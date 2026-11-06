/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Source-PCM analysis. Listening gain and plot zoom never alter these samples.
 */
(function (root, factory) {
  "use strict";
  const fft = typeof module === "object" && module.exports ? require("./sound-fft.js") : root.SoundLabFFT;
  const api = factory(fft);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabAnalysisDSP = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (fft) {
  "use strict";
  const FFT_SIZES = Object.freeze([1024, 4096, 16384, 65536]);
  const MAX_FRAMES = 64 * 1024 * 1024 / 4;
  const BLOCK_SIZE = 128;
  const CHUNK_FRAMES = 65536;
  const FLOAT32_MAX = 3.4028234663852886e38;
  const windows = new Map();
  const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));

  class AnalysisError extends Error {
    constructor(code, message) { super(message); this.name = "AnalysisError"; this.code = code; }
  }
  function invalid(message) { throw new AnalysisError("invalid", message); }
  function checkCancelled(options) {
    if (options.isCancelled?.()) throw new AnalysisError("cancelled", "Analysis cancelled");
  }
  async function cooperate(options, fraction) {
    checkCancelled(options);
    options.onProgress?.(Math.max(0, Math.min(1, fraction)));
    await (options.yieldTask || yieldTask)();
    checkCancelled(options);
  }
  function checkSamples(samples) {
    if (!(samples instanceof Float32Array) && !(samples instanceof Float64Array)) invalid("Expected a PCM sample array");
    if (!samples.length || samples.length > MAX_FRAMES) invalid("Unsupported PCM sample count");
  }
  function checkRate(sampleRate) {
    if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0) invalid("Sample rate must be a positive integer");
  }
  function checkedSample(value) {
    if (!Number.isFinite(value) || Math.abs(value) > FLOAT32_MAX) invalid("PCM samples must be finite 32-bit values");
    return value;
  }
  function alignedFrame(seconds, sampleRate) {
    const value = seconds * sampleRate, nearest = Math.round(value);
    // A frame -> seconds -> frame round trip can land one floating-point ulp
    // beside the integer. Snap only within arithmetic roundoff; arbitrary times
    // still get the enclosing floor/ceil selection convention below.
    return Math.abs(value - nearest) <= 4 * Number.EPSILON * Math.max(1, Math.abs(value)) ? nearest : value;
  }
  function range(samples, sampleRate, startSeconds, endSeconds) {
    checkSamples(samples); checkRate(sampleRate);
    const duration = samples.length / sampleRate;
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) ||
        startSeconds < 0 || endSeconds > duration || startSeconds >= endSeconds) {
      invalid("Select a nonempty interval inside the sound");
    }
    const start = Math.max(0, Math.floor(alignedFrame(startSeconds, sampleRate)));
    const end = Math.min(samples.length, Math.ceil(alignedFrame(endSeconds, sampleRate)));
    if (end <= start) invalid("The interval is too short to contain a PCM sample");
    return { start, end };
  }
  function windowFor(size) {
    if (!FFT_SIZES.includes(size)) invalid("Choose a supported FFT length");
    if (!windows.has(size)) {
      const values = fft.hann(size);
      windows.set(size, { values, sum: values.reduce((sum, value) => sum + value, 0) });
    }
    return windows.get(size);
  }
  function workspace(size) {
    return { size, window: windowFor(size), real: new Float64Array(size), imag: new Float64Array(size) };
  }
  function transformWindow(work, samples, first, lower, upper) {
    work.imag.fill(0);
    for (let i = 0; i < work.size; i++) {
      const frame = first + i;
      work.real[i] = frame < lower || frame >= upper ? 0 :
        work.window.values[i] * checkedSample(samples[frame]);
    }
    fft.transform(work.real, work.imag);
  }
  function magnitude(work, bin) {
    const factor = bin === 0 || bin === work.size / 2 ? 1 : 2;
    return factor * Math.hypot(work.real[bin], work.imag[bin]) / work.window.sum;
  }
  function windowMetadata(sampleRate, size, first, lower, upper) {
    const actualFirst = Math.max(lower, first), actualLast = Math.min(upper, first + size);
    return { binHz: sampleRate / size, fftSize: size, windowSeconds: size / sampleRate,
      windowStart: first / sampleRate, windowEnd: (first + size) / sampleRate,
      actualStart: actualFirst / sampleRate, actualEnd: actualLast / sampleRate,
      paddedSamples: size - Math.max(0, actualLast - actualFirst) };
  }

  function spectrumAt(samples, sampleRate, centerSeconds, fftSize = 4096) {
    checkSamples(samples); checkRate(sampleRate);
    if (!Number.isFinite(centerSeconds) || centerSeconds < 0 || centerSeconds > samples.length / sampleRate) {
      invalid("The inspection cursor must be inside the sound");
    }
    const first = Math.round(centerSeconds * sampleRate) - fftSize / 2;
    const work = workspace(fftSize);
    transformWindow(work, samples, first, 0, samples.length);
    const magnitudes = Float64Array.from({ length: fftSize / 2 + 1 }, (_, bin) => magnitude(work, bin));
    return { magnitudes, ...windowMetadata(sampleRate, fftSize, first, 0, samples.length),
      windowCount: 1, paddedWindowCount: first < 0 || first + fftSize > samples.length ? 1 : 0 };
  }

  async function spectrumAverage(samples, sampleRate, startSeconds, endSeconds, fftSize = 4096, options = {}) {
    const { start, end } = range(samples, sampleRate, startSeconds, endSeconds);
    checkCancelled(options);
    const work = workspace(fftSize), powers = new Float64Array(fftSize / 2 + 1);
    const length = end - start, hopFrames = fftSize / 2;
    // Full windows use 50% overlap. If a remainder exists, one last full window
    // ends exactly at the selection end; short selections use one centred,
    // explicitly zero-padded window. No sound outside the selection leaks in.
    const regularCount = length >= fftSize ? Math.floor((length - fftSize) / hopFrames) + 1 : 1;
    const extraLast = length > fftSize && (length - fftSize) % hopFrames !== 0;
    const count = regularCount + (extraLast ? 1 : 0);
    let firstWindow = 0, lastWindow = 0, paddedSamples = 0, paddedWindowCount = 0;
    await cooperate(options, 0);
    let lastYield = Date.now();
    for (let frame = 0; frame < count; frame++) {
      checkCancelled(options);
      const first = length < fftSize ? Math.floor((start + end - fftSize) / 2) :
        frame === regularCount ? end - fftSize : start + frame * hopFrames;
      if (!frame) firstWindow = first;
      lastWindow = first;
      const metadata = windowMetadata(sampleRate, fftSize, first, start, end);
      paddedSamples += metadata.paddedSamples;
      if (metadata.paddedSamples) paddedWindowCount++;
      transformWindow(work, samples, first, start, end);
      for (let bin = 0; bin < powers.length; bin++) {
        const amplitude = magnitude(work, bin);
        powers[bin] += amplitude * amplitude;
      }
      // Keep the browser's Stop, source changes and progress responsive. A single
      // transform is bounded by 65,536 samples; check cancellation between each.
      if (Date.now() - lastYield >= 8 && frame + 1 < count) {
        await cooperate(options, (frame + 1) / count);
        lastYield = Date.now();
      }
    }
    for (let bin = 0; bin < powers.length; bin++) powers[bin] = Math.sqrt(powers[bin] / count);
    checkCancelled(options);
    options.onProgress?.(1);
    return { magnitudes: powers, binHz: sampleRate / fftSize, fftSize,
      windowSeconds: fftSize / sampleRate, windowStart: firstWindow / sampleRate,
      windowEnd: (lastWindow + fftSize) / sampleRate, actualStart: start / sampleRate,
      actualEnd: end / sampleRate, paddedSamples, paddedWindowCount,
      windowCount: count, hopFrames };
  }

  function amplitudeDb(amplitude) {
    if (!Number.isFinite(amplitude) || amplitude < 0) invalid("Amplitude must be finite and nonnegative");
    return amplitude === 0 ? -Infinity : 20 * Math.log10(amplitude);
  }
  function measurementResult(peak, sumSquares, fullScaleCount, start, end, sampleRate) {
    const frames = end - start, rms = Math.sqrt(sumSquares / frames);
    return { peak, rms, peakDb: amplitudeDb(peak), rmsDb: amplitudeDb(rms), fullScaleCount,
      frames, duration: frames / sampleRate, startFrame: start, endFrame: end };
  }

  function newLevel(length, blockSize) {
    return { blockSize, minima: new Float64Array(length), maxima: new Float64Array(length),
      sumSquares: new Float64Array(length), fullScaleCounts: new Uint32Array(length) };
  }
  async function buildWaveformIndex(samples, options = {}) {
    checkSamples(samples); checkCancelled(options);
    const base = newLevel(Math.ceil(samples.length / BLOCK_SIZE), BLOCK_SIZE), levels = [base];
    let peak = 0, sumSquares = 0, fullScaleCount = 0;
    await cooperate(options, 0);
    for (let block = 0; block < base.minima.length; block++) {
      let min = Infinity, max = -Infinity, squared = 0, full = 0;
      const end = Math.min(samples.length, (block + 1) * BLOCK_SIZE);
      for (let i = block * BLOCK_SIZE; i < end; i++) {
        const value = checkedSample(samples[i]);
        min = Math.min(min, value); max = Math.max(max, value);
        squared += value * value;
        if (Math.abs(value) >= 1) full++;
      }
      base.minima[block] = min; base.maxima[block] = max;
      base.sumSquares[block] = squared; base.fullScaleCounts[block] = full;
      peak = Math.max(peak, -min, max); sumSquares += squared; fullScaleCount += full;
      if ((block + 1) * BLOCK_SIZE % CHUNK_FRAMES === 0) {
        await cooperate(options, end / samples.length * .9);
      }
    }
    while (levels.at(-1).minima.length > 1) {
      const previous = levels.at(-1), next = newLevel(Math.ceil(previous.minima.length / 2), previous.blockSize * 2);
      for (let i = 0; i < next.minima.length; i++) {
        const a = i * 2, b = a + 1;
        next.minima[i] = previous.minima[a]; next.maxima[i] = previous.maxima[a];
        next.sumSquares[i] = previous.sumSquares[a]; next.fullScaleCounts[i] = previous.fullScaleCounts[a];
        if (b < previous.minima.length) {
          next.minima[i] = Math.min(next.minima[i], previous.minima[b]);
          next.maxima[i] = Math.max(next.maxima[i], previous.maxima[b]);
          next.sumSquares[i] += previous.sumSquares[b];
          next.fullScaleCounts[i] += previous.fullScaleCounts[b];
        }
        if ((i + 1) % (CHUNK_FRAMES / 2) === 0) await cooperate(options, .9);
      }
      levels.push(next);
      checkCancelled(options);
    }
    options.onProgress?.(1);
    return Object.freeze({ samples, frames: samples.length, levels: Object.freeze(levels),
      peak, rms: Math.sqrt(sumSquares / samples.length), fullScaleCount });
  }

  function checkIndex(index) {
    if (!index || !Array.isArray(index.levels) || !index.levels.length || index.frames !== index.samples?.length) {
      invalid("Expected a waveform index");
    }
    checkSamples(index.samples);
  }
  function queryRange(index, start, end) {
    let min = Infinity, max = -Infinity, sumSquares = 0, fullScaleCount = 0, frame = start;
    while (frame < end) {
      if (frame % BLOCK_SIZE === 0 && end - frame >= BLOCK_SIZE) {
        let level = Math.min(index.levels.length - 1, Math.floor(Math.log2((end - frame) / BLOCK_SIZE)));
        while (level > 0 && frame % index.levels[level].blockSize !== 0) level--;
        const bank = index.levels[level], i = frame / bank.blockSize;
        min = Math.min(min, bank.minima[i]); max = Math.max(max, bank.maxima[i]);
        sumSquares += bank.sumSquares[i]; fullScaleCount += bank.fullScaleCounts[i];
        frame += bank.blockSize;
      } else {
        const value = index.samples[frame++];
        min = Math.min(min, value); max = Math.max(max, value);
        sumSquares += value * value;
        if (Math.abs(value) >= 1) fullScaleCount++;
      }
    }
    return { min, max, sumSquares, fullScaleCount };
  }

  // Passing an existing index makes repeated interval measurements logarithmic
  // instead of rescanning the entire file. Raw arrays remain supported for tests
  // and callers without a plot, with chunked cancellable work.
  async function measurements(samplesOrIndex, sampleRate, startSeconds, endSeconds, options = {}) {
    const index = samplesOrIndex?.levels ? samplesOrIndex : null;
    if (index) checkIndex(index);
    const samples = index ? index.samples : samplesOrIndex;
    const { start, end } = range(samples, sampleRate, startSeconds, endSeconds);
    checkCancelled(options);
    if (index) {
      const found = queryRange(index, start, end);
      options.onProgress?.(1);
      return measurementResult(Math.max(-found.min, found.max), found.sumSquares, found.fullScaleCount, start, end, sampleRate);
    }
    let peak = 0, sumSquares = 0, fullScaleCount = 0;
    await cooperate(options, 0);
    for (let i = start; i < end; i++) {
      const value = checkedSample(samples[i]);
      peak = Math.max(peak, Math.abs(value)); sumSquares += value * value;
      if (Math.abs(value) >= 1) fullScaleCount++;
      if ((i - start + 1) % CHUNK_FRAMES === 0) await cooperate(options, (i - start + 1) / (end - start));
    }
    checkCancelled(options); options.onProgress?.(1);
    return measurementResult(peak, sumSquares, fullScaleCount, start, end, sampleRate);
  }

  function waveformEnvelope(index, startSeconds, endSeconds, width, sampleRate) {
    checkIndex(index);
    const { start, end } = range(index.samples, sampleRate, startSeconds, endSeconds);
    if (!Number.isInteger(width) || width < 1 || width > 8192) invalid("Waveform width must be between 1 and 8,192 pixels");
    const minima = new Float64Array(width), maxima = new Float64Array(width);
    for (let pixel = 0; pixel < width; pixel++) {
      const first = start + Math.floor((end - start) * pixel / width);
      const last = Math.min(end, Math.max(first + 1, start + Math.floor((end - start) * (pixel + 1) / width)));
      const found = queryRange(index, first, last);
      minima[pixel] = found.min; maxima[pixel] = found.max;
    }
    return { minima, maxima, startFrame: start, endFrame: end };
  }

  return Object.freeze({ FFT_SIZES, MAX_FRAMES, BLOCK_SIZE, AnalysisError,
    spectrumAt, spectrumAverage, amplitudeDb, buildWaveformIndex, waveformEnvelope, measurements });
});
