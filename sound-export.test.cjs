/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const exporter = require("./sound-export.js");
const waveReader = require("./sound-wave-reader.js");
const players = require("./sound-score-player.js");
const abc = require("./sound-abc.js");
const drumABC = require("./sound-drum-abc.js");
const patterns = require("./sound-drum-patterns.js");
const sustain = require("./sound-sustain.js");
const heldVoice = require("./sound-held-voice.js");
const temperament = require("./sound-temperaments.js");
const compose = require("./sound-compose.js");
const ensemble = require("./sound-ensemble.js");
const presets = require("./sound-ensemble-presets.js");
const projects = require("./sound-project.js");

const SCORE = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC D E G |]";
const copy = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, actual + " is not close to " + expected);
const solo = (content = {}) => ({ mode: "solo", content: {
  abc: SCORE, instrument: "sine", tuning: "equal", volume: 40,
  guitar: { mode: "pluck", spacingMs: 20 }, ...content
} });
const track = (id, instrument = "sine", text = SCORE, changes = {}) => ({
  id, name: "Track " + id, instrument, abc: text, volume: 50, mute: false, solo: false, ...changes
});
const arrangement = tracks => ({ mode: "ensemble", content: {
  tuning: "equal", tracks, selectedId: tracks[0].id,
  nextId: Math.max(...tracks.map(item => item.id)) + 1,
  editor: { gridBar: 1, gridStep: 16, gridStrength: "normal" }
} });
const percussion = (body = "[!accent!CE]4 D4 F4 G4 |]") =>
  "M:4/4\nL:1/16\nQ:1/4=120\nK:C clef=perc\n" + body;

// This fixture records the scheduled Web Audio graph; it does not pretend to
// reproduce a browser's oscillator DSP. Controlled output samples separately
// exercise the rendered-buffer, attenuation and PCM packing boundaries.
function fixture(options = {}) {
  const contexts = [], modelCalls = [];
  let pendingRecipe = null;
  const duration = options.duration || ((decay, kind) => kind === "harp" ? Math.min(3, Math.max(.7, 5 * decay)) :
    Math.max(.35, Math.min(3, decay * 4)));
  const transientModel = {
    duration,
    makeSamples(kind, hz, decay, rate, size, settings) {
      const recipe = { kind, hz, decay, rate, size, settings: { ...settings } };
      modelCalls.push(recipe);
      if (options.modelErrorAt === modelCalls.length) throw new Error("model preparation failed");
      pendingRecipe = recipe;
      const samples = new Float32Array(Math.ceil(duration(decay, kind) * rate));
      if (samples.length > 1) samples[1] = .25;
      return samples;
    }
  };
  function param() {
    return { value: 0, records: [],
      cancelScheduledValues(at) { this.records.push(["cancel", at]); },
      setValueAtTime(value, at) { this.value = value; this.records.push(["set", value, at]); },
      linearRampToValueAtTime(value, at) { this.value = value; this.records.push(["ramp", value, at]); },
      setTargetAtTime(value, at, constant) { this.value = value; this.records.push(["target", value, at, constant]); }
    };
  }
  class FakeOfflineAudioContext {
    constructor(channels, length, sampleRate) {
      this.channels = channels; this.length = length; this.sampleRate = sampleRate;
      this.currentTime = 0; this.destination = { kind: "destination" };
      this.gains = []; this.sources = []; this.buffers = []; this.waves = []; this.filters = []; this.shapers = [];
      this.renderCalls = 0; this.graph = null;
      contexts.push(this);
      assert.equal(arguments.length, 3);
      assert.equal(channels, 1); assert.equal(sampleRate, 44100);
      assert.ok(Number.isSafeInteger(length) && length > 0 && length * 4 <= exporter.MAX_RENDER_PCM_BYTES);
      if (options.constructorError) throw new Error(options.constructorError);
      if (options.missingRenderer) this.startRendering = undefined;
    }
    resume() { throw new Error("offline export must not resume live audio"); }
    suspend() { throw new Error("offline export must not suspend live audio"); }
    createGain() {
      const node = { kind: "gain", gain: param(), target: null, disconnected: false,
        connect(target) { this.target = target; },
        disconnect() { this.target = null; this.disconnected = true; }
      };
      this.gains.push(node); return node;
    }
    createPeriodicWave(real, imag, settings) {
      const wave = { real: Float32Array.from(real), imag: Float32Array.from(imag), settings: { ...settings } };
      this.waves.push(wave); return wave;
    }
    createBiquadFilter() {
      const node = { kind: "filter", frequency: param(), Q: param(), gain: param(),
        connect(target) { this.target = target; }, disconnect() { this.disconnected = true; } };
      this.filters.push(node); return node;
    }
    createWaveShaper() {
      const node = { kind: "shaper", connect(target) { this.target = target; },
        disconnect() { this.disconnected = true; } };
      this.shapers.push(node); return node;
    }
    makeSource(kind) {
      const source = { kind, type: "sine", target: null, frequency: param(), onended: null,
        stopTimes: [], disconnected: false,
        connect(target) { this.target = target; },
        disconnect() { this.target = null; this.disconnected = true; },
        setPeriodicWave(wave) { this.wave = wave; },
        start(at, offset = 0) { this.startedAt = at; this.offset = offset; },
        stop(at) { this.stoppedAt = at; this.stopTimes.push(at); }
      };
      if (kind === "buffer") source.buffer = null;
      this.sources.push(source); return source;
    }
    createOscillator() { return this.makeSource("oscillator"); }
    createBufferSource() { return this.makeSource("buffer"); }
    createBuffer(channels, length, sampleRate) {
      assert.equal(channels, 1);
      const data = new Float32Array(length);
      const buffer = { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate,
        recipe: pendingRecipe, getChannelData(channel) { assert.equal(channel, 0); return data; } };
      pendingRecipe = null; this.buffers.push(buffer); return buffer;
    }
    async startRendering() {
      this.renderCalls++;
      const chain = source => {
        const result = []; let node = source.target;
        while (node && result.length < 20) {
          result.push(node === this.destination ? "destination" : this.gains.indexOf(node));
          node = node.target;
        }
        return result;
      };
      // Snapshot before render's finally block stops nodes and clears buffers.
      this.graph = {
        gains: this.gains.map(node => ({ records: copy(node.gain.records), target: node.target })),
        sources: this.sources.map(source => ({ kind: source.kind, type: source.type,
          at: source.startedAt, offset: source.offset, stop: source.stoppedAt, loop: Boolean(source.loop),
          frequency: source.frequency.records.find(item => item[0] === "set")?.[1],
          buffer: source.buffer, bufferIndex: this.buffers.indexOf(source.buffer), wave: source.wave,
          chain: chain(source), gain: source.target.gain ? copy(source.target.gain.records) : [] }))
      };
      if (options.renderError) throw new Error("offline rendering failed");
      const data = new Float32Array(options.channelLength === undefined ? this.length : options.channelLength);
      if (options.samples) data.set(options.samples.slice(0, data.length));
      this.currentTime = this.length / this.sampleRate;
      return { numberOfChannels: options.outputChannels ?? 1, sampleRate: options.outputRate ?? this.sampleRate,
        length: options.outputLength ?? this.length, getChannelData(channel) { assert.equal(channel, 0); return data; } };
    }
  }
  return { contexts, modelCalls, OfflineAudioContext: FakeOfflineAudioContext,
    deps: { transientModel, sustainModel: sustain, temperamentModel: temperament,
      OfflineAudioContext: FakeOfflineAudioContext } };
}
function resultPCM(result, count = 3) {
  const view = new DataView(result.bytes.buffer, result.bytes.byteOffset, result.bytes.byteLength);
  return Array.from({ length: count }, (_, i) => view.getInt16(44 + i * 2, true));
}
function cleaned(context) {
  assert.ok(context.gains.every(gain => gain.disconnected));
  assert.ok(context.filters.every(filter => filter.disconnected));
  assert.ok(context.shapers.every(shaper => shaper.disconnected));
  for (const source of context.sources) {
    assert.equal(source.onended, null);
    assert.ok(source.stopTimes.length > 0);
    if (source.kind === "buffer") assert.equal(source.buffer, null);
  }
}

test("offline export starts at score time zero and never invokes live playback or scheduling intervals", async t => {
  const f = fixture(), oldPlay = players.Player.prototype.play;
  const oldInterval = global.setInterval, oldTimeout = global.setTimeout, oldAudioContext = global.AudioContext;
  const delays = [];
  players.Player.prototype.play = () => { throw new Error("live Player.play must not run"); };
  global.setInterval = () => { throw new Error("playback interval must not run"); };
  global.AudioContext = function () { throw new Error("live context must not be created"); };
  global.setTimeout = (callback, delay, ...args) => { delays.push(delay); return oldTimeout(callback, delay, ...args); };
  t.after(() => {
    players.Player.prototype.play = oldPlay; global.setInterval = oldInterval; global.setTimeout = oldTimeout;
    if (oldAudioContext === undefined) delete global.AudioContext; else global.AudioContext = oldAudioContext;
  });
  const result = await exporter.render(solo(), f.deps);
  assert.equal(f.contexts.length, 1); assert.equal(f.contexts[0].renderCalls, 1);
  assert.deepEqual(f.contexts[0].graph.sources.map(source => source.at), [0, .5, 1, 1.5]);
  assert.ok(delays.length > 0 && delays.every(delay => delay === 0), "only zero-delay rendering yields are used");
  assert.equal(result.sampleRate, 44100); assert.equal(result.gain, 1);
  cleaned(f.contexts[0]);
});

test("offline WAV schedules every pitched timbre at the exact low and high ABC score pitches", async () => {
  const text = "M:2/4\nL:1/4\nQ:1/4=80\nK:C\n__C,,, ^b'' |]";
  const written = players.scheduledEvents(abc.parse(text)).map(note =>
    players.noteFrequency(note, "equal", temperament));
  assert.equal(written.length, 2);
  for (const instrument of players.INSTRUMENTS) {
    const f = fixture();
    const result = await exporter.render(solo({ abc: text, instrument }), f.deps);
    assert.equal(result.bytes[0], 82, `${instrument}: RIFF was produced`);
    const context = f.contexts[0];
    if (instrument === "fmep") {
      assert.equal(context.graph.sources.filter(source => source.kind === "buffer").length, 2,
        "FM electric piano synthesizes both notes using its dedicated frequency-based model");
      cleaned(context);
      continue;
    }
    if (instrument === "accordion") {
      const rankHz = context.graph.sources.filter(source => source.kind === "oscillator" &&
        source.frequency > 0).map(source => source.frequency);
      for (const hz of written) {
        const pair = rankHz.filter(value => Math.abs(value - hz) < hz * .005);
        assert.equal(pair.length, 2, "Accordion has two deliberately detuned ranks for each score pitch");
        close(Math.sqrt(pair[0] * pair[1]), hz, .00001);
      }
      cleaned(context);
      continue;
    }
    const pitched = heldVoice.KINDS.includes(instrument) ||
      ["organ-stopped", "organ-principal", "accordion", "bayan", "sine", "triangle", "square", "sawtooth"].includes(instrument) ?
      context.graph.sources.filter(source => source.kind === "oscillator" &&
        written.some(hz => Math.abs(source.frequency - hz) < .001)).map(source => source.frequency) :
      f.modelCalls.map(call => call.hz);
    for (const hz of written) {
      assert.ok(pitched.some(actual => Math.abs(actual - hz) < .001),
        `${instrument}: ${hz.toFixed(2)} Hz is scheduled unshifted`);
    }
    cleaned(context);
  }
});

test("exports beyond the 30-second recorder limit have the exact mono PCM16 header and bounded duration", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\n" + Array(16).fill("C4").join(" | ") + " |]";
  const f = fixture(), result = await exporter.render(solo({ abc: text }), f.deps);
  assert.ok(result.duration > 32 && result.duration < 32.1);
  assert.equal(result.bytes.length, 44 + f.contexts[0].length * 2);
  close(result.duration, f.contexts[0].length / 44100);
  const view = new DataView(result.bytes.buffer);
  const name = (offset, length) => String.fromCharCode(...result.bytes.slice(offset, offset + length));
  assert.equal(name(0, 4), "RIFF"); assert.equal(name(8, 4), "WAVE");
  assert.equal(name(12, 4), "fmt "); assert.equal(name(36, 4), "data");
  assert.equal(view.getUint32(4, true), result.bytes.length - 8);
  assert.equal(view.getUint16(20, true), 1); assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 44100); assert.equal(view.getUint32(28, true), 88200);
  assert.equal(view.getUint16(32, true), 2); assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), f.contexts[0].length * 2);
});

test("full free-buffer tails and piano/FM dampers determine the ending, not the old live tail constants", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nz15/4 C/4 |]";
  for (const [instrument, end] of [["guitar", 1.875 + 2.6], ["chimes", 1.875 + 2.8], ["marimba", 1.875 + 2.6],
    ["piano", 2.19], ["fmep", 2.19], ["sine", 2.005]]) {
    const f = fixture(), result = await exporter.render(solo({ abc: text, instrument }), f.deps);
    close(result.duration, Math.ceil((end + .02) * 44100) / 44100, 1 / 44100);
    close(f.contexts[0].graph.sources[0].at, 1.875);
    if (instrument === "piano" || instrument === "fmep") {
      close(f.contexts[0].graph.sources[0].stop, 2.19);
      assert.ok(f.contexts[0].graph.sources[0].gain.some(item => item[0] === "target" && item[2] === 2 && item[3] === .028));
    }
  }
  for (const [note, tail] of [["C", 1.44], ["D", .96], ["E", .52], ["F", 1.92], ["G", .96]]) {
    const f = fixture(), result = await exporter.render(arrangement([track(1, "drums", percussion("z15 " + note + " |]"))]), f.deps);
    close(result.duration, Math.ceil((1.875 + tail + .02) * 44100) / 44100, 1 / 44100);
  }
});

test("offline held instruments use the shared full graph and allocate complete short-note releases", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nz255/64 C/64 |]";
  for (const instrument of heldVoice.KINDS) {
    const f = fixture(), result = await exporter.render(solo({ abc: text, instrument }), f.deps);
    const context = f.contexts[0], tail = sustain.defaults(instrument).release + heldVoice.STOP_PAD;
    close(result.duration, Math.ceil((2 + tail + .02) * 44100) / 44100, 1 / 44100);
    assert.ok(result.duration > 2 + tail, "The WAV includes the whole release and final guard padding");
    assert.equal(context.graph.sources.length, instrument === "flute" ? 2 : 3);
    context.graph.sources.forEach(source => { close(source.at, 1.9921875); close(source.stop, 2 + tail); });
    assert.equal(context.buffers.length, 1);
    assert.equal(context.buffers[0].length, heldVoice.bufferFrames(44100));
    assert.equal(f.modelCalls.length, 0, "Held instruments never fall back to a transient sample model");
    assert.equal(context.graph.sources.filter(source => source.loop).length, 1);
    if (instrument === "flute") assert.equal(context.shapers[0].oversample, "4x");
    else assert.ok(context.graph.sources.filter(source => source.kind === "oscillator")
      .every(source => source.wave.settings.disableNormalization));
    cleaned(context);
  }
});

test("four-part I0/I1 exports preserve mix levels while sharing noise and ringing marimba freely", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nz15/4 C/4 |]";
  const instruments = ["flute", "violin", "morin", "marimba"];
  const f = fixture(), result = await exporter.render(arrangement(instruments.map((instrument, index) =>
    track(index + 1, instrument, text, { volume: 20 + 10 * index }))), f.deps);
  const context = f.contexts[0], graph = context.graph;
  assert.deepEqual(graph.gains.slice(1, 5).map(gain => gain.records.find(item => item[0] === "set")[1]),
    [.2, .3, .4, .5]);
  const noises = graph.sources.filter(source => source.loop);
  assert.equal(noises.length, 3);
  assert.ok(noises.every(source => source.buffer === noises[0].buffer), "Held parts share one noise allocation");
  assert.equal(context.buffers.length, 2, "One shared noise buffer and one marimba buffer");
  assert.equal(f.modelCalls.length, 1);
  assert.equal(f.modelCalls[0].kind, "marimba");
  assert.deepEqual(f.modelCalls[0].settings, { velocity: .62 });
  const marimbaSource = graph.sources.find(source => source.kind === "buffer" && !source.loop);
  assert.equal(marimbaSource.chain[1], 4);
  assert.equal(marimbaSource.gain.find(item => item[0] === "set")[1], .19);
  assert.equal(marimbaSource.gain.some(item => item[0] === "target"), false, "No piano damper is applied");
  assert.equal(marimbaSource.stop, undefined, "The bar rings to the end of its modeled buffer");
  for (const source of graph.sources.filter(source => source.kind === "oscillator")) {
    const busIndex = source.chain.at(-3);
    assert.ok(busIndex >= 1 && busIndex <= 3);
    const volumeIndex = source.chain.at(-4);
    assert.equal(graph.gains[volumeIndex].records.find(item => item[0] === "set")[1], .19,
      "Track faders remain on the part buses rather than changing excitation strength");
  }
  close(result.duration, Math.ceil((1.875 + 2.6 + .02) * 44100) / 44100, 1 / 44100);
  cleaned(context);
});

test("I2b Clarinet exports its complete release with the shared reed graph in solo and four-part WAV", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nz15/4 C/4 |]";
  const single = fixture();
  const result = await exporter.render(solo({ abc: text, instrument: "clarinet" }), single.deps);
  const tail = sustain.defaults("clarinet").release + heldVoice.STOP_PAD;
  close(result.duration, Math.ceil((2 + tail + .02) * 44100) / 44100, 1 / 44100);
  const sourceGraph = single.contexts[0].graph;
  assert.equal(sourceGraph.sources.filter(source => source.kind === "oscillator").length, 2);
  assert.equal(sourceGraph.sources.filter(source => source.loop).length, 1);
  assert.equal(single.modelCalls.length, 0, "No transient sample substitution");
  assert.equal(new DataView(result.bytes.buffer).getUint32(24, true), 44100);
  cleaned(single.contexts[0]);

  const mixed = fixture();
  const arrangementResult = await exporter.render(arrangement([
    track(1, "clarinet", text, { volume: 30 }),
    track(2, "flute", text, { volume: 20 }),
    track(3, "violin", text, { volume: 40 }),
    track(4, "xylophone", text, { volume: 35 })
  ]), mixed.deps);
  const graph = mixed.contexts[0].graph;
  assert.equal(graph.sources.filter(source => source.loop).length, 3);
  assert.equal(mixed.contexts[0].buffers.length, 2,
    "Three held instruments share one noise buffer, plus the xylophone note sample");
  assert.deepEqual(mixed.modelCalls.map(call => call.kind), ["xylophone"]);
  assert.ok(arrangementResult.duration > 2 + tail);
  cleaned(mixed.contexts[0]);
});

test("extended Clarinet F5 and Bayan A-flat2 preserve pitch in offline WAV", async () => {
  const header = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\n";
  const upper = header + "f4 |]", lower = header + "_A,,4 |]";
  const one = fixture();
  const single = await exporter.render(solo({ abc: upper, instrument: "clarinet" }), one.deps);
  assert.equal(single.sampleRate, 44100);
  assert.ok(one.contexts[0].graph.sources.some(source =>
    source.kind === "oscillator" && Math.abs(source.frequency - 698.4564628660078) < 1e-6));
  cleaned(one.contexts[0]);

  const many = fixture();
  const result = await exporter.render(arrangement([
    track(1, "clarinet", upper), track(2, "bayan", lower)
  ]), many.deps);
  assert.equal(result.sampleRate, 44100);
  const oscillators = many.contexts[0].graph.sources.filter(source => source.kind === "oscillator");
  assert.ok(oscillators.some(source => Math.abs(source.frequency - 698.4564628660078) < 1e-6),
    "F5 arrives at the clarinet oscillator unchanged");
  assert.ok(oscillators.some(source => Math.abs(source.frequency - 103.82617439498628) < 1e-6),
    "A-flat2 arrives at the Bayan oscillator unchanged");
  assert.ok(result.duration >= 2, "The WAV includes the full written bar");
  cleaned(many.contexts[0]);
});

test("I2a exports independent xylophone and marimba bar tails from both Compose modes", async () => {
  const score = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC z3 |]";
  const x = fixture(), xResult = await exporter.render(solo({
    abc: score, instrument: "xylophone"
  }), x.deps);
  assert.equal(x.modelCalls.length, 1);
  assert.equal(x.modelCalls[0].kind, "xylophone");
  assert.equal(x.modelCalls[0].decay, .32);
  assert.deepEqual(x.modelCalls[0].settings, { velocity: .66 });
  assert.equal(x.contexts[0].graph.sources.filter(source => source.kind === "buffer").length, 1);
  const header = new DataView(xResult.bytes.buffer, xResult.bytes.byteOffset, xResult.bytes.byteLength);
  assert.equal(header.getUint32(24, true), 44100);
  assert.equal(header.getUint16(34, true), 16);
  assert.equal(header.getUint16(22, true), 1);
  assert.ok(xResult.duration > 2 && xResult.duration < 2.1, "The written bar is longer than its short ring");
  cleaned(x.contexts[0]);

  const mixed = fixture(), mixedResult = await exporter.render(arrangement([
    track(1, "xylophone", score, { volume: 35 }),
    track(2, "marimba", score, { volume: 45 }),
    track(3, "piano", score, { volume: 25 }),
    track(4, "flute", score, { volume: 20 })
  ]), mixed.deps);
  assert.deepEqual(mixed.modelCalls.map(item => item.kind), ["xylophone", "marimba", "piano"]);
  assert.deepEqual(mixed.modelCalls.map(item => item.decay), [.32, .65, .8]);
  assert.deepEqual(mixed.modelCalls[0].settings, { velocity: .66 });
  assert.deepEqual(mixed.modelCalls[1].settings, { velocity: .62 });
  const graph = mixed.contexts[0].graph;
  const bars = graph.sources.filter(source => source.kind === "buffer" && !source.loop);
  assert.equal(bars.length, 3);
  assert.ok(bars[0].buffer.duration < bars[1].buffer.duration);
  assert.equal(bars[0].gain.some(item => item[0] === "target"), false);
  assert.equal(bars[1].gain.some(item => item[0] === "target"), false);
  assert.ok(mixedResult.duration > xResult.duration, "The longer marimba tail fits in the same exported WAV");
  assert.equal(graph.sources.some(source => source.kind === "oscillator"), true);
  cleaned(mixed.contexts[0]);
});

test("I2c Mandolin renders exact plucked-course tails in solo and four-part WAV exports", async () => {
  const score = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC z3 |]";
  const one = fixture(), soloResult = await exporter.render(solo({ abc: score, instrument: "mandolin" }), one.deps);
  assert.equal(one.modelCalls.length, 1);
  assert.equal(one.modelCalls[0].kind, "mandolin");
  assert.equal(one.modelCalls[0].decay, .52);
  assert.deepEqual(one.modelCalls[0].settings, { velocity: .64, articulation: "pick" });
  assert.equal(one.contexts[0].graph.sources.filter(source => source.kind === "buffer").length, 1);
  const view = new DataView(soloResult.bytes.buffer, soloResult.bytes.byteOffset, soloResult.bytes.byteLength);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint16(34, true), 16);
  assert.ok(soloResult.duration > 2.09 && soloResult.duration < 2.12,
    "WAV includes all 2.08 s of the undamped string tail plus guard samples");
  cleaned(one.contexts[0]);

  const mixed = fixture();
  const mixedResult = await exporter.render(arrangement([
    track(1, "mandolin", score, { volume: 35 }),
    track(2, "marimba", score, { volume: 35 }),
    track(3, "piano", score, { volume: 30 }),
    track(4, "clarinet", score, { volume: 25 })
  ]), mixed.deps);
  assert.deepEqual(mixed.modelCalls.map(call => call.kind), ["mandolin", "marimba", "piano"]);
  assert.deepEqual(mixed.modelCalls[0].settings, { velocity: .64, articulation: "pick" });
  const string = mixed.contexts[0].graph.sources.find(source =>
    source.kind === "buffer" && source.buffer?.duration > 2 && !source.loop);
  assert.ok(string, "Doubled course is an independent freely ringing buffer");
  assert.equal(string.gain.some(item => item[0] === "target"), false, "No piano damper on a mandolin string");
  assert.ok(mixedResult.duration >= soloResult.duration);
  cleaned(mixed.contexts[0]);
});

test("trailing rests and fully muted or zero-volume projects preserve the full notation duration", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC4 | z4 | z4 |]";
  const withRest = fixture(), restResult = await exporter.render(solo({ abc: text, instrument: "guitar" }), withRest.deps);
  close(restResult.duration, 6.02, 1 / 44100);
  for (const snapshot of [solo({ abc: text, volume: 0 }),
    arrangement([track(1, "piano", text, { mute: true })]),
    arrangement([track(1, "piano", text, { mute: true, solo: true }), track(2, "sine", text)])]) {
    const f = fixture(), result = await exporter.render(snapshot, f.deps);
    close(result.duration, 6.02, 1 / 44100);
    assert.equal(result.peak, 0); assert.equal(result.gain, 1);
    assert.equal(f.contexts[0].sources.length, 0); assert.equal(f.modelCalls.length, 0);
  }
});

test("the current raw snapshot is cloned before the first asynchronous yield", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\n[CEG]2 [DFA]2 |]";
  for (const mode of ["solo", "ensemble"]) {
    const f = fixture();
    const snapshot = mode === "solo" ? solo({ abc: text, instrument: "guitar", guitar: { mode: "alternate", spacingMs: 20 } }) :
      arrangement([track(1, "guitar", text, { guitar: { mode: "alternate", spacingMs: 20 } })]);
    const pending = exporter.render(snapshot, f.deps);
    const part = mode === "solo" ? snapshot.content : snapshot.content.tracks[0];
    part.abc = "now invalid"; part.instrument = "unknown"; part.volume = 0;
    part.guitar.mode = "up"; part.guitar.spacingMs = 60;
    await pending;
    const sources = f.contexts[0].graph.sources;
    assert.equal(sources.length, 6);
    sources.forEach((source, i) => close(source.at, [0, .02, .04, 1, 1.02, 1.04][i]));
    assert.ok(sources[0].buffer.recipe.hz < sources[2].buffer.recipe.hz);
    assert.ok(sources[3].buffer.recipe.hz > sources[5].buffer.recipe.hz);
  }
});

test("invalid ABC, muted invalid parts and unfinished empty pattern drafts fail before a context exists", async () => {
  const drumText = percussion(), linked = patterns.fromABC(drumText);
  const draft = track(1, "drums", drumText, { patterns: linked, patternBar: 1,
    patternId: linked.sequence[0].id, textMode: "pattern",
    patternDraft: { id: linked.sequence[0].id, text: "", error: "draft" } });
  for (const snapshot of [solo({ abc: "" }), solo({ abc: "unfinished" }),
    arrangement([track(1), track(2, "piano", "bad draft", { mute: true })]), arrangement([draft])]) {
    const f = fixture();
    await assert.rejects(exporter.render(snapshot, f.deps), error => error instanceof exporter.ExportError && error.code === "invalid");
    assert.equal(f.contexts.length, 0); assert.equal(f.modelCalls.length, 0);
  }
});

test("complete Charleston with over 1,024 events exports beyond 90 seconds and survives project roundtrip", async () => {
  const tracks = presets.create("charleston", "mn");
  const snapshot = arrangement(tracks);
  const saved = projects.decode(projects.encode({ format: projects.FORMAT, version: projects.VERSION,
    title: "Charleston", ...snapshot }));
  const f = fixture();
  const output = await exporter.render({ mode: "ensemble", content: saved.content }, f.deps);
  assert.ok(output.duration > 132 && output.duration < 140, "natural tails extend the complete 132-second form");
  assert.ok(output.bytes.length > 132 * 44100 * 2, "WAV contains all 88 bars plus the release tail");
  assert.equal(waveReader.inspect(output.bytes).duration, output.duration,
    "a full-length exported WAV can be loaded back into Analysis");
  assert.ok(f.contexts[0].graph.sources.length > 1024, "all notes and drum hits reach the render graph");
});

test("complete El Choclo exports every tango section beyond 90 seconds and survives project roundtrip", async () => {
  const snapshot = arrangement(presets.create("elChoclo", "mn"));
  const saved = projects.decode(projects.encode({ format: projects.FORMAT, version: projects.VERSION,
    title: "El Choclo", ...snapshot }));
  const f = fixture();
  const output = await exporter.render({ mode: "ensemble", content: saved.content }, f.deps);
  assert.ok(output.duration > 115.7 && output.duration < 122,
    "render includes all 108 measures and the ending's natural release");
  assert.ok(output.bytes.length > 115 * 44100 * 2, "full performance is preserved in WAV");
  assert.equal(waveReader.inspect(output.bytes).duration, output.duration,
    "full-length WAV can be opened in the Analysis workspace");
  assert.ok(f.contexts[0].graph.sources.length > 1024,
    "melody, piano, bass and percussion all reach the render graph");
});

test("E2 complete Turkish March saves, exports four internal piano voices, and retains a late coda", async () => {
  const snapshot = arrangement(presets.create("turkishMarch", "mn"));
  const saved = projects.decode(projects.encode({ format: projects.FORMAT, version: projects.VERSION,
    title: "Mozart K.331 III", ...snapshot }));
  const f = fixture();
  const output = await exporter.render({ mode: "ensemble", content: saved.content }, f.deps);
  assert.ok(output.duration > 223.5 && output.duration < 229,
    "the 223.5-second complete movement plus the piano's natural release is exported");
  assert.ok(output.bytes.length > 223 * 44100 * 2);
  assert.equal(waveReader.inspect(output.bytes).duration, output.duration);
  const graph = f.contexts[0].graph;
  assert.equal(saved.content.tracks.length, 1,
    "all four notated voices are edited inside one piano instrument track");
  assert.equal(graph.sources.length, 2812,
    "all unfolded normal notes and rapid grace notes reach the audio graph");
  assert.ok(graph.sources.some(source => source.at > 220),
    "the final coda, not just the recognizable opening, must sound");
  assert.equal(new Set(graph.sources.map(source => source.chain[1])).size, 1,
    "all four written voices now share one piano instrument bus");
  assert.ok(graph.sources.some(source => source.gain[0][1] < .12),
    "the quiet score-level dynamic is not silently ignored");
});

test("RP2 variable-tempo WAV timing matches the exact live score clock for pitched and drum tracks", async () => {
  const marked = "M:2/4\nL:1/4\nQ:1/4=60\nK:C\nC2 |\nQ:1/4=120\nD2 |\nQ:1/4=80\nE2 |]";
  const drum = "M:2/4\nL:1/4\nQ:1/4=60\nK:C clef=perc\nC2 | D2 | E2 |]";
  const f = fixture();
  const output = await exporter.render(arrangement([track(1, "sine", marked), track(2, "drums", drum)]), f.deps);
  const notes = f.contexts[0].graph.sources;
  assert.equal(notes.length, 6);
  assert.deepEqual(notes.map(event => +event.at.toFixed(6)), [0, 0, 2, 2, 3, 3],
    "all tracks share 60 -> 120 -> 80 quarter-note tempo changes");
  assert.ok(output.duration > 4.5 && output.duration < 7,
    "the final bar extends to beatToSeconds(6)=4.5, with natural percussion tails");
  assert.ok(output.bytes.byteLength > 4.5 * 44100 * 2);
});

test("RP2 complete Joplin Entertainer exports its final alternate ending with all eight piano voices", async () => {
  const input = arrangement(presets.create("entertainer", "en"));
  const encoded = projects.encode({ format: projects.FORMAT, version: projects.VERSION,
    title: "Joplin · The Entertainer", ...input });
  const saved = projects.decode(encoded);
  const { score: parsed } = ensemble.parseTracks(saved.content.tracks, "equal", temperament).prepared[0];
  const f = fixture();
  const output = await exporter.render({ mode: "ensemble", content: saved.content }, f.deps);
  assert.equal(saved.content.tracks.length, 1);
  assert.equal(parsed.parts[0].voiceIds.length, 8);
  assert.equal(parsed.bars.length, 152);
  assert.equal(parsed.totalBeats, 304);
  close(require("./sound-score.js").beatToSeconds(parsed, 304), 246.3655761024182);
  assert.ok(output.duration > 246.36 && output.duration < 250);
  assert.equal(waveReader.inspect(output.bytes).duration, output.duration);
  assert.equal(f.contexts[0].graph.sources.length, 2623,
    "repeat expansion and all 236 tied continuations produce 2,623 actual attacks");
  const attacks = players.scheduledEvents(parsed);
  const sourceTimes = f.contexts[0].graph.sources.map(source => source.at);
  for (const index of [0, 250, 1000, 1800, 2600, 2622]) {
    close(sourceTimes[index], require("./sound-score.js").beatToSeconds(parsed, attacks[index].startBeat));
  }
  assert.ok(sourceTimes.at(-1) > 244, "the alternate ending is not truncated");
});

test("RP3 complete Für Elise exports the true final cadence, grace attacks and pedal releases", async () => {
  const input = arrangement(presets.create("furElise", "mn"));
  const saved = projects.decode(projects.encode({ format: projects.FORMAT, version: projects.VERSION,
    title: "Beethoven · Für Elise", ...input }));
  const parsed = ensemble.parseTracks(saved.content.tracks, "equal", temperament).prepared[0].score;
  const f = fixture();
  const output = await exporter.render({ mode: "ensemble", content: saved.content }, f.deps);
  const notes = f.contexts[0].graph.sources;
  const attacks = players.scheduledEvents(parsed);
  const time = beat => require("./sound-score.js").beatToSeconds(parsed, beat);
  assert.equal(parsed.bars.length, 126);
  assert.equal(parsed.parts[0].voiceIds.length, 7);
  assert.ok(output.duration > 156.09 && output.duration < 159,
    "full 2:36 bagatelle and natural piano tail are retained");
  assert.equal(waveReader.inspect(output.bytes).duration, output.duration);
  assert.equal(notes.length, 1041, "1,038 notated attacks and three grace notes reach WAV");
  for (const index of [0, 45, 320, 600, 800, 1040]) close(notes[index].at, time(attacks[index].startBeat));
  assert.ok(notes.at(-1).at > 153, "final A-section cadence survives whole-score export");
  const pedalNoteIndex = attacks.findIndex(e =>
    e.startBeat >= 66.5 && e.pedalEndBeat > e.startBeat + e.durationBeats + .4);
  assert.ok(pedalNoteIndex >= 0);
  const pedalNote = notes[pedalNoteIndex];
  assert.ok(pedalNote.gain.some(record => record[0] === "target" &&
    Math.abs(record[2] - time(attacks[pedalNoteIndex].pedalEndBeat)) < 1e-8),
  "offline piano damper follows the same absolute pedal-up beat as live playback");
  const levels = notes.map(n => n.gain.find(record => record[0] === "set")?.[1]);
  assert.ok(Math.min(...levels) < .6 * Math.max(...levels),
    "source pp, editorial mf and soft grace attacks yield distinct WAV dynamics");
});

test("RP4 Minute Waltz saves, reopens and exports all ornaments with an analytic tempo map", async () => {
  const input = arrangement(presets.create("minuteWaltz", "mn"));
  const saved = projects.decode(projects.encode({ format: projects.FORMAT,
    version: projects.VERSION, title: "Chopin · Minute Waltz", ...input }));
  assert.equal(saved.content.tracks.length, 1);
  const parsed = ensemble.parseTracks(saved.content.tracks, "equal", temperament).prepared[0].score;
  const f = fixture();
  const output = await exporter.render({ mode: "ensemble", content: saved.content }, f.deps);
  const notes = f.contexts[0].graph.sources;
  const attacks = players.scheduledEvents(parsed);
  const time = beat => require("./sound-score.js").beatToSeconds(parsed, beat);
  assert.equal(parsed.bars.length, 140);
  assert.equal(parsed.parts[0].voiceIds.length, 4);
  assert.ok(output.duration > 131.34 && output.duration < 135,
    "the complete 2:11 waltz has no fixed export duration cutoff");
  assert.equal(waveReader.inspect(output.bytes).duration, output.duration);
  assert.equal(notes.length, 1440, "all 1,360 pitches, graces and sounding ornaments reach WAV");
  for (const index of [0, 75, 355, 650, 975, 1350, 1439]) {
    close(notes[index].at, time(attacks[index].startBeat));
  }
  assert.ok(notes.at(-1).at > 130, "the written final cadence is not cut off");
  const gains = notes.map(note => note.gain.find(record => record[0] === "set")?.[1]);
  assert.ok(Math.min(...gains) < .5 * Math.max(...gains),
    "written pp dynamics and hairpins survive offline piano gain scheduling");
});

test("RP5a complete Bach Prelude exports all 549 attacks, long bass holds and final chord", async () => {
  const input = arrangement(presets.create("bachPrelude", "en"));
  const saved = projects.decode(projects.encode({ format: projects.FORMAT,
    version: projects.VERSION, title: "Bach · Prelude BWV 846", ...input }));
  const parsed = ensemble.parseTracks(saved.content.tracks, "equal", temperament).prepared[0].score;
  const f = fixture();
  const output = await exporter.render({ mode: "ensemble", content: saved.content }, f.deps);
  const notes = f.contexts[0].graph.sources;
  const attacks = players.scheduledEvents(parsed);
  const time = beat => require("./sound-score.js").beatToSeconds(parsed, beat);
  assert.equal(parsed.bars.length, 35);
  assert.equal(parsed.parts[0].voiceIds.length, 3);
  assert.ok(output.duration > 127.27 && output.duration < 130,
    "the complete 2:07 Prelude renders beyond any former 90-second limit");
  assert.equal(waveReader.inspect(output.bytes).duration, output.duration);
  assert.equal(notes.length, 549, "68 source tie continuations are not restruck");
  for (const index of [0, 66, 150, 320, 460, 548]) {
    close(notes[index].at, time(attacks[index].startBeat));
  }
  assert.equal(notes.filter(note => Math.abs(note.at - time(136)) < 1e-8).length, 5);
  assert.ok(notes.at(-1).at >= time(136), "the closing full-bar chord survives export");
});

test("RP5b complete Odeon keeps every repeated piano attack in the full WAV export", async () => {
  const input = arrangement(presets.create("odeonPrinted", "en"));
  const saved = projects.decode(projects.encode({ format: projects.FORMAT,
    version: projects.VERSION, title: "Nazareth · Odeon", ...input }));
  const parsed = ensemble.parseTracks(saved.content.tracks, "equal", temperament).prepared[0].score;
  const f = fixture();
  const output = await exporter.render({ mode: "ensemble", content: saved.content }, f.deps);
  const notes = f.contexts[0].graph.sources;
  const attacks = players.scheduledEvents(parsed);
  const time = beat => require("./sound-score.js").beatToSeconds(parsed, beat);
  assert.equal(parsed.bars.length, 129);
  assert.equal(parsed.parts[0].voiceIds.length, 4);
  assert.ok(output.duration > 175.9 && output.duration < 180,
    "the whole 2:56 score must not be truncated by former 90-second limits");
  assert.equal(waveReader.inspect(output.bytes).duration, output.duration);
  assert.equal(notes.length, 1452);
  for (const index of [0, 105, 340, 610, 875, 1210, 1451]) {
    close(notes[index].at, time(attacks[index].startBeat));
  }
  assert.ok(notes.at(-1).at > 170, "closing notes survive whole-length WAV export");
});

test("persistent pitched dynamics change live/offline gain without changing note times", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\n!p!C !accent!D !f!E G |]";
  const f = fixture();
  await exporter.render(solo({ abc: text, instrument: "piano", volume: 40 }), f.deps);
  const notes = f.contexts[0].graph.sources;
  assert.deepEqual(notes.map(note => note.at), [0, .5, 1, 1.5]);
  const levels = notes.map(note => note.gain[0][1]);
  const unit = .19 * .4 * 2.35;
  [0.60, .60 * 1.16, 1.17, 1.17].forEach((dynamic, i) => close(levels[i], unit * dynamic));
  assert.equal(f.modelCalls.length, 4, "changes in loudness do not yet require new sample timbres");
});

test("ties are single attacks and non-equal tuning reaches the scheduled oscillator frequency", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC4- | C2 D2 |]";
  for (const tuning of ["equal", "pythagorean", "just"]) {
    const f = fixture(); await exporter.render(solo({ abc: text, instrument: "flute", tuning }), f.deps);
    const sources = f.contexts[0].graph.sources.filter(source => source.kind === "oscillator"),
      events = players.scheduledEvents(abc.parse(text));
    assert.equal(sources.length, 2);
    assert.deepEqual(sources.map(source => source.at), [0, 3]);
    const tail = sustain.defaults("flute").release + heldVoice.STOP_PAD;
    sources.forEach((source, i) => close(source.stop, [3 + tail, 4 + tail][i]));
    sources.forEach((source, i) => close(source.frequency, players.noteFrequency(events[i], tuning, temperament)));
    assert.ok(sources.every(source => source.type === "sine"));
    assert.equal(f.contexts[0].shapers.length, 2, "Each flute uses the shared jet graph");
    assert.equal(f.contexts[0].buffers.length, 1, "Held notes share one deterministic noise buffer");
    assert.equal(f.contexts[0].graph.sources.filter(source => source.loop).length, 2);
    cleaned(f.contexts[0]);
  }
});

test("ensemble scheduling preserves strums, instrument gains, track volumes, percussion strengths and mute/solo selection", async () => {
  const chords = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\n[CEG]2 [DFA]2 |]";
  const tracks = [track(1, "piano", SCORE, { volume: 80 }),
    track(2, "guitar", chords, { volume: 50, guitar: { mode: "alternate", spacingMs: 30 } }),
    track(3, "drums", percussion(), { volume: 25 }), track(4, "triangle", SCORE, { mute: true })];
  const snapshot = arrangement(tracks); snapshot.content.tuning = "just";
  const f = fixture(); await exporter.render(snapshot, f.deps);
  const graph = f.contexts[0].graph;
  const busLevel = index => graph.gains[index + 1].records.find(item => item[0] === "set")[1];
  assert.deepEqual([0, 1, 2, 3].map(busLevel), [.8, .5, .25, 0]);
  const expected = tracks.flatMap((part, partIndex) => {
    const parsed = part.instrument === "drums" ? drumABC.parse(part.abc) : abc.parse(part.abc);
    return (part.instrument === "drums" ? drumABC.scheduledEvents(parsed) :
      players.scheduledEvents(parsed, 0, part.guitar)).map(event => ({ ...event, partIndex }));
  }).filter(event => event.partIndex !== 3).sort((a, b) => a.startBeat - b.startBeat || a.partIndex - b.partIndex);
  assert.equal(graph.sources.length, expected.length);
  graph.sources.forEach((source, i) => {
    const event = expected[i], part = tracks[event.partIndex];
    close(source.at, event.startBeat * .5);
    assert.equal(source.chain[1], event.partIndex + 1);
    const level = source.gain.find(item => item[0] === "set")[1];
    if (event.type === "drum") close(level, .32 * event.velocity);
    else {
      close(level, (part.instrument === "piano" ? .35 : .19) *
        (players.ENSEMBLE_VOICE_GAIN[part.instrument] ?? 1) / Math.sqrt(event.chordSize || 1));
      close(source.buffer.recipe.hz, players.noteFrequency(event, "just", temperament));
    }
  });
  tracks[1].solo = true;
  const alone = fixture(); await exporter.render(arrangement(tracks), alone.deps);
  assert.ok(alone.contexts[0].graph.sources.every(source => source.chain[1] === 2));
  assert.equal(alone.contexts[0].graph.sources.length, 6);
});

test("D2c WAV export shares swung offbeat positions and audible hi-hat choke with live playback", async () => {
  const abc = percussion("F2 E2 z12 |]");
  for (const [feel, closedBeat] of [["straight", .5], ["light", .58], ["swing", 2 / 3]]) {
    const part = track(1, "drums", abc, { drumFeel: feel });
    const input = arrangement([part]), frozen = copy(input);
    const f = fixture();
    const output = await exporter.render(input, f.deps);
    const strokes = f.contexts[0].graph.sources;
    assert.equal(strokes.length, 2);
    close(strokes[0].at, 0);
    close(strokes[1].at, closedBeat * .5);
    close(strokes[0].stop, closedBeat * .5 + players.HAT_CHOKE_SECONDS);
    assert.ok(strokes[0].gain.some(record => record[0] === "target" &&
      Math.abs(record[2] - closedBeat * .5) < 1e-10 && record[3] === .009));
    assert.ok(output.duration > strokes[0].stop);
    assert.equal(input.content.tracks[0].abc, frozen.content.tracks[0].abc);
    assert.deepEqual(input, frozen, "Export does not alter ABC or feel");
    cleaned(f.contexts[0]);
  }
});

test("D2e WAV chokes the half-open hat and uses distinct velocity-dependent samples", async () => {
  const source = percussion("g2 E2 !ghost!D2 !accent!D2 z8 |]");
  const input = arrangement([track(1, "drums", source)]), frozen = copy(input);
  const f = fixture();
  await exporter.render(input, f.deps);
  const scheduled = f.contexts[0].graph.sources;
  assert.equal(scheduled.length, 4);
  close(scheduled[0].at, 0);
  close(scheduled[0].stop, .25 + players.HAT_CHOKE_SECONDS);
  assert.ok(scheduled[0].gain.some(record => record[0] === "target" &&
    Math.abs(record[2] - .25) < 1e-10 && record[3] === .009));
  const ghost = f.modelCalls.find(recipe => recipe.settings.drumVoice === "snare" && recipe.settings.velocity === .4);
  const accent = f.modelCalls.find(recipe => recipe.settings.drumVoice === "snare" && recipe.settings.velocity === 1);
  assert.ok(ghost && accent, "Different stroke strengths synthesize different cached timbre bands");
  assert.deepEqual(input, frozen, "Export does not rewrite the score or linked project data");
  cleaned(f.contexts[0]);
});

test("D2f WAV export uses the same two-stage hi-hat pedal envelope as live playback", async () => {
  const source = percussion("F2 g2 E2 z10 |]");
  const input = arrangement([track(1, "drums", source)]), original = copy(input);
  const f = fixture();
  await exporter.render(input, f.deps);
  const [open, half, closed] = f.contexts[0].graph.sources;
  assert.equal(f.contexts[0].graph.sources.length, 3);
  close(open.stop, .5 + players.HAT_CHOKE_SECONDS);
  close(half.stop, .5 + players.HAT_CHOKE_SECONDS);
  assert.equal(closed.stop, undefined, "The fresh closed-hat strike remains audible");
  assert.ok(open.gain.some(record => record[0] === "target" &&
    Math.abs(record[2] - .25) < 1e-10 && record[3] === drumABC.hatPedalRelease(.5).timeConstant));
  const preClose = open.gain.find(record => record[0] === "set" && Math.abs(record[2] - .5) < 1e-10);
  assert.ok(preClose && preClose[1] > 0 && preClose[1] < .32 * .8);
  assert.ok(open.gain.some(record => record[0] === "target" && Math.abs(record[2] - .5) < 1e-10 && record[3] === .009));
  assert.deepEqual(input, original, "Export must not alter the author's ABC or project");
  cleaned(f.contexts[0]);

  const reopened = fixture();
  await exporter.render(arrangement([track(1, "drums", percussion("F g F E z12 |]"))]), reopened.deps);
  const first = reopened.contexts[0].graph.sources[0];
  close(first.stop, .375 + players.HAT_CHOKE_SECONDS);
  const reopenedAt = first.gain.find(record => record[0] === "set" && Math.abs(record[2] - .25) < 1e-10);
  assert.ok(reopenedAt && reopenedAt[1] > 0 && reopenedAt[1] < .32 * .8);
  assert.equal(first.gain.some(record => record[0] === "target" && Math.abs(record[2] - .25) < 1e-10), false);
  cleaned(reopened.contexts[0]);
});

test("D2d offline WAV follows live expressive sticking velocity exactly without touching ABC", async () => {
  const abcText = percussion("!R!!accent!D2 !L!D2 !ghost!D2 !flam!!R!D2 !roll!!L!D8 |]");
  const part = track(1, "drums", abcText, { drumTouch: "expressive" });
  const data = arrangement([part]), original = copy(data);
  const expected = drumABC.scheduledEvents(drumABC.parse(abcText), "straight", "expressive");
  const f = fixture();
  await exporter.render(data, f.deps);
  assert.equal(f.contexts[0].graph.sources.length, expected.length);
  for (const [i, source] of f.contexts[0].graph.sources.entries()) {
    close(source.at, expected[i].startBeat * .5);
    close(source.gain.find(event => event[0] === "set")[1], .32 * expected[i].velocity);
  }
  assert.deepEqual(data, original);
  cleaned(f.contexts[0]);
});

test("peak protection attenuates only above 0.98 and never boosts quieter or silent exports", async () => {
  for (const [samples, peak, gain] of [[Float32Array.of(2, -1, .5), 2, .49],
    [Float32Array.of(.25, -.125, 0), .25, 1], [Float32Array.of(0, 0, 0), 0, 1]]) {
    const f = fixture({ samples }), result = await exporter.render(solo(), f.deps);
    close(result.peak, peak); close(result.gain, gain);
    const expected = Array.from(samples, sample => Math.round(sample * gain * (sample < 0 ? 32768 : 32767)));
    assert.deepEqual(resultPCM(result), expected);
    assert.ok(resultPCM(result).every(sample => Math.abs(sample) <= Math.ceil(.98 * 32768)));
  }
});

test("non-finite rendered audio and inconsistent output metadata are rejected and cleaned up", async () => {
  for (const options of [{ samples: Float32Array.of(NaN) }, { samples: Float32Array.of(Infinity) },
    { samples: Float32Array.of(-Infinity) }, { outputChannels: 2 }, { outputRate: 48000 },
    { outputLength: 1 }, { channelLength: 0 }]) {
    const f = fixture(options);
    await assert.rejects(exporter.render(solo({ instrument: "guitar" }), f.deps), error => error.code === "render");
    cleaned(f.contexts[0]);
  }
});

test("constructor, renderer and model failures release private nodes, source buffers and player caches", async t => {
  const oldClear = players.Player.prototype.clearBuffers, cleanedPlayers = [];
  players.Player.prototype.clearBuffers = function () { oldClear.call(this); cleanedPlayers.push(this); };
  t.after(() => { players.Player.prototype.clearBuffers = oldClear; });
  for (const options of [{ constructorError: "context allocation failed" }, { renderError: true }, { modelErrorAt: 2 }]) {
    const f = fixture(options), before = cleanedPlayers.length;
    await assert.rejects(exporter.render(solo({ instrument: "piano" }), f.deps), error => error.code === "render");
    assert.equal(cleanedPlayers.length, before + 1);
    const player = cleanedPlayers.at(-1);
    assert.equal(player.buffers.size, 0); assert.equal(player.bufferSizes.size, 0); assert.equal(player.bufferBytes, 0);
    assert.equal(player.context, null); assert.equal(player.score, null); assert.equal(player.playEvents.length, 0);
    assert.equal(player.contextOwner.output, null); assert.equal(player.voices.size, 0);
    cleaned(f.contexts[0]);
  }
});

test("missing offline support is reported without opening a context or producing a file", async () => {
  const f = fixture();
  for (const changes of [{ OfflineAudioContext: undefined }, { OfflineAudioContext: null },
    { transientModel: null }, { sustainModel: null }]) {
    await assert.rejects(exporter.render(solo(), { ...f.deps, ...changes }), error => error.code === "unsupported");
  }
  assert.equal(f.contexts.length, 0);
  const missing = fixture({ missingRenderer: true });
  await assert.rejects(exporter.render(solo(), missing.deps), error => error.code === "unsupported");
  assert.equal(missing.contexts[0].sources.length, 0);
});

test("128 MiB transient preflight rejects oversized model buffers before a context or sample allocation", async () => {
  assert.equal(exporter.MAX_BUFFER_BYTES, 128 * 1024 * 1024);
  const f = fixture({ duration: () => 1000 });
  await assert.rejects(exporter.render(solo({ instrument: "guitar" }), f.deps), error => error.code === "limit" && /128 MiB/.test(error.message));
  assert.equal(f.contexts.length, 0); assert.equal(f.modelCalls.length, 0);
});

test("offline memory preflight reserves the single shared noise buffer inside the same 128 MiB cap", async () => {
  const noiseBytes = heldVoice.bufferFrames(44100) * 4;
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC4 |]";
  const f = fixture({ duration: () => (exporter.MAX_BUFFER_BYTES - noiseBytes / 2) / 4 / 44100,
    constructorError: "memory probe escaped preflight" });
  const snapshot = arrangement([track(1, "piano", text), track(2, "flute", text)]);
  await assert.rejects(exporter.render(snapshot, f.deps), error => error.code === "limit" && /128 MiB/.test(error.message));
  assert.equal(f.contexts.length, 0);
  assert.equal(f.modelCalls.length, 0, "The oversized test recipe is rejected before allocating samples");
});

test("held and marimba releases retain the 90-second score and 93-second export bounds", async () => {
  const text = "M:6/4\nL:1/4\nQ:1/4=120\nK:C\n" + Array(29).fill("C6 | ").join("") + "z23/4 C/4 |]";
  for (const instrument of [...heldVoice.KINDS, "marimba"]) {
    const f = fixture({ constructorError: "bounded tail probe" });
    await assert.rejects(exporter.render(solo({ abc: text, instrument }), f.deps),
      error => error.code === "render" && /bounded tail probe/.test(error.message));
    assert.equal(f.contexts.length, 1);
    assert.ok(f.contexts[0].length > 90 * 44100 && f.contexts[0].length <= 93 * 44100);
    assert.equal(f.modelCalls.length, 0);
  }
});

test("failed held rendering disconnects all excitation, body-filter and noise nodes", async () => {
  for (const instrument of heldVoice.KINDS) {
    const f = fixture({ renderError: true });
    await assert.rejects(exporter.render(solo({ instrument }), f.deps), error => error.code === "render");
    cleaned(f.contexts[0]);
    assert.ok(f.contexts[0].sources.every(source => source.disconnected));
  }
});

test("I3 harp and organ/free-reed voices export from the shared score graph without samples or network dependencies", async () => {
  const sound = ["harp", "organ-stopped", "organ-principal", "accordion", "bayan"];
  for (const instrument of sound) {
    const f = fixture();
    const result = await exporter.render(solo({ instrument }), f.deps);
    assert.ok(result.bytes.length > 44, instrument + " exported an audio file");
    const context = f.contexts[0];
    const audio = context.graph.sources;
    if (instrument === "harp") {
      assert.equal(f.modelCalls[0].kind, "harp");
      assert.equal(audio[0].kind, "buffer");
      assert.equal(context.buffers[0].length, 3 * 44100);
    } else {
      assert.equal(f.modelCalls.length, 0, "held voices use no transient samples");
      assert.ok(audio.some(source => source.wave), "the voice has a real harmonic source");
      assert.ok(audio.every(source => source.kind === "oscillator"));
      assert.equal(audio.filter(source => source.wave).length, 4 * (instrument === "accordion" ? 2 : 1));
    }
    cleaned(context);
  }
});

test("I3 four-track ensemble survives project round-trip and exports separate instruments on shared timing", async () => {
  const original = arrangement([track(1, "harp"), track(2, "organ-stopped"),
    track(3, "accordion"), track(4, "bayan")]);
  const saved = projects.decode(projects.encode({ format: projects.FORMAT, version: projects.VERSION,
    title: "I3", ...original }));
  assert.deepEqual(saved.content.tracks.map(item => item.instrument),
    ["harp", "organ-stopped", "accordion", "bayan"]);
  const f = fixture();
  await exporter.render(saved, f.deps);
  assert.equal(f.contexts.length, 1);
  assert.ok(f.contexts[0].graph.sources.some(source => source.kind === "buffer"));
  assert.ok(f.contexts[0].graph.sources.filter(source => source.wave).length >= 4);
  assert.equal(f.modelCalls.length, 4, "harp notes are generated once per distinct pitch");
  cleaned(f.contexts[0]);
});

test("D1/D2 kit, snare, dialogue, tom/cymbal and ornamented snare studies render playable WAV files", async () => {
  for (const id of ["drumKitSolo", "snareStudy", "snareRudiments", "drumDialogue", "tomCymbalStudy"]) {
    const snapshot = arrangement(presets.create(id, "mn"));
    const restored = projects.decode(projects.encode({ format: projects.FORMAT,
      version: projects.VERSION, title: id, ...snapshot }));
    const f = fixture();
    const result = await exporter.render(restored, f.deps);
    assert.ok(result.bytes.length > 44, id + " has an audio payload");
    assert.equal(f.contexts.length, 1, id + " renders into one synchronized mix");
    assert.ok(f.contexts[0].graph.sources.length > 0, id + " schedules percussion sounds");
    assert.ok(f.modelCalls.length > 0, "Percussion voices have prepared drum buffers");
    assert.ok(f.modelCalls.every(call => call.kind === "kick" && call.settings.drumVoice),
      "Drum-only scores request percussion recipes, not pitched instruments");
    if (id === "tomCymbalStudy") {
      const soundKinds = new Set(f.modelCalls.map(call => call.settings.drumVoice));
      for (const voice of ["tom", "ride", "crash", "rimshot"]) assert.ok(soundKinds.has(voice));
    }
    if (id === "snareRudiments") {
      const part = drumABC.parse(restored.content.tracks[0].abc);
      const strokes = drumABC.scheduledEvents(part);
      assert.equal(f.contexts[0].graph.sources.length, strokes.length,
        "WAV contains each grace/roll stroke, not one sound per notated hit");
      const secondsPerBeat = 60 / part.tempoQuarter;
      f.contexts[0].graph.sources.forEach((source, i) => {
        close(source.at, strokes[i].startBeat * secondsPerBeat);
        close(source.gain.find(item => item[0] === "set")[1], .32 * strokes[i].velocity);
      });
      assert.ok(strokes.some(stroke => stroke.stroke === "flam-grace"));
      assert.ok(strokes.some(stroke => stroke.stroke === "roll-4"));
    }
    cleaned(f.contexts[0]);
  }
});

test("more than 24 distinct buffered pitches with repeats never evict and regenerate scheduled buffers", async () => {
  const notes = [];
  for (let octave = 1; octave <= 5; octave++) for (const letter of "CDEFGAB") {
    notes.push(octave < 4 ? letter + ",".repeat(4 - octave) : octave === 4 ? letter : letter.toLowerCase());
  }
  const unique = notes.slice(0, 30), repeated = [...unique, ...unique];
  const bars = Array.from({ length: repeated.length / 4 }, (_, i) => repeated.slice(i * 4, i * 4 + 4).join(" "));
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\n" + bars.join(" | ") + " |]";
  const f = fixture(); await exporter.render(solo({ abc: text, instrument: "piano" }), f.deps);
  const context = f.contexts[0];
  assert.equal(f.modelCalls.length, 30); assert.equal(context.buffers.length, 30);
  assert.equal(context.graph.sources.length, 60);
  for (let i = 0; i < 30; i++) assert.equal(context.graph.sources[i].buffer, context.graph.sources[i + 30].buffer);
  cleaned(context);
});

test("all shipped solo and bilingual ensemble presets survive project round-trip and export preflight", async () => {
  const snapshots = Object.entries(compose.EXAMPLES).map(([id, text]) => solo({ abc: text,
    instrument: compose.EXAMPLE_INFO[id]?.instrument || "flute",
    guitar: compose.EXAMPLE_INFO[id]?.guitar || { mode: "pluck", spacingMs: 20 } }));
  for (const language of ["mn", "en"]) for (const item of presets.CATALOG) {
    snapshots.push(arrangement(item.id === "starter" ? copy(ensemble.DEFAULTS) : presets.create(item.id, language)));
  }
  for (const snapshot of snapshots) {
    const saved = projects.decode(projects.encode({ format: projects.FORMAT, version: projects.VERSION,
      title: "Preset", ...snapshot }));
    // Stop at construction deliberately: preflight must succeed, but testing
    // every long piece need not allocate/encode every rendered audio buffer.
    const f = fixture({ constructorError: "preflight probe complete" });
    await assert.rejects(exporter.render(saved, f.deps), error => error.code === "render" && /preflight probe complete/.test(error.message));
    assert.equal(f.contexts.length, 1); assert.equal(f.modelCalls.length, 0);
  }
});
