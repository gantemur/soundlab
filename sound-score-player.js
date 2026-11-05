/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * Audio-clock score scheduler; uses the Sound Lab's existing sound models/bus.
 */
(function (root, factory) {
  const scoreModel = typeof module === "object" && module.exports ?
    require("./sound-score.js") : root.SoundLabScore;
  const fmModel = typeof module === "object" && module.exports ?
    require("./sound-fm.js") : root.SoundLabFM;
  const api = factory(scoreModel, fmModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabScorePlayer = api;
})(typeof window !== "undefined" ? window : null, function (scoreModel, fmModel) {
  "use strict";

  const WAVEFORMS = Object.freeze(["sine", "triangle", "square", "sawtooth"]);
  const INSTRUMENTS = Object.freeze(["flute", "violin", "morin", "guitar", "piano", "chimes",
    ...WAVEFORMS, "fmep"]);
  const AHEAD_SECONDS = .23;
  const TICK_MS = 35;

  function noteFrequency(event, tuning, temperamentModel) {
    return scoreModel.frequency(event.pitch, tuning, 440, temperamentModel);
  }

  function scheduledEvents(score, fromBeat = 0) {
    scoreModel.validate(score);
    if (!Number.isFinite(fromBeat) || fromBeat < 0 || fromBeat > score.totalBeats) {
      throw new RangeError("Invalid score offset");
    }
    const notes = [];
    for (const event of score.parts[0].events) {
      if (event.type === "rest") continue;
      if (event.tieFromPrevious) {
        notes[notes.length - 1].durationBeats += event.durationBeats;
      } else {
        const { tieFromPrevious, tieToNext, ...note } = event;
        notes.push({ ...note, pitch: { ...event.pitch } });
      }
    }
    // Keep the complete attack time when resuming inside a chain. The player
    // clips its remaining duration and seeks percussive buffers from that time.
    return notes.filter(event => event.startBeat + event.durationBeats > fromBeat);
  }

  class Player {
    constructor({ contextOwner, transientModel, sustainModel, temperamentModel, onUpdate } = {}) {
      if (!contextOwner || !transientModel || !sustainModel) {
        throw new Error("Sound Lab audio models unavailable");
      }
      this.contextOwner = contextOwner;
      this.transientModel = transientModel;
      this.sustainModel = sustainModel;
      this.temperamentModel = temperamentModel;
      this.onUpdate = typeof onUpdate === "function" ? onUpdate : () => {};
      this.context = null;
      this.voices = new Set();
      this.buffers = new Map();
      this.score = null;
      this.playEvents = [];
      this.instrument = "flute";
      this.tuning = "equal";
      this.volume = 38;
      this.status = "stopped";
      this.positionBeat = 0;
      this.originBeat = 0;
      this.nextIndex = 0;
      this.baseTime = 0;
      this.generation = 0;
      this.interval = null;
    }

    configure({ score, instrument = this.instrument, tuning = this.tuning,
      volume = this.volume }) {
      scoreModel.validate(score);
      if (!INSTRUMENTS.includes(instrument) || !scoreModel.TUNINGS.includes(tuning) ||
          !Number.isFinite(volume) || volume < 0 || volume > 100) {
        throw new RangeError("Invalid score instrument, tuning or volume");
      }
      // Validate every note before starting AudioContext, rather than silently
      // transposing notes outside the working range of the instrument models.
      for (const event of score.parts[0].events) {
        if (event.type === "rest") continue;
        const hz = noteFrequency(event, tuning, this.temperamentModel);
        const upper = instrument === "chimes" ? 1200 : scoreModel.MAX_NOTE_HZ;
        if (hz < scoreModel.MIN_NOTE_HZ || hz > upper) {
          throw new RangeError(scoreModel.pitchName(event.pitch) + " (" + hz.toFixed(1) +
            " Hz) is outside the " + instrument + " range (110–" + upper + " Hz)");
        }
      }
      this.stop();
      this.score = score;
      this.playEvents = scheduledEvents(score);
      this.instrument = instrument;
      this.tuning = tuning;
      this.volume = volume;
    }

    get currentBeat() {
      if (this.status !== "playing" || !this.context) return this.positionBeat;
      const seconds = Math.max(0, this.context.currentTime - this.baseTime);
      return Math.min(this.score.totalBeats, this.originBeat +
        seconds / scoreModel.secondsPerBeat(this.score));
    }

    inform() { this.onUpdate({ status: this.status, beat: this.currentBeat }); }

    stopVoices() {
      const now = this.context ? this.context.currentTime : 0;
      for (const voice of this.voices) {
        // Disconnect synchronously: a browser may reject stop() for an
        // already-ended or future-scheduled source. The gain must still go
        // silent immediately, including in Safari's delayed onended case.
        try {
          voice.gain.gain.cancelScheduledValues(now);
          voice.gain.gain.setValueAtTime(0, now);
        } catch (_) { /* AudioParam may already have been disconnected. */ }
        try { voice.gain.disconnect(); } catch (_) { /* Already disconnected. */ }
        try { voice.source.stop(now + .002); } catch (_) { /* Already stopped. */ }
      }
      this.voices.clear();
    }

    stop(reset = true) {
      this.generation++;
      if (this.interval !== null) clearInterval(this.interval);
      this.interval = null;
      this.stopVoices();
      if (reset) this.positionBeat = 0;
      this.status = "stopped";
      this.inform();
    }

    pause() {
      if (this.status !== "playing" && this.status !== "starting") return;
      if (this.status === "playing") this.positionBeat = this.currentBeat;
      this.generation++;
      if (this.interval !== null) clearInterval(this.interval);
      this.interval = null;
      this.stopVoices();
      this.status = "paused";
      this.inform();
    }

    async play() {
      if (this.status === "playing") { this.pause(); return true; }
      if (this.status === "starting") return false;
      if (!this.score) throw new Error("No score loaded");
      if (this.positionBeat >= this.score.totalBeats) this.positionBeat = 0;
      const ticket = ++this.generation;
      this.status = "starting";
      this.inform();
      try {
        const context = await this.contextOwner.readyContext();
        if (ticket !== this.generation) return false;
        this.context = context;
        this.originBeat = this.positionBeat;
        this.baseTime = context.currentTime + .08;
        this.nextIndex = this.playEvents.findIndex(event =>
          event.startBeat + event.durationBeats > this.originBeat);
        if (this.nextIndex < 0) this.nextIndex = this.playEvents.length;
        this.status = "playing";
        this.tick();
        this.interval = setInterval(() => this.tick(), TICK_MS);
        this.inform();
        return true;
      } catch (error) {
        if (ticket === this.generation) this.stop(false);
        throw error;
      }
    }

    tick() {
      if (this.status !== "playing" || !this.context) return;
      const now = this.context.currentTime;
      const spb = scoreModel.secondsPerBeat(this.score);
      const aheadBeat = this.originBeat + (now + AHEAD_SECONDS - this.baseTime) / spb;
      const events = this.playEvents;
      while (this.nextIndex < events.length && events[this.nextIndex].startBeat < aheadBeat) {
        const event = events[this.nextIndex++];
        const clippedBeat = Math.max(this.originBeat, event.startBeat);
        const at = this.baseTime + (clippedBeat - this.originBeat) * spb;
        const endsAt = this.baseTime + (event.startBeat + event.durationBeats - this.originBeat) * spb;
        if (endsAt <= now) continue;
        const offsetSeconds = (clippedBeat - event.startBeat) * spb;
        this.scheduleNote(event, Math.max(at, now + .003), endsAt, offsetSeconds);
      }
      const endTime = this.baseTime + (this.score.totalBeats - this.originBeat) * spb;
      const tail = ["guitar", "chimes"].includes(this.instrument) ? .8 : .15;
      if (now > endTime + tail) {
        this.stop();
        return;
      }
      this.inform();
    }

    addVoice(source, gain) {
      const voice = { source, gain };
      this.voices.add(voice);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
      };
    }

    toneComponents(hz) {
      return this.instrument === "flute" ? this.sustainModel.fluteComponents(60, hz,
        this.context.sampleRate) : this.sustainModel.bowedComponents(this.instrument, 60, hz,
        this.context.sampleRate);
    }

    scheduleNote(event, at, endsAt, offsetSeconds = 0) {
      const hz = noteFrequency(event, this.tuning, this.temperamentModel);
      const context = this.context;
      const gain = context.createGain();
      const level = .19 * this.volume / 100;
      gain.connect(this.contextOwner.output);
      if (["flute", "violin", "morin", ...WAVEFORMS].includes(this.instrument)) {
        const oscillator = context.createOscillator();
        if (WAVEFORMS.includes(this.instrument)) {
          // Native oscillator shapes are band-limited by the browser.
          oscillator.type = this.instrument;
        } else {
          const components = this.toneComponents(hz);
          const real = new Float32Array(components.length + 1);
          const imag = new Float32Array(components.length + 1);
          components.forEach((component, i) => { real[i + 1] = component.cos; imag[i + 1] = component.sin; });
          const wave = context.createPeriodicWave(real, imag, { disableNormalization: true });
          oscillator.setPeriodicWave(wave);
        }
        oscillator.frequency.setValueAtTime(hz, at);
        oscillator.connect(gain);
        const remaining = Math.max(.015, endsAt - at);
        const attack = Math.min(.045, remaining * .25);
        const release = Math.min(.10, remaining * .35);
        // Square and sawtooth carry strong upper harmonics; ease their level.
        const adjustedLevel = level * (this.instrument === "square" || this.instrument === "sawtooth" ? .72 : 1);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(adjustedLevel, at + attack);
        gain.gain.setValueAtTime(adjustedLevel, Math.max(at + attack, endsAt - release));
        gain.gain.linearRampToValueAtTime(0, endsAt);
        this.addVoice(oscillator, gain);
        oscillator.start(at);
        oscillator.stop(endsAt + .005);
        return;
      }
      const percussive = this.instrument === "chimes";
      const kind = this.instrument === "guitar" ? "pluck" : percussive ? "kick" :
        this.instrument === "fmep" ? "fmep" : "piano";
      const decay = this.instrument === "piano" || this.instrument === "fmep" ? .8 :
        percussive ? .7 : .65;
      const options = this.instrument === "guitar" ? { position: .22 } :
        this.instrument === "piano" ? { velocity: .62, touch: "press" } :
          percussive ? { drumVoice: "chimes", chimeHz: hz } : {};
      const key = [context.sampleRate, kind, hz.toFixed(5), decay, this.instrument].join("|");
      let buffer = this.buffers.get(key);
      if (!buffer) {
        const samples = this.instrument === "fmep" ?
          fmModel.makeElectricPianoSamples(hz, context.sampleRate) :
          this.transientModel.makeSamples(kind, hz, decay, context.sampleRate, "medium", options);
        buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.getChannelData(0).set(samples);
        if (this.buffers.size >= 24) this.buffers.delete(this.buffers.keys().next().value);
        this.buffers.set(key, buffer);
      }
      if (offsetSeconds >= buffer.duration - .01) { gain.disconnect(); return; }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      gain.gain.setValueAtTime(level, at);
      if (this.instrument === "piano" || this.instrument === "fmep") {
        const noteEnd = Math.max(at + .005, endsAt);
        gain.gain.setValueAtTime(level, noteEnd);
        gain.gain.setTargetAtTime(0, noteEnd, .028); // damper returns on release
      }
      this.addVoice(source, gain);
      source.start(at, offsetSeconds);
      if (this.instrument === "piano" || this.instrument === "fmep") source.stop(Math.min(at + buffer.duration - offsetSeconds,
        endsAt + .19));
    }
  }

  return Object.freeze({ INSTRUMENTS, AHEAD_SECONDS, noteFrequency, scheduledEvents, Player });
});
