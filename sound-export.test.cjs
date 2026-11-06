/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const exporter = require("./sound-export.js");
const players = require("./sound-score-player.js");
const abc = require("./sound-abc.js");
const drumABC = require("./sound-drum-abc.js");
const patterns = require("./sound-drum-patterns.js");
const sustain = require("./sound-sustain.js");
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
  const duration = options.duration || (decay => Math.max(.35, Math.min(3, decay * 4)));
  const transientModel = {
    duration,
    makeSamples(kind, hz, decay, rate, size, settings) {
      const recipe = { kind, hz, decay, rate, size, settings: { ...settings } };
      modelCalls.push(recipe);
      if (options.modelErrorAt === modelCalls.length) throw new Error("model preparation failed");
      pendingRecipe = recipe;
      const samples = new Float32Array(Math.ceil(duration(decay) * rate));
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
      this.gains = []; this.sources = []; this.buffers = []; this.waves = [];
      this.renderCalls = 0; this.graph = null;
      contexts.push(this);
      assert.equal(arguments.length, 3);
      assert.equal(channels, 1); assert.equal(sampleRate, 44100);
      assert.ok(Number.isSafeInteger(length) && length > 0 && length <= 93 * sampleRate);
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
        while (node && result.length < 8) {
          result.push(node === this.destination ? "destination" : this.gains.indexOf(node));
          node = node.target;
        }
        return result;
      };
      // Snapshot before render's finally block stops nodes and clears buffers.
      this.graph = {
        gains: this.gains.map(node => ({ records: copy(node.gain.records), target: node.target })),
        sources: this.sources.map(source => ({ kind: source.kind, type: source.type,
          at: source.startedAt, offset: source.offset, stop: source.stoppedAt,
          frequency: source.frequency.records.find(item => item[0] === "set")?.[1],
          buffer: source.buffer, bufferIndex: this.buffers.indexOf(source.buffer), wave: source.wave,
          chain: chain(source), gain: copy(source.target.gain.records) }))
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

test("exports beyond 15 seconds have the exact mono PCM16 header and bounded duration", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\n" + Array(10).fill("C4").join(" | ") + " |]";
  const f = fixture(), result = await exporter.render(solo({ abc: text }), f.deps);
  assert.ok(result.duration > 20 && result.duration < 20.1);
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
  for (const [instrument, end] of [["guitar", 1.875 + 2.6], ["chimes", 1.875 + 2.8],
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

test("invalid ABC, muted invalid parts, unfinished empty pattern drafts and playback limits fail before a context exists", async () => {
  const drumText = percussion(), linked = patterns.fromABC(drumText);
  const draft = track(1, "drums", drumText, { patterns: linked, patternBar: 1,
    patternId: linked.sequence[0].id, textMode: "pattern",
    patternDraft: { id: linked.sequence[0].id, text: "", error: "draft" } });
  const tooLong = "M:6/4\nL:1/4\nQ:1/4=120\nK:C\n" + Array(32).fill("C6").join(" | ") + " |]";
  const dense = "M:4/4\nL:1/8\nQ:1/4=320\nK:C\n" + Array(32).fill(Array(8).fill("[CEG]").join(" ")).join(" | ") + " |]";
  for (const snapshot of [solo({ abc: "" }), solo({ abc: "unfinished" }), solo({ abc: tooLong }),
    arrangement([track(1), track(2, "piano", "bad draft", { mute: true })]), arrangement([draft]),
    arrangement([track(1, "piano", dense), track(2, "piano", dense)])]) {
    const f = fixture();
    await assert.rejects(exporter.render(snapshot, f.deps), error => error instanceof exporter.ExportError && error.code === "invalid");
    assert.equal(f.contexts.length, 0); assert.equal(f.modelCalls.length, 0);
  }
});

test("ties are single attacks and non-equal tuning reaches the scheduled oscillator frequency", async () => {
  const text = "M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC4- | C2 D2 |]";
  for (const tuning of ["equal", "pythagorean", "just"]) {
    const f = fixture(); await exporter.render(solo({ abc: text, instrument: "flute", tuning }), f.deps);
    const sources = f.contexts[0].graph.sources, events = players.scheduledEvents(abc.parse(text));
    assert.equal(sources.length, 2);
    assert.deepEqual(sources.map(source => source.at), [0, 3]);
    assert.deepEqual(sources.map(source => source.stop), [3.005, 4.005]);
    sources.forEach((source, i) => close(source.frequency, players.noteFrequency(events[i], tuning, temperament)));
    assert.ok(sources.every(source => source.wave.settings.disableNormalization));
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
      close(level, (part.instrument === "piano" ? .35 : .19) / Math.sqrt(event.chordSize || 1));
      close(source.buffer.recipe.hz, players.noteFrequency(event, "just", temperament));
    }
  });
  tracks[1].solo = true;
  const alone = fixture(); await exporter.render(arrangement(tracks), alone.deps);
  assert.ok(alone.contexts[0].graph.sources.every(source => source.chain[1] === 2));
  assert.equal(alone.contexts[0].graph.sources.length, 6);
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
