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
  const heldVoice = typeof module === "object" && module.exports ?
    require("./sound-held-voice.js") : root.SoundLabHeldVoice;
  const marimbaModel = typeof module === "object" && module.exports ?
    require("./sound-marimba.js") : root.SoundLabMarimba;
  const xylophoneModel = typeof module === "object" && module.exports ?
    require("./sound-xylophone.js") : root.SoundLabXylophone;
  const mandolinModel = typeof module === "object" && module.exports ?
    require("./sound-mandolin.js") : root.SoundLabMandolin;
  const harpModel = typeof module === "object" && module.exports ?
    require("./sound-harp.js") : root.SoundLabHarp;
  const i3Held = typeof module === "object" && module.exports ?
    require("./sound-i3-held.js") : root.SoundLabI3Held;
  const api = factory(scoreModel, fmModel, drumModel, heldVoice, marimbaModel, xylophoneModel, mandolinModel, harpModel, i3Held);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabScorePlayer = api;
})(typeof window !== "undefined" ? window : null, function (scoreModel, fmModel, drumModel, heldVoice, marimbaModel, xylophoneModel, mandolinModel, harpModel, i3Held) {
  "use strict";

  const WAVEFORMS = Object.freeze(["sine", "triangle", "square", "sawtooth"]);
  // Approximate relative loudness calibration for Ensemble only. The source
  // models have very different native RMS levels (especially periodic waves,
  // piano/FM and plucked courses). Keep each track fader linear and separate;
  // Solo/Explore retain their established playback levels.
  const ENSEMBLE_VOICE_GAIN = Object.freeze({
    mandolin: 2.1, harp: 1.5, xylophone: 1.4, piano: .56, chimes: .65, fmep: .38,
    "organ-stopped": 1.05, "organ-principal": .86, accordion: 1.4, bayan: 1.5,
    sine: .30, triangle: .36, square: .30, sawtooth: .50
  });
  const HELD_INSTRUMENTS = Object.freeze(["flute", "clarinet", "violin", "morin", ...i3Held.KINDS]);
  const INSTRUMENTS = Object.freeze(["flute", "clarinet", "violin", "morin", ...i3Held.KINDS,
    "guitar", "mandolin", "harp", "piano", "chimes", "marimba", "xylophone",
    ...WAVEFORMS, "fmep"]);
  const GUITAR_MODES = Object.freeze(["pluck", "down", "up", "alternate"]);
  const DEFAULT_GUITAR = Object.freeze({ mode: "pluck", spacingMs: 20 });
  const AHEAD_SECONDS = .23;
  const TICK_MS = 35;
  const HAT_CHOKE_SECONDS = drumModel.hatPedalRelease(0).seconds;
  const DRUM_RECIPES = Object.freeze({
    kick: Object.freeze({ voice: "membrane", size: "large", decay: .36 }),
    snare: Object.freeze({ voice: "snare", size: "medium", decay: .24 }),
    hat: Object.freeze({ voice: "cymbal", size: "small", decay: .13 }),
    halfHat: Object.freeze({ voice: "halfhat", size: "medium", decay: .27 }),
    openHat: Object.freeze({ voice: "cymbal", size: "medium", decay: .48 }),
    woodblock: Object.freeze({ voice: "woodblock", size: "small", decay: .24 }),
    floorTom: Object.freeze({ voice: "tom", size: "large", decay: .49 }),
    midTom: Object.freeze({ voice: "tom", size: "medium", decay: .38 }),
    highTom: Object.freeze({ voice: "tom", size: "small", decay: .31 }),
    ride: Object.freeze({ voice: "ride", size: "medium", decay: .68 }),
    crash: Object.freeze({ voice: "crash", size: "large", decay: .75 }),
    rimshot: Object.freeze({ voice: "rimshot", size: "small", decay: .20 })
  });

  function hatPedalPlan(event, at, offsetSeconds, score) {
    if (event.type !== "drum" || !Object.hasOwn(drumModel.HAT_PEDAL_POSITIONS, event.drum)) return [];
    // Keep compatibility with events created before the pedalChanges field.
    const changes = event.pedalChanges || (Number.isFinite(event.chokeBeat) ?
      [{ beat: event.chokeBeat, openness: 0 }] : []);
    const onset = at - offsetSeconds;
    return changes.map(change => ({
      at: onset + scoreModel.beatToSeconds(score, change.beat) -
        scoreModel.beatToSeconds(score, event.startBeat),
      ...(drumModel.hatPedalRelease(change.openness) || { timeConstant: null, seconds: null }),
      openness: change.openness
    }));
  }

  // Value of a piecewise exponential pedal envelope at an arbitrary instant.
  // This is also used to resume a still-ringing cymbal after Pause/Seek.
  function hatPedalGainAt(plan, time, level) {
    let previous = null, gain = level;
    for (const release of plan) {
      if (release.at > time + 1e-9) break;
      if (previous?.timeConstant) gain *= Math.exp(-(release.at - previous.at) / previous.timeConstant);
      previous = release;
    }
    if (previous?.timeConstant) gain *= Math.exp(-(time - previous.at) / previous.timeConstant);
    return gain;
  }

  function hatPedalEndAt(plan, bufferEnd) {
    let end = bufferEnd;
    for (let i = 0; i < plan.length; i++) {
      const release = plan[i];
      if (!release.timeConstant) continue;
      const terminal = release.at + release.seconds;
      // Reopening/adjusting the pedal before six time constants interrupts
      // the prior envelope, while reopening after that cannot revive a tail.
      if (i + 1 < plan.length && plan[i + 1].at < terminal) continue;
      end = Math.min(end, terminal);
    }
    return end;
  }

  function noteFrequency(event, tuning, temperamentModel) {
    return scoreModel.frequency(event.pitch, tuning, 440, temperamentModel);
  }

  function instrumentRange(instrument) {
    if (i3Held.KINDS.includes(instrument)) return i3Held.rangeFor(instrument);
    if (HELD_INSTRUMENTS.includes(instrument)) return heldVoice.rangeFor(instrument);
    if (instrument === "marimba") return [marimbaModel.MIN_HZ, marimbaModel.MAX_HZ];
    if (instrument === "xylophone") return [xylophoneModel.MIN_HZ, xylophoneModel.MAX_HZ];
    if (instrument === "mandolin") return [mandolinModel.MIN_HZ, mandolinModel.MAX_HZ];
    if (instrument === "harp") return [harpModel.MIN_HZ, harpModel.MAX_HZ];
    return [instrument === "piano" ? 27.5 : instrument === "guitar" ? 80 : scoreModel.MIN_NOTE_HZ,
      // Acoustic piano extends to C8, not A6. High Für Elise right-hand
      // notes must retain their register; modal synthesis bounds partials.
      instrument === "piano" ? 4186.1 : instrument === "chimes" ? 1200 : scoreModel.MAX_NOTE_HZ];
  }

  function guitarSettings(guitar = DEFAULT_GUITAR) {
    if (!guitar || typeof guitar !== "object" || Array.isArray(guitar)) {
      throw new RangeError("Invalid guitar strum settings");
    }
    const { mode = DEFAULT_GUITAR.mode, spacingMs = DEFAULT_GUITAR.spacingMs } = guitar;
    if (!GUITAR_MODES.includes(mode) || !Number.isFinite(spacingMs) ||
        spacingMs < 0 || spacingMs > 60) {
      throw new RangeError("Invalid guitar strum mode or spacing (0–60 ms)");
    }
    return { mode, spacingMs };
  }

  function scheduledEvents(score, fromBeat = 0, guitar = DEFAULT_GUITAR) {
    scoreModel.validate(score);
    if (!Number.isFinite(fromBeat) || fromBeat < 0 || fromBeat > score.totalBeats) {
      throw new RangeError("Invalid score offset");
    }
    const technique = guitarSettings(guitar);
    const notes = [];
    const lastAttack = new Map();
    const chordCounts = new Map();
    for (const event of score.parts[0].events) {
      const voiceId = event.voiceId ?? "melody";
      if (event.type === "rest") {
        lastAttack.delete(voiceId);
        continue;
      }
      if (event.type === "chord") {
        // Expand one written chord into exactly one voice per pitch. A strum
        // changes attacks, never its pitches, voice count or written release.
        const { pitches, ...notated } = event;
        const ordered = [...pitches];
        let stepBeats = 0;
        if (technique.mode !== "pluck") {
          ordered.sort((a, b) => scoreModel.pitchNumber(a) - scoreModel.pitchNumber(b));
          if (technique.mode === "up" || (technique.mode === "alternate" &&
              (chordCounts.get(voiceId) || 0) % 2)) {
            ordered.reverse();
          }
          // Fast, short chords must finish their sweep before the next event.
          // Reserve at least half the written duration for every plucked note.
          stepBeats = Math.min(scoreModel.secondsToBeat(score,
            scoreModel.beatToSeconds(score, event.startBeat) + technique.spacingMs / 1000) - event.startBeat,
            event.durationBeats / (2 * (pitches.length - 1)));
        }
        ordered.forEach((pitch, index) => {
          const delayBeats = index * stepBeats;
          notes.push({ ...notated, type: "note", pitch: { ...pitch },
            ...(index ? { gracePitches: undefined } : {}), chordSize: pitches.length,
            startBeat: event.startBeat + delayBeats,
            durationBeats: event.durationBeats - delayBeats });
        });
        chordCounts.set(voiceId, (chordCounts.get(voiceId) || 0) + 1);
        lastAttack.delete(voiceId);
        continue;
      }
      if (event.tieFromPrevious) {
        // Interleaved ABC voices need their own continuation target. The last
        // globally scheduled note may belong to another independent voice.
        lastAttack.get(voiceId).durationBeats += event.durationBeats;
      } else {
        const { tieFromPrevious, tieToNext, ...note } = event;
        const attack = { ...note, pitch: { ...event.pitch } };
        notes.push(attack);
        lastAttack.set(voiceId, attack);
      }
    }
    // Interpret expressive marks after tie consolidation. Durations in the
    // editable score remain notated durations; only audio attacks/releases
    // change. A grace group steals up to 35% of its host note, with fixed
    // deterministic 55 ms targets rather than adding score beats or drifting
    // with repeated playback. The shared tempo map converts seconds to beats.
    const expressiveNotes = [];
    for (const original of notes) {
      const event = { ...original };
      const writtenEnd = event.startBeat + event.durationBeats;
      const articulation = event.articulation;
      if (articulation === "staccato") event.durationBeats *= .58;
      else if (articulation === "tenuto") event.durationBeats *= .97;
      else if (articulation === "legato") {
        event.durationBeats += Math.min(.10, event.durationBeats * .07);
      }
      const gracePitches = event.gracePitches;
      if (gracePitches?.length) {
        const onsetSeconds = scoreModel.beatToSeconds(score, event.startBeat);
        const hostSeconds = scoreModel.beatToSeconds(score, writtenEnd) - onsetSeconds;
        const totalGraceSeconds = Math.min(gracePitches.length * .055, hostSeconds * .35);
        const period = totalGraceSeconds / gracePitches.length;
        for (const [index, pitch] of gracePitches.entries()) {
          const startBeat = scoreModel.secondsToBeat(score, onsetSeconds + index * period);
          const endBeat = scoreModel.secondsToBeat(score, onsetSeconds + (index + .9) * period);
          expressiveNotes.push({ ...event, pitch: { ...pitch }, startBeat,
            durationBeats: endBeat - startBeat, articulation: undefined, gracePitches: undefined,
            isGrace: true, velocity: Math.min(1.5, (event.velocity ?? 1) * .82),
            pedalEndBeat: scoreModel.pedalReleaseBeat(score, endBeat) });
        }
        const delayedBeat = scoreModel.secondsToBeat(score, onsetSeconds + totalGraceSeconds);
        event.durationBeats = Math.max(1e-6, event.startBeat + event.durationBeats - delayedBeat);
        event.startBeat = delayedBeat;
      }
      event.gracePitches = undefined;
      event.pedalEndBeat = scoreModel.pedalReleaseBeat(score, event.startBeat + event.durationBeats);
      expressiveNotes.push(event);
    }
    // Keep each complete attack time when resuming inside a tie, pedal or strum.
    // Expand the entire score first so alternating strokes also retain their
    // direction after a seek. The scheduler seeks each percussive buffer from
    // its own attack and leaves not-yet-plucked notes at their future times.
    return expressiveNotes.sort((a, b) => a.startBeat - b.startBeat)
      .filter(event => Math.max(event.startBeat + event.durationBeats, event.pedalEndBeat || 0) > fromBeat);
  }

  class Player {
    constructor({ contextOwner, transientModel, sustainModel, temperamentModel, onUpdate,
      // A complete K.331/III piano movement uses 44 distinct pitches. Keeping
      // 48 common timbres avoids repeated synthesis at every returned refrain.
      bufferCacheLimit = 48, maxBufferBytes = Infinity, strictBufferFrames = false } = {}) {
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
      if (!Number.isInteger(bufferCacheLimit) || bufferCacheLimit < 1 || bufferCacheLimit > 1024 ||
          !(maxBufferBytes > 0) || (maxBufferBytes !== Infinity && !Number.isSafeInteger(maxBufferBytes)) ||
          typeof strictBufferFrames !== "boolean") {
        throw new RangeError("Invalid audio buffer cache limits");
      }
      this.bufferCacheLimit = bufferCacheLimit;
      this.maxBufferBytes = maxBufferBytes;
      this.bufferBytes = 0;
      this.bufferSizes = new Map();
      this.strictBufferFrames = strictBufferFrames;
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
      this.playbackEndTime = 0;
      this.generation = 0;
      this.interval = null;
      this.outputBus = null;
    }

    configure({ score, instrument = this.instrument, tuning = this.tuning,
      volume = this.volume, guitar = DEFAULT_GUITAR }) {
      scoreModel.validate(score);
      if (!INSTRUMENTS.includes(instrument) || !scoreModel.TUNINGS.includes(tuning) ||
          !Number.isFinite(volume) || volume < 0 || volume > 100) {
        throw new RangeError("Invalid score instrument, tuning or volume");
      }
      // Validate every note before starting AudioContext, rather than silently
      // transposing notes outside the working range of the instrument models.
      const technique = instrument === "guitar" ? guitarSettings(guitar) : DEFAULT_GUITAR;
      const soundingEvents = scheduledEvents(score, 0, technique);
      const [lower, upper] = instrumentRange(instrument);
      for (const event of soundingEvents) {
        const hz = noteFrequency(event, tuning, this.temperamentModel);
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

    get playbackBeat() {
      if (this.status !== "playing" || !this.context) return this.positionBeat;
      const seconds = Math.max(0, this.context.currentTime - this.baseTime);
      return scoreModel.secondsToBeat(this.score,
        scoreModel.beatToSeconds(this.score, this.originBeat) + seconds);
    }

    get currentBeat() {
      // The notation playhead stays at the last beat while an instrument's
      // release rings. Keep the real tail position separately for Pause/Resume.
      return this.score ? Math.min(this.score.totalBeats, this.playbackBeat) : this.positionBeat;
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
        if (voice.held) {
          // One sustained note owns several excitation/noise sources. Its
          // shared handle cancels and disconnects the complete graph.
          voice.held.stop();
          continue;
        }
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
      if (this.status === "playing") this.positionBeat = this.playbackBeat;
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
      if (this.status !== "paused" && this.positionBeat >= this.score.totalBeats) this.positionBeat = 0;
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
        this.playbackEndTime = this.baseTime +
          scoreModel.beatToSeconds(this.score, this.score.totalBeats) -
          scoreModel.beatToSeconds(this.score, this.originBeat);
        this.nextIndex = this.playEvents.findIndex(event =>
          this.eventPending(event, this.originBeat, context.sampleRate));
        if (this.nextIndex < 0) this.nextIndex = this.playEvents.length;
        if (this.originBeat >= this.score.totalBeats && this.nextIndex === this.playEvents.length) {
          // Pausing after all audible tails ended must not replay bar one.
          this.stop();
          return false;
        }
        this.status = "playing";
        this.tick();
        if (this.status === "playing") this.interval = setInterval(() => this.tick(), TICK_MS);
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
      const originSeconds = scoreModel.beatToSeconds(this.score, this.originBeat);
      const aheadBeat = scoreModel.secondsToBeat(this.score,
        Math.max(0, originSeconds + now + AHEAD_SECONDS - this.baseTime));
      const events = this.playEvents;
      while (this.nextIndex < events.length && events[this.nextIndex].startBeat < aheadBeat) {
        const event = events[this.nextIndex++];
        const clippedBeat = Math.max(this.originBeat, event.startBeat);
        // Avoid cancellation noise at exactly the resumed origin: an event
        // starting there must be scheduled at baseTime itself.
        const at = clippedBeat === this.originBeat ? this.baseTime :
          this.baseTime + scoreModel.beatToSeconds(this.score, clippedBeat) - originSeconds;
        const endsAt = this.baseTime +
          scoreModel.beatToSeconds(this.score, this.noteOffBeat(event)) - originSeconds;
        const startsAt = Math.max(at, now + .003);
        const originalAt = this.baseTime + scoreModel.beatToSeconds(this.score, event.startBeat) - originSeconds;
        const offsetSeconds = Math.max(0, startsAt - originalAt);
        const voiceEnd = this.voiceEndTime(event, startsAt, endsAt, this.context.sampleRate, offsetSeconds);
        if (voiceEnd <= startsAt || (WAVEFORMS.includes(this.eventInstrument(event)) && endsAt <= startsAt)) continue;
        this.scheduleNote(event, startsAt, endsAt, offsetSeconds);
        this.playbackEndTime = Math.max(this.playbackEndTime, voiceEnd);
      }
      if (now > this.playbackEndTime) {
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

    eventInstrument() { return this.instrument; }

    noteOffBeat(event) {
      const written = event.startBeat + event.durationBeats;
      return ["piano", "fmep"].includes(this.eventInstrument(event)) ?
        Math.max(written, event.pedalEndBeat || written) : written;
    }

    eventPending(event, fromBeat, sampleRate) {
      const at = scoreModel.beatToSeconds(this.score, event.startBeat);
      const endsAt = scoreModel.beatToSeconds(this.score, this.noteOffBeat(event));
      // Plain oscillators are already silent at note-off. Held voices and
      // sampled instruments can still be sounding after their notation ends.
      const end = WAVEFORMS.includes(this.eventInstrument(event)) ? endsAt :
        this.voiceEndTime(event, at, endsAt, sampleRate);
      return end > scoreModel.beatToSeconds(this.score, fromBeat);
    }

    // The held graph caches a single noise buffer per AudioContext, shared by
    // all held notes and parts. Specs must reserve it once, not once per note.
    sharedBufferBytes(event, sampleRate) {
      const instrument = this.eventInstrument(event);
      return HELD_INSTRUMENTS.includes(instrument) && !i3Held.KINDS.includes(instrument) ?
        heldVoice.bufferFrames(sampleRate) * 4 : 0;
    }

    // The same recipes describe live buffers, offline memory requirements and
    // the full audible ending. Preparing a spec never allocates audio samples.
    transientDuration(decay, kind = "") {
      return typeof this.transientModel.duration === "function" ? this.transientModel.duration(decay, kind) :
        Math.max(.35, Math.min(3, decay * 4));
    }

    bufferSpec(event, sampleRate, settings = null) {
      const instrument = settings?.instrument || this.instrument;
      if ([...HELD_INSTRUMENTS, ...WAVEFORMS].includes(instrument)) return null;
      const hz = noteFrequency(event, this.tuning, this.temperamentModel);
      const percussive = instrument === "chimes";
      const kind = instrument === "guitar" ? "pluck" : percussive ? "kick" :
        instrument === "fmep" ? "fmep" :
          ["marimba", "xylophone", "mandolin", "harp"].includes(instrument) ? instrument : "piano";
      const decay = instrument === "piano" || instrument === "fmep" ? .8 : percussive ? .7 :
        instrument === "marimba" ? marimbaModel.DEFAULT_DECAY :
          instrument === "xylophone" ? xylophoneModel.DEFAULT_DECAY :
            instrument === "mandolin" ? mandolinModel.DEFAULT_DECAY :
              instrument === "harp" ? harpModel.DEFAULT_DECAY : .65;
      const options = instrument === "guitar" ? { position: .22 } :
        instrument === "piano" ? { velocity: .62, touch: "press" } :
          percussive ? { drumVoice: "chimes", chimeHz: hz } :
            instrument === "marimba" ? { velocity: marimbaModel.DEFAULT_VELOCITY } :
              instrument === "xylophone" ? { velocity: xylophoneModel.DEFAULT_VELOCITY } :
                instrument === "mandolin" ? { velocity: mandolinModel.DEFAULT_VELOCITY, articulation: "pick" } :
                  instrument === "harp" ? { velocity: harpModel.DEFAULT_VELOCITY } : {};
      const seconds = instrument === "fmep" ? fmModel.DURATION_SECONDS :
        this.transientDuration(decay, kind);
      return { key: [sampleRate, kind, hz.toFixed(5), decay, instrument].join("|"),
        sampleRate, frames: Math.ceil(seconds * sampleRate), kind, hz, decay,
        size: "medium", options, fm: instrument === "fmep",
        damper: instrument === "piano" || instrument === "fmep" };
    }

    bufferFor(spec) {
      const cached = this.buffers.get(spec.key);
      if (cached) return cached;
      const oldest = this.buffers.size >= this.bufferCacheLimit ? this.buffers.keys().next().value : null;
      const retainedBytes = this.bufferBytes - (oldest === null ? 0 : this.bufferSizes.get(oldest));
      const checkBudget = bytes => {
        if (retainedBytes + bytes > this.maxBufferBytes) {
          const error = new RangeError("The arrangement needs more transient audio memory than this export allows");
          error.code = "limit";
          throw error;
        }
      };
      checkBudget(spec.frames * 4);
      const samples = spec.fm ? fmModel.makeElectricPianoSamples(spec.hz, spec.sampleRate) :
        this.transientModel.makeSamples(spec.kind, spec.hz, spec.decay, spec.sampleRate, spec.size, spec.options);
      if (!ArrayBuffer.isView(samples) || Object.prototype.toString.call(samples) !== "[object Float32Array]" ||
          (this.strictBufferFrames && samples.length !== spec.frames)) {
        throw new RangeError("An instrument returned an unexpected audio sample type or length");
      }
      checkBudget(samples.byteLength);
      const buffer = this.context.createBuffer(1, samples.length, spec.sampleRate);
      buffer.getChannelData(0).set(samples);
      if (oldest !== null) { this.buffers.delete(oldest); this.bufferSizes.delete(oldest); }
      this.buffers.set(spec.key, buffer);
      this.bufferSizes.set(spec.key, samples.byteLength);
      this.bufferBytes = retainedBytes + samples.byteLength;
      return buffer;
    }

    clearBuffers() {
      this.buffers.clear();
      this.bufferSizes.clear();
      this.bufferBytes = 0;
    }

    voiceEndTime(event, at, endsAt, sampleRate, offsetSeconds = 0) {
      const instrument = this.eventInstrument(event);
      if (HELD_INSTRUMENTS.includes(instrument)) {
        const voice = i3Held.KINDS.includes(instrument) ? i3Held : heldVoice;
        return endsAt + voice.defaults(instrument, this.sustainModel).release + voice.STOP_PAD;
      }
      const spec = this.bufferSpec(event, sampleRate);
      if (!spec) return endsAt + .005;
      const bufferEnd = at + spec.frames / sampleRate - offsetSeconds;
      if (event.type === "drum" && (event.drum === "openHat" || event.drum === "halfHat")) {
        return hatPedalEndAt(hatPedalPlan(event, at, offsetSeconds, this.score), bufferEnd);
      }
      return spec.damper ? Math.min(bufferEnd, endsAt + .19) : bufferEnd;
    }

    isEventAudible() { return this.volume > 0; }

    scheduleNote(event, at, endsAt, offsetSeconds = 0, settings = null) {
      const hz = noteFrequency(event, this.tuning, this.temperamentModel);
      const context = this.context;
      const instrument = settings?.instrument || this.instrument;
      const volume = settings?.volume ?? this.volume;
      const balance = this.instrument === "ensemble" ? (ENSEMBLE_VOICE_GAIN[instrument] ?? 1) : 1;
      const level = Math.min(.35, .19 * volume / 100 * (instrument === "piano" ? 2.35 : 1)) /
        Math.sqrt(event.chordSize || 1) * balance * (event.velocity ?? 1);
      const output = settings?.output || this.outputBus || this.contextOwner.output;
      if (HELD_INSTRUMENTS.includes(instrument)) {
        let voice;
        const synth = i3Held.KINDS.includes(instrument) ? i3Held : heldVoice;
        const held = synth.createVoice({ context, output, model: this.sustainModel,
          kind: instrument, hz, level, at, offsetSeconds,
          noteDurationSeconds: Math.max(0, offsetSeconds + endsAt - at),
          onended: () => this.voices.delete(voice) });
        voice = { source: held.oscillator, gain: held.volume, held };
        this.voices.add(voice);
        return;
      }
      const gain = context.createGain();
      gain.connect(output);
      if (WAVEFORMS.includes(instrument)) {
        const oscillator = context.createOscillator();
        // Native oscillator shapes are band-limited by the browser.
        oscillator.type = instrument;
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
      let buffer;
      try { buffer = this.bufferFor(this.bufferSpec(event, context.sampleRate, settings)); }
      catch (error) { gain.disconnect(); throw error; }
      if (offsetSeconds >= buffer.duration) { gain.disconnect(); return; }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      const damperAge = Math.max(0, at - endsAt);
      const initialLevel = instrument === "piano" || instrument === "fmep" ?
        level * Math.exp(-damperAge / .028) : level;
      gain.gain.setValueAtTime(initialLevel, at);
      if (instrument === "piano" || instrument === "fmep") {
        const noteEnd = Math.max(at, endsAt);
        gain.gain.setValueAtTime(initialLevel, noteEnd);
        gain.gain.setTargetAtTime(0, noteEnd, .028); // damper returns on release
      }
      this.addVoice(source, gain);
      source.start(at, offsetSeconds);
      if (instrument === "piano" || instrument === "fmep") source.stop(Math.min(at + buffer.duration - offsetSeconds,
        endsAt + .19));
    }
  }

  const MAX_PARTS = 4;
  const MAX_BUFFER_CACHE = 1024;
  function validateEnsemble(tracks, tuning = "equal", temperamentModel) {
    if (!Array.isArray(tracks) || tracks.length < 1 || tracks.length > MAX_PARTS ||
        !scoreModel.TUNINGS.includes(tuning)) throw new RangeError("Use 1–4 tracks and a supported tuning");
    const first = tracks[0]?.score;
    if (!first) throw new Error("Missing ABC score");
    let events = 0, totalBeats = 0;
    // A Q: change in any pitched voice controls the shared score clock;
    // unmarked instruments (including drums) inherit this global map.
    const marked = tracks.map(track => track.score.tempoMap).filter(Boolean);
    const tempoMap = marked[0];
    if (marked.some(map => JSON.stringify(map) !== JSON.stringify(tempoMap))) {
      throw new RangeError("All explicitly marked track tempo maps must agree");
    }
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
      const soundingEvents = instrument === "drums" ? drumModel.scheduledEvents(score, track.drumFeel, track.drumTouch) :
        scheduledEvents(score, 0, instrument === "guitar" ? track.guitar : DEFAULT_GUITAR);
      events += soundingEvents.length;
      totalBeats = Math.max(totalBeats, score.totalBeats);
      if (instrument === "drums") continue;
      const [lower, upper] = instrumentRange(instrument);
      for (const event of soundingEvents) {
        const hz = noteFrequency(event, tuning, temperamentModel);
        if (hz < lower || hz > upper) {
          throw new RangeError(scoreModel.pitchName(event.pitch) + " is outside " + instrument +
            " range (" + lower + "–" + upper + " Hz)");
        }
      }
    }
    if (!Number.isSafeInteger(events) || !Number.isFinite(scoreModel.beatToSeconds(
      { ...first, tempoMap }, totalBeats))) {
      throw new RangeError("The ensemble duration or event count is invalid");
    }
    return { tempoQuarter: first.tempoQuarter, ...(tempoMap ? { tempoMap } : {}),
      meter: first.meter, totalBeats, eventCount: events };
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
        drumModel.scheduledEvents(t.score, t.drumFeel, t.drumTouch) : scheduledEvents(t.score, 0,
          t.instrument === "guitar" ? t.guitar : DEFAULT_GUITAR)).map(event => ({
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
    isEventAudible(event) {
      const part = this.partSettings[event.partIndex];
      return !part.mute && part.volume > 0 && (!this.partSettings.some(item => item.solo) || part.solo);
    }
    eventInstrument(event) { return this.partSettings[event.partIndex].instrument; }
    bufferSpec(event, sampleRate) {
      if (event.type !== "drum") return super.bufferSpec(event, sampleRate,
        { instrument: this.partSettings[event.partIndex].instrument });
      const recipe = DRUM_RECIPES[event.drum];
      if (!recipe) throw new RangeError("Unknown percussion voice");
      // Six bounded timbre bands; amplitude remains the exact score velocity.
      // This limits cached buffers for rolls, ghost notes and busy kit studies.
      const velocityBand = Math.round(event.velocity * 5) / 5;
      return { key: ["drum", sampleRate, event.drum, velocityBand].join("|"), sampleRate,
        frames: Math.ceil(this.transientDuration(recipe.decay) * sampleRate),
        kind: "kick", hz: 220, decay: recipe.decay, size: recipe.size,
        options: { drumVoice: recipe.voice, velocity: velocityBand }, fm: false, damper: false };
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
      const context = this.context;
      const plan = hatPedalPlan(event, at, offsetSeconds, this.score);
      const first = plan[0];
      if (first && (hatPedalEndAt(plan, Infinity) <= at ||
          first.at === at && offsetSeconds === 0 &&
          first.openness < drumModel.HAT_PEDAL_POSITIONS[event.drum])) return;
      const buffer = this.bufferFor(this.bufferSpec(event, context.sampleRate));
      if (offsetSeconds >= buffer.duration) return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.buses[event.partIndex]);
      const level = .32 * event.velocity;
      gain.gain.setValueAtTime(hatPedalGainAt(plan, at, level), at);
      const active = [...plan].reverse().find(release => release.at <= at);
      if (active?.timeConstant) gain.gain.setTargetAtTime(0, at, active.timeConstant);
      for (const release of plan) if (release.at > at) {
        gain.gain.setValueAtTime(hatPedalGainAt(plan, release.at, level), release.at);
        if (release.timeConstant) gain.gain.setTargetAtTime(0, release.at, release.timeConstant);
      }
      this.addVoice(source, gain);
      source.start(at, offsetSeconds);
      const bufferEnd = at + buffer.duration - offsetSeconds;
      const stopAt = hatPedalEndAt(plan, bufferEnd);
      if (stopAt < bufferEnd) source.stop(Math.max(at + .002, stopAt));
    }
    stop(reset = true) {
      super.stop(reset);
      if (this.buses) {
        this.buses.forEach(bus => { try { bus.disconnect(); } catch (_) { /* Already disconnected. */ } });
        this.buses = [];
      }
    }
  }

  return Object.freeze({ INSTRUMENTS, ENSEMBLE_VOICE_GAIN, GUITAR_MODES, DEFAULT_GUITAR, DRUM_RECIPES,
    AHEAD_SECONDS, HAT_CHOKE_SECONDS,
    MAX_PARTS, MAX_BUFFER_CACHE,
    noteFrequency, instrumentRange, scheduledEvents, validateEnsemble, Player, EnsemblePlayer });
});
