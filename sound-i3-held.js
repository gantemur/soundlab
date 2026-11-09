/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * I3: two simplified pipe-organ flue stops and two free-reed registrations.
 * Harmonic/attack surrogates, not sampled stops, measured reed banks, or
 * pressure/jet/reed-plate feedback solvers. Native oscillators make long notes
 * and polyphony practical without generating multi-second audio buffers.
 */
(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  if (root) root.SoundLabI3Held = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const KINDS = Object.freeze(["organ-stopped", "organ-principal", "accordion", "bayan"]);
  const STOP_PAD = .025, MAX_PARTIALS = 12, MAX_MODE_HZ = 7500;
  // This is a *synthetic* reed bank: the fundamental stays pitch-correct at
  // these extra registers, but the modeled harmonics thin toward the top.
  // The familiar A2–G6 demonstration register remains the recommendation.
  const EXTENDED_REED_RANGE = Object.freeze([65.40639132514966, 3135.9634878539946]);
  const RECIPES = Object.freeze({
    "organ-stopped": Object.freeze({ range: [65.406, 1568], attack: .075, release: .16,
      soft: [1, .018, .36, .012, .14, .008, .06, .005, .025],
      bright: [1, .055, .43, .032, .20, .017, .11, .012, .055],
      chiff: .028, detune: [0], gain: .90 }),
    "organ-principal": Object.freeze({ range: [65.406, 1568], attack: .055, release: .13,
      soft: [1, .52, .30, .18, .12, .070, .044, .025, .016, .012],
      bright: [1, .68, .42, .30, .22, .14, .095, .062, .036, .024],
      chiff: .045, detune: [0], gain: .72 }),
    accordion: Object.freeze({ range: EXTENDED_REED_RANGE, attack: .085, release: .21,
      soft: [1, .46, .27, .17, .12, .08, .054, .038, .027],
      bright: [1, .64, .42, .32, .24, .16, .12, .085, .055],
      chiff: 0, detune: [-5.5, 5.5], gain: .60 }),
    bayan: Object.freeze({ range: EXTENDED_REED_RANGE, attack: .065, release: .17,
      soft: [1, .27, .26, .10, .08, .052, .030, .020],
      bright: [1, .40, .35, .18, .13, .085, .055, .037],
      chiff: 0, detune: [0], gain: .82 })
  });
  function recipe(kind) {
    if (!Object.hasOwn(RECIPES, kind)) throw new RangeError("Unknown organ or free-reed voice");
    return RECIPES[kind];
  }
  function validate(kind, hz, attack, release) {
    const r = recipe(kind);
    if (!Number.isFinite(hz) || hz < 20 || hz > 5000 ||
        !Number.isFinite(attack) || attack < .02 || attack > .6 ||
        !Number.isFinite(release) || release < .04 || release > 1.2) {
      throw new RangeError("Held pitch or articulation outside instrument range");
    }
  }
  function defaults(kind) {
    const r = recipe(kind);
    return { attack: r.attack, release: r.release, strength: 60 };
  }
  function rangeFor(kind) { return [...recipe(kind).range]; }
  function recommendedRangeFor(kind) {
    const range = rangeFor(kind);
    return kind === "accordion" || kind === "bayan" ? [110, 1568] : range;
  }
  function sliderToHz(position, kind) {
    const [a, b] = rangeFor(kind);
    return a * Math.pow(b / a, position / 1000);
  }
  function hzToSlider(hz, kind) {
    const [a, b] = rangeFor(kind);
    return 1000 * Math.log(hz / a) / Math.log(b / a);
  }
  function smoothstep(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }
  function weights(kind, strength = 60, hz = 440, sampleRate = 48000) {
    const r = recipe(kind);
    if (!Number.isFinite(strength) || strength < 0 || strength > 100 ||
        !Number.isFinite(hz) || hz < 20 || hz > 5000) {
      throw new RangeError("Invalid pipe or bellows pressure or frequency");
    }
    const bright = .12 + .75 * strength / 100;
    const pressure = Math.pow(strength / 100, .55);
    return Array.from({ length: Math.min(MAX_PARTIALS, Math.max(r.soft.length, r.bright.length)) }, (_, i) => {
      const harmonic = i + 1;
      if (harmonic * hz >= Math.min(MAX_MODE_HZ, sampleRate * .47)) return 0;
      return pressure * ((r.soft[i] || 0) * (1 - bright) + (r.bright[i] || 0) * bright) / 1.8;
    });
  }
  function partials(kind, strength = 60, hz = 440) { return weights(kind, strength, hz); }
  function waveAt(phase, kind, strength = 60, hz = 440) {
    if (!Number.isFinite(phase)) throw new RangeError("Invalid held phase");
    return weights(kind, strength, hz).reduce((sum, w, index) =>
      sum + w * Math.sin((index + 1) * phase), 0);
  }

  // A native harmonic source for each free-reed rank. The two accordion ranks
  // beat through real ±5.5-cent detuning; bayan is one almost dry rank.
  function createVoice(options = {}) {
    const { context, output, kind, hz, onended } = options;
    if (!context || !output) throw new TypeError("Instrument needs a context and output");
    const r = recipe(kind), at = options.at ?? context.currentTime;
    const attack = options.attack ?? r.attack, releaseDuration = options.release ?? r.release;
    const strength = options.strength ?? 60, level = options.level ?? 1;
    const age = options.offsetSeconds ?? 0, noteLength = options.noteDurationSeconds;
    validate(kind, hz, attack, releaseDuration);
    if (![at, age, context.currentTime, level, strength].every(Number.isFinite) ||
        at < 0 || age < 0 || level < 0 || level > 1 || strength < 0 || strength > 100 ||
        (noteLength !== undefined && (!Number.isFinite(noteLength) || noteLength < 0)) ||
        (onended !== undefined && typeof onended !== "function")) {
      throw new RangeError("Invalid held-voice timing, pressure or level");
    }
    const nodes = [], sources = [], pitched = [];
    let ended = false, releaseAt = noteLength === undefined ? Infinity : at + noteLength - age;
    let endAt = noteLength === undefined ? Infinity : releaseAt + releaseDuration + STOP_PAD;
    let manualOff = null, volume, envelope, voice;
    let currentHz = hz, currentStrength = strength, currentLevel = level;
    const add = node => { nodes.push(node); return node; };
    const source = osc => { sources.push(osc); return add(osc); };
    const rawLevel = elapsed => {
      const onset = smoothstep(elapsed / attack);
      const off = manualOff ? manualOff.age : noteLength;
      if (off === undefined || elapsed <= off) return onset;
      const atOff = manualOff ? manualOff.level : smoothstep(off / attack);
      return atOff * (1 - smoothstep((elapsed - off) / (manualOff?.duration ?? releaseDuration)));
    };
    const envelopeAt = when => when < at || when >= endAt ? 0 :
      Math.max(0, rawLevel(age + when - at));
    function finish(notify) {
      if (ended) return false;
      ended = true;
      for (const osc of sources) osc.onended = null;
      for (const osc of sources) try { osc.stop(context.currentTime); } catch (_) { /* Already stopped. */ }
      for (const node of nodes) try { node.disconnect(); } catch (_) { /* Continue cleanup. */ }
      if (notify && onended) onended(voice);
      return true;
    }
    function stop() {
      if (ended) return false;
      endAt = context.currentTime;
      try { volume.gain.cancelScheduledValues(endAt); volume.gain.setValueAtTime(0, endAt); } catch (_) { /* Unavailable. */ }
      return finish(true);
    }
    function release(when = context.currentTime, duration = releaseDuration) {
      if (!Number.isFinite(when) || when < 0 || !Number.isFinite(duration) ||
          duration < 0 || duration > 1.2) throw new RangeError("Invalid release");
      if (ended || when >= releaseAt) return false;
      if (when < at) return stop();
      const offAge = age + when - at, startLevel = rawLevel(offAge);
      envelope.gain.cancelScheduledValues(when);
      envelope.gain.setValueAtTime(startLevel, when);
      if (duration > 0) for (let i = 1; i <= 12; i++) {
        envelope.gain.linearRampToValueAtTime(startLevel * (1 - smoothstep(i / 12)), when + duration * i / 12);
      } else envelope.gain.setValueAtTime(0, when);
      manualOff = { age: offAge, level: startLevel, duration };
      releaseAt = when; endAt = when + duration + STOP_PAD;
      for (const osc of sources) try { osc.stop(endAt); } catch (_) { /* Already scheduled. */ }
      return true;
    }
    function update(changes = {}, when = context.currentTime) {
      if (ended || when >= endAt) return false;
      const nextHz = changes.hz ?? currentHz, nextStrength = changes.strength ?? currentStrength;
      const nextLevel = changes.level ?? currentLevel;
      validate(kind, nextHz, attack, releaseDuration);
      if (![nextStrength, nextLevel, when].every(Number.isFinite) || nextStrength < 0 ||
          nextStrength > 100 || nextLevel < 0 || nextLevel > 1) throw new RangeError("Invalid held update");
      const start = Math.max(when, at);
      const harmonics = weights(kind, nextStrength, nextHz, context.sampleRate);
      for (const entry of pitched) {
        entry.osc.frequency.setTargetAtTime(nextHz * entry.ratio, start, .017);
        if (nextStrength !== currentStrength || nextHz !== currentHz) {
          const real = new Float32Array(harmonics.length + 1);
          const imag = Float32Array.from([0, ...harmonics]);
          entry.osc.setPeriodicWave(context.createPeriodicWave(real, imag, { disableNormalization: true }));
        }
      }
      if (changes.level !== undefined) volume.gain.setTargetAtTime(nextLevel, start, .018);
      currentHz = nextHz; currentStrength = nextStrength; currentLevel = nextLevel;
      return true;
    }
    try {
      envelope = add(context.createGain()); volume = add(context.createGain());
      volume.gain.setValueAtTime(level, at);
      const off = noteLength;
      envelope.gain.setValueAtTime(rawLevel(age), at);
      const marks = [0, .25, .5, .75, 1].map(f => attack * f);
      if (off !== undefined) marks.push(off, ...[.25, .5, .75, 1].map(f => off + releaseDuration * f));
      for (const elapsed of [...new Set(marks)].sort((a, b) => a - b)) {
        if (elapsed <= age) continue;
        envelope.gain.linearRampToValueAtTime(Math.max(0, rawLevel(elapsed)), at + elapsed - age);
      }
      // Two profiles per rank permit pressure to affect spectral colour without
      // changing pitch; each harmonic is limited by Nyquist at note creation.
      const mixed = weights(kind, strength, hz, context.sampleRate);
      for (const cents of r.detune) {
        const ratio = Math.pow(2, cents / 1200), rankGain = r.gain / r.detune.length;
        const osc = source(context.createOscillator());
        const real = new Float32Array(mixed.length + 1), imag = new Float32Array(mixed.length + 1);
        mixed.forEach((weight, i) => { imag[i + 1] = weight; });
        osc.setPeriodicWave(context.createPeriodicWave(real, imag, { disableNormalization: true }));
        osc.frequency.setValueAtTime(hz * ratio, at);
        const amp = add(context.createGain()); amp.gain.setValueAtTime(rankGain, at);
        osc.connect(amp); amp.connect(envelope);
        // Retimbre by changing the PeriodicWave on updates; preserve the rank.
        pitched.push({ osc, gain: amp, ratio });
      }
      if (r.chiff && age < .07) {
        const tick = source(context.createOscillator());
        tick.type = "sine"; tick.frequency.setValueAtTime(hz * 6, at);
        const chirp = add(context.createGain());
        chirp.gain.setValueAtTime(r.chiff * (1 - age / .07), at);
        chirp.gain.linearRampToValueAtTime(0, at + Math.max(.001, .07 - age));
        tick.connect(chirp); chirp.connect(envelope);
      }
      envelope.connect(volume); volume.connect(output);
      voice = { kind, oscillator: pitched[0].osc, volume, envelope, sources, nodes,
        stop, release, update, envelopeAt, attack, releaseDuration, offsetSeconds: age,
        get ended() { return ended; }, get stopping() { return releaseAt !== Infinity; },
        get endTime() { return endAt; } };
      pitched[0].osc.onended = () => finish(true);
      for (const osc of sources) {
        osc.start(at);
        if (Number.isFinite(endAt)) osc.stop(Math.max(at + .001, endAt));
        else if (osc !== pitched[0].osc && !pitched.some(entry => entry.osc === osc)) osc.stop(at + .071);
      }
      return voice;
    } catch (error) { finish(false); throw error; }
  }
  return Object.freeze({ KINDS, STOP_PAD, MAX_PARTIALS, defaults, rangeFor, recommendedRangeFor, validate,
    sliderToHz, hzToSlider, partials, waveAt, createVoice });
});
