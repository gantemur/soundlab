"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const noise = require("./sound-noise.js");

function correlation(samples) {
  let adjacent = 0, energy = 0;
  for (let i = 500; i < samples.length; i++) {
    adjacent += samples[i] * samples[i - 1];
    energy += samples[i] * samples[i];
  }
  return adjacent / energy;
}

test("seeded noise buffers are repeatable, bounded and start/end silently for looping", () => {
  for (const color of noise.COLORS) {
    const a = noise.makeSamples(color, 16000, .5, 7);
    const b = noise.makeSamples(color, 16000, .5, 7);
    assert.deepEqual(a, b);
    assert.equal(a.length, 8000);
    assert.equal(a[0], 0);
    assert.equal(a.at(-1), 0);
    assert.ok(a.some(value => Math.abs(value) > .05));
    assert.ok(a.every(value => Math.abs(value) <= .90001));
  }
});

test("white, pink and brown have increasingly correlated local fluctuations", () => {
  const white = correlation(noise.makeSamples("white", 16000, 2));
  const pink = correlation(noise.makeSamples("pink", 16000, 2));
  const brown = correlation(noise.makeSamples("brown", 16000, 2));
  assert.ok(white < .1, `white lag-1 correlation ${white}`);
  assert.ok(pink > white + .2, `pink lag-1 correlation ${pink}`);
  assert.ok(brown > pink, `brown lag-1 correlation ${brown}`);
});

test("the ideal spectrum distinguishes noise colors and a bright/dark filter", () => {
  assert.ok(Math.abs(noise.expectedMagnitude("white", 100, 8000) -
    noise.expectedMagnitude("white", 1000, 8000)) < .0002);
  assert.ok(noise.expectedMagnitude("pink", 100, 8000) >
    noise.expectedMagnitude("pink", 1000, 8000));
  assert.ok(noise.expectedMagnitude("brown", 100, 8000) >
    noise.expectedMagnitude("pink", 100, 8000));
  assert.ok(noise.expectedMagnitude("white", 5000, 1000) <
    noise.expectedMagnitude("white", 5000, 8000));
  assert.throws(() => noise.makeSamples("purple", 44100), RangeError);
  assert.throws(() => noise.makeSamples("white", 2000), RangeError);
  assert.throws(() => noise.expectedMagnitude("white", 0, 1000), RangeError);
});
