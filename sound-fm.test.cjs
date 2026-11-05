"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fm = require("./sound-fm.js");

function rms(samples, begin, end) {
  let energy = 0;
  for (let i = begin; i < end; i++) energy += samples[i] * samples[i];
  return Math.sqrt(energy / (end - begin));
}

test("two-operator electric piano has a bounded, decaying attack and silent buffer edges", () => {
  const rate = 16000;
  const samples = fm.makeElectricPianoSamples(440, rate);
  assert.equal(samples.length, Math.ceil(rate * fm.DURATION_SECONDS));
  assert.equal(samples[0], 0);
  assert.ok(Math.abs(samples.at(-1)) < .005);
  assert.ok(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1));
  assert.ok(rms(samples, rate * .03, rate * .1) >
    rms(samples, rate * 1.6, rate * 1.7) * 3, "The modeled piano dies away rather than sustaining");
});

test("FM piano is deterministic, pitched and timbrally different from a sine", () => {
  const rate = 16000;
  const a = fm.makeElectricPianoSamples(220, rate);
  const b = fm.makeElectricPianoSamples(220, rate);
  const higher = fm.makeElectricPianoSamples(440, rate);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.slice(200, 300), higher.slice(200, 300));
  // Against a sinusoid at the carrier frequency, rapid sidebands must remain.
  const t = 0.035;
  const sample = a[Math.round(t * rate)];
  const pure = Math.sin(2 * Math.PI * 220 * t);
  assert.ok(Math.abs(sample - pure) > .02);
});

test("FM piano rejects unusable pitch and sample-rate inputs", () => {
  for (const frequency of [0, 109, 881, Infinity, NaN]) {
    assert.throws(() => fm.makeElectricPianoSamples(frequency, 16000), RangeError);
  }
  for (const sampleRate of [0, 4000, Infinity, NaN]) {
    assert.throws(() => fm.makeElectricPianoSamples(440, sampleRate), RangeError);
  }
  assert.ok(fm.makeElectricPianoSamples(880, 8000).every(Number.isFinite));
});
