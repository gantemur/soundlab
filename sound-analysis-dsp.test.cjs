"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const dsp = require("./sound-analysis-dsp.js");
const noWait = { yieldTask: async () => {} };

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by ${Math.abs(actual - expected)}`);
}
function sine(frames, rate, frequency, amplitude = 1) {
  return Float64Array.from({ length: frames }, (_, i) => amplitude * Math.sin(2 * Math.PI * frequency * i / rate));
}
function peakBin(result, minHz = 0, maxHz = Infinity) {
  let found = Math.ceil(minHz / result.binHz);
  const upper = Math.min(result.magnitudes.length - 1, Math.floor(maxHz / result.binHz));
  for (let i = found + 1; i <= upper; i++) if (result.magnitudes[i] > result.magnitudes[found]) found = i;
  return found;
}
function directStats(samples, start, end) {
  let min = Infinity, max = -Infinity, squares = 0, full = 0;
  for (let i = start; i < end; i++) {
    min = Math.min(min, samples[i]); max = Math.max(max, samples[i]);
    squares += samples[i] ** 2; if (Math.abs(samples[i]) >= 1) full++;
  }
  return { min, max, peak: Math.max(-min, max), rms: Math.sqrt(squares / (end - start)), full };
}

test("Hann spectra use source rate and coherent one-sided amplitude at every A1 size", () => {
  for (const rate of [16000, 44100, 48000]) {
    for (const size of dsp.FFT_SIZES) {
      const bin = 53, frequency = rate * bin / size;
      const samples = sine(size, rate, frequency, .7);
      const result = dsp.spectrumAt(samples, rate, size / (2 * rate), size);
      assert.equal(peakBin(result), bin);
      close(result.magnitudes[bin], .7, 1e-6);
      close(result.binHz, rate / size);
      close(result.windowSeconds, size / rate);
      close(result.magnitudes.length * 2 - 2, size);
      close(result.binHz * (result.magnitudes.length - 1), rate / 2);
      assert.equal(result.paddedSamples, 0);
      assert.ok(result.magnitudes.every(Number.isFinite));
    }
  }
});

test("440 Hz off-bin peaks have the right axes at 16, 44.1 and 48 kHz", () => {
  for (const rate of [16000, 44100, 48000]) {
    const samples = sine(rate * 2, rate, 440);
    const spectrum = dsp.spectrumAt(samples, rate, 1, 16384);
    assert.ok(Math.abs(peakBin(spectrum) * spectrum.binHz - 440) <= spectrum.binHz / 2);
    const peak = spectrum.magnitudes[peakBin(spectrum)];
    assert.ok(peak > .84 && peak <= 1.001, "Off-bin Hann scalloping is not hidden by peak normalization");
  }
});

test("half amplitude reads -6.0206 dB and a unit sine has -3.0103 dB RMS", async () => {
  const rate = 48000, size = 4096, bin = 67;
  const full = sine(size, rate, bin * rate / size), half = full.map(value => value / 2);
  const a = dsp.spectrumAt(full, rate, size / (2 * rate), size);
  const b = dsp.spectrumAt(half, rate, size / (2 * rate), size);
  close(dsp.amplitudeDb(b.magnitudes[bin]) - dsp.amplitudeDb(a.magnitudes[bin]), -6.020599913, 1e-9);
  const metrics = await dsp.measurements(full, rate, 0, size / rate, noWait);
  close(metrics.peak, 1); close(metrics.rms, Math.SQRT1_2);
  close(metrics.rmsDb, -3.01029995664, 1e-9);
  const lower = await dsp.measurements(half, rate, 0, size / rate, noWait);
  close(lower.rmsDb - metrics.rmsDb, -6.020599913, 1e-9);
});

test("DC and Nyquist are not erroneously doubled; silence has no false peaks", async () => {
  const rate = 16000, size = 1024;
  const dc = new Float32Array(size).fill(.75);
  const dcSpectrum = dsp.spectrumAt(dc, rate, size / (2 * rate), size);
  close(dcSpectrum.magnitudes[0], .75);
  const nyquist = Float32Array.from({ length: size }, (_, i) => i % 2 ? -.5 : .5);
  const nyquistSpectrum = dsp.spectrumAt(nyquist, rate, size / (2 * rate), size);
  close(nyquistSpectrum.magnitudes[size / 2], .5);
  const silent = new Float32Array(size);
  const local = dsp.spectrumAt(silent, rate, size / (2 * rate), size);
  const overall = await dsp.spectrumAverage(silent, rate, 0, size / rate, size, noWait);
  assert.ok(local.magnitudes.every(value => value === 0));
  assert.ok(overall.magnitudes.every(value => value === 0));
  const metrics = await dsp.measurements(silent, rate, 0, size / rate, noWait);
  assert.equal(metrics.peakDb, -Infinity); assert.equal(metrics.rmsDb, -Infinity);
  assert.equal(metrics.rms, 0); assert.equal(metrics.fullScaleCount, 0);
});

test("an impulse and a one-sample file retain the full-window normalization and padding extent", async () => {
  const size = 1024, rate = 44100;
  const samples = new Float32Array([1]);
  const local = dsp.spectrumAt(samples, rate, 0, size);
  assert.equal(local.paddedSamples, size - 1);
  assert.equal(local.actualStart, 0); close(local.actualEnd, 1 / rate);
  assert.equal(local.windowStart, -size / (2 * rate));
  assert.ok(local.magnitudes.every(Number.isFinite));
  close(local.magnitudes[1], 2 * local.magnitudes[0], 1e-15);
  close(local.magnitudes.at(-1), local.magnitudes[0], 1e-15);
  assert.ok(local.magnitudes[1] < .004, "Short records are not boosted to fake unit spectral amplitude");
  const overall = await dsp.spectrumAverage(samples, rate, 0, 1 / rate, size, noWait);
  assert.equal(overall.windowCount, 1); assert.equal(overall.paddedWindowCount, 1);
  assert.equal(overall.paddedSamples, size - 1);
  const index = await dsp.buildWaveformIndex(samples, noWait);
  assert.equal(index.peak, 1); assert.equal(index.rms, 1);
});

test("cursor edges report zero padding without changing FFT size or modifying PCM", () => {
  const rate = 16000, samples = sine(rate, rate, 440), saved = samples.slice();
  const start = dsp.spectrumAt(samples, rate, 0, 4096);
  const middle = dsp.spectrumAt(samples, rate, .5, 4096);
  const end = dsp.spectrumAt(samples, rate, 1, 4096);
  assert.equal(start.paddedSamples, 2048); assert.equal(end.paddedSamples, 2048);
  assert.equal(middle.paddedSamples, 0);
  assert.equal(start.fftSize, middle.fftSize);
  assert.equal(end.windowSeconds, middle.windowSeconds);
  assert.deepEqual(samples, saved);
});

test("65536-point windows resolve the two close reference tones without inventing a beat-frequency pitch", () => {
  const rate = 44100, size = 65536;
  const samples = sine(size, rate, 440, .25);
  for (let i = 0; i < size; i++) samples[i] += .25 * Math.sin(2 * Math.PI * 444 * i / rate);
  const result = dsp.spectrumAt(samples, rate, size / (2 * rate), size);
  const a = peakBin(result, 438, 442), b = peakBin(result, 442.1, 446);
  assert.ok(Math.abs(a * result.binHz - 440) < result.binHz);
  assert.ok(Math.abs(b * result.binHz - 444) < result.binHz);
  assert.ok(b > a + 3);
  assert.ok(result.magnitudes[a] > .2 && result.magnitudes[b] > .2);
  assert.ok(result.magnitudes[peakBin(result, 0, 20)] < 1e-5);
});

test("the chirp's local peak moves with the cursor and a decaying tone is not normalized upward", () => {
  const rate = 16000, seconds = 3, first = 150, slope = (2000 - first) / seconds;
  const chirp = Float64Array.from({ length: rate * seconds }, (_, i) => {
    const t = i / rate; return .5 * Math.sin(2 * Math.PI * (first * t + .5 * slope * t * t));
  });
  for (const center of [.5, 1.5, 2.5]) {
    const result = dsp.spectrumAt(chirp, rate, center, 1024);
    assert.ok(Math.abs(peakBin(result) * result.binHz - (first + slope * center)) < 2 * result.binHz);
  }
  const decay = sine(rate, rate, 440).map((value, i) => value * Math.exp(-i / (rate * .25)));
  const early = dsp.spectrumAt(decay, rate, .2, 1024), late = dsp.spectrumAt(decay, rate, .6, 1024);
  close(late.magnitudes[peakBin(late)] / early.magnitudes[peakBin(early)], Math.exp(-.4 / .25), 1e-7);
});

test("selection average averages squared amplitude, not dB, magnitudes or complex phase", async () => {
  const size = 1024, rate = 1024, bin = 47;
  const samples = sine(size * 2, rate, bin);
  for (let i = size; i < samples.length; i++) samples[i] *= -1;
  const windows = [.5, 1, 1.5].map(center => dsp.spectrumAt(samples, rate, center, size));
  const result = await dsp.spectrumAverage(samples, rate, 0, 2, size, noWait);
  assert.equal(result.windowCount, 3); assert.equal(result.hopFrames, size / 2);
  assert.equal(result.paddedWindowCount, 0);
  for (let i = 0; i < result.magnitudes.length; i++) {
    close(result.magnitudes[i], Math.sqrt(windows.reduce((sum, item) => sum + item.magnitudes[i] ** 2, 0) / 3), 1e-12);
  }
  assert.ok(result.magnitudes[bin] > .8, "Opposite phases do not cancel in a power average");
});

test("selection average covers a remainder and excludes audio outside a short selected interval", async () => {
  const rate = 16000, size = 1024, frames = 2600;
  const samples = sine(frames, rate, 440, .25);
  const result = await dsp.spectrumAverage(samples, rate, 0, frames / rate, size, noWait);
  assert.equal(result.windowCount, 5);
  assert.equal(result.windowStart, 0); close(result.windowEnd, frames / rate);
  assert.equal(result.paddedSamples, 0);
  const source = new Float32Array(4096); source[20] = 1;
  const short = await dsp.spectrumAverage(source, rate, 2000 / rate, 2010 / rate, size, noWait);
  assert.equal(short.paddedSamples, 1014);
  assert.equal(short.paddedWindowCount, 1);
  assert.ok(short.magnitudes.every(value => value === 0));
  close(short.actualStart, 2000 / rate); close(short.actualEnd, 2010 / rate);
});

test("opposite-phase stereo remains separately measurable without implicit mid-channel mixing", async () => {
  const rate = 44100, size = 4096;
  const left = sine(size, rate, rate * 31 / size, .6), right = left.map(value => -value);
  const a = dsp.spectrumAt(left, rate, size / (2 * rate), size);
  const b = dsp.spectrumAt(right, rate, size / (2 * rate), size);
  assert.deepEqual(a.magnitudes, b.magnitudes);
  const indexL = await dsp.buildWaveformIndex(left, noWait);
  const indexR = await dsp.buildWaveformIndex(right, noWait);
  close(indexL.rms, .6 * Math.SQRT1_2); close(indexR.rms, indexL.rms);
  assert.ok(indexL.peak > .59 && indexR.peak > .59);
});

test("full-scale counts and finite over-range float samples remain measurable without clipping", async () => {
  const samples = new Float32Array([-1, 1, .5, -.5, 2, -3, 0]);
  const saved = samples.slice(), metrics = await dsp.measurements(samples, 16000, 0, samples.length / 16000, noWait);
  assert.equal(metrics.peak, 3); assert.equal(metrics.fullScaleCount, 4);
  close(metrics.rms, Math.sqrt(15.5 / 7)); close(metrics.peakDb, 20 * Math.log10(3));
  assert.deepEqual(samples, saved);
  const max = 3.4028234663852886e38;
  const extreme = Float32Array.from({ length: 1024 }, (_, i) => i % 16 < 8 ? max : -max);
  const spectrum = dsp.spectrumAt(extreme, 16000, 1024 / 32000, 1024);
  assert.ok(spectrum.magnitudes instanceof Float64Array);
  assert.ok(spectrum.magnitudes.every(Number.isFinite));
  assert.ok(spectrum.magnitudes[64] > max, "Spectral output does not overflow a Float32 container");
  const average = await dsp.spectrumAverage(extreme, 16000, 0, 1024 / 16000, 1024, noWait);
  assert.ok(average.magnitudes.every(Number.isFinite));
});

test("waveform hierarchy preserves isolated spikes and exact per-pixel extrema at coarse zoom", async () => {
  const samples = new Float32Array(100003);
  samples[127] = .8; samples[128] = -1; samples[50001] = 2; samples[100002] = -.9;
  const saved = samples.slice(), index = await dsp.buildWaveformIndex(samples, noWait);
  assert.equal(index.samples, samples, "An index does not duplicate permanent PCM");
  assert.equal(index.peak, 2);
  assert.equal(index.fullScaleCount, 2);
  const result = dsp.waveformEnvelope(index, 0, samples.length / 16000, 17, 16000);
  for (let pixel = 0; pixel < 17; pixel++) {
    const start = Math.floor(samples.length * pixel / 17), end = Math.floor(samples.length * (pixel + 1) / 17);
    const actual = directStats(samples, start, end);
    assert.equal(result.minima[pixel], actual.min); assert.equal(result.maxima[pixel], actual.max);
  }
  assert.ok(result.maxima.some(value => value === 2));
  assert.ok(result.minima.some(value => value === -1));
  const fine = dsp.waveformEnvelope(index, 126 / 16000, 131 / 16000, 100, 16000);
  assert.ok(fine.maxima.some(value => value === .800000011920929));
  assert.ok(fine.minima.some(value => value === -1));
  assert.deepEqual(samples, saved);
});

test("indexed interval measurements exactly match independent scans, including partial blocks", async () => {
  const samples = Float32Array.from({ length: 20779 }, (_, i) => Math.sin(i * .71) * 1.4 + Math.cos(i * .13) / 3);
  const rate = 44100, index = await dsp.buildWaveformIndex(samples, noWait);
  for (const [start, end] of [[0, 20779], [1, 127], [128, 256], [123, 19877], [16384, 20000], [20778, 20779]]) {
    const metrics = await dsp.measurements(index, rate, start / rate, end / rate, noWait);
    const raw = await dsp.measurements(samples, rate, start / rate, end / rate, noWait);
    const expected = directStats(samples, metrics.startFrame, metrics.endFrame);
    close(metrics.peak, expected.peak); close(metrics.rms, expected.rms, 1e-12);
    assert.equal(metrics.fullScaleCount, expected.full);
    close(metrics.rms, raw.rms, 1e-12); assert.equal(metrics.frames, metrics.endFrame - metrics.startFrame);
    close(metrics.duration, metrics.frames / rate);
  }
  const totalIndexBytes = index.levels.reduce((sum, level) => sum + level.minima.byteLength + level.maxima.byteLength +
    level.sumSquares.byteLength + level.fullScaleCounts.byteLength, 0);
  assert.ok(totalIndexBytes < samples.byteLength * .12, "Index remains a modest bounded fraction of PCM storage");
});

test("sample-aligned times round trip exactly while arbitrary intervals still enclose samples", async () => {
  const samples = new Float32Array(100000), index = await dsp.buildWaveformIndex(samples, noWait);
  for (const rate of [16000, 44100, 48000, 192000]) {
    for (let start = 1; start < 99000; start += 137) {
      const end = start + 173;
      const metrics = await dsp.measurements(index, rate, start / rate, end / rate, noWait);
      assert.equal(metrics.startFrame, start, `Start frame ${start} / ${rate}`);
      assert.equal(metrics.endFrame, end, `End frame ${end} / ${rate}`);
      assert.equal(metrics.frames, 173);
    }
    const enclosed = await dsp.measurements(index, rate, 22.25 / rate, 27.75 / rate, noWait);
    assert.equal(enclosed.startFrame, 22); assert.equal(enclosed.endFrame, 28);
  }
});

test("long-file indexing, measurement and averaging are cancellable and yield progress", async () => {
  const samples = new Float32Array(65536 * 3);
  let cancelled = false, yields = 0;
  const options = { isCancelled: () => cancelled, yieldTask: async () => { if (++yields === 2) cancelled = true; } };
  await assert.rejects(dsp.buildWaveformIndex(samples, options), error => error.code === "cancelled");
  assert.equal(yields, 2);
  cancelled = false; yields = 0;
  await assert.rejects(dsp.measurements(samples, 48000, 0, samples.length / 48000, options), error => error.code === "cancelled");
  let checks = 0;
  await assert.rejects(dsp.spectrumAverage(samples, 48000, 0, samples.length / 48000, 65536,
    { ...noWait, isCancelled: () => ++checks > 3 }), error => error.code === "cancelled");
  const progress = [];
  await dsp.spectrumAverage(samples.subarray(0, 5000), 48000, 0, 5000 / 48000, 1024,
    { ...noWait, onProgress: value => progress.push(value) });
  assert.equal(progress[0], 0); assert.equal(progress.at(-1), 1);
  assert.ok(progress.every((value, i) => value >= 0 && value <= 1 && (!i || value >= progress[i - 1])));
});

test("invalid PCM, FFT sizes, rates, bounds and waveform widths fail explicitly", async () => {
  const samples = new Float32Array(44100);
  for (const size of [0, 1000, 2048, 131072, NaN]) {
    assert.throws(() => dsp.spectrumAt(samples, 44100, .5, size), error => error.code === "invalid");
  }
  for (const rate of [0, -1, NaN, Infinity, 44100.1]) assert.throws(() => dsp.spectrumAt(samples, rate, 0));
  for (const time of [-1, 1.01, NaN, Infinity]) assert.throws(() => dsp.spectrumAt(samples, 44100, time));
  assert.throws(() => dsp.spectrumAt([], 44100, 0));
  assert.throws(() => dsp.spectrumAt(new Float32Array(), 44100, 0));
  assert.throws(() => dsp.spectrumAt(new Float32Array([NaN]), 44100, 0));
  await assert.rejects(dsp.buildWaveformIndex(new Float32Array([Infinity]), noWait));
  await assert.rejects(dsp.measurements(new Float64Array([1e100]), 44100, 0, 1 / 44100, noWait));
  for (const [start, end] of [[-.1, .2], [.5, .5], [.6, .2], [0, 1.1], [0, NaN]]) {
    await assert.rejects(dsp.spectrumAverage(samples, 44100, start, end, 4096, noWait));
    await assert.rejects(dsp.measurements(samples, 44100, start, end, noWait));
  }
  const index = await dsp.buildWaveformIndex(samples, noWait);
  // Distinct finite times can round to the same sample boundary on multiplication.
  assert.throws(() => dsp.waveformEnvelope(index, .3333333333333333, .33333333333333337, 100, 3));
  for (const width of [0, -1, 1.5, 9000]) assert.throws(() => dsp.waveformEnvelope(index, 0, 1, width, 44100));
  assert.throws(() => dsp.waveformEnvelope({}, 0, 1, 300, 44100));
  assert.throws(() => dsp.amplitudeDb(-1));
});
