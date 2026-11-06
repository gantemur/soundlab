/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Bounded mono PCM16 WAV packing, shared by recording and offline export.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabWav = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_SECONDS = 93;
  const MAX_BLOCKS = 65536;
  const typedArrayPrototype = Object.getPrototypeOf(Float32Array.prototype);
  const typedArrayName = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag).get;
  const typedArrayLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, "length").get;

  // Cross-window Float32Arrays are valid. Test their actual typed-array kind,
  // rather than instanceof or a user-overridden Symbol.toStringTag/length.
  function lengthOf(block) {
    if (!ArrayBuffer.isView(block) || typedArrayName.call(block) !== "Float32Array") {
      throw new TypeError("WAV blocks must be Float32Array");
    }
    return typedArrayLength.call(block);
  }

  function encodeWav(blocks, sampleRate, options = {}) {
    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
        !Array.isArray(blocks) || blocks.length > MAX_BLOCKS) {
      throw new RangeError("Invalid WAV sample rate or blocks");
    }
    if (!options || typeof options !== "object" || Array.isArray(options) ||
        Object.keys(options).some(key => !["maxSeconds", "gain", "nonFinite"].includes(key))) {
      throw new TypeError("Invalid WAV encoding options");
    }
    const maxSeconds = options.maxSeconds === undefined ? MAX_SECONDS : options.maxSeconds;
    const gain = options.gain === undefined ? 1 : options.gain;
    const nonFinite = options.nonFinite === undefined ? "reject" : options.nonFinite;
    if (!Number.isFinite(maxSeconds) || maxSeconds <= 0 || maxSeconds > MAX_SECONDS ||
        !Number.isFinite(gain) || gain < 0 || gain > 1 || !["reject", "silence"].includes(nonFinite)) {
      throw new RangeError("Invalid WAV duration, attenuation or sample policy");
    }
    const maxFrames = Math.ceil(sampleRate * maxSeconds), checked = [];
    let frames = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i], length = lengthOf(block);
      frames += length;
      if (frames > maxFrames) throw new RangeError("Audio exceeds maximum WAV length");
      checked.push({ block, length });
    }
    // Fail visibly on invalid rendered audio, before allocating the output.
    // The live recorder opts into its historical non-finite-to-silence policy.
    if (nonFinite === "reject") for (const { block, length } of checked) {
      for (let i = 0; i < length; i++) {
        if (!Number.isFinite(block[i])) throw new RangeError("WAV audio contains a non-finite sample");
      }
    }

    const bytes = new Uint8Array(44 + frames * 2);
    const view = new DataView(bytes.buffer);
    const ascii = (offset, value) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    ascii(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); ascii(8, "WAVE");
    ascii(12, "fmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); // block alignment
    view.setUint16(34, 16, true);
    ascii(36, "data"); view.setUint32(40, frames * 2, true);
    let offset = 44;
    for (const { block, length } of checked) {
      for (let i = 0; i < length; i++) {
        const value = block[i];
        // Re-check in case a caller supplies a concurrently changed shared
        // buffer. Never silently replace invalid offline audio with silence.
        if (!Number.isFinite(value) && nonFinite === "reject") {
          throw new RangeError("WAV audio contains a non-finite sample");
        }
        const sample = Number.isFinite(value) ? Math.max(-1, Math.min(1, value * gain)) : 0;
        view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
        offset += 2;
      }
    }
    return bytes;
  }

  return Object.freeze({ MAX_SECONDS, encodeWav });
});
