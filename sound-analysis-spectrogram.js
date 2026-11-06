/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Cancellable, bounded STFT tiles over immutable source PCM. No Web Audio or DOM.
 */
(function (root, factory) {
  "use strict";
  const fft = typeof module === "object" && module.exports ?
    require("./sound-fft.js") : root.SoundLabFFT;
  const api = factory(fft);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabSpectrogram = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (fft) {
  "use strict";
  const FFT_SIZES = Object.freeze([1024, 4096, 16384]);
  const TILE_COLUMNS = 16;
  const MAX_COLUMNS = 384;
  const MAX_ROWS = 224;
  const MAX_TILES = 24;
  const MIN_DB = -100, MAX_DB = 0;
  const cachedWindows = new Map();
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));

  function validInput(samples, rate, start, end, size, axis, rows) {
    if (!(samples instanceof Float32Array || samples instanceof Float64Array) || !samples.length ||
        samples.length > 16 * 1024 * 1024) throw new RangeError("Expected bounded source PCM");
    if (!Number.isSafeInteger(rate) || rate < 1 || rate > 384000 ||
        !Number.isFinite(start) || !Number.isFinite(end) ||
        start < 0 || end <= start || end > samples.length / rate ||
        !FFT_SIZES.includes(size) || !["linear", "log"].includes(axis) ||
        !Number.isInteger(rows) || rows < 8 || rows > MAX_ROWS) {
      throw new RangeError("Invalid spectrogram range or settings");
    }
  }

  // Identical Hann window and one-sided peak-amplitude convention to the
  // source-PCM spectrum: interior 2|X|/sum(window), DC/Nyquist 1|X|/sum.
  function windowFor(size) {
    if (!cachedWindows.has(size)) {
      const values = fft.hann(size);
      cachedWindows.set(size, { values, sum: values.reduce((a, b) => a + b, 0) });
    }
    return cachedWindows.get(size);
  }
  function frequencyFraction(frequency, rate, size, axis) {
    const max = rate / 2;
    if (axis === "linear") return frequency / max;
    const min = rate / size;
    return Math.log(Math.max(min, frequency) / min) / Math.log(max / min);
  }
  function frequencyAtFraction(fraction, rate, size, axis) {
    const max = rate / 2;
    if (axis === "linear") return clamp(fraction, 0, 1) * max;
    const min = rate / size;
    return min * Math.pow(max / min, clamp(fraction, 0, 1));
  }
  function maxColumns(size) {
    return size === 1024 ? MAX_COLUMNS : size === 4096 ? 256 : 96;
  }
  function hopFor(frames, size) {
    const required = Math.max(1, Math.ceil(frames / maxColumns(size)));
    return Math.pow(2, Math.ceil(Math.log2(required)));
  }
  function intensity(amplitude) {
    if (!(amplitude > 0)) return 0;
    const level = 20 * Math.log10(amplitude);
    return Math.round(255 * clamp((level - MIN_DB) / (MAX_DB - MIN_DB), 0, 1));
  }

  class TileCache {
    constructor() {
      this.source = null;
      this.rate = null;
      this.tiles = new Map();
    }
    clear() { this.source = null; this.rate = null; this.tiles.clear(); }
    async tile(samples, rate, size, axis, rows, hop, tileIndex, options) {
      const win = windowFor(size), real = new Float64Array(size), imag = new Float64Array(size);
      const bank = new Uint8Array(TILE_COLUMNS * rows);
      const rowsByBin = new Int16Array(size / 2 + 1);
      for (let bin = 0; bin < rowsByBin.length; bin++) {
        rowsByBin[bin] = axis === "log" && bin === 0 ? -1 :
          clamp(Math.floor(frequencyFraction(bin * rate / size, rate, size, axis) * rows), 0, rows - 1);
      }
      let lastYield = Date.now();
      for (let column = 0; column < TILE_COLUMNS; column++) {
        if (options.isCancelled?.()) throw new Error("Spectrogram cancelled");
        const globalColumn = tileIndex * TILE_COLUMNS + column;
        const center = Math.round((globalColumn + .5) * hop);
        const first = center - size / 2;
        imag.fill(0);
        for (let i = 0; i < size; i++) {
          const at = first + i;
          real[i] = at < 0 || at >= samples.length ? 0 : samples[at] * win.values[i];
        }
        fft.transform(real, imag);
        for (let bin = 0; bin < rowsByBin.length; bin++) {
          const row = rowsByBin[bin];
          if (row < 0) continue;
          const factor = bin === 0 || bin === size / 2 ? 1 : 2;
          const amp = factor * Math.hypot(real[bin], imag[bin]) / win.sum;
          const index = column * rows + row;
          bank[index] = Math.max(bank[index], intensity(amp));
        }
        if (Date.now() - lastYield >= 8 && column + 1 < TILE_COLUMNS) {
          await (options.yieldTask || yieldTask)();
          if (options.isCancelled?.()) throw new Error("Spectrogram cancelled");
          lastYield = Date.now();
        }
      }
      return bank;
    }
    async view(samples, rate, start, end, settings = {}) {
      const size = settings.fftSize ?? 1024, axis = settings.axis ?? "linear";
      const rows = settings.rows ?? 160;
      validInput(samples, rate, start, end, size, axis, rows);
      if (settings.isCancelled?.()) throw new Error("Spectrogram cancelled");
      if (this.source !== samples || this.rate !== rate) {
        this.clear(); this.source = samples; this.rate = rate;
      }
      const startFrame = Math.floor(start * rate), endFrame = Math.ceil(end * rate);
      const hop = hopFor(endFrame - startFrame, size);
      const firstColumn = Math.max(0, Math.floor(startFrame / hop));
      const lastColumn = Math.max(firstColumn, Math.ceil(endFrame / hop) - 1);
      const columns = lastColumn - firstColumn + 1;
      if (columns > maxColumns(size) + 2) throw new RangeError("Spectrogram column budget exceeded");
      const pixels = new Uint8Array(columns * rows);
      const firstTile = Math.floor(firstColumn / TILE_COLUMNS);
      const lastTile = Math.floor(lastColumn / TILE_COLUMNS);
      for (let tileIndex = firstTile; tileIndex <= lastTile; tileIndex++) {
        if (settings.isCancelled?.()) throw new Error("Spectrogram cancelled");
        const key = [size, axis, rows, hop, tileIndex].join("|");
        let tile = this.tiles.get(key);
        if (tile) {
          this.tiles.delete(key); this.tiles.set(key, tile); // LRU
        } else {
          tile = await this.tile(samples, rate, size, axis, rows, hop, tileIndex, settings);
          if (settings.isCancelled?.()) throw new Error("Spectrogram cancelled");
          this.tiles.set(key, tile);
          if (this.tiles.size > MAX_TILES) this.tiles.delete(this.tiles.keys().next().value);
        }
        const first = Math.max(firstColumn, tileIndex * TILE_COLUMNS);
        const last = Math.min(lastColumn + 1, (tileIndex + 1) * TILE_COLUMNS);
        for (let col = first; col < last; col++) {
          const from = (col - tileIndex * TILE_COLUMNS) * rows;
          pixels.set(tile.subarray(from, from + rows), (col - firstColumn) * rows);
        }
        settings.onProgress?.((tileIndex - firstTile + 1) / (lastTile - firstTile + 1));
        // Even cached tiles yield once per batch so a 120-second source never
        // monopolizes the main thread or races a newer view/selection.
        if (tileIndex < lastTile) await (settings.yieldTask || yieldTask)();
      }
      if (settings.isCancelled?.()) throw new Error("Spectrogram cancelled");
      return { pixels, columns, rows, firstColumn, hopFrames: hop, fftSize: size,
        sampleRate: rate, timeStart: firstColumn * hop / rate,
        timeEnd: (lastColumn + 1) * hop / rate, windowSeconds: size / rate,
        hopSeconds: hop / rate, minHz: axis === "log" ? rate / size : 0, maxHz: rate / 2,
        axis, minDb: MIN_DB, maxDb: MAX_DB };
    }
  }
  return Object.freeze({ FFT_SIZES, TILE_COLUMNS, MAX_COLUMNS, MAX_ROWS, MAX_TILES,
    MIN_DB, MAX_DB, frequencyFraction, frequencyAtFraction, intensity, hopFor, TileCache });
});
