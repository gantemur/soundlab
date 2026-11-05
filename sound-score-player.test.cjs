"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const abc = require("./sound-abc.js");
const playerModel = require("./sound-score-player.js");
const transient = require("./sound-transient.js");
const sustain = require("./sound-sustain.js");
const temperaments = require("./sound-temperaments.js");

function audioFixture(Player = playerModel.Player) {
  const context = {
    currentTime: 0, sampleRate: 16000, sources: [], gains: [], waves: [], buffers: [],
    createGain() {
      const gain = { gain: {
        records: [], cancelScheduledValues(at) { this.records.push(["cancel", at]); },
        setValueAtTime(value, at) { this.value = value; this.records.push(["set", value, at]); },
        linearRampToValueAtTime(value, at) { this.records.push(["ramp", value, at]); },
        setTargetAtTime(value, at, constant) { this.records.push(["target", value, at, constant]); }
      }, connect(target) { this.target = target; }, disconnect() {} };
      this.gains.push(gain);
      return gain;
    },
    createPeriodicWave(real, imag, options) {
      const wave = { real, imag, options }; this.waves.push(wave); return wave;
    },
    createOscillator() {
      const source = {
        type: "oscillator", frequency: { setValueAtTime(value, at) {
          this.value = value; this.time = at;
        } },
        connect(target) { this.target = target; }, disconnect() {},
        setPeriodicWave(wave) { this.wave = wave; },
        start(at) { this.startedAt = at; }, stop(at) { this.stoppedAt = at; }
      };
      this.sources.push(source);
      return source;
    },
    createBuffer(_channels, length, rate) {
      const data = new Float32Array(length);
      const buffer = { duration: length / rate, getChannelData() { return data; } };
      this.buffers.push(buffer);
      return buffer;
    },
    createBufferSource() {
      const source = {
        type: "buffer", connect(target) { this.target = target; }, disconnect() {},
        start(at, offset) { this.startedAt = at; this.offset = offset || 0; },
        stop(at) { this.stoppedAt = at; }
      };
      this.sources.push(source);
      return source;
    }
  };
  const calls = [];
  const owner = { output: {}, async readyContext() { calls.push("start"); return context; } };
  const recipes = [];
  const transients = { makeSamples(kind, pitchHz, decay, rate, size, options) {
    recipes.push({ kind, pitchHz, decay, rate, size, options });
    return new Float32Array(rate * 2);
  } };
  const updates = [];
  const player = new Player({ contextOwner: owner, transientModel: transients,
    sustainModel: sustain, temperamentModel: temperaments, onUpdate: state => updates.push(state) });
  return { context, owner, player, calls, recipes, updates };
}

const melody = abc.parse("M:4/4\nL:1/4\nQ:1/4=96\nK:C\nC z D E | G4 |]");

test("a score never starts audio on load; uses the audio clock and skips rests", async () => {
  const { context, player, calls, updates } = audioFixture();
  player.configure({ score: melody, instrument: "flute", volume: 38 });
  assert.equal(calls.length, 0);
  assert.equal(context.sources.length, 0);
  assert.deepEqual(playerModel.scheduledEvents(melody).map(e => e.startBeat), [0, 2, 3, 4]);
  await player.play();
  assert.equal(calls.length, 1);
  assert.equal(player.status, "playing");
  assert.equal(context.sources.length, 1);
  assert.ok(Math.abs(context.sources[0].startedAt - .08) < 1e-6);
  assert.ok(context.sources[0].wave);
  assert.equal(context.gains[0].target, player.contextOwner.output);
  context.currentTime = 1.29;
  player.tick();
  assert.equal(context.sources.length, 2, "The rest does not create a voice");
  context.currentTime = 1.94;
  player.tick();
  assert.equal(context.sources.length, 3);
  context.currentTime = 2.56;
  player.tick();
  assert.equal(context.sources.length, 4);
  assert.ok(updates.some(update => update.status === "playing"));
  context.currentTime = 5.5;
  player.tick();
  assert.equal(player.status, "stopped", "Stops after score plus short release");
});

test("bracketed piano chords expand to independent simultaneous voices with one release", async () => {
  const chord = abc.parse("M:4/4\nL:1/4\nQ:1/4=100\nK:C\n[CEG]2 z [DFA] |]");
  assert.equal(chord.parts[0].events.length, 3, "one notation event per chord");
  const events = playerModel.scheduledEvents(chord);
  assert.equal(events.length, 6);
  assert.deepEqual(events.map(e => e.startBeat), [0, 0, 0, 3, 3, 3]);
  assert.ok(events.every(e => e.chordSize === 3));
  const { player, context } = audioFixture();
  player.configure({ score: chord, instrument: "piano", volume: 44 });
  assert.equal(context.sources.length, 0, "Load stays silent");
  await player.play();
  assert.equal(context.sources.length, 3, "all three piano samples are scheduled together");
  assert.ok(context.sources.every(source => source.startedAt === context.sources[0].startedAt));
  assert.equal(context.gains.length >= 4, true);
  player.stop();
});

test("piano's extended range accepts low Chopin notes but other instruments keep bounds", () => {
  const bass = abc.parse("M:4/4\nL:1/4\nQ:1/4=96\nK:C\n[C,,,C,,]4 |]");
  const { player } = audioFixture();
  assert.doesNotThrow(() => player.configure({ score: bass, instrument: "piano" }));
  assert.throws(() => player.configure({ score: bass, instrument: "flute" }), /outside/);
  const high = abc.parse("M:4/4\nL:1/4\nQ:1/4=96\nK:C\n[c'e']4 |]");
  assert.doesNotThrow(() => player.configure({ score: high, instrument: "piano" }));
  assert.throws(() => player.configure({ score: high, instrument: "chimes" }), /outside/);
});

test("the actual acoustic piano model renders simultaneous low Chopin pitches on playback", async () => {
  const bass = abc.parse("M:4/4\nL:1/4\nQ:1/4=96\nK:C\n[C,,,C,,]4 |]");
  const { player, context } = audioFixture();
  context.sampleRate = 8000;
  player.transientModel = transient;
  player.configure({ score: bass, instrument: "piano", volume: 36 });
  await player.play();
  assert.equal(context.sources.length, 2, "both low piano strings actually synthesized");
  assert.ok(context.buffers.every(b => b.getChannelData().some(v => Math.abs(v) > 1e-4)));
  player.stop();
});

test("pause and resume preserve playback position, while Stop returns to bar one", async () => {
  const { context, player } = audioFixture();
  player.configure({ score: melody, instrument: "violin" });
  await player.play();
  context.currentTime = 1.7;
  player.pause();
  const pausedAt = player.currentBeat;
  assert.equal(player.status, "paused");
  assert.ok(pausedAt > 2 && pausedAt < 3);
  assert.equal(player.interval, null);
  context.currentTime += 5;
  assert.equal(player.currentBeat, pausedAt, "Position is frozen while paused");
  await player.play();
  assert.equal(player.status, "playing");
  assert.ok(Math.abs(player.currentBeat - pausedAt) < 1e-6);
  const mostRecent = context.sources.at(-1);
  assert.ok(mostRecent.startedAt >= context.currentTime);
  player.stop();
  assert.equal(player.currentBeat, 0);
  assert.equal(player.interval, null);
  assert.ok(context.sources.every(source => Number.isFinite(source.stoppedAt)));
});

test("Pause silences a scheduled voice even when Safari-style stop/gain calls throw", async () => {
  const { player, context } = audioFixture();
  player.configure({ score: melody, instrument: "piano" });
  await player.play();
  const voiceGain = context.gains[1]; // gains[0] is the Safari-safe master bus
  const source = context.sources[0];
  voiceGain.disconnect = () => { voiceGain.disconnected = true; };
  voiceGain.gain.cancelScheduledValues = () => { throw new Error("unsupported"); };
  source.stop = () => { throw new Error("already ended"); };
  context.currentTime = .3;
  assert.doesNotThrow(() => player.pause());
  assert.equal(player.status, "paused");
  assert.equal(voiceGain.disconnected, true, "Disconnect guarantees silence even if stop() fails");
  assert.equal(player.voices.size, 0);
  player.stop();
});

test("Pause during asynchronous audio startup cancels late notes; Resume can start normally", async () => {
  const { owner, player, context } = audioFixture();
  let unlock;
  owner.readyContext = () => new Promise(resolve => { unlock = resolve; });
  player.configure({ score: melody, instrument: "fmep" });
  const pending = player.play();
  assert.equal(player.status, "starting");
  player.pause();
  assert.equal(player.status, "paused");
  unlock(context);
  assert.equal(await pending, false);
  assert.equal(context.sources.length, 0, "A canceled startup cannot produce a late sound");
  owner.readyContext = async () => context;
  await player.play();
  assert.equal(player.status, "playing");
  assert.equal(context.sources.length, 1);
  player.stop();
});

test("guitar, piano and chime scores delegate to existing sound models", async () => {
  for (const instrument of ["guitar", "piano", "chimes"]) {
    const { player, context, recipes } = audioFixture();
    player.configure({ score: melody, instrument, tuning: "just", volume: 52 });
    await player.play();
    assert.equal(context.sources[0].type, "buffer", instrument);
    assert.equal(recipes.length, 1, instrument);
    const recipe = recipes[0];
    assert.equal(recipe.kind, instrument === "guitar" ? "pluck" :
      instrument === "piano" ? "piano" : "kick");
    if (instrument === "chimes") {
      assert.equal(recipe.options.drumVoice, "chimes");
      assert.ok(Math.abs(recipe.options.chimeHz - 264) < 10);
    }
    assert.equal(context.sources[0].buffer.duration, 2);
    player.stop();
  }
});

test("four electronic oscillators retain their exact waveforms, pitches and stop behavior", async () => {
  for (const instrument of ["sine", "triangle", "square", "sawtooth"]) {
    const { player, context, recipes } = audioFixture();
    player.configure({ score: melody, instrument });
    await player.play();
    const source = context.sources[0];
    assert.equal(source.type, instrument);
    assert.ok(Math.abs(source.frequency.value - 261.625565) < .01);
    assert.equal(context.waves.length, 0, "Standard oscillator needs no custom harmonic model");
    assert.equal(recipes.length, 0, "Electronic oscillators use no percussion model");
    assert.ok(context.gains[1].gain.records.some(record => record[0] === "ramp"));
    player.stop();
    assert.equal(source.stoppedAt, .002);
    assert.equal(player.currentBeat, 0);
  }
});

test("FM electric piano uses original decaying samples, note-off damping and pause seek", async () => {
  const { player, context, recipes } = audioFixture();
  player.configure({ score: melody, instrument: "fmep" });
  await player.play();
  const source = context.sources[0];
  assert.equal(source.type, "buffer");
  assert.equal(context.buffers.length, 1);
  assert.equal(source.buffer.duration, 2.8);
  assert.equal(recipes.length, 0, "FM uses its own model, not an acoustic sampled instrument");
  assert.ok(context.gains[1].gain.records.some(record => record[0] === "target"),
    "The modeled electric piano releases its note with a damper");
  context.currentTime = .33;
  player.pause();
  context.currentTime = 5;
  await player.play();
  const resumed = context.sources.at(-1);
  assert.ok(resumed.offset > .2);
  player.stop();
  assert.equal(player.currentBeat, 0);
});

test("invalid pitches or controls are rejected before audio-context startup", () => {
  const { player, calls } = audioFixture();
  const tooLow = abc.parse("M:4/4\nL:1/4\nQ:1/4=100\nK:C\nC,,4 |]");
  assert.throws(() => player.configure({ score: tooLow, instrument: "guitar" }), /outside/);
  assert.throws(() => player.configure({ score: melody, instrument: "banjo" }), RangeError);
  assert.throws(() => player.configure({ score: melody, volume: 130 }), RangeError);
  assert.equal(calls.length, 0);
});

test("a pending audio-context request cannot launch after Stop", async () => {
  const { player, owner, context } = audioFixture();
  let resolveStart;
  owner.readyContext = () => new Promise(resolve => { resolveStart = resolve; });
  player.configure({ score: melody });
  const started = player.play();
  assert.equal(player.status, "starting");
  player.stop();
  resolveStart(context);
  assert.equal(await started, false);
  assert.equal(context.sources.length, 0);
  assert.equal(player.status, "stopped");
});


test("playback coalesces a tie chain and preserves the original notation", () => {
  const tied = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC2-C2- | C2 C z |]");
  const original = structuredClone(tied);
  const notes = playerModel.scheduledEvents(tied);
  assert.deepEqual(notes.map(event => [event.startBeat, event.durationBeats]), [[0, 6], [6, 1]]);
  assert.deepEqual(playerModel.scheduledEvents(tied, 5).map(event =>
    [event.startBeat, event.durationBeats]), [[0, 6], [6, 1]], "Resume retains the chain's attack time");
  assert.deepEqual(playerModel.scheduledEvents(tied, 6).map(event => event.startBeat), [6]);
  assert.deepEqual(playerModel.scheduledEvents(tied, tied.totalBeats), []);
  notes[0].pitch.accidental = 1;
  assert.deepEqual(tied, original, "Coalescing and caller edits do not mutate the score");
  assert.throws(() => playerModel.scheduledEvents(tied, -1), /offset/);
});

test("a tied chain has one attack and ends at its combined duration", async t => {
  const tied = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC2-C2- | C2 D2 |]");
  for (const instrument of ["flute", "violin", "morin", "guitar", "piano", "chimes"]) {
    const { player, context } = audioFixture();
    t.after(() => player.stop());
    player.configure({ score: tied, instrument });
    await player.play();
    assert.equal(context.sources.length, 1, instrument);
    if (["flute", "violin", "morin"].includes(instrument)) {
      assert.ok(Math.abs(context.sources[0].stoppedAt - 3.085) < 1e-9,
        "The sustained note spans all three written C notes");
    }
    for (const now of [1, 2, 2.5]) { context.currentTime = now; player.tick(); }
    assert.equal(context.sources.length, 1, instrument + " does not retrigger at a tie");
    context.currentTime = 2.95;
    player.tick();
    assert.equal(context.sources.length, 2, instrument + " attacks the next untied note");
    player.stop();
  }
});

test("pause and resume within a tied chain preserve its ending and sample position", async t => {
  const tied = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC2-C2- | C4 |]");
  for (const instrument of ["violin", "guitar", "piano", "chimes"]) {
    const { player, context } = audioFixture();
    t.after(() => player.stop());
    player.configure({ score: tied, instrument });
    await player.play();
    context.currentTime = 1.58;
    player.pause();
    assert.equal(player.currentBeat, 3, "Pause is inside the second notated C");
    context.currentTime = 10;
    await player.play();
    const resumed = context.sources.at(-1);
    assert.equal(context.sources.length, 2, instrument);
    assert.equal(resumed.startedAt, 10.08);
    if (instrument === "violin") {
      assert.ok(Math.abs(resumed.stoppedAt - 12.585) < 1e-9, "Sustain ends at the chain's final beat");
    } else {
      assert.equal(resumed.offset, 1.5, "Resume seeks from the original attack, not the continuation");
    }
    context.currentTime = 10.45;
    player.tick();
    assert.equal(context.sources.length, 2, "No new attack at the next notated continuation");
    player.stop();
  }
});

test("resuming an already-decayed tied pluck does not create a fresh attack", async t => {
  const { player, context } = audioFixture();
  t.after(() => player.stop());
  const tied = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC4- | C4 |]");
  player.configure({ score: tied, instrument: "guitar" });
  await player.play();
  context.currentTime = 2.58;
  player.pause();
  context.currentTime = 5;
  await player.play();
  assert.equal(player.currentBeat, 5);
  assert.equal(context.sources.length, 1, "The two-second buffer has already decayed");
});


test("guitar down and up strokes order only chord attacks and preserve written endings", () => {
  const chord = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\n[GCE]2 z C |]");
  const original = structuredClone(chord);
  const plain = playerModel.scheduledEvents(chord);
  assert.deepEqual(plain.map(e => e.pitch.letter), ["G", "C", "E", "C"]);
  assert.deepEqual(plain.map(e => e.startBeat), [0, 0, 0, 3], "The default retains simultaneous chords");
  for (const [mode, pitches] of [["down", ["C", "E", "G"]], ["up", ["G", "E", "C"]]]) {
    const notes = playerModel.scheduledEvents(chord, 0, { mode, spacingMs: 20 });
    assert.deepEqual(notes.slice(0, 3).map(e => e.pitch.letter), pitches);
    assert.deepEqual(notes.map(e => e.startBeat), [0, .04, .08, 3]);
    assert.ok(notes.slice(0, 3).every(e => Math.abs(e.startBeat + e.durationBeats - 2) < 1e-10));
    assert.ok(notes.slice(0, 3).every(e => e.chordSize === 3));
    assert.deepEqual(notes[3], plain[3], "An isolated note is still one ordinary pluck");
    notes[0].pitch.accidental = 1;
    assert.deepEqual(chord, original, "Ordering and caller mutations leave the score intact");
  }
  const zero = playerModel.scheduledEvents(chord, 0, { mode: "down", spacingMs: 0 });
  assert.deepEqual(zero.map(e => e.startBeat), [0, 0, 0, 3]);
});

test("alternating guitar strokes count chords, preserving ties and direction after seeks", () => {
  const part = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\n[GCE] C- C [AFD] | z [BGE]3 |]");
  const notes = playerModel.scheduledEvents(part, 0, { mode: "alternate", spacingMs: 20 });
  assert.deepEqual(notes.map(e => e.pitch.letter), ["C", "E", "G", "C", "A", "F", "D", "E", "G", "B"]);
  assert.equal(notes[3].durationBeats, 2, "A tie remains one picked note");
  const resumed = playerModel.scheduledEvents(part, 3.5, { mode: "alternate", spacingMs: 20 });
  assert.deepEqual(resumed, notes.slice(4), "Seek keeps the written second chord's upstroke");
  assert.deepEqual(playerModel.scheduledEvents(part, part.totalBeats,
    { mode: "alternate", spacingMs: 20 }), []);
});

test("six-note strums on dense short notes remain bounded and finish within half a note", () => {
  const body = Array.from({ length: 128 }, () => "[CEGceg]/64").join(" ");
  const part = abc.parse("M:4/4\nL:1/4\nQ:1/4=320\nK:C\n" + body + " |]");
  const notes = playerModel.scheduledEvents(part, 0, { mode: "alternate", spacingMs: 60 });
  assert.equal(notes.length, 768, "A strum adds no extra voices to the bounded score");
  for (let i = 0; i < 128; i++) {
    const written = part.parts[0].events[i], chord = notes.slice(i * 6, i * 6 + 6);
    assert.equal(chord[0].startBeat, written.startBeat);
    assert.ok(Math.abs(chord[5].startBeat - written.startBeat - written.durationBeats / 2) < 1e-10);
    for (const note of chord) {
      assert.ok(note.durationBeats > 0);
      assert.ok(note.durationBeats >= written.durationBeats / 2 - 1e-10);
      assert.ok(Math.abs(note.startBeat + note.durationBeats - written.startBeat - written.durationBeats) < 1e-10);
    }
  }
  assert.ok(notes.every((note, index) => index === 0 || note.startBeat >= notes[index - 1].startBeat));
  const tracks = [1, 2].map(id => ({ id, score: part, instrument: "guitar", volume: 30,
    guitar: { mode: "down", spacingMs: 60 } }));
  assert.throws(() => playerModel.validateEnsemble(tracks), /1024/, "Ensemble voice-count limit still applies");
});

test("long guitar sweeps schedule on the audio clock with the original pluck gain and voice count", async t => {
  const { player, context, recipes } = audioFixture();
  t.after(() => player.stop());
  const part = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\n[gcGEeC]4 |]");
  player.configure({ score: part, instrument: "guitar", volume: 50,
    guitar: { mode: "down", spacingMs: 60 } });
  await player.play();
  assert.equal(context.sources.length, 3, "Only attacks within the look-ahead window are created");
  context.currentTime = .10;
  player.tick();
  assert.equal(context.sources.length, 5);
  context.currentTime = .20;
  player.tick();
  assert.equal(context.sources.length, 6);
  assert.ok(recipes.every(recipe => recipe.kind === "pluck" && recipe.options.position === .22));
  assert.ok(recipes.every((recipe, index) => index === 0 || recipe.pitchHz > recipes[index - 1].pitchHz));
  context.sources.forEach((source, index) => {
    assert.ok(Math.abs(source.startedAt - (.08 + index * .06)) < 1e-10);
    assert.ok(Math.abs(source.target.gain.value - .19 * .5 / Math.sqrt(6)) < 1e-10);
  });
  player.stop();
  assert.equal(player.voices.size, 0);
  assert.ok(context.sources.every(source => source.target.gain.value === 0 && source.stoppedAt === .202),
    "Stop silences even notes scheduled beyond the present audio time");
});

test("pause between strummed attacks seeks sounded strings and retains future attacks", async t => {
  const { player, context } = audioFixture();
  t.after(() => player.stop());
  const part = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\n[CEG]4 |]");
  player.configure({ score: part, instrument: "guitar", guitar: { mode: "down", spacingMs: 60 } });
  await player.play();
  assert.equal(context.sources.length, 3);
  context.currentTime = .11;
  player.pause();
  const stopped = context.sources.slice();
  assert.ok(stopped.every(source => source.target.gain.value === 0));
  context.currentTime = 10;
  await player.play();
  const resumed = context.sources.slice(3);
  assert.equal(resumed.length, 3);
  const starts = [10.08, 10.11, 10.17], offsets = [.03, 0, 0];
  resumed.forEach((source, index) => {
    assert.ok(Math.abs(source.startedAt - starts[index]) < 1e-10);
    assert.ok(Math.abs(source.offset - offsets[index]) < 1e-10,
      "A sounded string resumes its decay; a future string keeps a fresh attack");
  });
  assert.equal(context.buffers.length, 3, "Resume reuses the same individual string buffers");
  player.stop();
  context.currentTime = 20;
  await player.play();
  assert.ok(Math.abs(context.sources.at(-3).startedAt - 20.08) < 1e-10);
  assert.ok(context.sources.slice(-3).every(source => source.offset === 0), "Stop then play starts the same sweep again");
});

test("guitar settings are validated before audio starts and are ignored by other instruments", async t => {
  const { player, calls, context } = audioFixture();
  t.after(() => player.stop());
  const part = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\n[GCE]4 |]");
  for (const guitar of [null, [], "down", { mode: "sideways" }, { spacingMs: -1 },
    { spacingMs: 60.01 }, { spacingMs: Infinity }, { spacingMs: "20" }]) {
    assert.throws(() => player.configure({ score: part, instrument: "guitar", guitar }), /guitar strum/);
    assert.throws(() => playerModel.validateEnsemble([{ score: part, instrument: "guitar", volume: 40, guitar }]),
      /guitar strum/);
  }
  assert.equal(calls.length, 0);
  player.configure({ score: part, instrument: "guitar", guitar: { mode: "down" } });
  assert.equal(player.playEvents[1].startBeat, .04, "A missing spacing uses the exported default");
  player.configure({ score: part, instrument: "piano", guitar: { mode: "up", spacingMs: 60 } });
  assert.ok(player.playEvents.every(event => event.startBeat === 0), "Other voices stay simultaneous");
  await player.play();
  assert.ok(context.sources.every(source => source.startedAt === .08));
});

test("ensemble guitar articulations retain shared timing while other tracks stay simultaneous", async t => {
  const { player, context, recipes, calls } = audioFixture(playerModel.EnsemblePlayer);
  t.after(() => player.stop());
  const part = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\n[GCE]4 |]");
  const tracks = [
    { id: 1, score: part, instrument: "guitar", volume: 40, guitar: { mode: "up", spacingMs: 60 } },
    { id: 2, score: part, instrument: "violin", volume: 40, guitar: { mode: "down", spacingMs: 60 } }
  ];
  player.configure({ tracks });
  assert.equal(calls.length, 0);
  assert.equal(player.score.totalBeats, 4);
  assert.equal(player.score.eventCount, 6);
  assert.ok(player.playEvents.every((event, i) => i === 0 || event.startBeat >= player.playEvents[i - 1].startBeat));
  await player.play();
  const strings = context.sources.filter(source => source.type === "buffer");
  const violin = context.sources.filter(source => source.type === "oscillator");
  assert.equal(strings.length, 3);
  assert.equal(violin.length, 3);
  assert.ok(violin.every(source => source.startedAt === .08));
  strings.forEach((source, i) => assert.ok(Math.abs(source.startedAt - (.08 + .06 * i)) < 1e-10));
  assert.ok(recipes.every((recipe, i) => i === 0 || recipe.pitchHz < recipes[i - 1].pitchHz));
});

test("solo and ensemble guitars admit low open strings while other instrument bounds remain", () => {
  const { player, calls } = audioFixture();
  const openE = abc.parse("M:4/4\nL:1/4\nQ:1/4=100\nK:C\n[E,,B,,E,G,B,e]4 |]");
  const belowGuitar = abc.parse("M:4/4\nL:1/4\nQ:1/4=100\nK:C\nD,,4 |]");
  assert.doesNotThrow(() => player.configure({ score: openE, instrument: "guitar",
    guitar: { mode: "down", spacingMs: 20 } }));
  assert.doesNotThrow(() => playerModel.validateEnsemble([{ score: openE, instrument: "guitar", volume: 40 }]));
  assert.throws(() => player.configure({ score: belowGuitar, instrument: "guitar" }), /80–880/);
  assert.throws(() => playerModel.validateEnsemble([{ score: belowGuitar, instrument: "guitar", volume: 40 }]), /80–880/);
  for (const instrument of ["flute", "violin", "morin", "chimes", "triangle", "fmep"]) {
    assert.throws(() => player.configure({ score: openE, instrument }), /outside/);
    assert.throws(() => playerModel.validateEnsemble([{ score: openE, instrument, volume: 40 }]), /outside/);
  }
  assert.equal(calls.length, 0);
});
