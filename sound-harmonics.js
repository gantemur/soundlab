/* Pure, deterministic harmonic recipes for teaching additive synthesis.
 * Each partial is a sine at an integer multiple of the chosen base frequency.
 * The browser AudioContext can render the same coefficients as a PeriodicWave.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabHarmonics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COUNT = 8;
  const MIN_HZ = 120;
  const MAX_HZ = 1000;
  const PRESETS = Object.freeze({
    pure: Object.freeze([1, 0, 0, 0, 0, 0, 0, 0]),
    odd: Object.freeze(Array.from({ length: COUNT }, (_, i) => (i % 2 ? 0 : 1 / (i + 1)))),
    rich: Object.freeze(Array.from({ length: COUNT }, (_, i) => 1 / (i + 1)))
  });

  function validate(baseHz, partials) {
    if (!Number.isFinite(baseHz) || baseHz < MIN_HZ || baseHz > MAX_HZ) {
      throw new RangeError("Harmonic base frequency outside the supported range");
    }
    if (!Array.isArray(partials) || partials.length !== COUNT || partials.some((a, i) =>
      !Number.isFinite(a) || a < (i === 0 ? 0.1 : 0) || a > 1)) {
      throw new RangeError("Harmonic strengths must be an eight-element 0–1 array with a present fundamental");
    }
  }

  function preset(name) {
    if (!Object.hasOwn(PRESETS, name)) throw new RangeError("Unknown harmonic recipe");
    return [...PRESETS[name]];
  }

  function rawAt(phase, partials) {
    let value = 0;
    for (let n = 0; n < COUNT; n++) value += partials[n] * Math.sin((n + 1) * phase);
    return value;
  }

  function peak(partials) {
    validate(440, partials);
    let maximum = 0;
    for (let i = 0; i < 4096; i++) maximum = Math.max(maximum,
      Math.abs(rawAt(2 * Math.PI * i / 4096, partials)));
    return Math.max(0.000001, maximum);
  }

  function sampleAt(time, baseHz, partials, normalizer = peak(partials)) {
    validate(baseHz, partials);
    if (!Number.isFinite(time)) throw new RangeError("Invalid harmonic time");
    return rawAt(2 * Math.PI * baseHz * time, partials) / normalizer;
  }

  function spectralLines(baseHz, partials) {
    validate(baseHz, partials);
    return partials.map((strength, i) => ({ number: i + 1, hz: (i + 1) * baseHz, strength }));
  }

  function periodicCoefficients(partials) {
    validate(440, partials);
    const real = new Float32Array(COUNT + 1);
    const imag = new Float32Array(COUNT + 1);
    partials.forEach((strength, i) => { imag[i + 1] = strength; });
    return { real, imag };
  }

  return Object.freeze({ COUNT, MIN_HZ, MAX_HZ, PRESETS, validate, preset, peak,
    sampleAt, spectralLines, periodicCoefficients });
});
