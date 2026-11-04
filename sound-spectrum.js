/* Short-time Fourier analysis of the same modeled waveform sent to Web Audio.
 * A 128 ms Hann window stays independent of the waveform's zoom level.
 * This represents a finite-window spectrum, not an instantaneous Fourier transform.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabSpectrum = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SAMPLE_RATE = 16000;
  const FFT_SIZE = 2048;
  const WINDOW_SECONDS = FFT_SIZE / SAMPLE_RATE;
  const BIN_HZ = SAMPLE_RATE / FFT_SIZE;
  const hann = Float64Array.from({ length: FFT_SIZE }, (_, i) =>
    0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
  const windowSum = hann.reduce((sum, value) => sum + value, 0);

  function transform(real, imag) {
    const n = real.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      while (j & bit) { j ^= bit; bit >>= 1; }
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
    for (let length = 2; length <= n; length *= 2) {
      const angle = -2 * Math.PI / length;
      const cosine = Math.cos(angle), sine = Math.sin(angle);
      for (let start = 0; start < n; start += length) {
        let wr = 1, wi = 0;
        for (let k = 0; k < length / 2; k++) {
          const a = start + k, b = a + length / 2;
          const br = real[b] * wr - imag[b] * wi;
          const bi = real[b] * wi + imag[b] * wr;
          real[b] = real[a] - br;
          imag[b] = imag[a] - bi;
          real[a] += br;
          imag[a] += bi;
          const nextWr = wr * cosine - wi * sine;
          wi = wr * sine + wi * cosine;
          wr = nextWr;
        }
      }
    }
  }

  function spectrumAt(model, recipe, centerSeconds) {
    const { kind, pitchHz, decaySec, kickSize = "medium", options = {} } = recipe;
    model.validate(kind, pitchHz, decaySec, kickSize, options);
    if (!Number.isFinite(centerSeconds) || centerSeconds < 0 || centerSeconds > 3) {
      throw new RangeError("Analysis time must be within 0–3 seconds");
    }
    const real = new Float64Array(FFT_SIZE), imag = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      const time = centerSeconds + (i - FFT_SIZE / 2) / SAMPLE_RATE;
      real[i] = hann[i] * model.plottedSampleAt(kind, time, pitchHz, decaySec, kickSize, options);
    }
    transform(real, imag);
    const magnitudes = new Float32Array(FFT_SIZE / 2 + 1);
    for (let i = 0; i < magnitudes.length; i++) {
      magnitudes[i] = 2 * Math.hypot(real[i], imag[i]) / windowSum;
    }
    return { magnitudes, binHz: BIN_HZ };
  }

  function spectrumOverall(model, recipe) {
    const length = model.duration(recipe.decaySec);
    const magnitudes = new Float32Array(FFT_SIZE / 2 + 1);
    const segments = 24;
    for (let i = 0; i < segments; i++) {
      const current = spectrumAt(model, recipe, length * (i + 0.5) / segments).magnitudes;
      for (let j = 0; j < magnitudes.length; j++) magnitudes[j] += current[j] * current[j] / segments;
    }
    for (let j = 0; j < magnitudes.length; j++) magnitudes[j] = Math.sqrt(magnitudes[j]);
    return { magnitudes, binHz: BIN_HZ };
  }

  return Object.freeze({ SAMPLE_RATE, FFT_SIZE, WINDOW_SECONDS, BIN_HZ, spectrumAt, spectrumOverall });
});
