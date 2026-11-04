"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const intervals = require("./sound-intervals.js");

function near(value, expected, tolerance = 1e-3) {
  assert.ok(Math.abs(value - expected) < tolerance, `${value} differs from ${expected}`);
}

test("S021 simple-ratio presets have the correct common cycles, periods and shared partials", () => {
  const upper = [220, 440, 330, 293.33333333, 275, 264];
  intervals.PRESETS.forEach((preset, index) => {
    const result = intervals.analyze({ ratio: preset.ratio, baseHz: 220, tuning: "just" });
    near(result.highHz, upper[index], 1e-6);
    near(result.referencePeriod, preset.q / 220, 1e-9);
    assert.equal(result.lowerCycles, preset.q);
    assert.equal(result.upperCycles, preset.p);
    assert.equal(result.exactOverlap, true);
    near(result.sharedLowHz, result.sharedHighHz, 1e-9);
    assert.equal(result.cents, 0);
  });
});

test("12-TET differs from 3:2, 4:3, 5:4 and 6:5 but not octave or unison", () => {
  for (const [ratio, upper, cents, nearBeat] of [
    ["3:2", 329.62756, -1.955, 0.74489],
    ["4:3", 293.66477, 1.955, 0.99431],
    ["5:4", 277.18263, 13.686, 8.73051],
    ["6:5", 261.62557, -15.641, 11.87217]
  ]) {
    const data = intervals.analyze({ ratio, baseHz: 220, tuning: "equal" });
    near(data.highHz, upper, 0.002);
    near(data.cents, cents, 0.002);
    near(data.discrepancyHz, nearBeat, 0.003);
    assert.equal(data.exactOverlap, false, `${ratio} has no exact shared harmonic in 12-TET`);
    assert.notEqual(data.sharedLowHz, data.sharedHighHz);
  }
  for (const ratio of ["1:1", "2:1"]) {
    const result = intervals.analyze({ ratio, baseHz: 220, tuning: "equal" });
    assert.equal(result.exactOverlap, true);
    near(result.discrepancyHz, 0, 1e-9);
  }
});

test("pure signals have only fundamentals; Rich signals have eight bounded harmonics", () => {
  assert.deepEqual(intervals.partialAmplitudes("pure"), [1, 0, 0, 0, 0, 0, 0, 0]);
  const rich = intervals.partialAmplitudes("rich");
  assert.equal(rich.length, 8);
  near(rich.reduce((a, b) => a + b, 0), 1, 1e-12);
  assert.ok(rich.every((weight, i) => weight > 0 && (i === 0 || weight < rich[i - 1])));
  const { real, imag } = intervals.coefficients("rich");
  assert.equal(real.length, 9);
  assert.equal(imag.length, 9);
  near(imag[3], rich[2], 1e-7);
  assert.equal(intervals.spectrum(220, "pure").length, 1);
  assert.equal(intervals.spectrum(220, "rich").length, 8);
  for (const t of [0, .0001, .001, .003, .009]) {
    assert.ok(Math.abs(intervals.sample(t, 220, "rich")) <= 1 + 1e-12);
  }
});

test("interval parameters are validated without evaluating arbitrary expressions", () => {
  for (const invalid of ["7:6", "2/1", "5:0", "3:2; alert(1)"]) {
    assert.throws(() => intervals.analyze({ ratio: invalid }), RangeError);
  }
  for (const baseHz of [NaN, -1, 0, 109, 441, Infinity]) {
    assert.throws(() => intervals.analyze({ baseHz }), RangeError);
  }
  assert.throws(() => intervals.analyze({ tuning: "pythagorean" }), RangeError);
  assert.throws(() => intervals.partialAmplitudes("square"), RangeError);
});
