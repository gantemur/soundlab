/* Deterministic models of percussion, feedback-plucked strings and pitched hits.
 * Playback and explanatory plots use precisely the same model samples.
 * These are simplified physical teaching models, not instrument recordings.
 */
(function (root, makeModel) {
  "use strict";
  const strings = typeof module === "object" && module.exports ? require("./sound-string.js") : root.SoundLabString;
  const piano = typeof module === "object" && module.exports ? require("./sound-piano.js") : root.SoundLabPiano;
  const fm = typeof module === "object" && module.exports ? require("./sound-fm.js") : root.SoundLabFM;
  const marimba = typeof module === "object" && module.exports ? require("./sound-marimba.js") : root.SoundLabMarimba;
  const xylophone = typeof module === "object" && module.exports ? require("./sound-xylophone.js") : root.SoundLabXylophone;
  const mandolin = typeof module === "object" && module.exports ? require("./sound-mandolin.js") : root.SoundLabMandolin;
  const harp = typeof module === "object" && module.exports ? require("./sound-harp.js") : root.SoundLabHarp;
  const model = makeModel(strings, piano, fm, marimba, xylophone, mandolin, harp);
  if (typeof module === "object" && module.exports) module.exports = model;
  if (root) root.SoundLabTransientModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function (strings, piano, fm, marimba, xylophone, mandolin, harp) {
  "use strict";

  if (!strings) throw new Error("String synthesis must load before transient synthesis");
  if (!piano) throw new Error("Piano synthesis must load before transient synthesis");
  if (!fm) throw new Error("FM synthesis must load before transient synthesis");
  if (!marimba) throw new Error("Marimba synthesis must load before transient synthesis");
  if (!xylophone) throw new Error("Xylophone synthesis must load before transient synthesis");
  if (!mandolin) throw new Error("Mandolin synthesis must load before transient synthesis");
  if (!harp) throw new Error("Harp synthesis must load before transient synthesis");

  const TAU = 2 * Math.PI;
  const KINDS = Object.freeze(["pluck", "kick", "piano", "marimba", "xylophone", "mandolin", "harp"]);
  const MIN_PITCH_HZ = 110;
  const MAX_PITCH_HZ = 880;
  const MIN_DECAY = 0.12;
  const MAX_DECAY = 1.2;
  const DRUM_BASE_HZ = 112;
  const DRUM_ZEROS = Object.freeze([2.40483, 3.83171, 5.13562, 5.52008,
    6.38016, 7.01559, 7.58834, 8.41724]);
  const DRUM_WEIGHTS = Object.freeze([1, .39, .24, .28, .14, .12, .09, .075]);
  const DRUM_MIN_TENSION = .5;
  const DRUM_MAX_TENSION = 2;
  const KICK_SIZES = Object.freeze({ large: 0.72, medium: 1, small: 1.4 });
  // The three pads choose either drum sizes or pitched struck resonators.
  const DRUM_VOICES = Object.freeze(["membrane", "snare", "cymbal", "steelpan", "chimes", "woodblock"]);
  // D2 score-only voices. Keep the Explore pads' six established choices intact;
  // the Compose drum grid selects these individual kit instruments instead.
  const COMPOSE_DRUM_VOICES = Object.freeze(["tom", "ride", "crash", "rimshot"]);
  const VALID_DRUM_VOICES = Object.freeze([...DRUM_VOICES, ...COMPOSE_DRUM_VOICES]);
  const TOM_BASES = Object.freeze({ large: 92, medium: 145, small: 205 });
  const STEELPAN_PITCHES = Object.freeze({ large: 261.625565, medium: 329.627557,
    small: 391.995436 });
  const CYMBAL_MODES = Object.freeze([1, 1.42, 1.87, 2.31, 2.92, 3.55, 4.23, 5.04, 6.17]);
  const CYMBAL_WEIGHTS = Object.freeze([.6, .42, .37, .31, .24, .19, .17, .12, .10]);
  const PAN_MODES = Object.freeze([1, 2.005, 3.012, 4.16, 5.34, 6.08]);
  const PAN_WEIGHTS = Object.freeze([1, .67, .42, .18, .10, .07]);
  // A high pitched bar/tube-like chime: sparse inharmonic flexural modes,
  // distinctly brighter than the tuned steel pan's octave partials.
  const CHIME_PITCHES = Object.freeze({ large: 523.251131, medium: 659.255114,
    small: 783.990872 });
  const CHIME_MODES = Object.freeze([1, 2.76, 5.41, 8.93]);
  const CHIME_WEIGHTS = Object.freeze([1, .36, .21, .13]);
  const WOOD_BASES = Object.freeze({ large: 510, medium: 760, small: 1110 });
  const WOOD_MODES = Object.freeze([1, 1.61, 2.38, 3.17]);
  const WOOD_WEIGHTS = Object.freeze([.92, .48, .24, .12]);

  function validate(kind, pitchHz, decaySec, kickSize = "medium", options = {}) {
    if (!KINDS.includes(kind)) throw new RangeError("Unknown transient sound");
    if (!Number.isFinite(decaySec) || decaySec < MIN_DECAY || decaySec > MAX_DECAY) {
      throw new RangeError("Decay outside the supported range");
    }
    // Compose guitar chords include the open low E (about 82 Hz). The string
    // model already supports this range; keep the exploratory slider unchanged.
    const lowPitch = kind === "piano" ? 27.5 : kind === "pluck" ? 80 : MIN_PITCH_HZ;
    const highPitch = kind === "piano" ? 1760 : MAX_PITCH_HZ;
    if ((kind === "pluck" || kind === "piano") &&
        (!Number.isFinite(pitchHz) || pitchHz < lowPitch || pitchHz > highPitch)) {
      throw new RangeError("Pitched-string frequency outside the supported range");
    }
    if (kind === "marimba") marimba.validate(pitchHz, decaySec,
      options.velocity ?? marimba.DEFAULT_VELOCITY, options.sampleRate ?? marimba.REFERENCE_RATE);
    if (kind === "xylophone") xylophone.validate(pitchHz, decaySec,
      options.velocity ?? xylophone.DEFAULT_VELOCITY, options.sampleRate ?? xylophone.REFERENCE_RATE);
    if (kind === "mandolin") mandolin.validate(pitchHz, decaySec,
      options.velocity ?? mandolin.DEFAULT_VELOCITY, options.sampleRate ?? mandolin.RATE,
      options.articulation ?? "pick");
    if (kind === "harp") harp.validate(pitchHz, decaySec,
      options.velocity ?? harp.DEFAULT_VELOCITY, options.sampleRate ?? 48000);
    if (kind === "kick" && (!Object.hasOwn(KICK_SIZES, kickSize) ||
        !VALID_DRUM_VOICES.includes(options.drumVoice ?? "membrane") ||
        !Number.isFinite(options.drumTension ?? 1) ||
        (options.drumTension ?? 1) < DRUM_MIN_TENSION ||
        (options.drumTension ?? 1) > DRUM_MAX_TENSION ||
        (options.drumVoice === "chimes" && (!Number.isFinite(options.chimeHz ?? CHIME_PITCHES[kickSize]) ||
          (options.chimeHz ?? CHIME_PITCHES[kickSize]) < 110 ||
          (options.chimeHz ?? CHIME_PITCHES[kickSize]) > 1200)))) {
      throw new RangeError("Unknown drum-size preset");
    }
    if (kind === "pluck" && (!strings.validPosition(options.position ?? .22) ||
        (options.strumChord !== undefined && !Object.hasOwn(strings.CHORDS, options.strumChord)) ||
        (options.strumPattern !== undefined && !strings.STRUM_PATTERNS.includes(options.strumPattern)))) {
      throw new RangeError("Unknown pluck position or guitar chord");
    }
    if (kind === "piano" && (!piano.validVelocity(options.velocity ?? .55) ||
        !piano.validTouch(options.touch ?? "press") ||
        !["acoustic", "electric"].includes(options.pianoVoice ?? "acoustic"))) {
      throw new RangeError("Piano hammer velocity or touch outside the supported range");
    }
  }

  function envelope(kind, time, decaySec, options = {}) {
    if (time <= 0) return 0;
    if (kind === "marimba") return marimba.envelope(time, decaySec,
      options.velocity ?? marimba.DEFAULT_VELOCITY);
    if (kind === "xylophone") return xylophone.envelope(time, decaySec,
      options.velocity ?? xylophone.DEFAULT_VELOCITY);
    if (kind === "mandolin") return mandolin.envelope(time, decaySec,
      options.velocity ?? mandolin.DEFAULT_VELOCITY, options.articulation ?? "pick");
    if (kind === "harp") return harp.envelope(time, decaySec,
      options.velocity ?? harp.DEFAULT_VELOCITY);
    if (kind === "piano") return options.pianoVoice === "electric" ?
      fm.envelopeAt(time, decaySec, options.velocity ?? .55, options.touch ?? "press") :
      piano.envelope(time, decaySec, options.touch ?? "press");
    const attack = kind === "kick" ? 0.0015 : 0.0025;
    const effectiveDecay = kind === "kick" && (options.drumVoice === "cymbal" ||
      options.drumVoice === "steelpan") ? decaySec * 1.3 : decaySec;
    return (1 - Math.exp(-time / attack)) * Math.exp(-time / effectiveDecay);
  }

  function kickFrequency(time, size = "medium", tension = 1) {
    if (!Object.hasOwn(KICK_SIZES, size) || !Number.isFinite(tension) ||
        tension < DRUM_MIN_TENSION || tension > DRUM_MAX_TENSION) {
      throw new RangeError("Unknown membrane size or tension");
    }
    return DRUM_BASE_HZ * KICK_SIZES[size] * Math.sqrt(tension);
  }

  function drumModeFrequencies(size = "medium", tension = 1) {
    const fundamental = kickFrequency(0, size, tension);
    return DRUM_ZEROS.map(zero => fundamental * zero / DRUM_ZEROS[0]);
  }

  function drumReferenceHz(size = "medium", tension = 1, voice = "membrane") {
    if (!Object.hasOwn(KICK_SIZES, size) ||
        !VALID_DRUM_VOICES.includes(voice)) {
      throw new RangeError("Unknown drum pad or sound family");
    }
    if (["cymbal", "woodblock", "ride", "crash", "rimshot"].includes(voice)) return null;
    if (voice === "tom") {
      kickFrequency(0, size, tension); // Keep tension validation consistent with other membranes.
      return TOM_BASES[size] * Math.sqrt(tension);
    }
    if (voice === "steelpan") return STEELPAN_PITCHES[size];
    if (voice === "chimes") return CHIME_PITCHES[size];
    return kickFrequency(0, size, tension);
  }

  // Smooth, deterministic noise: a simplified broadband rattle or turbulent
  // plate response, not an audio sample or a stochastic hardware input.
  function hash(index) {
    let value = Math.imul(index, 1664525) + 1013904223;
    value ^= value >>> 15;
    value = Math.imul(value, 2246822519);
    return (value >>> 0) / 2147483648 - 1;
  }

  function noiseAt(time) {
    const sample = time * 6500;
    const index = Math.floor(sample), fraction = sample - index;
    return hash(index) * (1 - fraction) + hash(index + 1) * fraction;
  }

  function membraneAt(time, size, tension, decaySec) {
    const base = kickFrequency(0, size, tension);
    let value = 0;
    for (let i = 0; i < DRUM_ZEROS.length; i++) {
      const modeDecay = decaySec / (1 + i * .16);
      const frequency = base * DRUM_ZEROS[i] / DRUM_ZEROS[0];
      value += DRUM_WEIGHTS[i] * Math.exp(-time / modeDecay) * Math.sin(TAU * frequency * time);
    }
    const knock = .1 * Math.exp(-time / .007) * Math.sin(TAU * 2300 * time);
    // Very low membrane fundamentals are barely reproduced by phone speakers.
    // A bass-drum beater also excites shorter-lived midrange/body components;
    // show them without pretending the membrane itself has harmonic modes.
    const bassBeater = size === "large" ?
      .22 * Math.exp(-time / .030) * Math.sin(TAU * 350 * time) +
      .21 * Math.exp(-time / .012) * Math.sin(TAU * 980 * time) : 0;
    return (1 - Math.exp(-time / .0015)) *
      (value * (size === "large" ? 1.13 : 1) / 2.2 + knock + bassBeater);
  }

  function snareAt(time, size, tension, decaySec) {
    const body = membraneAt(time, size, tension, decaySec);
    const rattle = noiseAt(time) * Math.exp(-time / (decaySec * .48));
    return .48 * body + .53 * (1 - Math.exp(-time / .0012)) * rattle;
  }

  // A tom has freely decaying Bessel-like modes, a modest downward tension
  // sweep and no snare-wire rattle or bass-drum beater. This is an original
  // illustrative membrane model, not a recorded or calibrated drum sample.
  function tomAt(time, size, tension, decaySec) {
    const base = TOM_BASES[size] * Math.sqrt(tension);
    const bend = { large: .23, medium: .17, small: .13 }[size];
    const sweptTime = time + .022 * bend * (1 - Math.exp(-time / .022));
    let modes = 0;
    for (let i = 0; i < DRUM_ZEROS.length; i++) {
      const partial = DRUM_ZEROS[i] / DRUM_ZEROS[0];
      modes += DRUM_WEIGHTS[i] * Math.exp(-time * (1 + i * .28) / decaySec) *
        Math.sin(TAU * base * partial * sweptTime + i * .11);
    }
    const contact = .13 * noiseAt(time) * Math.exp(-time / .009);
    return (1 - Math.exp(-time / .0011)) * (.43 * modes + contact);
  }

  function cymbalAt(time, size, decaySec) {
    const base = { large: 310, medium: 415, small: 630 }[size];
    const factor = { large: 1.65, medium: 1.25, small: .58 }[size];
    const decay = decaySec * factor;
    let ringing = 0;
    CYMBAL_MODES.forEach((ratio, index) => {
      ringing += CYMBAL_WEIGHTS[index] * Math.sin(TAU * base * ratio * time + index * .37) *
        Math.exp(-time / (decay * (1 - .045 * index)));
    });
    const fizz = noiseAt(time) * Math.exp(-time / (decay * .72));
    return (1 - Math.exp(-time / .002)) * (.26 * ringing + .43 * fizz);
  }

  // Ride separates a clear repeated stick ping from a quieter, long metallic
  // sustain; crash uses a broader turbulent wash and a slower plate decay.
  function rideAt(time, decaySec) {
    let modes = 0;
    for (let i = 0; i < CYMBAL_MODES.length; i++) {
      modes += CYMBAL_WEIGHTS[i] * Math.exp(-time * (1 + i * .13) / (decaySec * 1.4)) *
        Math.sin(TAU * 610 * CYMBAL_MODES[i] * time + i * .31);
    }
    const ping = .34 * Math.exp(-time / .075) * Math.sin(TAU * 2040 * time);
    const contact = .11 * noiseAt(time) * Math.exp(-time / .02);
    return (1 - Math.exp(-time / .001)) * (.26 * modes + ping + contact);
  }

  function crashAt(time, decaySec) {
    let plates = 0;
    for (let i = 0; i < CYMBAL_MODES.length; i++) {
      plates += CYMBAL_WEIGHTS[i] * Math.exp(-time * (1 + i * .09) / (decaySec * 1.65)) *
        Math.sin(TAU * 360 * CYMBAL_MODES[i] * time + i * .61);
    }
    const wash = noiseAt(time) * Math.exp(-time / (decaySec * 1.35));
    return (1 - Math.exp(-time / .004)) * (.21 * plates + .38 * wash);
  }

  function rimshotAt(time, decaySec) {
    const body = snareAt(time, "small", 1.4, decaySec);
    const contact = noiseAt(time) * Math.exp(-time / .012);
    const rim = Math.sin(TAU * 3450 * time) * Math.exp(-time / .025);
    return .34 * body + .35 * contact + .27 * rim;
  }

  function steelpanAt(time, size, decaySec) {
    const base = STEELPAN_PITCHES[size];
    let ringing = 0;
    PAN_MODES.forEach((ratio, index) => {
      ringing += PAN_WEIGHTS[index] * Math.exp(-time / (decaySec * (1.35 - index * .11))) *
        Math.sin(TAU * base * ratio * time);
    });
    const strike = .055 * Math.exp(-time / .008) * noiseAt(time);
    return (1 - Math.exp(-time / .0015)) * (.38 * ringing + strike);
  }

  // One struck chime with a crisp attack and decaying inharmonic ringing.
  // No stochastic sequence of collisions: repeated taps are separate hits.
  function chimeAt(time, pitchHz, decaySec) {
    let ring = 0;
    for (let mode = 0; mode < CHIME_MODES.length; mode++) {
      const partialDecay = decaySec * (1.35 - .21 * mode);
      ring += CHIME_WEIGHTS[mode] * Math.exp(-time / partialDecay) *
        Math.sin(TAU * pitchHz * CHIME_MODES[mode] * time + mode * .18);
    }
    const tick = .09 * Math.exp(-time / .004) * noiseAt(time);
    return (1 - Math.exp(-time / .001)) * (.48 * ring + tick);
  }

  // A dry struck wooden block: shorter, lower-Q inharmonic body modes plus
  // a brief hard-contact click. Sizes are qualitative timbre choices, not notes.
  function woodblockAt(time, size, decaySec) {
    const base = WOOD_BASES[size];
    const bodyDecay = .030 + .080 * decaySec;
    let body = 0;
    for (let mode = 0; mode < WOOD_MODES.length; mode++) {
      body += WOOD_WEIGHTS[mode] * Math.exp(-time / (bodyDecay / (1 + mode * .34))) *
        Math.sin(TAU * base * WOOD_MODES[mode] * time + mode * .18);
    }
    const tap = .22 * Math.exp(-time / .005) * noiseAt(time);
    return (1 - Math.exp(-time / .00065)) * (.42 * body + tap);
  }

  function sampleAt(kind, time, pitchHz, decaySec, kickSize = "medium", options = {}) {
    if (time <= 0) return 0;
    if (kind === "kick") {
      const voice = options.drumVoice ?? "membrane";
      if (voice === "snare") return snareAt(time, kickSize, options.drumTension ?? 1, decaySec);
      if (voice === "cymbal") return cymbalAt(time, kickSize, decaySec);
      if (voice === "tom") return tomAt(time, kickSize, options.drumTension ?? 1, decaySec);
      if (voice === "ride") return rideAt(time, decaySec);
      if (voice === "crash") return crashAt(time, decaySec);
      if (voice === "rimshot") return rimshotAt(time, decaySec);
      if (voice === "steelpan") return steelpanAt(time, kickSize, decaySec);
      if (voice === "chimes") return chimeAt(time, options.chimeHz ?? CHIME_PITCHES[kickSize], decaySec);
      if (voice === "woodblock") return woodblockAt(time, kickSize, decaySec);
      // Circular-membrane eigenfrequencies are Bessel zeros, not integer harmonics.
      return membraneAt(time, kickSize, options.drumTension ?? 1, decaySec);
    }
    if (kind === "pluck") {
      const position = options.position ?? .22;
      return options.strumChord ?
        strings.strumAt(time, options.strumChord, decaySec, position, options.strumPattern ?? "down") :
        strings.pluckAt(time, pitchHz, decaySec, position);
    }
    if (kind === "marimba") return marimba.sampleAt(time, pitchHz, decaySec,
      options.velocity ?? marimba.DEFAULT_VELOCITY, options.sampleRate ?? marimba.REFERENCE_RATE);
    if (kind === "xylophone") return xylophone.sampleAt(time, pitchHz, decaySec,
      options.velocity ?? xylophone.DEFAULT_VELOCITY, options.sampleRate ?? xylophone.REFERENCE_RATE);
    if (kind === "mandolin") return mandolin.sampleAt(time, pitchHz, decaySec,
      options.velocity ?? mandolin.DEFAULT_VELOCITY, options.sampleRate ?? mandolin.RATE,
      options.articulation ?? "pick");
    if (kind === "harp") return harp.sampleAt(time, pitchHz, decaySec,
      options.velocity ?? harp.DEFAULT_VELOCITY, options.sampleRate ?? 48000);
    if (options.pianoVoice === "electric") return fm.sampleAt(time, pitchHz,
      options.sampleRate ?? 48000, { decaySec, velocity: options.velocity ?? .55,
        touch: options.touch ?? "press" });
    return piano.sampleAt(time, pitchHz, decaySec, options.velocity ?? .55,
      options.touch ?? "press");
  }

  function duration(decaySec, kind = "") {
    if (kind === "harp") return harp.duration(decaySec);
    return Math.max(0.35, Math.min(3, decaySec * 4));
  }

  function plottedEnvelope(kind, time, decaySec, options = {}) {
    const length = duration(decaySec, kind);
    if (time >= length) return 0;
    return envelope(kind, time, decaySec, options) * Math.min(1, (length - time) / 0.018);
  }

  function plottedSampleAt(kind, time, pitchHz, decaySec, kickSize = "medium", options = {}) {
    const length = duration(decaySec, kind);
    if (time <= 0 || time >= length) return 0;
    const fade = Math.min(1, (length - time) / 0.018);
    return sampleAt(kind, time, pitchHz, decaySec, kickSize, options) * fade;
  }

  function makeSamples(kind, pitchHz, decaySec, sampleRate, kickSize = "medium", options = {}) {
    validate(kind, pitchHz, decaySec, kickSize, options);
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new RangeError("Unsupported sampling rate");
    }
    const seconds = duration(decaySec, kind);
    const count = Math.ceil(seconds * sampleRate);
    const samples = new Float32Array(count);
    // Supply the playback sample rate to models with sample-rate-aware mode
    // suppression. Tuned bars' fixed band caps also match the 16 kHz plots.
    const modelOptions = kind === "marimba" || kind === "xylophone" || kind === "mandolin" || kind === "harp" ||
      (kind === "piano" && options.pianoVoice === "electric") ?
      { ...options, sampleRate } : options;
    for (let i = 0; i < count; i++) {
      const time = i / sampleRate;
      samples[i] = plottedSampleAt(kind, time, pitchHz, decaySec, kickSize, modelOptions);
    }
    return samples;
  }

  function sliderToHz(position) {
    return MIN_PITCH_HZ * Math.pow(MAX_PITCH_HZ / MIN_PITCH_HZ, position / 1000);
  }

  function hzToSlider(hz) {
    return 1000 * Math.log(hz / MIN_PITCH_HZ) / Math.log(MAX_PITCH_HZ / MIN_PITCH_HZ);
  }

  return Object.freeze({
    KINDS, KICK_SIZES, DRUM_VOICES, COMPOSE_DRUM_VOICES, DRUM_MIN_TENSION, DRUM_MAX_TENSION,
    STEELPAN_PITCHES, CHIME_PITCHES, STRUM_CHORDS: strings.CHORDS, STRUM_PATTERNS: strings.STRUM_PATTERNS,
    MIN_PITCH_HZ, MAX_PITCH_HZ, MIN_DECAY, MAX_DECAY,
    PIANO_STIFFNESS: piano.STIFFNESS, PIANO_TOUCHES: piano.TOUCHES,
    pianoPartialHz: piano.pianoPartialHz,
    validate, envelope, plottedEnvelope, kickFrequency, drumModeFrequencies, drumReferenceHz,
    sampleAt, plottedSampleAt,
    duration, makeSamples, sliderToHz, hzToSlider
  });
});
