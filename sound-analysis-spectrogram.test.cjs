"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const spectral = require("./sound-analysis-spectrogram.js");

const rate = 16000;
const sine = (hz, amplitude = .5, seconds = 2) => Float32Array.from(
  { length: Math.round(seconds * rate) },
  (_, i) => amplitude * Math.sin(2 * Math.PI * hz * i / rate));

function hottest(result, time) {
  const column = Math.max(0, Math.min(result.columns - 1,
    Math.round(time * result.sampleRate / result.hopFrames - result.firstColumn - .5)));
  let row = 0, level = -1;
  for (let k = 0; k < result.rows; k++) {
    const value = result.pixels[column * result.rows + k];
    if (value > level) { row = k; level = value; }
  }
  return { row, level, hz: spectral.frequencyAtFraction((row + .5) / result.rows,
    result.sampleRate, result.fftSize, result.axis) };
}

test("1024 Hann spectrogram shares one-sided dB convention and fixed source-independent scale", async () => {
  const cache = new spectral.TileCache();
  const a = await cache.view(sine(500), rate, 0, 2, { fftSize: 1024, rows: 160 });
  const note = hottest(a, 1);
  assert.ok(Math.abs(note.hz - 500) < 65, JSON.stringify(note));
  assert.ok(Math.abs(note.level - spectral.intensity(.5)) <= 2,
    "Bin-centred half-scale sine stays at about -6.02 dB relative to unit peak");
  assert.equal(a.minDb, -100); assert.equal(a.maxDb, 0);
  assert.equal(a.windowSeconds, 1024 / rate);
  assert.equal(a.minHz, 0); assert.equal(a.maxHz, rate / 2);
  const quiet = await cache.view(sine(500, .25), rate, 0, 2, { fftSize: 1024, rows: 160 });
  assert.ok(Math.abs(note.level - hottest(quiet, 1).level - 15.35) < 3,
    "Halving amplitude means -6.02 dB, without automatic brightening");
  assert.ok(cache.tiles.size <= spectral.MAX_TILES);
});

test("known rising chirp forms a timed ridge; a narrow impulse stays localized", async () => {
  const chirp = Float32Array.from({ length: 3 * rate }, (_, i) => {
    const t = i / rate;
    return .5 * Math.sin(2 * Math.PI * (200 * t + 700 * t * t / 3));
  });
  const cache = new spectral.TileCache();
  const image = await cache.view(chirp, rate, 0, 3, { fftSize: 1024, rows: 160 });
  const a = hottest(image, .5), b = hottest(image, 1.5), c = hottest(image, 2.5);
  assert.ok(a.hz < b.hz && b.hz < c.hz);
  for (const [actual, expected] of [[a.hz, 200 + 1400 * .5 / 3],
    [b.hz, 200 + 1400 * 1.5 / 3], [c.hz, 200 + 1400 * 2.5 / 3]]) {
    assert.ok(Math.abs(actual - expected) < 100, `ridge ${actual} versus ${expected}`);
  }
  const transient = new Float32Array(2 * rate); transient[Math.round(.8 * rate)] = 1;
  const hit = await cache.view(transient, rate, 0, 2, { fftSize: 1024, rows: 80 });
  assert.equal(hottest(hit, .2).level, 0);
  assert.equal(hottest(hit, 1.5).level, 0);
  assert.ok(hottest(hit, .8).level > 0);
});

test("log axis omits DC, preserves frequency coordinates and retains channel polarity energy", async () => {
  const cache = new spectral.TileCache();
  const a = await cache.view(sine(500), rate, .3, .9, { axis: "log", fftSize: 1024, rows: 128 });
  assert.equal(a.minHz, rate / 1024);
  assert.ok(Math.abs(hottest(a, .5).hz - 500) < 100);
  const dc = new Float32Array(rate).fill(.5);
  const image = await cache.view(dc, rate, 0, 1, { axis: "log", fftSize: 1024, rows: 128 });
  assert.ok(hottest(image, .5).hz < 1.5 * rate / 1024,
    "The DC bin is omitted, though a finite Hann window leaks into the first positive bin");
  const negative = Float32Array.from(sine(500), x => -x);
  const b = await cache.view(negative, rate, .3, .9, { axis: "log", fftSize: 1024, rows: 128 });
  assert.ok(Math.abs(hottest(a, .5).level - hottest(b, .5).level) <= 1,
    "Opposite-phase stereo channels are analyzed individually, never mixed away");
});

test("long sources and large FFT sizes stay inside the tile and column budgets", async () => {
  const cache = new spectral.TileCache();
  const samples = new Float32Array(rate * 120);
  for (const size of spectral.FFT_SIZES) {
    const result = await cache.view(samples, rate, 0, 120, { fftSize: size, rows: 128 });
    assert.ok(result.columns <= (size === 1024 ? 384 : size === 4096 ? 256 : 96) + 2);
    assert.ok(cache.tiles.size <= spectral.MAX_TILES);
    assert.equal(result.pixels.byteLength, result.columns * result.rows);
  }
  const size = cache.tiles.size;
  await cache.view(samples, rate, 60, 90, { fftSize: 1024, rows: 128 });
  assert.ok(cache.tiles.size <= spectral.MAX_TILES && size <= spectral.MAX_TILES);
  cache.clear(); assert.equal(cache.source, null); assert.equal(cache.tiles.size, 0);
});

test("cancellation, invalid input and excessive display work are rejected safely", async () => {
  const cache = new spectral.TileCache(), samples = sine(500);
  await assert.rejects(cache.view(samples, rate, 0, 2, { fftSize: 1024, rows: 160,
    isCancelled: () => true }), /cancelled/);
  let stop = false, progress = 0;
  await assert.rejects(cache.view(samples, rate, 0, 2, { fftSize: 1024, rows: 160,
    yieldTask: async () => { stop = true; },
    isCancelled: () => stop, onProgress: x => { progress = x; } }), /cancelled/);
  assert.ok(progress < 1);
  for (const options of [{ fftSize: 512 }, { fftSize: 65536 }, { axis: "illegal" },
    { rows: 300 }]) {
    await assert.rejects(cache.view(samples, rate, 0, 2, options), RangeError);
  }
  await assert.rejects(cache.view(samples, rate, 2, 1), RangeError);
  await assert.rejects(cache.view(samples, rate, -.01, 1), RangeError);
});
