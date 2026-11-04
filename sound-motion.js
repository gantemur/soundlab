/* Moving Pitch: deterministic source/filter recipes shared by audio and plots.
 * The vowel and overtone settings are teaching approximations: one periodic
 * glottal-like source shaped by fixed vowel formants or a focused resonance.
 * Neither simulates vocal-fold dynamics or anatomical throat-singing geometry.
 */
(function (root, makeModel) {
  "use strict";
  const model = makeModel();
  if (typeof module === "object" && module.exports) module.exports = model;
  if (root) root.SoundLabMotionModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MIN_HZ = 120;
  const MAX_HZ = 1600;
  const MIN_RATE = 0.2;
  const MAX_RATE = 2;
  // Two tones are the rectangular trajectory; the others glide continuously.
  const PATTERNS = Object.freeze(["two-tone", "sine-sweep", "pitch-sweep"]);
  const TIMBRES = Object.freeze(["pure", "rich", "voice", "overtones"]);
  const VOWELS = Object.freeze(["a", "e", "i", "o", "u"]);
  const MIN_OVERTONE = 2, MAX_OVERTONE = 12;
  const PLOT_SAMPLE_RATE = 44100;
  // Illustrative vowel resonance centers, not measured Mongolian formants.
  // Q sets bandwidth, gain is the enhancement in dB at each formant.
  const VOWEL_FORMANTS = Object.freeze({
    a: Object.freeze([[750, 2.7, 17], [1250, 4.4, 13], [2700, 5.6, 8]]),
    e: Object.freeze([[520, 2.8, 17], [1900, 5.0, 15], [2750, 6.0, 8]]),
    i: Object.freeze([[310, 2.4, 17], [2300, 5.8, 16], [3000, 6.0, 7]]),
    o: Object.freeze([[520, 2.8, 17], [940, 3.6, 15], [2500, 5.5, 8]]),
    u: Object.freeze([[340, 2.5, 18], [810, 3.5, 14], [2300, 5.8, 8]])
  });
  // A tilted harmonic glottal-like excitation is shaped by resonant filters.
  // Unlike the old voice/overtones presets, the resonances need not track f0.
  const VOICE_SOURCE = Object.freeze(Array.from({ length: 24 }, (_, i) =>
    Math.pow(i + 1, -1.2)));
  const TIMBRE_PARTIALS = Object.freeze({
    pure: Object.freeze([1, 0, 0, 0, 0, 0, 0, 0]),
    rich: Object.freeze([1, .60, .45, .30, .22, .17, .12, .09]),
    voice: VOICE_SOURCE,
    overtones: VOICE_SOURCE
  });
  function timbrePartials(timbre) {
    if (!Object.hasOwn(TIMBRE_PARTIALS, timbre)) throw new RangeError("Unknown theremin timbre");
    return TIMBRE_PARTIALS[timbre];
  }

  function vowelFormants(vowel) {
    if (!Object.hasOwn(VOWEL_FORMANTS, vowel)) throw new RangeError("Unknown vowel");
    return VOWEL_FORMANTS[vowel];
  }
  function overtoneFocus(hz, harmonic) {
    if (!Number.isFinite(hz) || hz < MIN_HZ || hz > MAX_HZ ||
        !Number.isInteger(harmonic) || harmonic < MIN_OVERTONE || harmonic > MAX_OVERTONE) {
      throw new RangeError("Invalid overtone focus");
    }
    return Object.freeze({ frequency: harmonic * hz, q: 14,
      gain: Math.min(27, 12 + 8 * Math.log2(harmonic / 2)) });
  }
  function complexProduct(a, b) {
    return { real: a.real * b.real - a.imag * b.imag,
      imag: a.real * b.imag + a.imag * b.real };
  }
  // Discrete-time RBJ response of the exact peaking/lowpass BiquadFilterNode
  // recipes used for playback, including phase (assuming the selected rate).
  function biquadResponse(type, harmonicHz, cutoff, q, gain, sampleRate) {
    const center = Math.min(cutoff, .49 * sampleRate);
    const omega = 2 * Math.PI * center / sampleRate;
    const c = Math.cos(omega), alpha = Math.sin(omega) / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === "peaking") {
      const a = Math.pow(10, gain / 40);
      b0 = 1 + alpha * a; b1 = -2 * c; b2 = 1 - alpha * a;
      a0 = 1 + alpha / a; a1 = -2 * c; a2 = 1 - alpha / a;
    } else {
      b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0;
      a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    }
    const theta = 2 * Math.PI * harmonicHz / sampleRate;
    const br = b0 + b1 * Math.cos(theta) + b2 * Math.cos(2 * theta);
    const bi = -b1 * Math.sin(theta) - b2 * Math.sin(2 * theta);
    const ar = a0 + a1 * Math.cos(theta) + a2 * Math.cos(2 * theta);
    const ai = -a1 * Math.sin(theta) - a2 * Math.sin(2 * theta);
    const divisor = ar * ar + ai * ai;
    return { real: (br * ar + bi * ai) / divisor,
      imag: (bi * ar - br * ai) / divisor };
  }
  function timbreComponents(timbre, hz = 440, vowel = "a", harmonic = 6,
    sampleRate = PLOT_SAMPLE_RATE) {
    const partials = timbrePartials(timbre);
    if (!Number.isFinite(hz) || hz < MIN_HZ || hz > MAX_HZ ||
        !Number.isFinite(sampleRate) || sampleRate < 16000) {
      throw new RangeError("Invalid theremin pitch or sample rate");
    }
    const filters = [];
    if (timbre === "voice") {
      for (const [frequency, q, gain] of vowelFormants(vowel)) {
        filters.push(["peaking", frequency, q, gain]);
      }
      filters.push(["lowpass", 4300, Math.SQRT1_2, 0]);
    } else if (timbre === "overtones") {
      const focused = overtoneFocus(hz, harmonic);
      filters.push(["peaking", focused.frequency, focused.q, focused.gain]);
      filters.push(["lowpass", 5800, Math.SQRT1_2, 0]);
    }
    return Object.freeze(partials.map((source, i) => {
      const frequency = (i + 1) * hz;
      if (frequency >= sampleRate / 2) return Object.freeze({ sin: 0, cos: 0, magnitude: 0 });
      let response = { real: 1, imag: 0 };
      for (const [type, cutoff, q, gain] of filters) {
        response = complexProduct(response,
          biquadResponse(type, frequency, cutoff, q, gain, sampleRate));
      }
      return Object.freeze({ sin: source * response.real, cos: source * response.imag,
        magnitude: source * Math.hypot(response.real, response.imag) });
    }));
  }
  function waveFromComponents(phase, components) {
    return components.reduce((sum, c, index) => sum +
      c.sin * Math.sin((index + 1) * phase) + c.cos * Math.cos((index + 1) * phase), 0);
  }
  function timbreSpectrum(timbre, hz = 440, vowel = "a", harmonic = 6,
    sampleRate = PLOT_SAMPLE_RATE) {
    const components = timbreComponents(timbre, hz, vowel, harmonic, sampleRate);
    let peak = 0;
    for (let i = 0; i < 256; i++) {
      peak = Math.max(peak, Math.abs(waveFromComponents(i * 2 * Math.PI / 256, components)));
    }
    return Object.freeze({ components, peak: Math.max(peak, 1e-9) });
  }
  const DEFAULT_SPECTRA = Object.freeze(Object.fromEntries(TIMBRES.map(timbre =>
    [timbre, timbreSpectrum(timbre)])));
  function timbreWaveAt(phase, timbre, spectrum = null) {
    if (!Number.isFinite(phase)) throw new RangeError("Invalid wave phase");
    timbrePartials(timbre); // Validate before using an optional spectrum.
    const shape = spectrum || DEFAULT_SPECTRA[timbre];
    return waveFromComponents(phase, shape.components) / shape.peak;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function padHz(xFraction) {
    if (!Number.isFinite(xFraction)) throw new RangeError("Invalid pad position");
    return MIN_HZ * Math.pow(MAX_HZ / MIN_HZ, clamp(xFraction, 0, 1));
  }

  function padFraction(hz) {
    if (!Number.isFinite(hz) || hz <= 0) throw new RangeError("Invalid pad frequency");
    return clamp(Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ), 0, 1);
  }

  function padLevel(yFraction) {
    if (!Number.isFinite(yFraction)) throw new RangeError("Invalid pad height");
    return 1 - clamp(yFraction, 0, 1);
  }

  function validateSiren(recipe) {
    if (!recipe || !PATTERNS.includes(recipe.pattern)) throw new RangeError("Invalid siren pattern");
    if (!Number.isFinite(recipe.lowHz) || !Number.isFinite(recipe.highHz) ||
        recipe.lowHz < MIN_HZ || recipe.highHz > MAX_HZ || recipe.highHz - recipe.lowHz < 20) {
      throw new RangeError("Siren pitches must be separated and within range");
    }
    if (!Number.isFinite(recipe.rate) || recipe.rate < MIN_RATE || recipe.rate > MAX_RATE) {
      throw new RangeError("Siren speed outside supported range");
    }
  }

  function sirenHzAt(time, recipe) {
    validateSiren(recipe);
    if (!Number.isFinite(time) || time < 0) throw new RangeError("Invalid siren time");
    const phase = (time * recipe.rate) % 1;
    if (recipe.pattern === "two-tone") return phase < 0.5 ? recipe.lowHz : recipe.highHz;
    const fraction = phase <= 0.5 ? 2 * phase : 2 * (1 - phase);
    if (recipe.pattern === "pitch-sweep") {
      // Constant semitones per second: geometric interpolation of frequency.
      return recipe.lowHz * Math.pow(recipe.highHz / recipe.lowHz, fraction);
    }
    // A smooth sinusoidal Hz trajectory, with zero slope at both extremes.
    return recipe.lowHz + (recipe.highHz - recipe.lowHz) * (1 - Math.cos(2 * Math.PI * phase)) / 2;
  }

  return Object.freeze({
    MIN_HZ, MAX_HZ, MIN_RATE, MAX_RATE, PATTERNS, TIMBRES, VOWELS,
    MIN_OVERTONE, MAX_OVERTONE, PLOT_SAMPLE_RATE,
    timbrePartials, vowelFormants, overtoneFocus, timbreComponents, timbreSpectrum, timbreWaveAt,
    padHz, padFraction, padLevel, validateSiren, sirenHzAt
  });
});
