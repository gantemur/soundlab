/* Reproducible models of white, pink-ish (octave-layered), and brown noise.
 * These are generated signals, not recordings or measurements of a microphone.
 * A second-order low-pass filter is applied by Web Audio during playback.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabNoise = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COLORS = Object.freeze(["white", "pink", "brown"]);
  const MIN_CUTOFF = 250;
  const MAX_CUTOFF = 8000;
  const SLOPES = Object.freeze({ white: 0, pink: 1, brown: 2 });

  function validate(color, sampleRate) {
    if (!COLORS.includes(color)) throw new RangeError("Unknown noise color");
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new RangeError("Unsupported noise sample rate");
    }
  }

  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeSamples(color, sampleRate, seconds = 2, seed = 14389) {
    validate(color, sampleRate);
    if (!Number.isFinite(seconds) || seconds < .1 || seconds > 4) {
      throw new RangeError("Noise buffer length outside safe bounds");
    }
    const count = Math.ceil(seconds * sampleRate);
    const samples = new Float32Array(count);
    const rng = random(seed), layers = new Float64Array(9);
    const brownRetention = Math.exp(-2 * Math.PI * 12 / sampleRate);
    let brownValue = 0, energy = 0, maximum = 0;
    for (let i = 0; i < count; i++) {
      const white = rng() * 2 - 1;
      let value = white;
      if (color === "pink") {
        let sum = 0;
        for (let octave = 0; octave < layers.length; octave++) {
          if (i % (1 << octave) === 0) layers[octave] = rng() * 2 - 1;
          sum += layers[octave];
        }
        value = (sum + white) / (layers.length + 1);
      } else if (color === "brown") {
        brownValue = brownRetention * brownValue + (1 - brownRetention) * white;
        value = brownValue;
      }
      samples[i] = value;
      energy += value * value;
      maximum = Math.max(maximum, Math.abs(value));
    }
    const rms = Math.sqrt(energy / count);
    const scale = Math.min(.4 / Math.max(rms, 1e-8), .9 / Math.max(maximum, 1e-8));
    const edge = Math.max(1, Math.round(.008 * sampleRate));
    for (let i = 0; i < count; i++) {
      const fade = Math.min(1, i / edge, (count - 1 - i) / edge);
      samples[i] = fade === 0 ? 0 : samples[i] * scale * fade;
    }
    return samples;
  }

  function expectedMagnitude(color, frequencyHz, cutoffHz) {
    if (!COLORS.includes(color) || !Number.isFinite(frequencyHz) || frequencyHz <= 0 ||
        !Number.isFinite(cutoffHz) || cutoffHz < MIN_CUTOFF || cutoffHz > MAX_CUTOFF) {
      throw new RangeError("Invalid noise spectrum parameters");
    }
    const colorShape = Math.pow(Math.max(30, frequencyHz) / 500, -SLOPES[color] / 2);
    const lowPass = 1 / Math.sqrt(1 + Math.pow(frequencyHz / cutoffHz, 4));
    return colorShape * lowPass;
  }

  return Object.freeze({ COLORS, MIN_CUTOFF, MAX_CUTOFF, SLOPES, validate, makeSamples,
    expectedMagnitude });
});
