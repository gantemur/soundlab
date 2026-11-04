"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("./sound-ear-tune.js");

test("all ear exercises consist of a single ratio, starting imperfectly tuned", () => {
  assert.equal(Object.keys(model.TASKS).length, 7);
  for (const [taskId, task] of Object.entries(model.TASKS)) {
    const before = model.step({ taskId });
    assert.ok(Math.abs(before.errorCents) >= 15);
    assert.ok(before.nearBeatHz > 0);
    const exact = model.step({ taskId, adjustment: -model.OFFSETS[taskId] });
    assert.ok(Math.abs(exact.errorCents) < 1e-12);
    assert.ok(Math.abs(exact.nearBeatHz) < 1e-9);
    assert.ok(Math.abs(exact.tunedHz / exact.referenceHz - task.ratio) < 1e-12);
    assert.equal(model.rating(exact.errorCents), "excellent");
  }
});

test("descending 3:4, 2:3 and 1:2 tune below C4 then lift into the C4 octave", () => {
  for (const [taskId, ratio, foldedRatio] of [
    ["downFourth", 3 / 4, 3 / 2],
    ["downFifth", 2 / 3, 4 / 3],
    ["octaveDown", 1 / 2, 1]
  ]) {
    const data = model.step({ taskId, adjustment: -model.OFFSETS[taskId] });
    assert.ok(Math.abs(data.tunedHz / model.START_HZ - ratio) < 1e-12);
    assert.equal(data.shifts, 1);
    assert.ok(Math.abs(data.foldedHz / model.START_HZ - foldedRatio) < 1e-12);
  }
});

test("octave equivalent stays in the same chosen direction despite slight detuning", () => {
  const up = model.step({ taskId: "octaveUp" });
  const down = model.step({ taskId: "octaveDown", adjustment: -60 });
  assert.equal(up.shifts, -1);
  assert.equal(down.shifts, 1);
  assert.ok(up.foldedHz > 0 && down.foldedHz > 0);
  assert.ok(Math.abs(model.cents(up.foldedHz, model.START_HZ) - model.OFFSETS.octaveUp) < 1e-8);
  assert.equal(model.foldOctave(model.START_HZ / 3).shifts, 2);
});

test("pure, rich, guitar-like, and piano-like overtone recipes are bounded", () => {
  for (const sound of model.SOUNDS) {
    const partials = model.partials(sound);
    assert.equal(partials.length, sound === "pure" ? 1 : 8);
    assert.ok(Math.abs(partials.reduce((sum, p) => sum + p.amplitude, 0) - 1) < 1e-12);
    assert.ok(partials.every(p => p.amplitude >= 0 && p.multiplier > 0));
  }
  assert.ok(model.partials("piano")[2].multiplier > 3);
  assert.equal(model.partials("guitar")[1].multiplier, 2);
  assert.deepEqual(model.PATTERNS, ["alternating", "together"]);
});

test("invalid tasks, timbres and frequencies are rejected", () => {
  assert.throws(() => model.step({ taskId: "unknown" }), RangeError);
  assert.throws(() => model.step({ taskId: "chain2" }), RangeError);
  assert.throws(() => model.step({ adjustment: NaN }), RangeError);
  assert.throws(() => model.step({ referenceHz: 0 }), RangeError);
  assert.throws(() => model.foldOctave(0), RangeError);
  assert.throws(() => model.partials("violin"), RangeError);
});
