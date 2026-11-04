"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const harmonics = require("./sound-harmonics.js");

test("harmonic presets preserve a fundamental and explain odd versus all partials", () => {
  const pure = harmonics.preset("pure"), odd = harmonics.preset("odd"), rich = harmonics.preset("rich");
  assert.equal(pure.length, harmonics.COUNT);
  assert.equal(pure[0], 1);
  assert.equal(odd[1], 0);
  assert.equal(odd[2], 1 / 3);
  assert.equal(rich[1], 1 / 2);
  assert.notStrictEqual(odd, harmonics.preset("odd"), "Recipes are independent mutable copies");
  assert.throws(() => harmonics.preset("missing"), RangeError);
});

test("harmonic formula and Web Audio coefficients agree on all eight terms", () => {
  const partials = harmonics.preset("rich");
  const { real, imag } = harmonics.periodicCoefficients(partials);
  assert.equal(real.length, 9);
  assert.equal(real.every(value => value === 0), true);
  assert.deepEqual([...imag].map(x => Number(x.toFixed(3))),
    [0, 1, .5, .333, .25, .2, .167, .143, .125]);
  const lines = harmonics.spectralLines(220, partials);
  assert.deepEqual(lines.map(x => x.hz), [220, 440, 660, 880, 1100, 1320, 1540, 1760]);
  const peak = harmonics.peak(partials);
  for (let i = 0; i < 2000; i++) {
    assert.ok(Math.abs(harmonics.sampleAt(i / 100000, 220, partials, peak)) <= 1.001);
  }
  assert.ok(Math.abs(harmonics.sampleAt(.001, 220, partials) -
    harmonics.sampleAt(.001, 220, partials, peak)) < 1e-12);
});

test("invalid bases and absent fundamental cannot silently become unpitched output", () => {
  assert.throws(() => harmonics.validate(0, harmonics.preset("pure")), RangeError);
  assert.throws(() => harmonics.validate(4000, harmonics.preset("pure")), RangeError);
  const silent = harmonics.preset("pure"); silent[0] = 0;
  assert.throws(() => harmonics.periodicCoefficients(silent), RangeError);
  assert.throws(() => harmonics.validate(440, new Array(8).fill(2)), RangeError);
});
