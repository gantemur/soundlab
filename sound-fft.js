/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Dependency-free, in-place radix-2 Fourier transform. No audio or DOM state.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabFFT = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const MAX_SIZE = 65536;

  function validateSize(size) {
    if (!Number.isInteger(size) || size < 2 || size > MAX_SIZE || (size & (size - 1))) {
      throw new RangeError("FFT length must be a power of two between 2 and 65,536");
    }
  }

  function hann(size) {
    validateSize(size);
    // Symmetric Hann: endpoints are zero; this window is not periodic.
    return Float64Array.from({ length: size }, (_, i) =>
      0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
  }

  function transform(real, imag) {
    if (!(real instanceof Float64Array) || !(imag instanceof Float64Array) || real === imag ||
        real.length !== imag.length) throw new TypeError("FFT needs two distinct equal-length Float64Array buffers");
    const n = real.length;
    validateSize(n);
    if (real.buffer === imag.buffer && real.byteOffset < imag.byteOffset + imag.byteLength &&
        imag.byteOffset < real.byteOffset + real.byteLength) {
      throw new TypeError("FFT real and imaginary buffers must not overlap");
    }
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(real[i]) || !Number.isFinite(imag[i])) {
        throw new RangeError("FFT input samples must be finite");
      }
    }
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

  return Object.freeze({ MAX_SIZE, hann, transform });
});
