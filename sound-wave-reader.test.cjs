/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const reader = require("./sound-wave-reader.js");
const wav = require("./sound-wav.js");

const noWait = () => Promise.resolve();
const decode = bytes => reader.decode(bytes, { yieldTask: noWait });
const ascii = (bytes, at, value) => {
  for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i);
};
const viewOf = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const errorCode = code => error => error instanceof reader.WaveReadError && error.code === code;
const close = (actual, expected, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

function fixture({ format = 1, bits = 16, sampleRate = 48000, channelCount,
  values = [[0]], frames = values[0].length } = {}) {
  if (channelCount === undefined) channelCount = values.length;
  const sampleBytes = bits / 8, align = channelCount * sampleBytes, dataBytes = frames * align;
  const bytes = new Uint8Array(44 + dataBytes + dataBytes % 2), view = viewOf(bytes);
  ascii(bytes, 0, "RIFF"); view.setUint32(4, bytes.length - 8, true); ascii(bytes, 8, "WAVE");
  ascii(bytes, 12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, format, true); view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * align, true);
  view.setUint16(32, align, true); view.setUint16(34, bits, true);
  ascii(bytes, 36, "data"); view.setUint32(40, dataBytes, true);
  for (let channel = 0; channel < values.length; channel++) {
    for (let frame = 0; frame < Math.min(frames, values[channel].length); frame++) {
      const at = 44 + frame * align + channel * sampleBytes, value = values[channel][frame];
      if (format === 3) view.setFloat32(at, value, true);
      else if (bits === 8) view.setUint8(at, value);
      else if (bits === 16) view.setInt16(at, value, true);
      else if (bits === 24) {
        const word = value < 0 ? value + 0x1000000 : value;
        bytes[at] = word & 255; bytes[at + 1] = word >> 8 & 255; bytes[at + 2] = word >> 16 & 255;
      } else if (bits === 32) view.setInt32(at, value, true);
    }
  }
  return bytes;
}

function riff(chunks) {
  const bytes = new Uint8Array(12 + chunks.reduce((sum, [, data]) => sum + 8 + data.length + data.length % 2, 0));
  const view = viewOf(bytes);
  ascii(bytes, 0, "RIFF"); view.setUint32(4, bytes.length - 8, true); ascii(bytes, 8, "WAVE");
  let offset = 12;
  for (const [id, data] of chunks) {
    ascii(bytes, offset, id); view.setUint32(offset + 4, data.length, true);
    bytes.set(data, offset + 8); offset += 8 + data.length + data.length % 2;
  }
  return bytes;
}

function altered(bytes, change) {
  const copy = bytes.slice(); change(viewOf(copy), copy); return copy;
}

test("the reader exposes fixed local-file bounds and an allocation-free header inspection", () => {
  assert.equal(reader.MAX_SECONDS, 120);
  assert.equal(reader.MAX_INPUT_BYTES, 32 * 1024 * 1024);
  assert.equal(reader.MAX_DECODED_BYTES, 64 * 1024 * 1024);
  const info = reader.inspect(fixture({ values: [[-32768, 0, 32767]], sampleRate: 16000 }));
  assert.deepEqual(info, {
    formatCode: 1, channelCount: 1, sampleRate: 16000, bitsPerSample: 16, blockAlign: 2,
    encoding: "PCM16", dataOffset: 44, dataBytes: 6, frames: 3,
    duration: 3 / 16000, decodedBytes: 12, inputBytes: 50
  });
  assert.equal(Object.isFrozen(info), true);
  assert.equal(Object.isFrozen(reader), true);
});

test("PCM8 is unsigned; PCM16/24/32 sign, endpoints and small values decode correctly", async () => {
  const cases = [
    { bits: 8, raw: [0, 64, 128, 192, 255], expected: [-1, -.5, 0, .5, 127 / 128] },
    { bits: 16, raw: [-32768, -16384, -1, 0, 1, 16384, 32767],
      expected: [-1, -.5, -1 / 32768, 0, 1 / 32768, .5, 32767 / 32768] },
    { bits: 24, raw: [-8388608, -4194304, -1, 0, 1, 4194304, 8388607],
      expected: [-1, -.5, -1 / 8388608, 0, 1 / 8388608, .5, 8388607 / 8388608] },
    { bits: 32, raw: [-2147483648, -1073741824, -1, 0, 1, 1073741824, 2147483647],
      expected: [-1, -.5, -1 / 2147483648, 0, 1 / 2147483648, .5, Math.fround(2147483647 / 2147483648)] }
  ];
  for (const { bits, raw, expected } of cases) {
    const source = fixture({ bits, values: [raw] }), before = source.slice();
    const result = await decode(source);
    assert.ok(result.channels[0] instanceof Float32Array);
    assert.deepEqual(Array.from(result.channels[0]), expected.map(Math.fround));
    assert.equal(result.frames, raw.length);
    assert.equal(result.encoding, "PCM" + bits);
    assert.equal(result.peak, 1);
    assert.equal(result.fullScaleSamples, 2);
    assert.deepEqual(source, before, "import never edits the encoded bytes");
  }
});

test("stereo channels remain distinct and opposite-phase audio is never silently downmixed", async () => {
  const source = fixture({ values: [[0, 8192, 16384, -32768], [0, -8192, -16384, 32767]] });
  const result = await decode(source);
  assert.equal(result.channelCount, 2);
  assert.equal(result.channels.length, 2);
  assert.deepEqual(Array.from(result.channels[0]), [0, .25, .5, -1]);
  assert.deepEqual(Array.from(result.channels[1]), [0, -.25, -.5, 32767 / 32768]);
  assert.equal(result.decodedBytes, 32);
  assert.equal(result.frames, 4);
  assert.equal(result.peak, 1);
});

test("32-bit floats keep finite over-full-scale values and reject NaN and both infinities", async () => {
  const values = [-3.25, -1, -.5, -0, 0, .5, 1, 2.5, 3.4028234663852886e38];
  const source = fixture({ format: 3, bits: 32, values: [values] });
  const result = await decode(source);
  assert.equal(result.encoding, "FLOAT32");
  assert.deepEqual(Array.from(result.channels[0]), values.map(Math.fround));
  assert.equal(result.peak, Math.fround(values.at(-1)));
  assert.equal(result.fullScaleSamples, 5);
  for (const value of [NaN, Infinity, -Infinity]) {
    const bytes = fixture({ format: 3, bits: 32, values: [[.5, value]] });
    assert.equal(reader.inspect(bytes).frames, 2, "header inspection does not pretend to validate sample contents");
    await assert.rejects(decode(bytes), errorCode("nonfinite"));
  }
});

test("source rates and one-frame recordings are preserved without Web Audio or resampling", async () => {
  for (const sampleRate of [1, 8000, 16000, 44100, 48000, 192000, 384000]) {
    const result = await decode(fixture({ sampleRate, values: [[16384]] }));
    assert.equal(result.sampleRate, sampleRate);
    assert.equal(result.duration, 1 / sampleRate);
    assert.equal(result.frames, 1);
    assert.equal(result.channels[0][0], .5);
  }
});

test("unknown metadata, repeated unknown chunks, odd padding and data before fmt are handled", async () => {
  const original = fixture({ bits: 8, values: [[0, 128, 255]] });
  const fmt = original.slice(20, 36), data = original.slice(44, 47);
  const bytes = riff([["JUNK", Uint8Array.of(1, 2, 3)], ["data", data],
    ["LIST", Uint8Array.of(1, 2)], ["fmt ", fmt], ["JUNK", new Uint8Array(0)],
    ["fact", Uint8Array.of(3, 0, 0, 0)]]);
  bytes[23] = 251; // Padding is present, but its value is not interpreted.
  const result = await decode(bytes);
  assert.deepEqual(Array.from(result.channels[0]), [-1, 0, 127 / 128]);
  assert.equal(result.frames, 3);
  const fmt18 = new Uint8Array(18); fmt18.set(fmt);
  assert.equal(reader.inspect(riff([["fmt ", fmt18], ["data", data]])).encoding, "PCM8");
  const floating = fixture({ format: 3, bits: 32, values: [[.25]] });
  fmt18.set(floating.slice(20, 36));
  assert.equal((await decode(riff([["fmt ", fmt18], ["data", floating.slice(44)]]))).channels[0][0], .25);
});

test("subarray and DataView offsets, Node buffers and cross-realm ArrayBuffers are respected", async () => {
  const bytes = fixture({ values: [[-8192, 16384]] });
  const padded = new Uint8Array(bytes.length + 20); padded.fill(255); padded.set(bytes, 7);
  for (const source of [bytes.buffer, padded.subarray(7, 7 + bytes.length),
    new DataView(padded.buffer, 7, bytes.length), Buffer.from(bytes), new Uint16Array(bytes.buffer)]) {
    assert.deepEqual(Array.from((await decode(source)).channels[0]), [-.25, .5]);
  }
  const foreign = vm.runInNewContext("Uint8Array.from(input)", { input: Array.from(bytes) });
  assert.equal(foreign instanceof Uint8Array, false);
  assert.equal(reader.inspect(foreign.buffer).frames, 2);
  assert.deepEqual(Array.from((await decode(foreign)).channels[0]), [-.25, .5]);
  const tagged = bytes.slice();
  Object.defineProperties(tagged, { byteOffset: { value: 999999 }, byteLength: { value: 2 },
    buffer: { value: new ArrayBuffer(0) } });
  assert.deepEqual(Array.from((await decode(tagged)).channels[0]), [-.25, .5]);
});

test("bad objects, detached/shared buffers and short headers fail with a stable error", async () => {
  for (const bytes of [null, undefined, [], {}, "RIFF", { buffer: new ArrayBuffer(44), byteLength: 44 },
    new ArrayBuffer(0), new Uint8Array(11), { [Symbol.toStringTag]: "ArrayBuffer", byteLength: 44 }]) {
    assert.throws(() => reader.inspect(bytes), errorCode("invalid"));
    await assert.rejects(decode(bytes), errorCode("invalid"));
  }
  if (typeof SharedArrayBuffer === "function") {
    for (const bytes of [new SharedArrayBuffer(44), new Uint8Array(new SharedArrayBuffer(44))]) {
      assert.throws(() => reader.inspect(bytes), errorCode("invalid"));
    }
  }
  if (typeof structuredClone === "function") {
    const bytes = fixture().buffer;
    structuredClone(bytes, { transfer: [bytes] });
    assert.throws(() => reader.inspect(bytes), errorCode("invalid"));
  }
});

test("container types, audio encodings, bit depths, channel counts and rates are explicit", () => {
  const bytes = fixture();
  for (const marker of ["RIFX", "RF64"]) {
    assert.throws(() => reader.inspect(altered(bytes, (_, b) => ascii(b, 0, marker))), errorCode("unsupported"));
  }
  for (const [offset, marker] of [[0, "riff"], [0, "OggS"], [8, "AVI "]]) {
    assert.throws(() => reader.inspect(altered(bytes, (_, b) => ascii(b, offset, marker))), errorCode("invalid"));
  }
  for (const format of [0, 2, 6, 7, 0xfffe]) {
    assert.throws(() => reader.inspect(altered(bytes, v => v.setUint16(20, format, true))), errorCode("unsupported"));
  }
  for (const bits of [0, 1, 12, 20, 64]) {
    assert.throws(() => reader.inspect(altered(bytes, v => v.setUint16(34, bits, true))), errorCode("unsupported"));
  }
  assert.throws(() => reader.inspect(altered(bytes, v => v.setUint16(20, 3, true))), errorCode("unsupported"));
  for (const count of [0, 3, 65535]) {
    assert.throws(() => reader.inspect(altered(bytes, v => v.setUint16(22, count, true))), errorCode("unsupported"));
  }
  assert.throws(() => reader.inspect(altered(bytes, v => v.setUint32(24, 0, true))), errorCode("invalid"));
  assert.throws(() => reader.inspect(altered(bytes, v => v.setUint32(24, 384001, true))), errorCode("unsupported"));
});

test("RIFF and chunk lengths are checked without overflow, incomplete frames or hidden trailing data", () => {
  const bytes = fixture({ values: [[100, 200]] });
  const cases = [
    altered(bytes, v => v.setUint32(4, 0, true)),
    altered(bytes, v => v.setUint32(4, 0xffffffff, true)),
    altered(bytes, v => v.setUint32(4, bytes.length - 9, true)),
    altered(bytes, v => v.setUint32(16, 0xffffffff, true)),
    altered(bytes, v => v.setUint32(40, 0xffffffff, true)),
    altered(bytes, v => v.setUint32(40, 3, true)), // PCM16 has an incomplete frame.
    altered(bytes, v => v.setUint16(32, 4, true)),
    altered(bytes, v => v.setUint32(28, 8000, true)),
    fixture({ frames: 0 })
  ];
  for (const bad of cases) assert.throws(() => reader.inspect(bad), errorCode("invalid"));
  const odd = fixture({ bits: 8, values: [[128]] });
  const noPad = odd.slice(0, -1); viewOf(noPad).setUint32(4, noPad.length - 8, true);
  assert.throws(() => reader.inspect(noPad), errorCode("invalid"));
  const trailing = new Uint8Array(bytes.length + 1); trailing.set(bytes);
  assert.throws(() => reader.inspect(trailing), errorCode("invalid"));
  viewOf(trailing).setUint32(4, trailing.length - 8, true);
  assert.throws(() => reader.inspect(trailing), errorCode("invalid"));
});

test("missing or ambiguous audio/format chunks and malformed extensions fail visibly", () => {
  const bytes = fixture(), fmt = bytes.slice(20, 36), data = bytes.slice(44);
  for (const chunks of [[], [["fmt ", fmt]], [["data", data]],
    [["fmt ", fmt], ["data", data], ["fmt ", fmt]],
    [["fmt ", fmt.slice(0, 15)], ["data", data]]]) {
    assert.throws(() => reader.inspect(riff(chunks)), errorCode("invalid"));
  }
  assert.throws(() => reader.inspect(riff([["fmt ", fmt], ["data", data], ["data", data]])), errorCode("unsupported"));
  for (const size of [17, 19, 20]) {
    const extended = new Uint8Array(size); extended.set(fmt);
    assert.throws(() => reader.inspect(riff([["fmt ", extended], ["data", data]])), errorCode("invalid"));
  }
  const extension = new Uint8Array(20); extension.set(fmt); viewOf(extension).setUint16(16, 2, true);
  assert.throws(() => reader.inspect(riff([["fmt ", extension], ["data", data]])), errorCode("unsupported"));
});

test("encoded, decoded, duration and metadata-work limits are enforced before PCM allocation", () => {
  assert.throws(() => reader.inspect(new Uint8Array(reader.MAX_INPUT_BYTES + 1)), errorCode("limit"));
  const durationEdge = fixture({ sampleRate: 1, frames: 120 });
  assert.equal(reader.inspect(durationEdge).duration, 120);
  assert.throws(() => reader.inspect(fixture({ sampleRate: 1, frames: 121 })), errorCode("limit"));
  const frames = reader.MAX_DECODED_BYTES / 4;
  assert.equal(reader.inspect(fixture({ bits: 8, sampleRate: 384000, frames })).decodedBytes,
    reader.MAX_DECODED_BYTES);
  assert.throws(() => reader.inspect(fixture({ bits: 8, sampleRate: 384000, frames: frames + 1 })), errorCode("limit"));
  const base = fixture();
  const manyChunks = [["fmt ", base.slice(20, 36)], ["data", base.slice(44)],
    ...Array.from({ length: reader.MAX_CHUNKS - 2 }, () => ["JUNK", new Uint8Array(0)])];
  assert.equal(reader.inspect(riff(manyChunks)).frames, 1);
  manyChunks.push(["JUNK", new Uint8Array(0)]);
  assert.throws(() => reader.inspect(riff(manyChunks)), errorCode("limit"));
});

test("a file exactly 32 MiB is accepted when its decoded audio remains small", () => {
  const bytes = new Uint8Array(reader.MAX_INPUT_BYTES), view = viewOf(bytes), base = fixture();
  bytes.set(base.subarray(0, 36));
  view.setUint32(4, bytes.length - 8, true);
  ascii(bytes, 36, "JUNK"); view.setUint32(40, bytes.length - 54, true);
  ascii(bytes, bytes.length - 10, "data"); view.setUint32(bytes.length - 6, 2, true);
  assert.equal(reader.inspect(bytes).inputBytes, reader.MAX_INPUT_BYTES);
  assert.equal(reader.inspect(bytes).frames, 1);
});

test("decode yields with monotonic progress and cancellation before allocation or between chunks", async () => {
  const bytes = fixture({ frames: reader.CHUNK_FRAMES * 2 + 3 }), progress = [];
  let yields = 0;
  const result = await reader.decode(bytes, { onProgress: value => progress.push(value),
    yieldTask: async () => { yields++; } });
  assert.equal(result.frames, reader.CHUNK_FRAMES * 2 + 3);
  assert.equal(progress[0], 0);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.every((value, i) => value >= 0 && value <= 1 && (!i || value > progress[i - 1])));
  assert.equal(yields, 3);
  await assert.rejects(reader.decode(bytes, { isCancelled: () => true, yieldTask: noWait }), errorCode("cancelled"));
  let cancel = false;
  await assert.rejects(reader.decode(bytes, { isCancelled: () => cancel,
    yieldTask: async () => { cancel = true; } }), errorCode("cancelled"));
  cancel = false;
  await assert.rejects(reader.decode(bytes, { isCancelled: () => cancel,
    onProgress: value => { if (value > 0) cancel = true; }, yieldTask: noWait }), errorCode("cancelled"));
  for (const options of [null, [], 1, { isCancelled: true }, { onProgress: "yes" }, { yieldTask: 3 }]) {
    await assert.rejects(reader.decode(bytes, options), errorCode("invalid"));
  }
});

test("browser module uses no audio APIs and rejects structural/bounds errors before allocating PCM", async () => {
  let allocations = 0;
  class CountingSamples extends Float32Array { constructor(length) { super(length); allocations++; } }
  const context = { Float32Array: CountingSamples, setTimeout,
    AudioContext() { throw new Error("must not open audio"); },
    OfflineAudioContext() { throw new Error("must not render audio"); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "sound-wave-reader.js"), "utf8"), context);
  const api = context.SoundLabWaveReader;
  assert.equal(api.inspect(fixture()).frames, 1);
  assert.equal(allocations, 0);
  for (const bytes of [new Uint8Array(10), fixture({ frames: 121, sampleRate: 1 })]) {
    await assert.rejects(api.decode(bytes, { yieldTask: noWait }), error => /invalid|limit/.test(error.code));
  }
  await assert.rejects(api.decode(fixture(), { isCancelled: () => true }), error => error.code === "cancelled");
  assert.equal(allocations, 0);
  assert.equal((await api.decode(fixture({ values: [[16384]] }), { yieldTask: noWait })).channels[0][0], .5);
  assert.equal(allocations, 1);
});

test("shared-encoder 30-second REC and 93-second Compose-length WAVs roundtrip", async () => {
  for (const [seconds, sampleRate] of [[30, 48000], [93, 44100]]) {
    const samples = new Float32Array(seconds * sampleRate);
    for (let frame = 0; frame < samples.length; frame++) samples[frame] = .4 * Math.sin(2 * Math.PI * 440 * frame / sampleRate);
    samples[0] = .5; samples[samples.length - 1] = -.5;
    const bytes = wav.encodeWav([samples], sampleRate, { maxSeconds: seconds });
    const decoded = await decode(bytes);
    assert.equal(decoded.duration, seconds);
    assert.equal(decoded.sampleRate, sampleRate);
    assert.equal(decoded.frames, samples.length);
    assert.equal(decoded.channels[0][0], .5);
    assert.equal(decoded.channels[0].at(-1), -.5);
    for (let i = 0; i < samples.length; i += 997) close(decoded.channels[0][i], samples[i], 1 / 32768);
    assert.ok(decoded.peak <= .5);
  }
});

test("deterministic malformed-header mutations do not leak native range errors or unbounded results", async () => {
  const base = fixture({ values: [[-1, 0, 1]] });
  for (let index = 0; index < 44; index++) {
    for (const value of [0, 0xff]) {
      const bytes = base.slice(); bytes[index] = value;
      try {
        const result = await decode(bytes);
        assert.ok(result.frames > 0 && result.duration <= reader.MAX_SECONDS);
        assert.ok(result.channels.every(channel => channel.every(Number.isFinite)));
      } catch (error) {
        assert.ok(error instanceof reader.WaveReadError, `offset ${index}: ${error}`);
      }
    }
  }
});
