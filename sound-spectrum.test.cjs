"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const transient = require("./sound-transient.js");
const analysis = require("./sound-spectrum.js");

function peakHz(spectrum, min = 20, max = 8000) {
  let index = 0, amplitude = -Infinity;
  for (let i = Math.ceil(min / spectrum.binHz); i <= Math.min(spectrum.magnitudes.length - 1, Math.floor(max / spectrum.binHz)); i++) {
    if (spectrum.magnitudes[i] > amplitude) { amplitude = spectrum.magnitudes[i]; index = i; }
  }
  return index * spectrum.binHz;
}

test("short-time spectrum identifies plucked fundamentals and changing overtone strengths", () => {
  const recipe = { kind: "pluck", pitchHz: 220, decaySec: 0.65 };
  const early = analysis.spectrumAt(transient, recipe, 0.04);
  const later = analysis.spectrumAt(transient, recipe, 0.25);
  assert.ok(Math.abs(peakHz(early) - 220) < 15);
  const bandMax = (result, low, high) => Math.max(...result.magnitudes.slice(
    Math.round(low / result.binHz), Math.round(high / result.binHz)));
  const highEarly = bandMax(early, 640, 680);
  const highLate = bandMax(later, 640, 680);
  assert.ok(highEarly > highLate * 1.3, "The third harmonic loses energy as the string rings");
  const relative = s => bandMax(s, 640, 680) / bandMax(s, 210, 230);
  assert.ok(relative(early) > relative(later), "Upper harmonics decay faster relative to the fundamental");
  assert.ok(early.magnitudes.every(Number.isFinite));
  const overall = analysis.spectrumOverall(transient, recipe);
  assert.ok(Math.abs(peakHz(overall) - 220) < 15);
});

test("membrane modes have fixed inharmonic frequencies affected by size and tension", () => {
  const medium = { kind: "kick", pitchHz: 220, decaySec: 0.65, kickSize: "medium" };
  const early = analysis.spectrumAt(transient, medium, 0.04);
  const late = analysis.spectrumAt(transient, medium, 0.3);
  assert.ok(Math.abs(peakHz(early, 20, 350) - 112) < 15);
  assert.ok(Math.abs(peakHz(late, 20, 350) - 112) < 15);
  assert.ok(transient.kickFrequency(0, "large") < transient.kickFrequency(0, "small"));
  assert.ok(transient.kickFrequency(0.5, "large") < transient.kickFrequency(0.5, "small"));
  const large = analysis.spectrumAt(transient, { ...medium, kickSize: "large" }, 0.1);
  const small = analysis.spectrumAt(transient, { ...medium, kickSize: "small" }, 0.1);
  assert.ok(peakHz(large, 20, 350) < peakHz(small, 20, 350));
  const tight = analysis.spectrumAt(transient, { ...medium, options: { drumTension: 2 } }, 0.1);
  assert.ok(peakHz(tight, 20, 350) > peakHz(early, 20, 350));
});

test("strumming creates several stable guitar frequencies in the local spectrum", () => {
  const recipe = { kind: "pluck", pitchHz: 220, decaySec: .65, options: { strumChord: "em" } };
  const chord = analysis.spectrumAt(transient, recipe, .15);
  const fundamental = [82.4, 123.5, 164.8, 196.0, 246.9, 329.6];
  const around = hz => Math.max(...chord.magnitudes.slice(
    Math.round((hz - 8) / chord.binHz), Math.round((hz + 8) / chord.binHz) + 1));
  for (const hz of fundamental) assert.ok(around(hz) > .005, `${hz} Hz guitar string is audible`);
  const single = analysis.spectrumAt(transient, { kind: "pluck", pitchHz: 220, decaySec: .65 }, .15);
  assert.ok(chord.magnitudes.some((value, i) => value > single.magnitudes[i] * 5 && value > .01),
    "Strummed chord adds notes beyond a single string");
});

test("Fourier analysis rejects invalid time and recipe inputs", () => {
  assert.equal(analysis.FFT_SIZE, 2048);
  assert.ok(Math.abs(analysis.WINDOW_SECONDS - 0.128) < 1e-9);
  assert.throws(() => analysis.spectrumAt(transient, { kind: "kick", decaySec: 0.3 }, -0.1), RangeError);
  assert.throws(() => analysis.spectrumAt(transient, { kind: "kick", decaySec: 0.3, kickSize: "huge" }, 0.1), RangeError);
});
