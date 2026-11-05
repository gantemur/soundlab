/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * Audio-clock score scheduler; uses the Sound Lab's existing sound models/bus.
 */
(function (root, factory) {
  const scoreModel = typeof module === "object" && module.exports ?
    require("./sound-score.js") : root.SoundLabScore;
  const fmModel = typeof module === "object" && module.exports ?
    require("./sound-fm.js") : root.SoundLabFM;
  const drumModel = typeof module === "object" && module.exports ?
    require("./sound-drum-abc.js") : root.SoundLabDrumABC;
  const api = factory(scoreModel, fmModel, drumModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabScorePlayer = api;
})(typeof window !== "undefined" ? window : null, function (scoreModel, fmModel, drumModel) {
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
      if (event.type === "chord") {
        // One notated chord is one rhythmic event, but each pitch needs its
        // own sounding voice. Keep their common attack and release times.
        for (const pitch of event.pitches) {
          const { pitches, ...notated } = event;
          notes.push({ ...notated, type: "note", pitch: { ...pitch }, chordSize: pitches.length });
        }
        continue;
      }
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
      this.outputBus = null;
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
      const soundingEvents = scheduledEvents(score);
      for (const event of soundingEvents) {
        const hz = noteFrequency(event, tuning, this.temperamentModel);
        const lower = instrument === "piano" ? 27.5 : scoreModel.MIN_NOTE_HZ;
        const upper = instrument === "piano" ? 1760 : instrument === "chimes" ? 1200 : scoreModel.MAX_NOTE_HZ;
        if (hz < lower || hz > upper) {
          throw new RangeError(scoreModel.pitchName(event.pitch) + " (" + hz.toFixed(1) +
            " Hz) is outside the " + instrument + " range (" + lower + "–" + upper + " Hz)");
        }
      }
      this.stop();
      this.score = score;
      this.playEvents = soundingEvents;
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
      // Independently mute the whole score before touching individual voices.
      // Safari can leave a scheduled BufferSource audible for a short interval
      // even after stop(), so Pause must not rely on that call alone.
      if (this.outputBus) {
        try {
          this.outputBus.gain.cancelScheduledValues(now);
          this.outputBus.gain.setValueAtTime(0, now);
        } catch (_) { /* Also disconnect below on Stop. */ }
      }
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
      if (this.outputBus) {
        try { this.outputBus.disconnect(); } catch (_) { /* Already disconnected. */ }
        this.outputBus = null;
      }
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
        this.preparePlayback(context);
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
      const tail = ["guitar", "chimes", "ensemble"].includes(this.instrument) ? .8 : .15;
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

    preparePlayback(context) {
      if (!this.outputBus) {
        this.outputBus = context.createGain();
        this.outputBus.connect(this.contextOwner.output);
      }
      this.outputBus.gain.cancelScheduledValues(context.currentTime);
      this.outputBus.gain.setValueAtTime(1, context.currentTime);
    }

    toneComponents(hz, instrument = this.instrument) {
      return instrument === "flute" ? this.sustainModel.fluteComponents(60, hz,
        this.context.sampleRate) : this.sustainModel.bowedComponents(instrument, 60, hz,
        this.context.sampleRate);
    }

    scheduleNote(event, at, endsAt, offsetSeconds = 0, settings = null) {
      const hz = noteFrequency(event, this.tuning, this.temperamentModel);
      const context = this.context;
      const gain = context.createGain();
      const instrument = settings?.instrument || this.instrument;
      const volume = settings?.volume ?? this.volume;
      const level = Math.min(.35, .19 * volume / 100 * (instrument === "piano" ? 2.35 : 1)) /
        Math.sqrt(event.chordSize || 1);
      gain.connect(settings?.output || this.outputBus || this.contextOwner.output);
      if (["flute", "violin", "morin", ...WAVEFORMS].includes(instrument)) {
        const oscillator = context.createOscillator();
        if (WAVEFORMS.includes(instrument)) {
          // Native oscillator shapes are band-limited by the browser.
          oscillator.type = instrument;
        } else {
          const components = this.toneComponents(hz, instrument);
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
        const adjustedLevel = level * (instrument === "square" || instrument === "sawtooth" ? .72 : 1);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(adjustedLevel, at + attack);
        gain.gain.setValueAtTime(adjustedLevel, Math.max(at + attack, endsAt - release));
        gain.gain.linearRampToValueAtTime(0, endsAt);
        this.addVoice(oscillator, gain);
        oscillator.start(at);
        oscillator.stop(endsAt + .005);
        return;
      }
      const percussive = instrument === "chimes";
      const kind = instrument === "guitar" ? "pluck" : percussive ? "kick" :
        instrument === "fmep" ? "fmep" : "piano";
      const decay = instrument === "piano" || instrument === "fmep" ? .8 :
        percussive ? .7 : .65;
      const options = instrument === "guitar" ? { position: .22 } :
        instrument === "piano" ? { velocity: .62, touch: "press" } :
          percussive ? { drumVoice: "chimes", chimeHz: hz } : {};
      const key = [context.sampleRate, kind, hz.toFixed(5), decay, instrument].join("|");
      let buffer = this.buffers.get(key);
      if (!buffer) {
        const samples = instrument === "fmep" ?
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
      if (instrument === "piano" || instrument === "fmep") {
        const noteEnd = Math.max(at + .005, endsAt);
        gain.gain.setValueAtTime(level, noteEnd);
        gain.gain.setTargetAtTime(0, noteEnd, .028); // damper returns on release
      }
      this.addVoice(source, gain);
      source.start(at, offsetSeconds);
      if (instrument === "piano" || instrument === "fmep") source.stop(Math.min(at + buffer.duration - offsetSeconds,
        endsAt + .19));
    }
  }

  const MAX_PARTS = 4;
  const MAX_ENSEMBLE_EVENTS = 1024;
  function validateEnsemble(tracks, tuning = "equal", temperamentModel) {
    if (!Array.isArray(tracks) || tracks.length < 1 || tracks.length > MAX_PARTS ||
        !scoreModel.TUNINGS.includes(tuning)) throw new RangeError("Use 1–4 tracks and a supported tuning");
    const first = tracks[0]?.score;
    if (!first) throw new Error("Missing ABC score");
    let events = 0, totalBeats = 0;
    for (const track of tracks) {
      const { score, instrument, volume } = track;
      if (instrument === "drums") drumModel.validate(score);
      else scoreModel.validate(score);
      if (!(instrument === "drums" || INSTRUMENTS.includes(instrument)) ||
          !Number.isFinite(volume) || volume < 0 || volume > 100) {
        throw new RangeError("Invalid track instrument or volume");
      }
      if (score.tempoQuarter !== first.tempoQuarter ||
          score.meter.numerator !== first.meter.numerator ||
          score.meter.denominator !== first.meter.denominator) {
        throw new RangeError("All tracks must have the same M: and Q: tempo");
      }
      const soundingEvents = instrument === "drums" ? drumModel.scheduledEvents(score) : scheduledEvents(score);
      events += soundingEvents.length;
      totalBeats = Math.max(totalBeats, score.totalBeats);
      if (instrument === "drums") continue;
      for (const event of soundingEvents) {
        const hz = noteFrequency(event, tuning, temperamentModel);
        const lower = instrument === "piano" ? 27.5 : scoreModel.MIN_NOTE_HZ;
        const upper = instrument === "piano" ? 1760 : instrument === "chimes" ? 1200 : scoreModel.MAX_NOTE_HZ;
        if (hz < lower || hz > upper) {
          throw new RangeError(scoreModel.pitchName(event.pitch) + " is outside " + instrument +
            " range (" + lower + "–" + upper + " Hz)");
        }
      }
    }
    if (events > MAX_ENSEMBLE_EVENTS || totalBeats * scoreModel.secondsPerBeat(first) > 90) {
      throw new RangeError("Ensemble is limited to 1024 events and 90 seconds");
    }
    return { tempoQuarter: first.tempoQuarter, meter: first.meter, totalBeats, eventCount: events };
  }

  class EnsemblePlayer extends Player {
    constructor(options) {
      super(options);
      this.partSettings = [];
      this.buses = [];
      this.instrument = "ensemble";
    }
    configure({ tracks, tuning = "equal" }) {
      const summary = validateEnsemble(tracks, tuning, this.temperamentModel);
      this.stop();
      this.score = summary;
      this.tuning = tuning;
      this.instrument = "ensemble";
      this.partSettings = tracks.map(t => ({ id: t.id, instrument: t.instrument, volume: t.volume,
        mute: Boolean(t.mute), solo: Boolean(t.solo) }));
      this.playEvents = tracks.flatMap((t, partIndex) => (t.instrument === "drums" ?
        drumModel.scheduledEvents(t.score) : scheduledEvents(t.score)).map(event => ({
        ...event, partIndex
      }))).sort((a, b) => a.startBeat - b.startBeat || a.partIndex - b.partIndex);
    }
    preparePlayback(context) {
      super.preparePlayback(context);
      if (!this.buses.length) {
        this.buses = this.partSettings.map(() => {
          const bus = context.createGain();
          bus.connect(this.outputBus);
          return bus;
        });
      }
      this.updateBusLevels(true);
    }
    updateBusLevels(immediate = false) {
      const anySolo = this.partSettings.some(part => part.solo);
      for (const [i, part] of this.partSettings.entries()) {
        const bus = this.buses[i];
        if (!bus || !this.context) continue;
        const level = part.mute || (anySolo && !part.solo) ? 0 : part.volume / 100;
        const now = this.context.currentTime;
        bus.gain.cancelScheduledValues(now);
        if (immediate) bus.gain.setValueAtTime(level, now);
        else bus.gain.setTargetAtTime(level, now, .008);
      }
    }
    updateMix(id, fields) {
      const part = this.partSettings.find(p => p.id === id);
      if (!part) return;
      for (const key of ["mute", "solo", "volume"]) {
        if (Object.prototype.hasOwnProperty.call(fields, key)) {
          const value = fields[key];
          if (key === "volume" && (!Number.isFinite(value) || value < 0 || value > 100)) {
            throw new RangeError("Invalid track volume");
          }
          part[key] = key === "volume" ? value : Boolean(value);
        }
      }
      this.updateBusLevels();
    }
    scheduleNote(event, at, endsAt, offsetSeconds = 0) {
      const part = this.partSettings[event.partIndex];
      if (event.type === "drum") {
        this.scheduleDrumHit(event, at, offsetSeconds);
        return;
      }
      super.scheduleNote(event, at, endsAt, offsetSeconds, {
        instrument: part.instrument, volume: 100, output: this.buses[event.partIndex]
      });
    }
    scheduleDrumHit(event, at, offsetSeconds = 0) {
      const recipes = {
        kick: { voice: "membrane", size: "large", decay: .36 },
        snare: { voice: "snare", size: "medium", decay: .24 },
        hat: { voice: "cymbal", size: "small", decay: .13 },
        openHat: { voice: "cymbal", size: "medium", decay: .48 },
        woodblock: { voice: "woodblock", size: "small", decay: .24 }
      };
      const recipe = recipes[event.drum];
      if (!recipe) throw new RangeError("Unknown percussion voice");
      const context = this.context;
      const key = ["drum", context.sampleRate, event.drum].join("|");
      let buffer = this.buffers.get(key);
      if (!buffer) {
        const samples = this.transientModel.makeSamples("kick", 220, recipe.decay,
          context.sampleRate, recipe.size, { drumVoice: recipe.voice });
        buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.getChannelData(0).set(samples);
        if (this.buffers.size >= 24) this.buffers.delete(this.buffers.keys().next().value);
        this.buffers.set(key, buffer);
      }
      if (offsetSeconds >= buffer.duration - .01) return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.buses[event.partIndex]);
      gain.gain.setValueAtTime(.32 * event.velocity, at);
      this.addVoice(source, gain);
      source.start(at, offsetSeconds);
    }
    stop(reset = true) {
      super.stop(reset);
      if (this.buses) {
        this.buses.forEach(bus => { try { bus.disconnect(); } catch (_) { /* Already disconnected. */ } });
        this.buses = [];
      }
    }
  }

  return Object.freeze({ INSTRUMENTS, AHEAD_SECONDS, MAX_PARTS, MAX_ENSEMBLE_EVENTS,
    noteFrequency, scheduledEvents, validateEnsemble, Player, EnsemblePlayer });
});
