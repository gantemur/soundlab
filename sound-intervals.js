/* Two independent fundamentals in a small-integer musical interval. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabIntervals = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const MIN_BASE_HZ = 110;
  const MAX_BASE_HZ = 440;
  const PARTIAL_COUNT = 8;
  const PRESETS = Object.freeze([
    Object.freeze({ ratio: "1:1", p: 1, q: 1, semitones: 0 }),
    Object.freeze({ ratio: "2:1", p: 2, q: 1, semitones: 12 }),
    Object.freeze({ ratio: "3:2", p: 3, q: 2, semitones: 7 }),
    Object.freeze({ ratio: "4:3", p: 4, q: 3, semitones: 5 }),
    Object.freeze({ ratio: "5:4", p: 5, q: 4, semitones: 4 }),
    Object.freeze({ ratio: "6:5", p: 6, q: 5, semitones: 3 })
  ]);

  function preset(ratio) {
    const found = PRESETS.find(item => item.ratio === ratio);
    if (!found) throw new RangeError("Unknown interval ratio");
    return found;
  }

  function analyze({ ratio = "3:2", baseHz = 220, tuning = "just" } = {}) {
    const item = preset(ratio);
    if (!Number.isFinite(baseHz) || baseHz < MIN_BASE_HZ || baseHz > MAX_BASE_HZ) {
      throw new RangeError("Lower-note frequency must be between 110 and 440 Hz");
    }
    if (tuning !== "just" && tuning !== "equal") throw new RangeError("Unknown tuning");
    const justRatio = item.p / item.q;
    const equalRatio = Math.pow(2, item.semitones / 12);
    const actualRatio = tuning === "just" ? justRatio : equalRatio;
    const highHz = baseHz * actualRatio;
    const justHighHz = baseHz * justRatio;
    const referencePeriod = item.q / baseHz;
    const sharedLowHz = item.p * baseHz;
    const sharedHighHz = item.q * highHz;
    const discrepancyHz = Math.abs(sharedLowHz - sharedHighHz);
    const exactOverlap = discrepancyHz < 1e-9;
    return {
      ...item, baseHz, highHz, justHighHz, tuning, justRatio, actualRatio,
      cents: 1200 * Math.log2(actualRatio / justRatio),
      referencePeriod, lowerCycles: item.q, upperCycles: item.p,
      sharedLowHz, sharedHighHz, discrepancyHz, exactOverlap
    };
  }

  function partialAmplitudes(color = "rich") {
    if (color !== "rich" && color !== "pure") throw new RangeError("Unknown source color");
    const weights = Array.from({ length: PARTIAL_COUNT }, (_, i) =>
      color === "pure" ? (i === 0 ? 1 : 0) : 1 / (i + 1));
    // Fixed conservative normalization keeps the actual Web Audio sum bounded.
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(weight => weight / sum);
  }

  function coefficients(color = "rich") {
    const amplitudes = partialAmplitudes(color);
    const real = new Float32Array(PARTIAL_COUNT + 1);
    const imag = new Float32Array(PARTIAL_COUNT + 1);
    amplitudes.forEach((strength, i) => { imag[i + 1] = strength; });
    return { real, imag };
  }

  function sample(t, baseHz, color = "rich") {
    return partialAmplitudes(color).reduce((sum, strength, i) =>
      sum + strength * Math.sin(2 * Math.PI * (i + 1) * baseHz * t), 0);
  }

  function spectrum(baseHz, color = "rich") {
    return partialAmplitudes(color).map((strength, i) => ({
      harmonic: i + 1, hz: (i + 1) * baseHz, strength
    })).filter(line => line.strength > 0);
  }

  return Object.freeze({ MIN_BASE_HZ, MAX_BASE_HZ, PARTIAL_COUNT, PRESETS,
    preset, analyze, partialAmplitudes, coefficients, sample, spectrum });
});
