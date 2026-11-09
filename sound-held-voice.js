/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Shared native Web Audio voices for the held-instrument explorer and scores.
 *
 * These are illustrative source/filter models, not complete physical solvers.
 * Each host shares the nonlinear flute jet, bounded reed-inspired clarinet
 * voice, phase-locked bowed sources, body filters and quiet noise.
 * One intentional timbre correction converts the model's linear LP/HP Q to
 * native Web Audio dB units, removing the old unintended filter resonance so
 * the plotted and sounding tone-filter responses agree. Peaking Q is linear.
 * Seeking resumes envelope age and noise-loop position; native oscillator and
 * filter state restart, so a resumed note is not a bit-exact continuation.
 */
(function (root, makeAPI) {
  "use strict";
  const model = typeof module === "object" && module.exports ?
    require("./sound-sustain.js") : root.SoundLabSustain;
  const api = makeAPI(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabHeldVoice = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (defaultModel) {
  "use strict";

  if (!defaultModel) throw new Error("Load sound-sustain.js before sound-held-voice.js");
  const STOP_PAD = .025;
  const NOISE_SECONDS = 1;
  const RESUME_FADE = .004;
  const RAMP_STEPS = 12;
  const noiseBuffers = new WeakMap();

  function range(value, minimum, maximum, name) {
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new RangeError(name + " must be between " + minimum + " and " + maximum);
    }
    return value;
  }
  function timeValue(value, name) {
    return range(value, 0, Number.MAX_VALUE, name);
  }
  function defaults(kind, model = defaultModel) {
    const recipe = model.defaults(kind);
    return Object.freeze({ attack: recipe.attack, release: recipe.release,
      strength: kind === "flute" || kind === "clarinet" ?
        model.DEFAULT_BREATH : model.DEFAULT_BOW_PRESSURE });
  }
  function bufferFrames(sampleRate) {
    // The model's filter-response contract starts at 16 kHz. This finite upper
    // bound also avoids accidental oversized allocations in a malformed host.
    range(sampleRate, 16000, 384000, "Held-voice sample rate");
    return Math.ceil(sampleRate * NOISE_SECONDS);
  }
  function noiseBuffer(context) {
    let buffer = noiseBuffers.get(context);
    if (buffer) return buffer;
    const count = bufferFrames(context.sampleRate);
    buffer = context.createBuffer(1, count, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 0x518c3f27;
    for (let i = 0; i < count; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = (seed / 0x80000000 - 1) * .7;
    }
    noiseBuffers.set(context, buffer);
    return buffer;
  }
  // Removing the cache is safe while voices exist: sources retain their own
  // buffer reference. Offline hosts may drop the cache after rendering.
  function clearNoiseBuffer(context) { return noiseBuffers.delete(context); }

  function interpolate(points, time) {
    if (time < points[0].time) return points[0].level;
    for (let i = 1; i < points.length; i++) {
      const right = points[i], left = points[i - 1];
      if (time < right.time) {
        const fraction = (time - left.time) / (right.time - left.time);
        return left.level + fraction * (right.level - left.level);
      }
    }
    return points[points.length - 1].level;
  }

  function createVoice(options = {}) {
    const { context, output, kind, hz, onended } = options;
    const model = options.model || defaultModel;
    if (!context || !output) throw new TypeError("Held voice needs a context and output");
    const recipe = defaults(kind, model);
    const at = options.at === undefined ? context.currentTime : options.at;
    const attack = options.attack === undefined ? recipe.attack : options.attack;
    const releaseDuration = options.release === undefined ? recipe.release : options.release;
    const strength = options.strength === undefined ? recipe.strength : options.strength;
    const level = options.level === undefined ? 1 : options.level;
    const offsetSeconds = options.offsetSeconds === undefined ? 0 : options.offsetSeconds;
    const noteDurationSeconds = options.noteDurationSeconds;
    // In Web Audio only lowpass/highpass use dB for Q. The analytic model uses
    // the usual linear RBJ Q. Peaking filters below keep their unconverted Q.
    const filterQDb = 20 * Math.log10(model.FLUTE_Q);
    model.validate(kind, hz, attack, releaseDuration);
    range(strength, 0, 100, "Held strength");
    range(level, 0, 1, "Held output level");
    timeValue(context.currentTime, "Audio clock");
    timeValue(at, "Voice start time");
    timeValue(offsetSeconds, "Note age");
    if (noteDurationSeconds !== undefined) timeValue(noteDurationSeconds, "Written note duration");
    bufferFrames(context.sampleRate);
    if (onended !== undefined && typeof onended !== "function") {
      throw new TypeError("Held onended must be a function");
    }
    const factories = ["createOscillator", "createGain", "createBiquadFilter",
      "createBuffer", "createBufferSource", kind === "flute" ? "createWaveShaper" : "createPeriodicWave"];
    for (const factory of factories) {
      if (typeof context[factory] !== "function") throw new TypeError("Missing Web Audio " + factory);
    }

    const nodes = [], sources = [];
    let voice, oscillator, noise, noiseGain, filter, envelope, volume;
    let fluteNodes = null, clarinetNodes = null, bowNodes = null, resumeGain = null;
    let ended = false, stopping = false, endTime = Infinity, releaseTime = Infinity;
    const values = { hz, strength, level };
    const originalAttack = Array.from({ length: RAMP_STEPS + 1 }, (_, i) =>
      ({ time: attack * i / RAMP_STEPS, level: model.smoothstep(i / RAMP_STEPS) }));
    let originalEnvelope = originalAttack;
    if (noteDurationSeconds !== undefined) {
      // Scores know the original note-off. Build that whole timeline before
      // seeking so Pause/Resume can restore even a partially elapsed release,
      // including the lower release-start level of a note shorter than attack.
      const offLevel = interpolate(originalAttack, noteDurationSeconds);
      originalEnvelope = [...originalAttack.filter(point => point.time < noteDurationSeconds),
        { time: noteDurationSeconds, level: offLevel },
        ...Array.from({ length: RAMP_STEPS }, (_, i) => ({
          time: noteDurationSeconds + releaseDuration * (i + 1) / RAMP_STEPS,
          level: offLevel * (1 - model.smoothstep((i + 1) / RAMP_STEPS))
        }))];
      releaseTime = at + noteDurationSeconds - offsetSeconds;
      endTime = at + Math.max(0, noteDurationSeconds + releaseDuration + STOP_PAD - offsetSeconds);
      stopping = true;
    }
    let points = [{ time: at, level: interpolate(originalEnvelope, offsetSeconds) },
      ...originalEnvelope.filter(point => point.time > offsetSeconds).map(point =>
        ({ time: at + point.time - offsetSeconds, level: point.level }))];
    const addNode = node => { nodes.push(node); return node; };
    const addSource = source => { addNode(source); sources.push(source); return source; };
    function stopSources(when) {
      for (const source of sources) {
        try { source.stop(when); } catch (_) { /* Ended or partially constructed source. */ }
      }
    }
    function finish(notify) {
      if (ended) return false;
      ended = true;
      stopping = true;
      endTime = Math.min(endTime, context.currentTime);
      // Clear callbacks first: a host may deliver onended during stop().
      for (const source of sources) source.onended = null;
      stopSources(context.currentTime);
      for (const node of nodes) {
        try { node.disconnect(); } catch (_) { /* Cleanup must reach every node. */ }
      }
      if (notify && onended) onended(voice);
      return true;
    }
    function envelopeAt(time) {
      timeValue(time, "Envelope time");
      if (time < at || time >= endTime) return 0;
      return interpolate(points, time);
    }
    function stop() {
      if (ended) return false;
      endTime = context.currentTime;
      // Disconnect synchronously even when a browser postpones onended or an
      // already-scheduled stop throws. A future note can never sound afterward.
      for (const node of [envelope, volume, resumeGain]) {
        if (!node) continue;
        try { node.gain.cancelScheduledValues(context.currentTime); } catch (_) { /* Continue. */ }
        try { node.gain.setValueAtTime(0, context.currentTime); } catch (_) { /* Disconnect below. */ }
      }
      return finish(true);
    }
    function release(when = context.currentTime, duration = releaseDuration) {
      timeValue(when, "Note-off time");
      range(duration, 0, model.MAX_RELEASE, "Release duration");
      if (ended || when >= releaseTime) return false;
      if (when < at) return stop(); // Cancel a note that has not begun.
      const startLevel = envelopeAt(when);
      const prefix = points.filter(point => point.time < when);
      envelope.gain.cancelScheduledValues(when);
      // A ramp endpoint, rather than setValueAtTime, preserves the unfinished
      // attack segment when a short note's future note-off is scheduled now.
      if (when > at) envelope.gain.linearRampToValueAtTime(startLevel, when);
      else envelope.gain.setValueAtTime(startLevel, when);
      points = [...prefix, { time: when, level: startLevel }];
      if (duration === 0) {
        envelope.gain.setValueAtTime(0, when);
        points.push({ time: when, level: 0 });
      } else {
        for (let i = 1; i <= RAMP_STEPS; i++) {
          const point = { time: when + duration * i / RAMP_STEPS,
            level: startLevel * (1 - model.smoothstep(i / RAMP_STEPS)) };
          envelope.gain.linearRampToValueAtTime(point.level, point.time);
          points.push(point);
        }
      }
      releaseTime = when;
      endTime = when + duration + STOP_PAD;
      stopping = true;
      stopSources(endTime);
      return true;
    }
    function update(changes = {}, when = context.currentTime) {
      timeValue(when, "Update time");
      const next = { ...values, ...changes };
      model.validate(kind, next.hz, attack, releaseDuration);
      range(next.strength, 0, 100, "Held strength");
      range(next.level, 0, 1, "Held output level");
      if (ended || when >= endTime) return false;
      const time = Math.max(at, when);
      if (changes.hz !== undefined) {
        oscillator.frequency.setTargetAtTime(next.hz, time, .018);
        if (bowNodes) bowNodes.sharpOscillator.frequency.setTargetAtTime(next.hz, time, .018);
        if (clarinetNodes) clarinetNodes.brightOscillator.frequency.setTargetAtTime(next.hz, time, .018);
      }
      if (changes.level !== undefined) volume.gain.setTargetAtTime(next.level, time, .015);
      if (changes.strength !== undefined) {
        if (fluteNodes) {
          fluteNodes.drive.gain.setTargetAtTime(model.fluteDrive(next.strength), time, .025);
          noiseGain.gain.setTargetAtTime(model.fluteNoiseGain(next.strength), time, .025);
        } else if (clarinetNodes) {
          const weights = model.clarinet.strengthWeights(next.strength);
          clarinetNodes.softGain.gain.setTargetAtTime(weights.soft, time, .025);
          clarinetNodes.brightGain.gain.setTargetAtTime(weights.bright, time, .025);
          noiseGain.gain.setTargetAtTime(model.clarinet.noiseGain(next.strength), time, .025);
        } else {
          const weights = model.bowPressureWeights(next.strength);
          bowNodes.softGain.gain.setTargetAtTime(weights.soft, time, .025);
          bowNodes.hardGain.gain.setTargetAtTime(weights.hard, time, .025);
          noiseGain.gain.setTargetAtTime(model.bowNoiseGain(kind, next.strength), time, .025);
        }
      }
      Object.assign(values, next);
      return true;
    }

    try {
      oscillator = addSource(context.createOscillator());
      oscillator.frequency.setValueAtTime(hz, at);
      if (kind === "flute") {
        const drive = addNode(context.createGain());
        drive.gain.setValueAtTime(model.fluteDrive(strength), at);
        const shaper = addNode(context.createWaveShaper());
        shaper.curve = Float32Array.from({ length: 2049 }, (_, i) => model.fluteJetAt(2 * i / 2048 - 1));
        shaper.oversample = "4x";
        const highpass = addNode(context.createBiquadFilter());
        highpass.type = "highpass";
        highpass.frequency.setValueAtTime(model.FLUTE_HIGHPASS, at);
        highpass.Q.setValueAtTime(filterQDb, at);
        const lowpass = addNode(context.createBiquadFilter());
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(model.FLUTE_LOWPASS, at);
        lowpass.Q.setValueAtTime(filterQDb, at);
        const toneGain = addNode(context.createGain());
        toneGain.gain.setValueAtTime(model.FLUTE_TONE_GAIN, at);
        oscillator.type = "sine";
        oscillator.connect(drive); drive.connect(shaper); shaper.connect(highpass);
        highpass.connect(lowpass); lowpass.connect(toneGain);
        fluteNodes = { drive, shaper, highpass, lowpass, toneGain };
      } else if (kind === "clarinet") {
        const reed = model.clarinet;
        const makeWave = profile => {
          const components = reed.SOURCES[profile];
          return context.createPeriodicWave(new Float32Array([0, ...components.map(c => c.cos)]),
            new Float32Array([0, ...components.map(c => c.sin)]), { disableNormalization: true });
        };
        oscillator.setPeriodicWave(makeWave("soft"));
        const brightOscillator = addSource(context.createOscillator());
        brightOscillator.setPeriodicWave(makeWave("bright"));
        brightOscillator.frequency.setValueAtTime(hz, at);
        const weights = reed.strengthWeights(strength);
        const softGain = addNode(context.createGain());
        const brightGain = addNode(context.createGain());
        softGain.gain.setValueAtTime(weights.soft, at);
        brightGain.gain.setValueAtTime(weights.bright * reed.brightOnset(offsetSeconds), at);
        if (offsetSeconds < reed.TONGUE_SECONDS) {
          for (let i = 1; i <= RAMP_STEPS; i++) {
            const age = offsetSeconds + (reed.TONGUE_SECONDS - offsetSeconds) * i / RAMP_STEPS;
            brightGain.gain.linearRampToValueAtTime(weights.bright * reed.brightOnset(age),
              at + age - offsetSeconds);
          }
        }
        const highpass = addNode(context.createBiquadFilter());
        highpass.type = "highpass";
        highpass.frequency.setValueAtTime(reed.BODY.highpass, at);
        highpass.Q.setValueAtTime(filterQDb, at);
        const peak = addNode(context.createBiquadFilter());
        peak.type = "peaking";
        peak.frequency.setValueAtTime(reed.BODY.peak, at);
        peak.Q.setValueAtTime(reed.BODY.peakQ, at);
        peak.gain.setValueAtTime(reed.BODY.peakGain, at);
        const lowpass = addNode(context.createBiquadFilter());
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(reed.BODY.lowpass, at);
        lowpass.Q.setValueAtTime(filterQDb, at);
        oscillator.connect(softGain); brightOscillator.connect(brightGain);
        softGain.connect(highpass); brightGain.connect(highpass);
        highpass.connect(peak); peak.connect(lowpass);
        clarinetNodes = { brightOscillator, softGain, brightGain, highpass, peak, lowpass };
      } else {
        const makeWave = edge => {
          const components = model.bowSourceComponents(kind, edge);
          return context.createPeriodicWave(new Float32Array([0, ...components.map(c => c.cos)]),
            new Float32Array([0, ...components.map(c => c.sin)]), { disableNormalization: true });
        };
        oscillator.setPeriodicWave(makeWave("soft"));
        const sharpOscillator = addSource(context.createOscillator());
        sharpOscillator.setPeriodicWave(makeWave("hard"));
        sharpOscillator.frequency.setValueAtTime(hz, at);
        const weights = model.bowPressureWeights(strength);
        const softGain = addNode(context.createGain()), hardGain = addNode(context.createGain());
        softGain.gain.setValueAtTime(weights.soft, at);
        hardGain.gain.setValueAtTime(weights.hard, at);
        const body = model.bowBody(kind);
        const peaks = body.peaks.map(peak => {
          const node = addNode(context.createBiquadFilter());
          node.type = "peaking";
          node.frequency.setValueAtTime(peak.frequency, at);
          node.Q.setValueAtTime(peak.q, at); node.gain.setValueAtTime(peak.gain, at);
          return node;
        });
        const lowpass = addNode(context.createBiquadFilter());
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(body.cutoff, at);
        lowpass.Q.setValueAtTime(filterQDb, at);
        oscillator.connect(softGain); sharpOscillator.connect(hardGain);
        softGain.connect(peaks[0]); hardGain.connect(peaks[0]);
        for (let i = 1; i < peaks.length; i++) peaks[i - 1].connect(peaks[i]);
        peaks[peaks.length - 1].connect(lowpass);
        bowNodes = { sharpOscillator, softGain, hardGain, peaks, lowpass };
      }

      envelope = addNode(context.createGain());
      volume = addNode(context.createGain());
      volume.gain.setValueAtTime(level, at);
      envelope.gain.setValueAtTime(points[0].level, at);
      for (const point of points.slice(1)) envelope.gain.linearRampToValueAtTime(point.level, point.time);
      (fluteNodes ? fluteNodes.toneGain :
        clarinetNodes ? clarinetNodes.lowpass : bowNodes.lowpass).connect(envelope);
      noise = addSource(context.createBufferSource());
      noise.buffer = noiseBuffer(context);
      noise.loop = true;
      filter = addNode(context.createBiquadFilter());
      filter.type = clarinetNodes ? "bandpass" : "lowpass";
      filter.frequency.setValueAtTime(model.defaults(kind).cutoff, at);
      filter.Q.setValueAtTime(1, at); // The old explorer used the native default Q.
      noiseGain = addNode(context.createGain());
      const baseNoise = fluteNodes ? model.fluteNoiseGain(strength) :
        clarinetNodes ? model.clarinet.noiseGain(strength) : model.bowNoiseGain(kind, strength);
      noiseGain.gain.setValueAtTime(baseNoise * (clarinetNodes ?
        model.clarinet.noiseOnset(offsetSeconds) : 1), at);
      if (clarinetNodes && offsetSeconds < model.clarinet.NOISE_SECONDS) {
        for (let i = 1; i <= RAMP_STEPS; i++) {
          const age = offsetSeconds +
            (model.clarinet.NOISE_SECONDS - offsetSeconds) * i / RAMP_STEPS;
          noiseGain.gain.linearRampToValueAtTime(baseNoise * model.clarinet.noiseOnset(age),
            at + age - offsetSeconds);
        }
      }
      noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(envelope);
      if (offsetSeconds > 0) {
        resumeGain = addNode(context.createGain());
        resumeGain.gain.setValueAtTime(0, at);
        resumeGain.gain.linearRampToValueAtTime(1, at + RESUME_FADE);
        envelope.connect(resumeGain); resumeGain.connect(volume);
      } else envelope.connect(volume);
      volume.connect(output);
      voice = { kind, oscillator, noise, noiseGain, filter, envelope, volume,
        fluteNodes, clarinetNodes, bowNodes, resumeGain, startedAt: at, attack,
        releaseDuration, offsetSeconds, noteDurationSeconds,
        nodes: Object.freeze(nodes), sources: Object.freeze(sources),
        update, release, stop, envelopeAt,
        get endTime() { return endTime; }, get stopping() { return stopping; },
        get ended() { return ended; } };
      oscillator.onended = () => finish(true);
      oscillator.start(at);
      if (bowNodes) bowNodes.sharpOscillator.start(at);
      if (clarinetNodes) clarinetNodes.brightOscillator.start(at);
      noise.start(at, offsetSeconds % NOISE_SECONDS);
      if (noteDurationSeconds !== undefined) stopSources(endTime);
      return voice;
    } catch (error) {
      finish(false);
      throw error;
    }
  }

  return Object.freeze({ createVoice, defaults, bufferFrames, clearNoiseBuffer,
    rangeFor: defaultModel.rangeFor, recommendedRangeFor: defaultModel.recommendedRangeFor,
    STOP_PAD, NOISE_SECONDS, RESUME_FADE, KINDS: defaultModel.KINDS,
    MIN_HZ: defaultModel.MIN_HZ, MAX_HZ: defaultModel.MAX_HZ });
});
