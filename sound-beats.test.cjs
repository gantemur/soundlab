"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const beats = require("./sound-beats.js");

const recipe = { baseHz: 440, gapHz: 4 };
const close = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-9,
  `${value} != ${expected}`);

test("440 and 444 Hz produce exactly four ideal beats per second", () => {
  assert.deepEqual(beats.frequencies(recipe), [440, 444]);
  assert.equal(beats.beatRate(recipe), 4);
  close(beats.envelopeAt(0, recipe), 1);
  close(beats.envelopeAt(0.125, recipe), 0);
  close(beats.envelopeAt(0.25, recipe), 1);
  close(beats.envelopeAt(0.375, recipe), 0);
  close(beats.envelopeAt(0.5, recipe), 1);
  for (const t of [0, 0.013, 0.125, 0.3, 1]) {
    close(beats.sampleAt(t, recipe),
      (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 444 * t)) / 2);
    assert.ok(Math.abs(beats.sampleAt(t, recipe)) <= beats.envelopeAt(t, recipe) + 1e-9);
  }
});

test("the ideal spectrum shows only the original tones, never a spurious low-frequency peak", () => {
  assert.deepEqual(beats.spectrumLines(recipe), [
    { hz: 440, amplitude: 0.5 }, { hz: 444, amplitude: 0.5 }
  ]);
  assert.deepEqual(beats.spectrumLines({ baseHz: 440, gapHz: 0 }),
    [{ hz: 440, amplitude: 1 }]);
  assert.equal(beats.beatRate({ baseHz: 440, gapHz: 0 }), 0);
  close(beats.envelopeAt(2, { baseHz: 440, gapHz: 0 }), 1);
});

test("beat calculations reject out-of-range frequencies and invalid times", () => {
  for (const bad of [
    null, {}, { baseHz: 119, gapHz: 4 }, { baseHz: 1001, gapHz: 4 },
    { baseHz: 440, gapHz: -1 }, { baseHz: 440, gapHz: 20.5 },
    { baseHz: NaN, gapHz: 4 }, { baseHz: 440, gapHz: Infinity }
  ]) assert.throws(() => beats.frequencies(bad), RangeError);
  for (const t of [-0.1, NaN, Infinity]) {
    assert.throws(() => beats.sampleAt(t, recipe), RangeError);
    assert.throws(() => beats.envelopeAt(t, recipe), RangeError);
  }
});
