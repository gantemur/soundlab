/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Bounded, source-rate-preserving RIFF/WAVE import. No audio context is opened.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabWaveReader = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_SECONDS = 120;
  const MAX_INPUT_BYTES = 32 * 1024 * 1024;
  const MAX_DECODED_BYTES = 64 * 1024 * 1024;
  const MAX_SAMPLE_RATE = 384000;
  const MAX_CHUNKS = 4096;
  const CHUNK_FRAMES = 16384;
  const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get;
  const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
  const typedBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer").get;
  const typedOffset = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteOffset").get;
  const typedLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteLength").get;
  const dataBuffer = Object.getOwnPropertyDescriptor(DataView.prototype, "buffer").get;
  const dataOffset = Object.getOwnPropertyDescriptor(DataView.prototype, "byteOffset").get;
  const dataLength = Object.getOwnPropertyDescriptor(DataView.prototype, "byteLength").get;

  class WaveReadError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "WaveReadError";
      this.code = code;
    }
  }
  const fail = (code, message) => { throw new WaveReadError(code, message); };

  // Intrinsic getters accept genuine cross-window views, including subarrays,
  // without trusting a caller-overridden .buffer/.byteOffset/.byteLength.
  // SharedArrayBuffer is deliberately excluded: the bytes must not be changed
  // by another thread between header validation and sample decoding.
  function viewOf(bytes) {
    let buffer = bytes, offset = 0, length;
    try {
      if (ArrayBuffer.isView(bytes)) {
        try {
          buffer = dataBuffer.call(bytes);
          offset = dataOffset.call(bytes);
          length = dataLength.call(bytes);
        } catch (_) {
          buffer = typedBuffer.call(bytes);
          offset = typedOffset.call(bytes);
          length = typedLength.call(bytes);
        }
        bufferLength.call(buffer);
      } else {
        length = bufferLength.call(buffer);
      }
    } catch (_) {
      fail("invalid", "Supply a WAV ArrayBuffer or a view of a non-shared ArrayBuffer");
    }
    if (length > MAX_INPUT_BYTES) fail("limit", "The WAV file exceeds 32 MiB");
    if (length < 12) fail("invalid", "The WAV header is missing or truncated");
    try { return new DataView(buffer, offset, length); }
    catch (_) { fail("invalid", "The WAV bytes are unavailable or detached"); }
  }

  function ascii(view, offset) {
    return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3));
  }

  function inspectView(view) {
    const container = ascii(view, 0);
    if (container === "RIFX" || container === "RF64") {
      fail("unsupported", "Use ordinary little-endian RIFF WAV, not RIFX or RF64");
    }
    if (container !== "RIFF" || ascii(view, 8) !== "WAVE") {
      fail("invalid", "This is not a RIFF/WAVE file");
    }
    const end = view.getUint32(4, true) + 8;
    if (end !== view.byteLength || end < 12) {
      fail("invalid", "The RIFF length does not match the file length");
    }
    let format = null, audio = null, chunks = 0;
    for (let offset = 12; offset < end;) {
      if (++chunks > MAX_CHUNKS) fail("limit", "The WAV file contains too many chunks");
      if (end - offset < 8) fail("invalid", "A WAV chunk header is truncated");
      const id = ascii(view, offset), size = view.getUint32(offset + 4, true);
      const start = offset + 8, next = start + size + (size % 2);
      if (next > end) fail("invalid", "A WAV chunk or its padding extends past the file");
      if (id === "fmt ") {
        if (format !== null) fail("invalid", "The WAV file contains more than one format chunk");
        if (size < 16) fail("invalid", "The WAV format chunk is too short");
        const formatCode = view.getUint16(start, true);
        const channelCount = view.getUint16(start + 2, true);
        const sampleRate = view.getUint32(start + 4, true);
        const byteRate = view.getUint32(start + 8, true);
        const blockAlign = view.getUint16(start + 12, true);
        const bitsPerSample = view.getUint16(start + 14, true);
        if (![1, 3].includes(formatCode)) {
          fail("unsupported", "Use integer PCM or 32-bit float WAV; compressed and extensible WAV are not supported");
        }
        if (size !== 16) {
          if (size < 18 || view.getUint16(start + 16, true) !== size - 18) {
            fail("invalid", "The WAV format extension length is inconsistent");
          }
          if (size !== 18) fail("unsupported", "Extended WAV format fields are not supported");
        }
        if (channelCount !== 1 && channelCount !== 2) fail("unsupported", "Use a mono or stereo WAV file");
        if (sampleRate === 0) fail("invalid", "The WAV sample rate must be positive");
        if (sampleRate > MAX_SAMPLE_RATE) fail("unsupported", "The WAV sample rate exceeds 384,000 Hz");
        if ((formatCode === 1 && ![8, 16, 24, 32].includes(bitsPerSample)) ||
            (formatCode === 3 && bitsPerSample !== 32)) {
          fail("unsupported", "Use PCM 8/16/24/32-bit or 32-bit float WAV");
        }
        if (blockAlign !== channelCount * (bitsPerSample / 8) || byteRate !== sampleRate * blockAlign) {
          fail("invalid", "The WAV byte rate or frame alignment is inconsistent");
        }
        format = { formatCode, channelCount, sampleRate, bitsPerSample, blockAlign,
          encoding: formatCode === 3 ? "FLOAT32" : "PCM" + bitsPerSample };
      } else if (id === "data") {
        if (audio !== null) fail("unsupported", "Multiple WAV data chunks are not supported");
        audio = { dataOffset: start, dataBytes: size };
      }
      // Unknown metadata chunks may repeat. Their contents are never executed
      // or interpreted, but their lengths and required odd-byte padding count.
      offset = next;
    }
    if (format === null || audio === null) fail("invalid", "The WAV file needs format and audio data chunks");
    if (audio.dataBytes === 0 || audio.dataBytes % format.blockAlign !== 0) {
      fail("invalid", "The WAV data must contain complete, nonempty sample frames");
    }
    const frames = audio.dataBytes / format.blockAlign;
    const duration = frames / format.sampleRate;
    const decodedBytes = frames * format.channelCount * Float32Array.BYTES_PER_ELEMENT;
    if (!Number.isSafeInteger(frames) || frames > MAX_SECONDS * format.sampleRate) {
      fail("limit", "The WAV audio exceeds 120 seconds");
    }
    if (!Number.isSafeInteger(decodedBytes) || decodedBytes > MAX_DECODED_BYTES) {
      fail("limit", "The decoded WAV samples exceed 64 MiB");
    }
    return Object.freeze({ ...format, ...audio, frames, duration, decodedBytes,
      inputBytes: view.byteLength });
  }

  function inspect(bytes) { return inspectView(viewOf(bytes)); }

  async function decode(bytes, options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      fail("invalid", "Invalid WAV decode options");
    }
    const { isCancelled = () => false, onProgress = () => {},
      yieldTask = () => new Promise(resolve => setTimeout(resolve, 0)) } = options;
    if (typeof isCancelled !== "function" || typeof onProgress !== "function" || typeof yieldTask !== "function") {
      fail("invalid", "WAV cancellation, progress and yield hooks must be functions");
    }
    const checkCancelled = () => {
      if (isCancelled()) fail("cancelled", "WAV import cancelled");
    };
    checkCancelled();
    const view = viewOf(bytes), info = inspectView(view);
    onProgress(0);
    await yieldTask(); // Paint the loading state before allocating/decoding PCM.
    checkCancelled();
    let channels;
    try { channels = Array.from({ length: info.channelCount }, () => new Float32Array(info.frames)); }
    catch (_) { fail("limit", "There is not enough memory to decode this WAV file"); }
    const sampleBytes = info.bitsPerSample / 8;
    const positiveLimit = info.formatCode === 3 ? 1 : 1 - 2 ** (1 - info.bitsPerSample);
    let peak = 0, fullScaleSamples = 0;
    for (let first = 0; first < info.frames; first += CHUNK_FRAMES) {
      checkCancelled();
      const last = Math.min(info.frames, first + CHUNK_FRAMES);
      try {
        for (let frame = first; frame < last; frame++) {
          const offset = info.dataOffset + frame * info.blockAlign;
          for (let channel = 0; channel < info.channelCount; channel++) {
            const at = offset + channel * sampleBytes;
            let sample;
            if (info.formatCode === 3) sample = view.getFloat32(at, true);
            else if (info.bitsPerSample === 8) sample = (view.getUint8(at) - 128) / 128;
            else if (info.bitsPerSample === 16) sample = view.getInt16(at, true) / 32768;
            else if (info.bitsPerSample === 24) {
              const word = view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getUint8(at + 2) << 16);
              sample = (word >= 0x800000 ? word - 0x1000000 : word) / 8388608;
            } else sample = view.getInt32(at, true) / 2147483648;
            if (!Number.isFinite(sample)) fail("nonfinite", "The WAV audio contains a non-finite sample");
            // Float data outside [-1,1] remains measurable, never normalized or
            // clipped. Playback, independently, must apply peak-safe gain.
            channels[channel][frame] = sample;
            peak = Math.max(peak, Math.abs(channels[channel][frame]));
            if (sample <= -1 || sample >= positiveLimit) fullScaleSamples++;
          }
        }
      } catch (error) {
        if (error instanceof WaveReadError) throw error;
        fail("invalid", "The WAV bytes changed or became unavailable while decoding");
      }
      onProgress(last / info.frames);
      if (last < info.frames) await yieldTask();
      checkCancelled();
    }
    return { ...info, channels, peak, fullScaleSamples };
  }

  return Object.freeze({ MAX_SECONDS, MAX_INPUT_BYTES, MAX_DECODED_BYTES,
    MAX_SAMPLE_RATE, MAX_CHUNKS, CHUNK_FRAMES, WaveReadError, inspect, decode });
});
