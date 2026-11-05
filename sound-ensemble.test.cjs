"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const abc = require("./sound-abc.js");
const drumABC = require("./sound-drum-abc.js");
const ensemble = require("./sound-ensemble.js");
const playerModel = require("./sound-score-player.js");
const sustain = require("./sound-sustain.js");
const transient = require("./sound-transient.js");
const temperament = require("./sound-temperaments.js");
const ensemblePresets = require("./sound-ensemble-presets.js");

function fixture() {
  const context = {
    currentTime: 0, sampleRate: 16000, gains: [], sources: [], buffers: [],
    createGain() {
      const node = { connected: null, disconnected: false, gain: {
        value: 0, records: [],
        cancelScheduledValues(at) { this.records.push(["cancel", at]); },
        setValueAtTime(value, at) { this.value = value; this.records.push(["set", value, at]); },
        setTargetAtTime(value, at, tau) { this.value = value; this.records.push(["target", value, at, tau]); },
        linearRampToValueAtTime(value, at) { this.value = value; this.records.push(["ramp", value, at]); }
      }, connect(target) { this.connected = target; }, disconnect() { this.disconnected = true; } };
      this.gains.push(node); return node;
    },
    createOscillator() {
      const src = { frequency: { setValueAtTime(value) { this.value = value; } },
        connect(node) { this.connected = node; }, disconnect() {}, setPeriodicWave() {},
        start(t) { this.startedAt = t; }, stop(t) { this.stoppedAt = t; } };
      this.sources.push(src); return src;
    },
    createPeriodicWave() { return {}; },
    createBuffer(channels, len, rate) {
      const arr = new Float32Array(len);
      const buffer = { duration: len / rate, getChannelData() { return arr; } };
      this.buffers.push(buffer); return buffer;
    },
    createBufferSource() {
      const src = { connect(node) { this.connected = node; }, disconnect() {},
        start(t, offset) { this.startedAt = t; this.offset = offset || 0; },
        stop(t) { this.stoppedAt = t; } };
      this.sources.push(src); return src;
    }
  };
  const owner = { output: {}, async readyContext() { return context; } };
  const synth = new playerModel.EnsemblePlayer({ contextOwner: owner, transientModel: transient,
    sustainModel: sustain, temperamentModel: temperament });
  return { context, owner, synth };
}

test("C2A default ABC scores are separate, in sync and remain silent until Play", async () => {
  const { context, synth, owner } = fixture();
  const { prepared, summary } = ensemble.parseTracks(ensemble.DEFAULTS, "equal", temperament);
  assert.equal(summary.totalBeats, 16);
  assert.equal(summary.tempoQuarter, 96);
  assert.equal(summary.eventCount, 17);
  assert.equal(context.sources.length, 0);
  synth.configure({ tracks: prepared });
  assert.equal(context.sources.length, 0);
  assert.deepEqual(synth.playEvents.slice(0, 2).map(note => note.partIndex), [0, 1]);
  await synth.play();
  assert.equal(context.sources.length, 2, "Both first notes share a start clock");
  assert.equal(context.sources[0].startedAt, context.sources[1].startedAt);
  assert.equal(context.gains[0].connected, owner.output, "Master score bus joins REC output");
  assert.equal(synth.buses[0].connected, synth.outputBus);
  assert.equal(synth.buses[1].connected, synth.outputBus);
  assert.equal(synth.buses[0].gain.value, .5);
  assert.equal(synth.buses[1].gain.value, .32);
  synth.stop();
  assert.equal(context.gains[0].disconnected, true);
  assert.ok(synth.buses.length === 0);
});

test("ensemble Pause silences the shared bus, freezes the beat and Resume preserves it", async () => {
  const { context, synth } = fixture();
  const { prepared } = ensemble.parseTracks(ensemble.DEFAULTS, "equal", temperament);
  synth.configure({ tracks: prepared });
  await synth.play();
  context.currentTime = 1.65;
  synth.pause();
  const beat = synth.currentBeat;
  assert.ok(beat > 2 && beat < 3);
  assert.equal(synth.outputBus.gain.value, 0);
  assert.equal(synth.status, "paused");
  assert.equal(synth.interval, null);
  context.currentTime += 5;
  assert.equal(synth.currentBeat, beat);
  await synth.play();
  assert.equal(synth.status, "playing");
  assert.equal(synth.outputBus.gain.value, 1);
  assert.equal(synth.currentBeat, beat);
  synth.stop();
  assert.equal(synth.currentBeat, 0);
});

test("mute, solo, and faders update each track bus without restarting playback", async () => {
  const { context, synth } = fixture();
  const { prepared } = ensemble.parseTracks(ensemble.DEFAULTS, "equal", temperament);
  synth.configure({ tracks: prepared });
  await synth.play();
  synth.updateMix(2, { mute: true });
  assert.equal(synth.buses[1].gain.value, 0);
  assert.equal(synth.buses[0].gain.value, .5);
  synth.updateMix(2, { mute: false, solo: true, volume: 73 });
  assert.equal(synth.buses[1].gain.value, .73);
  assert.equal(synth.buses[0].gain.value, 0);
  synth.updateMix(2, { solo: false });
  assert.equal(synth.buses[0].gain.value, .5);
  assert.equal(synth.buses[1].gain.value, .73);
  assert.throws(() => synth.updateMix(2, { volume: 200 }), /Invalid track volume/);
  assert.equal(synth.status, "playing");
  assert.equal(context.sources.length, 2, "Mixing does not retrigger notes");
  synth.stop();
});

test("independent ABC files may have different keys and lengths, not different clocks", () => {
  const clone = ensemble.DEFAULTS.map(track => ({ ...track }));
  clone[1].abc = "X:2\nT:Short bass\nM:4/4\nL:1/4\nQ:1/4=96\nK:G\nG,2 D2 | G,4 |]";
  assert.equal(ensemble.parseTracks(clone, "equal", temperament).summary.totalBeats, 16);
  clone[1].abc = clone[1].abc.replace("96", "100");
  assert.throws(() => ensemble.parseTracks(clone, "equal", temperament), /same M: and Q:/);
  clone[1].abc = "M:3/4\nL:1/4\nQ:1/4=96\nK:G\nG,2 D | G,3 |]";
  assert.throws(() => ensemble.parseTracks(clone, "equal", temperament), /same M: and Q:/);
});

test("ensemble validates event limits, instrument names and 1–4 tracks", () => {
  const { prepared } = ensemble.parseTracks(ensemble.DEFAULTS, "equal", temperament);
  const mk = track => ({ ...track, score: abc.parse(track.abc) });
  assert.throws(() => playerModel.validateEnsemble([], "equal", temperament), /1–4/);
  assert.throws(() => playerModel.validateEnsemble([prepared[0], prepared[1], prepared[0], prepared[1], prepared[0]], "equal", temperament), /1–4/);
  assert.throws(() => playerModel.validateEnsemble([{ ...prepared[0], instrument: "sax" }], "equal", temperament), /Invalid track/);
  assert.throws(() => playerModel.validateEnsemble([{ ...prepared[0], volume: -2 }], "equal", temperament), /Invalid track/);
  assert.throws(() => playerModel.validateEnsemble([prepared[0]], "unknown", temperament), /1–4/);
  const high = mk({ ...prepared[0], abc: prepared[0].abc.replace(/C D E G/, "c' d' e' g'") });
  assert.throws(() => playerModel.validateEnsemble([high], "equal", temperament), /outside flute range/);
});

test("acoustic score piano gets an RMS level correction; FM piano retains its gain", async () => {
  const abcText = "M:4/4\nL:1/4\nQ:1/4=96\nK:C\nC D E F |]";
  const score = abc.parse(abcText);
  const { context, synth } = fixture();
  synth.configure({ tracks: [
    { id: 1, score, instrument: "piano", volume: 50 },
    { id: 2, score, instrument: "fmep", volume: 50 }
  ] });
  await synth.play();
  const notes = context.gains.slice(3);
  synth.stop();
  assert.equal(notes.length, 2);
  assert.ok(notes[0].gain.records.some(item => item[0] === "set" && Math.abs(item[1] - .35) < 1e-9),
    "Acoustic note gain is boosted and capped");
  assert.ok(notes[1].gain.records.some(item => item[0] === "set" && Math.abs(item[1] - .19) < 1e-9),
    "FM note retains its level");
});

test("C2C percussion attacks use the same audio clock and recorder bus as melody", async t => {
  const { synth, context, owner } = fixture();
  t.after(() => synth.stop());
  const drums = { id: 3, name: "Drums", instrument: "drums", volume: 68, mute: false, solo: false,
    abc: drumABC.groove({ meter: { numerator: 4, denominator: 4, quarterBeats: 4 },
      tempoQuarter: 96, totalBeats: 16 }, 3) };
  const { prepared, summary } = ensemble.parseTracks([...ensemble.DEFAULTS, drums], "equal", temperament);
  assert.equal(summary.eventCount, 65);
  synth.configure({ tracks: prepared });
  assert.equal(context.sources.length, 0);
  assert.equal(synth.playEvents.filter(e => e.type === "drum").length, 48);
  await synth.play();
  assert.equal(context.sources.length, 4, "two pitched notes and two simultaneous drum voices start");
  assert.ok(context.sources.every(source => source.startedAt === context.sources[0].startedAt));
  assert.equal(synth.outputBus.connected, owner.output);
  assert.equal(synth.buses[2].connected, synth.outputBus);
  const drumGains = context.gains.filter(gain => gain.connected === synth.buses[2]);
  assert.equal(drumGains.length, 2);
  assert.ok(drumGains.every(gain => gain.connected === synth.buses[2]));
  synth.updateMix(3, { mute: true });
  assert.equal(synth.buses[2].gain.value, 0);
  context.currentTime = 1.5;
  synth.pause();
  assert.equal(synth.status, "paused");
  assert.equal(synth.outputBus.gain.value, 0);
  const position = synth.currentBeat;
  await synth.play();
  assert.equal(synth.status, "playing");
  assert.equal(synth.currentBeat, position);
  synth.stop();
});

test("drum score and melodic score must use matching clock, but tuning does not change drums", () => {
  const drums = { id: 3, instrument: "drums", volume: 65,
    abc: drumABC.groove({ meter: { numerator: 4, denominator: 4, quarterBeats: 4 },
      tempoQuarter: 96, totalBeats: 16 }) };
  const { summary } = ensemble.parseTracks([...ensemble.DEFAULTS, drums], "just", temperament);
  assert.equal(summary.totalBeats, 16);
  drums.abc = drums.abc.replace("Q:1/4=96", "Q:1/4=120");
  assert.throws(() => ensemble.parseTracks([...ensemble.DEFAULTS, drums], "equal", temperament), /same M: and Q:/);
  drums.abc = drumABC.groove({ meter: { numerator: 3, denominator: 4, quarterBeats: 3 },
    tempoQuarter: 96, totalBeats: 12 });
  assert.throws(() => ensemble.parseTracks([...ensemble.DEFAULTS, drums], "equal", temperament), /same M: and Q:/);
});

test("all complete ensemble arrangements accept drums with their original pickup and bars", () => {
  for (const preset of ensemblePresets.CATALOG) {
    if (preset.id === "starter") continue;
    const tracks = ensemblePresets.create(preset.id, "en");
    const summary = ensemble.parseTracks(tracks, "equal", temperament).summary;
    const source = abc.parse(tracks[0].abc);
    const percussion = { id: 4, name: "Drums", instrument: "drums", volume: 65,
      abc: drumABC.groove({ ...summary, barDurations: source.bars.map(bar => bar.durationBeats) }, 4) };
    const added = ensemble.parseTracks([...tracks, percussion], "equal", temperament);
    assert.equal(added.summary.totalBeats, summary.totalBeats, preset.id);
    assert.ok(added.summary.eventCount > summary.eventCount, preset.id);
    const score = drumABC.parse(percussion.abc);
    assert.deepEqual(score.bars.map(bar => bar.durationBeats), source.bars.map(bar => bar.durationBeats), preset.id);
  }
});
