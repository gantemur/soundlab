/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const wav = require("./sound-wav.js");

const pcm = bytes => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: (bytes.length - 44) / 2 }, (_, i) => view.getInt16(44 + i * 2, true));
};

test("shared WAV encoder writes a complete little-endian mono PCM16 header", () => {
  const bytes = wav.encodeWav([Float32Array.of(0, .5), Float32Array.of(-1, 1, -2, 2)], 44100);
  const view = new DataView(bytes.buffer);
  const ascii = (offset, count) => String.fromCharCode(...bytes.slice(offset, offset + count));
  assert.equal(ascii(0, 4), "RIFF");
  assert.equal(ascii(8, 4), "WAVE");
  assert.equal(ascii(12, 4), "fmt ");
  assert.equal(ascii(36, 4), "data");
  assert.equal(view.getUint32(4, true), bytes.length - 8);
  assert.equal(view.getUint32(16, true), 16);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(28, true), 88200);
  assert.equal(view.getUint16(32, true), 2);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 12);
  assert.deepEqual(pcm(bytes), [0, 16384, -32768, 32767, -32768, 32767]);
});

test("attenuation preserves sample ratios, never boosts, and precedes PCM clipping", () => {
  const samples = Float32Array.of(-4, -.5, .5, 4);
  assert.deepEqual(pcm(wav.encodeWav([samples], 44100, { gain: .25 })), [-32768, -4096, 4096, 32767]);
  assert.deepEqual(pcm(wav.encodeWav([samples], 44100, { gain: 0 })), [0, 0, 0, 0]);
  assert.deepEqual(Array.from(samples), [-4, -.5, .5, 4], "encoding does not alter its source");
  for (const gain of [-.01, 1.01, NaN, Infinity, "1", null]) {
    assert.throws(() => wav.encodeWav([samples], 44100, { gain }), RangeError);
  }
});

test("block boundaries and subarray views do not add, reorder or drop frames", () => {
  const all = Float32Array.of(-1, -.5, 0, .5, 1);
  const parts = [all.subarray(0, 2), new Float32Array(0), all.subarray(2, 3), all.subarray(3)];
  assert.deepEqual(wav.encodeWav(parts, 48000), wav.encodeWav([all], 48000));
  assert.deepEqual(pcm(wav.encodeWav([all.subarray(1, 4)], 48000)), [-16384, 0, 16384]);
  assert.equal(wav.encodeWav([], 8000).length, 44);
});

test("the shared encoder accepts long exports without increasing the recorder cap", () => {
  assert.equal(wav.MAX_SECONDS, 93);
  const sampleRate = 8000, frames = 18 * sampleRate;
  const samples = new Float32Array(frames);
  samples[frames - 1] = .5;
  const bytes = wav.encodeWav([samples], sampleRate);
  assert.equal(bytes.length, 44 + frames * 2);
  assert.equal(new DataView(bytes.buffer).getInt16(bytes.length - 2, true), 16384);
  assert.throws(() => wav.encodeWav([samples], sampleRate, { maxSeconds: 15 }), RangeError);
  const long = new Float32Array(132 * sampleRate);
  assert.equal(wav.encodeWav([long], sampleRate, { maxSeconds: 133 }).length, 44 + long.length * 2);
});

test("maximum length is bounded before output allocation and includes the exact endpoint", () => {
  const sampleRate = 8000, frames = wav.MAX_SECONDS * sampleRate;
  assert.equal(wav.encodeWav([new Float32Array(frames)], sampleRate).length, 44 + frames * 2);
  assert.throws(() => wav.encodeWav([new Float32Array(frames), Float32Array.of(0)], sampleRate), RangeError);
  assert.equal(wav.encodeWav([Float32Array.of(0)], sampleRate, { maxSeconds: .0001 }).length, 46);
  assert.throws(() => wav.encodeWav([Float32Array.of(0, 0)], sampleRate, { maxSeconds: .0001 }), RangeError);
});

test("strict default rejects all non-finite samples, including with zero gain", () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    const blocks = [Float32Array.of(.1), Float32Array.of(value)];
    assert.throws(() => wav.encodeWav(blocks, 44100), /non-finite/);
    assert.throws(() => wav.encodeWav(blocks, 44100, { gain: 0 }), /non-finite/);
  }
});

test("explicit silence policy retains the live recorder's historical non-finite handling", () => {
  const bytes = wav.encodeWav([Float32Array.of(NaN, Infinity, -Infinity, -.5, .5)], 44100,
    { nonFinite: "silence" });
  assert.deepEqual(pcm(bytes), [0, 0, 0, -16384, 16384]);
});

test("Float32Arrays from another realm are accepted without accepting other views or spoofed tags", () => {
  const foreign = vm.runInNewContext("Float32Array.of(-.5, 0, .5)");
  assert.equal(foreign instanceof Float32Array, false);
  assert.deepEqual(pcm(wav.encodeWav([foreign], 44100)), [-16384, 0, 16384]);
  for (const block of [null, [], [0], new Float64Array(1), new Int32Array(1), new Int16Array(1),
    new Uint8Array(1), new DataView(new ArrayBuffer(4)), { length: 1, 0: 0 }]) {
    assert.throws(() => wav.encodeWav([block], 44100), TypeError);
  }
  const spoofed = new Int32Array(1);
  Object.defineProperty(spoofed, Symbol.toStringTag, { value: "Float32Array" });
  assert.throws(() => wav.encodeWav([spoofed], 44100), TypeError);
  const real = Float32Array.of(.5);
  Object.defineProperty(real, "length", { value: 1000000 });
  assert.deepEqual(pcm(wav.encodeWav([real], 44100)), [16384], "intrinsic view length cannot be overridden");
});

test("rates, arrays and options are validated before packing", () => {
  for (const rate of [0, 7999, 192001, NaN, Infinity, 44100.5, "44100", null]) {
    assert.throws(() => wav.encodeWav([], rate), RangeError);
  }
  for (const blocks of [null, {}, new Float32Array(1), "samples"]) {
    assert.throws(() => wav.encodeWav(blocks, 44100), RangeError);
  }
  for (const maxSeconds of [0, -.01, NaN, Infinity, "15", null]) {
    assert.throws(() => wav.encodeWav([], 44100, { maxSeconds }), RangeError);
  }
  for (const options of [null, [], "options", 1, { unknown: true }]) {
    assert.throws(() => wav.encodeWav([], 44100, options), TypeError);
  }
  for (const nonFinite of [null, false, "ignore", "zero"]) {
    assert.throws(() => wav.encodeWav([], 44100, { nonFinite }), RangeError);
  }
  assert.throws(() => wav.encodeWav(new Array(65537), 44100), RangeError);
  assert.equal(wav.encodeWav([], 192000).length, 44);
});

test("browser module is independent of Web Audio and rejects bad input before allocating WAV bytes", () => {
  let allocations = 0;
  class CountingBytes extends Uint8Array { constructor(length) { super(length); allocations++; } }
  const context = { Uint8Array: CountingBytes,
    AudioContext() { throw new Error("must not use live audio"); },
    OfflineAudioContext() { throw new Error("packing must not render audio"); } };
  const code = fs.readFileSync(path.join(__dirname, "sound-wav.js"), "utf8");
  vm.runInNewContext(code, context);
  assert.equal(context.SoundLabWav.MAX_SECONDS, 93);
  assert.equal(Object.isFrozen(context.SoundLabWav), true);
  assert.throws(() => context.SoundLabWav.encodeWav([Float32Array.of(NaN)], 44100), /non-finite/);
  assert.throws(() => context.SoundLabWav.encodeWav([new Float32Array(8001)], 8000, { maxSeconds: 1 }), /maximum/);
  assert.equal(allocations, 0);
  assert.equal(context.SoundLabWav.encodeWav([Float32Array.of(.25)], 44100).length, 46);
  assert.equal(allocations, 1);
});
