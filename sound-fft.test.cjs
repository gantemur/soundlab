"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fft = require("./sound-fft.js");

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}

test("shared radix-2 FFT agrees with a direct complex DFT", () => {
  for (const size of [2, 4, 8, 16, 32]) {
    const inputReal = Float64Array.from({ length: size }, (_, i) => Math.sin(i * 1.23) + i / 17);
    const inputImag = Float64Array.from({ length: size }, (_, i) => Math.cos(i * .77) - i / 19);
    const real = inputReal.slice(), imag = inputImag.slice();
    fft.transform(real, imag);
    for (let k = 0; k < size; k++) {
      let expectedReal = 0, expectedImag = 0;
      for (let i = 0; i < size; i++) {
        const angle = -2 * Math.PI * k * i / size, cosine = Math.cos(angle), sine = Math.sin(angle);
        expectedReal += inputReal[i] * cosine - inputImag[i] * sine;
        expectedImag += inputReal[i] * sine + inputImag[i] * cosine;
      }
      close(real[k], expectedReal); close(imag[k], expectedImag);
    }
  }
});

test("FFT keeps impulse, DC and Nyquist conventions and handles its largest size", () => {
  for (const size of [1024, 2048, 4096, 16384, 65536]) {
    const impulse = new Float64Array(size), imaginary = new Float64Array(size);
    impulse[0] = 1;
    fft.transform(impulse, imaginary);
    assert.ok(impulse.every(value => value === 1));
    assert.ok(imaginary.every(value => value === 0));
    const alternating = Float64Array.from({ length: size }, (_, i) => i % 2 ? -1 : 1);
    fft.transform(alternating, imaginary);
    close(alternating[size / 2], size);
    assert.ok(alternating.every((value, bin) => bin === size / 2 || Math.abs(value) < 1e-8));
  }
});

test("symmetric Hann has zero endpoints, symmetry and the expected coherent gain", () => {
  for (const size of [1024, 2048, 4096, 16384, 65536]) {
    const window = fft.hann(size);
    assert.equal(window[0], 0); assert.equal(window[size - 1], 0);
    for (let i = 0; i < size; i++) close(window[i], window[size - i - 1], 1e-14);
    close(window.reduce((sum, value) => sum + value, 0), (size - 1) / 2, 1e-8);
  }
});

test("FFT validates bounded sizes, nonfinite input, and nonoverlapping double buffers", () => {
  for (const size of [0, 1, 3, 1000, 131072, NaN, 3.5]) assert.throws(() => fft.hann(size), RangeError);
  assert.throws(() => fft.transform(new Float64Array(8), new Float64Array(4)), TypeError);
  assert.throws(() => fft.transform(new Float32Array(8), new Float64Array(8)), TypeError);
  const same = new Float64Array(8);
  assert.throws(() => fft.transform(same, same), TypeError);
  const shared = new ArrayBuffer(12 * 8);
  assert.throws(() => fft.transform(new Float64Array(shared, 0, 8), new Float64Array(shared, 4 * 8, 8)), TypeError);
  const separate = new ArrayBuffer(16 * 8);
  assert.doesNotThrow(() => fft.transform(new Float64Array(separate, 0, 8), new Float64Array(separate, 8 * 8, 8)));
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const input = new Float64Array(8); input[3] = invalid;
    assert.throws(() => fft.transform(input, new Float64Array(8)), RangeError);
  }
});
