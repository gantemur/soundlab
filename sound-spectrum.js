/* Short-time Fourier analysis of the same modeled waveform sent to Web Audio.
 * A 128 ms Hann window stays independent of the waveform's zoom level.
 * This represents a finite-window spectrum, not an instantaneous Fourier transform.
 */
(function (root, factory) {
  "use strict";
  const fft = typeof module === "object" && module.exports ? require("./sound-fft.js") : root.SoundLabFFT;
  const api = factory(fft);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabSpectrum = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (fft) {
  "use strict";
  const SAMPLE_RATE = 16000;
  const FFT_SIZE = 2048;
  const WINDOW_SECONDS = FFT_SIZE / SAMPLE_RATE;
  const BIN_HZ = SAMPLE_RATE / FFT_SIZE;
  const hann = fft.hann(FFT_SIZE);
  const windowSum = hann.reduce((sum, value) => sum + value, 0);

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
    fft.transform(real, imag);
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
