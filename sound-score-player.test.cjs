"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const abc = require("./sound-abc.js");
const playerModel = require("./sound-score-player.js");
const transient = require("./sound-transient.js");
const sustain = require("./sound-sustain.js");
const heldVoice = require("./sound-held-voice.js");
const marimba = require("./sound-marimba.js");
const mandolin = require("./sound-mandolin.js");
const temperaments = require("./sound-temperaments.js");
const drumABC = require("./sound-drum-abc.js");

function audioParam() {
  return { value: 0, records: [],
    cancelScheduledValues(at) { this.records.push(["cancel", at]); },
    setValueAtTime(value, at) { this.value = value; this.records.push(["set", value, at]); },
    linearRampToValueAtTime(value, at) { this.value = value; this.records.push(["ramp", value, at]); },
    setTargetAtTime(value, at, constant) { this.value = value; this.records.push(["target", value, at, constant]); }
  };
}

function audioFixture(Player = playerModel.Player) {
  const context = {
    currentTime: 0, sampleRate: 16000, sources: [], gains: [], waves: [], buffers: [], filters: [], shapers: [],
    createGain() {
      const gain = { gain: audioParam(), connect(target) { this.target = target; },
        disconnect() { this.disconnected = true; } };
      this.gains.push(gain);
      return gain;
    },
    createPeriodicWave(real, imag, options) {
      const wave = { real, imag, options }; this.waves.push(wave); return wave;
    },
    createOscillator() {
      const source = {
        type: "oscillator", frequency: audioParam(),
        connect(target) { this.target = target; }, disconnect() { this.disconnected = true; },
        setPeriodicWave(wave) { this.wave = wave; },
        start(at) { this.startedAt = at; }, stop(at) { this.stoppedAt = at; }
      };
      this.sources.push(source);
      return source;
    },
    createBuffer(_channels, length, rate) {
      const data = new Float32Array(length);
      const buffer = { duration: length / rate, length, sampleRate: rate, getChannelData() { return data; } };
      this.buffers.push(buffer);
      return buffer;
    },
    createBufferSource() {
      const source = {
        type: "buffer", connect(target) { this.target = target; }, disconnect() { this.disconnected = true; },
        start(at, offset) { this.startedAt = at; this.offset = offset || 0; },
        stop(at) { this.stoppedAt = at; }
      };
      this.sources.push(source);
      return source;
    },
    createBiquadFilter() {
      const node = { frequency: audioParam(), Q: audioParam(), gain: audioParam(),
        connect(target) { this.target = target; }, disconnect() { this.disconnected = true; } };
      this.filters.push(node); return node;
    },
    createWaveShaper() {
      const node = { connect(target) { this.target = target; }, disconnect() { this.disconnected = true; } };
      this.shapers.push(node); return node;
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
  assert.equal(player.voices.size, 1);
  assert.ok(Math.abs(context.sources[0].startedAt - .08) < 1e-6);
  assert.equal(context.sources[0].type, "sine");
  assert.equal(context.shapers.length, 1, "Flute uses the shared nonlinear jet graph");
  assert.equal(context.gains[0].target, player.contextOwner.output);
  context.currentTime = 1.29;
  player.tick();
  assert.equal(player.voices.size, 2, "The rest does not create a voice");
  context.currentTime = 1.94;
  player.tick();
  assert.equal(player.voices.size, 3);
  context.currentTime = 2.56;
  player.tick();
  assert.equal(player.voices.size, 4);
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

test("I3 held score voices stop and resume within note age without re-triggering chiff or musette attacks", async () => {
  const longNote = abc.parse("M:4/4\nL:1/4\nQ:1/4=60\nK:C\nC4 |]");
  for (const instrument of ["organ-stopped", "organ-principal", "accordion", "bayan"]) {
    const { player, context } = audioFixture();
    player.configure({ score: longNote, instrument });
    assert.equal(context.sources.length, 0);
    await player.play();
    assert.equal(player.voices.size, 1);
    assert.equal(context.sources.length,
      instrument === "accordion" ? 2 : instrument.startsWith("organ-") ? 2 : 1);
    context.currentTime = 1.5;
    player.pause();
    assert.equal(player.status, "paused");
    assert.equal(player.voices.size, 0);
    assert.ok(context.sources.every(source => Number.isFinite(source.stoppedAt)),
      instrument + " had no lingering oscillator after Pause");
    const initialCount = context.sources.length;
    context.currentTime = 2.6;
    await player.play();
    assert.equal(player.voices.size, 1);
    const resumed = context.sources.slice(initialCount);
    assert.equal(resumed.length,
      instrument === "accordion" ? 2 : 1,
      "a resumed organ pipe omits the original short chiff");
    assert.ok(resumed.some(source => source.wave?.imag?.some(value => value > 0)));
    player.stop();
    assert.ok(context.sources.every(source => Number.isFinite(source.stoppedAt)));
  }
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

test("guitar, mandolin, piano, chime, marimba and xylophone scores delegate to their shared sound models", async () => {
  for (const instrument of ["guitar", "mandolin", "piano", "chimes", "marimba", "xylophone"]) {
    const { player, context, recipes } = audioFixture();
    player.configure({ score: melody, instrument, tuning: "just", volume: 52 });
    await player.play();
    assert.equal(context.sources[0].type, "buffer", instrument);
    assert.equal(recipes.length, 1, instrument);
    const recipe = recipes[0];
    assert.equal(recipe.kind, instrument === "guitar" ? "pluck" :
      instrument === "piano" ? "piano" :
        ["marimba", "xylophone", "mandolin"].includes(instrument) ? instrument : "kick");
    if (instrument === "mandolin") {
      assert.equal(recipe.decay, mandolin.DEFAULT_DECAY);
      assert.deepEqual(recipe.options, { velocity: mandolin.DEFAULT_VELOCITY, articulation: "pick" });
    }
    if (instrument === "chimes") {
      assert.equal(recipe.options.drumVoice, "chimes");
      assert.ok(Math.abs(recipe.options.chimeHz - 264) < 10);
    }
    if (instrument === "marimba") {
      assert.equal(recipe.decay, marimba.DEFAULT_DECAY);
      assert.equal(recipe.options.velocity, marimba.DEFAULT_VELOCITY);
    }
    if (instrument === "xylophone") {
      assert.equal(recipe.decay, .32);
      assert.equal(recipe.options.velocity, .66);
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

test("held and marimba score ranges are checked before audio starts in both hosts", () => {
  const { player, calls } = audioFixture();
  const score = body => abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\n" + body + " |]");
  for (const instrument of heldVoice.KINDS) {
    assert.deepEqual(playerModel.instrumentRange(instrument), sustain.rangeFor(instrument));
    const [lower, upper] = sustain.rangeFor(instrument);
    for (const part of [score("G,,4"), score("b4")]) {
      assert.throws(() => player.configure({ score: part, instrument }), new RegExp(lower + "–" + upper));
      assert.throws(() => playerModel.validateEnsemble([{ score: part, instrument, volume: 50 }]),
        new RegExp(lower + "–" + upper));
    }
    assert.doesNotThrow(() => player.configure({
      score: score(instrument === "clarinet" ? "D,2 e2" : "A,,2 a2"), instrument }));
  }
  assert.deepEqual(playerModel.instrumentRange("marimba"), [marimba.MIN_HZ, marimba.MAX_HZ]);
  assert.doesNotThrow(() => player.configure({ score: score("A,,2 a'2"), instrument: "marimba" }));
  assert.doesNotThrow(() => playerModel.validateEnsemble([
    { score: score("A,,2 a'2"), instrument: "marimba", volume: 50 }
  ]));
  for (const part of [score("G,,4"), score("b'4")]) {
    assert.throws(() => player.configure({ score: part, instrument: "marimba" }), /110–1760/);
    assert.throws(() => playerModel.validateEnsemble([{ score: part, instrument: "marimba", volume: 50 }]), /110–1760/);
  }
  assert.equal(calls.length, 0);
});

test("xylophone range C4–C7 is enforced before audio starts in solo and ensemble", () => {
  const xylophone = require("./sound-xylophone.js");
  const { player, calls } = audioFixture();
  const score = body => abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\n" + body + " |]");
  assert.deepEqual(playerModel.instrumentRange("xylophone"), [xylophone.MIN_HZ, xylophone.MAX_HZ]);
  for (const valid of [score("C4"), score("c''4")]) {
    assert.doesNotThrow(() => player.configure({ score: valid, instrument: "xylophone" }));
    assert.doesNotThrow(() => playerModel.validateEnsemble([
      { score: valid, instrument: "xylophone", volume: 50 }
    ]));
  }
  for (const invalid of [score("G,4"), score("d''4")]) {
    assert.throws(() => player.configure({ score: invalid, instrument: "xylophone" }), /outside (?:the )?xylophone range/);
    assert.throws(() => playerModel.validateEnsemble([
      { score: invalid, instrument: "xylophone", volume: 50 }
    ]), /outside (?:the )?xylophone range/);
  }
  assert.equal(calls.length, 0);
});

test("Compose held voices retain the explorer graph, quiet noise and default attack/release even for short notes", () => {
  for (const instrument of heldVoice.KINDS) {
    const { player, context } = audioFixture();
    player.configure({ score: melody, instrument, volume: 40 });
    player.context = context;
    const event = player.playEvents[0], recipe = heldVoice.defaults(instrument);
    assert.equal(player.sharedBufferBytes(event, context.sampleRate), context.sampleRate * 4);
    assert.equal(context.buffers.length, 0, "Planning does not allocate noise or open audio");
    player.scheduleNote(event, 1, 1.01);
    const voice = [...player.voices][0].held;
    assert.equal(voice.attack, recipe.attack);
    assert.equal(voice.releaseDuration, recipe.release);
    assert.ok(voice.envelopeAt(1.005) > 0 && voice.envelopeAt(1.01) < 1,
      "A very short note releases from its unfinished attack");
    assert.ok(voice.envelopeAt(1.01 + recipe.release / 2) > 0);
    assert.equal(voice.envelopeAt(1.01 + recipe.release), 0);
    assert.ok(Math.abs(voice.endTime - player.voiceEndTime(event, 1, 1.01, context.sampleRate)) < 1e-12);
    assert.ok(voice.sources.every(source => source.startedAt === 1 && source.stoppedAt === voice.endTime));
    assert.equal(voice.noise.loop, true);
    assert.equal(voice.noise.buffer.duration, heldVoice.NOISE_SECONDS);
    const expectedNoise = instrument === "flute" ? sustain.fluteNoiseGain(recipe.strength) :
      instrument === "clarinet" ? sustain.clarinet.noiseGain(recipe.strength) :
        sustain.bowNoiseGain(instrument, recipe.strength);
    assert.equal(voice.noiseGain.gain.value, expectedNoise);
    assert.ok(Math.abs(voice.volume.gain.value - .19 * .4) < 1e-12, "Compose applies only its existing mix level");
    if (instrument === "flute") {
      assert.equal(voice.fluteNodes.shaper.oversample, "4x");
      assert.equal(voice.fluteNodes.drive.gain.value, sustain.fluteDrive(recipe.strength));
    } else if (instrument === "clarinet") {
      assert.equal(voice.clarinetNodes.lowpass.frequency.value, sustain.clarinet.BODY.lowpass);
      assert.equal(voice.sources.length, 3, "Clarinet has two phased reed sources and one noise source");
    } else {
      assert.equal(voice.bowNodes.peaks.length, sustain.bowBody(instrument).peaks.length);
      assert.equal(voice.sources.length, 3, "Soft/hard bow sources plus quiet noise are present");
    }
    player.scheduleNote(event, 2, 2.5);
    const second = [...player.voices][1].held;
    assert.equal(second.noise.buffer, voice.noise.buffer, "All notes reuse one bounded excitation buffer");
    context.currentTime = .5;
    player.stop();
    assert.equal(player.voices.size, 0);
    assert.ok(context.sources.every(source => source.disconnected && source.stoppedAt === .5),
      "Stop cancels every future oscillator and noise source synchronously");
    assert.ok(voice.nodes.every(node => node.disconnected));
    assert.ok(second.nodes.every(node => node.disconnected));
  }
});

test("live completion waits for final held releases and full freely ringing marimba tails", async t => {
  const finalNote = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nz15/4 C/4 |]");
  for (const instrument of [...heldVoice.KINDS, "marimba"]) {
    const { player, context } = audioFixture();
    t.after(() => player.stop());
    player.transientModel = transient;
    player.configure({ score: finalNote, instrument });
    await player.play();
    context.currentTime = 1.9;
    player.tick();
    const expectedEnd = player.voiceEndTime(player.playEvents[0], 1.955, 2.08, context.sampleRate);
    assert.ok(Math.abs(player.playbackEndTime - expectedEnd) < 1e-10);
    context.currentTime = expectedEnd - .01;
    player.tick();
    assert.equal(player.status, "playing", instrument + " release was not cut off at score end");
    context.currentTime = expectedEnd + .01;
    player.tick();
    assert.equal(player.status, "stopped");
  }
});

test("Pause/Resume preserves a held release tail after the notation ends, including a short note", async t => {
  for (const instrument of heldVoice.KINDS) for (const body of ["C4", "z255/64 C/64"]) {
    const { player, context } = audioFixture();
    t.after(() => player.stop());
    const score = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\n" + body + " |]");
    const original = structuredClone(score), release = sustain.defaults(instrument).release;
    player.configure({ score, instrument });
    await player.play();
    if (body !== "C4") { context.currentTime = 1.9; player.tick(); }
    const first = [...player.voices][0].held;
    context.currentTime = 2.08 + release / 2;
    const expectedLevel = first.envelopeAt(context.currentTime);
    assert.ok(expectedLevel > 0 && expectedLevel < 1);
    player.pause();
    assert.equal(player.currentBeat, score.totalBeats, "The visible notation never extends beyond its final beat");
    assert.ok(player.positionBeat > score.totalBeats, "The internal audio position retains release age");
    const sourceCount = context.sources.length;
    context.currentTime = 10;
    assert.equal(await player.play(), true);
    assert.equal(player.voices.size, 1, "Resume restores just the sounding tail, not bar one");
    const resumed = [...player.voices][0].held;
    assert.equal(context.sources.length, sourceCount + resumed.sources.length);
    assert.ok(Math.abs(resumed.envelopeAt(10.08) - expectedLevel) < 1e-9);
    assert.ok(Math.abs(resumed.endTime - (10.08 + release / 2 + heldVoice.STOP_PAD)) < 1e-9);
    const event = player.playEvents[0];
    const expectedOffset = (4 - event.startBeat) * .5 + release / 2;
    assert.ok(Math.abs(resumed.offsetSeconds - expectedOffset) < 1e-9);
    assert.ok(Math.abs(resumed.noise.offset - expectedOffset % 1) < 1e-9);
    assert.ok(resumed.envelope.gain.records.filter(record => record[0] === "ramp" && record[2] > 10.08)
      .every(record => record[1] <= expectedLevel + 1e-9), "No new attack is inserted into the release");
    assert.equal(player.currentBeat, score.totalBeats);
    assert.deepEqual(score, original);
    context.currentTime = resumed.endTime + .01;
    player.tick();
    assert.equal(player.status, "stopped");
    assert.equal(player.currentBeat, 0);
    assert.equal(context.sources.length, sourceCount + resumed.sources.length, "Tail completion never loops the music");
  }
});

test("repeated pauses within one held release retain the progressively shorter tail", async t => {
  const { player, context } = audioFixture();
  t.after(() => player.stop());
  player.configure({ score: abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC4 |]"), instrument: "morin" });
  await player.play();
  context.currentTime = 2.14;
  player.pause();
  context.currentTime = 10;
  await player.play();
  context.currentTime = 10.12;
  const expected = [...player.voices][0].held.envelopeAt(context.currentTime);
  player.pause();
  context.currentTime = 20;
  await player.play();
  const resumed = [...player.voices][0].held;
  assert.ok(Math.abs(resumed.offsetSeconds - 2.1) < 1e-10);
  assert.ok(Math.abs(resumed.envelopeAt(20.08) - expected) < 1e-9);
  assert.ok(Math.abs(resumed.endTime - (20.08 + .22 + heldVoice.STOP_PAD)) < 1e-9);
  assert.equal(player.currentBeat, 4);
});

test("freely ringing sample tails resume from their original samples inside rests and after score end", async t => {
  const score = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC z3 |]");
  for (const instrument of ["guitar", "chimes", "marimba"]) for (const age of [.9, 2.2]) {
    const { player, context } = audioFixture();
    t.after(() => player.stop());
    player.transientModel = transient;
    player.configure({ score, instrument });
    await player.play();
    const first = [...player.voices][0].source, buffer = first.buffer;
    context.currentTime = .08 + age;
    player.pause();
    assert.equal(player.currentBeat, Math.min(4, age * 2));
    context.currentTime = 10;
    await player.play();
    assert.equal(player.voices.size, 1, instrument + " still rings after its written quarter note");
    const resumed = [...player.voices][0].source;
    assert.equal(resumed.buffer, buffer);
    assert.ok(Math.abs(resumed.offset - age) < 1e-9, "Resume seeks the ring instead of replaying its strike");
    assert.equal(resumed.startedAt, 10.08);
    const expectedEnd = Math.max(10.08 + 2 - age, 10.08 + buffer.duration - age);
    assert.ok(Math.abs(player.playbackEndTime - expectedEnd) < 1e-9);
    const sourceCount = context.sources.length;
    context.currentTime = expectedEnd + .01;
    player.tick();
    assert.equal(player.status, "stopped");
    assert.equal(context.sources.length, sourceCount);
  }
});

test("piano and FM damper-tail resume preserves sample age, exponential level and remaining stop time", async t => {
  const score = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nz3 C |]");
  for (const instrument of ["piano", "fmep"]) {
    const { player, context } = audioFixture();
    t.after(() => player.stop());
    player.transientModel = transient;
    player.configure({ score, instrument });
    await player.play();
    context.currentTime = 1.5;
    player.tick();
    const first = [...player.voices][0], initial = first.gain.gain.records.find(record => record[0] === "set")[1];
    context.currentTime = 2.14;
    player.pause();
    context.currentTime = 10;
    await player.play();
    assert.equal(player.voices.size, 1);
    const resumed = [...player.voices][0];
    assert.ok(Math.abs(resumed.source.offset - .56) < 1e-9);
    assert.ok(Math.abs(resumed.source.stoppedAt - 10.21) < 1e-9);
    const level = resumed.gain.gain.records.find(record => record[0] === "set")[1];
    assert.ok(Math.abs(level - initial * Math.exp(-.06 / .028)) < 1e-9);
    assert.ok(resumed.gain.gain.records.some(record => record[0] === "target" && record[2] === 10.08));
    assert.equal(player.currentBeat, score.totalBeats);
  }
});

test("a four-part ensemble resumes only its still-sounding held, marimba and drum tails", async t => {
  const { player, context } = audioFixture(playerModel.EnsemblePlayer);
  t.after(() => player.stop());
  player.transientModel = transient;
  const score = body => abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\n" + body + " |]");
  const drums = drumABC.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C clef=perc\nz3 F |]");
  player.configure({ tracks: [
    { id: 1, instrument: "flute", score: score("C4"), volume: 20 },
    { id: 2, instrument: "morin", score: score("C4"), volume: 30 },
    { id: 3, instrument: "marimba", score: score("C z3"), volume: 40 },
    { id: 4, instrument: "drums", score: drums, volume: 50 }
  ] });
  await player.play();
  context.currentTime = 1.5;
  player.tick();
  context.currentTime = 2.18;
  player.pause();
  context.currentTime = 10;
  await player.play();
  assert.equal(player.voices.size, 4);
  assert.deepEqual(player.buses.map(bus => bus.gain.value), [.2, .3, .4, .5]);
  const held = [...player.voices].filter(voice => voice.held).map(voice => voice.held);
  assert.equal(held.length, 2);
  assert.ok(held.every(voice => Math.abs(voice.offsetSeconds - 2.1) < 1e-9));
  const sampled = [...player.voices].filter(voice => !voice.held).map(voice => voice.source);
  assert.ok(Math.abs(sampled[0].offset - 2.1) < 1e-9);
  assert.ok(Math.abs(sampled[1].offset - .6) < 1e-9);
  assert.equal(player.currentBeat, 4);
  const count = context.sources.length;
  context.currentTime = 10.18;
  player.tick();
  assert.equal(context.sources.length, count, "Already resumed tails are not scheduled twice");
  context.currentTime = player.playbackEndTime + .01;
  player.tick();
  assert.equal(player.status, "stopped");
  assert.equal(context.sources.length, count);
});

test("D2c closed hi-hat chokes the actual open sample, including seek and same-beat collisions", async t => {
  const part = drumABC.parse("M:4/4\nL:1/8\nQ:1/4=120\nK:C clef=perc\nF E z6 |]");
  const { player, context } = audioFixture(playerModel.EnsemblePlayer);
  t.after(() => player.stop());
  player.configure({ tracks: [{ id: 1, instrument: "drums", score: part, volume: 60 }] });
  assert.equal(player.playEvents[0].drum, "openHat");
  assert.equal(player.playEvents[0].chokeBeat, .5);
  await player.play();
  const open = context.sources[0];
  assert.equal(open.type, "buffer");
  assert.ok(Math.abs(open.stoppedAt - (.08 + .25 + playerModel.HAT_CHOKE_SECONDS)) < 1e-9);
  const openEnvelope = context.gains.find(gain => gain === open.target);
  assert.ok(openEnvelope.gain.records.some(record => record[0] === "target" &&
    Math.abs(record[2] - .33) < 1e-9 && record[3] === .009));
  context.currentTime = .2;
  player.tick();
  assert.equal(context.sources.length, 2, "The closed hi-hat still sounds as its own strike");
  context.currentTime = .45;
  player.pause();
  assert.equal(player.status, "paused");
  context.currentTime = 10;
  const count = context.sources.length;
  await player.play();
  assert.equal(context.sources.length, count + 1, "Only the closed-hat tail resumes after the choke");
  assert.ok(context.sources.at(-1).offset > .1);
  const simultaneous = drumABC.parse("M:4/4\nL:1/8\nQ:1/4=120\nK:C clef=perc\n[EF] z7 |]");
  const other = audioFixture(playerModel.EnsemblePlayer);
  t.after(() => other.player.stop());
  other.player.configure({ tracks: [{ id: 1, instrument: "drums", score: simultaneous, volume: 50 }] });
  await other.player.play();
  assert.equal(other.context.sources.length, 1, "Pedal-closed hi-hat suppresses simultaneous open strike");
});

test("D2e half-open hi-hat chokes on the live clock and velocity bands cache distinct timbres", async t => {
  const part = drumABC.parse("M:4/4\nL:1/8\nQ:1/4=120\nK:C clef=perc\n" +
    "g E F E !ghost!D !accent!D z2 |]");
  const { player, context } = audioFixture(playerModel.EnsemblePlayer);
  t.after(() => player.stop());
  player.configure({ tracks: [{ id: 1, instrument: "drums", score: part, volume: 65 }] });
  const half = player.playEvents.find(event => event.drum === "halfHat");
  const open = player.playEvents.find(event => event.drum === "openHat");
  assert.equal(half.chokeBeat, .5);
  assert.equal(open.chokeBeat, 1.5);
  const snare = player.playEvents.filter(event => event.drum === "snare");
  const ghost = player.bufferSpec(snare[0], context.sampleRate);
  const accent = player.bufferSpec(snare[1], context.sampleRate);
  assert.notEqual(ghost.key, accent.key, "Velocity changes cached sample shape");
  assert.equal(ghost.options.velocity, .4);
  assert.equal(accent.options.velocity, 1);
  assert.equal(ghost.frames, accent.frames);
  await player.play();
  const first = context.sources[0];
  assert.equal(first.type, "buffer");
  assert.ok(Math.abs(first.stoppedAt - (.08 + .25 + playerModel.HAT_CHOKE_SECONDS)) < 1e-9);
  context.currentTime = .27;
  player.tick();
  assert.ok(context.sources.some(source => source !== first && source.startedAt > first.startedAt));
});

test("D2c ensemble schedules swung offbeats without moving downbeats or touching a pitched track", async t => {
  const part = drumABC.parse("M:4/4\nL:1/8\nQ:1/4=120\nK:C clef=perc\nC E D E z4 |]");
  const pitched = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC4 |]");
  const { player, context } = audioFixture(playerModel.EnsemblePlayer);
  t.after(() => player.stop());
  player.configure({ tracks: [
    { id: 1, instrument: "drums", score: part, volume: 50, drumFeel: "swing" },
    { id: 2, instrument: "sine", score: pitched, volume: 50 }
  ] });
  assert.deepEqual(player.playEvents.filter(event => event.partIndex === 0)
    .map(event => +event.startBeat.toFixed(9)),
    [0, +(2 / 3).toFixed(9), 1, +(5 / 3).toFixed(9)]);
  assert.equal(player.playEvents.find(event => event.partIndex === 1).startBeat, 0);
  await player.play();
  for (const time of [.25, .45, .65, .85]) { context.currentTime = time; player.tick(); }
  const drum = context.sources.filter(source => source.type === "buffer");
  assert.deepEqual(drum.map(source => +source.startedAt.toFixed(9)),
    [.08, +(.08 + 1 / 3).toFixed(9), .58, +(.08 + 5 / 6).toFixed(9)]);
});

test("D2d live ensemble honors per-track expressive dynamics and explicit sticking", () => {
  const part = drumABC.parse("M:4/4\nL:1/16\nQ:1/4=120\nK:C clef=perc\n" +
    "!accent!!R!D2 !L!D2 !ghost!D2 !R!D2 !roll!!L!D8 |]");
  const expected = drumABC.scheduledEvents(part, "straight", "expressive");
  const { player } = audioFixture(playerModel.EnsemblePlayer);
  player.configure({ tracks: [{ id: 1, instrument: "drums", score: part,
    volume: 65, drumFeel: "straight", drumTouch: "expressive" }] });
  assert.deepEqual(player.playEvents.map(({ partIndex, ...event }) => event), expected);
  assert.equal(player.playEvents[0].velocity, 1, "A written accent remains exact");
  assert.equal(player.playEvents[2].velocity, .34, "A ghost remains exact");
  assert.deepEqual(player.playEvents.filter(event => event.stroke?.startsWith("roll"))
    .map(event => event.hand), ["L", "R", "L", "R"]);
  const even = drumABC.scheduledEvents(part);
  assert.ok(player.playEvents.some((event, i) => event.velocity !== even[i].velocity));
});

test("resuming after all tails expired stops cleanly instead of looping from bar one", async t => {
  for (const instrument of ["flute", "morin", "marimba", "sine"]) {
    const { player, context } = audioFixture();
    t.after(() => player.stop());
    player.transientModel = transient;
    player.configure({ score: abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC4 |]"), instrument });
    await player.play();
    context.currentTime = player.playbackEndTime + .1;
    player.pause(); // Simulate a delayed UI action before the next scheduler tick.
    const count = context.sources.length;
    context.currentTime = 10;
    assert.equal(await player.play(), false);
    assert.equal(player.status, "stopped");
    assert.equal(player.currentBeat, 0);
    assert.equal(player.voices.size, 0);
    assert.equal(context.sources.length, count);
  }
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
  for (const instrument of ["flute", "violin", "morin", "guitar", "piano", "chimes", "marimba"]) {
    const { player, context } = audioFixture();
    t.after(() => player.stop());
    player.configure({ score: tied, instrument });
    await player.play();
    assert.equal(player.voices.size, 1, instrument);
    if (["flute", "violin", "morin"].includes(instrument)) {
      const voice = [...player.voices][0].held;
      assert.ok(Math.abs(voice.endTime - (3.08 + sustain.defaults(instrument).release + heldVoice.STOP_PAD)) < 1e-9,
        "The sustained note spans all three written C notes, then releases fully");
      assert.ok(voice.sources.every(source => source.stoppedAt === voice.endTime));
    }
    for (const now of [1, 2, 2.5]) { context.currentTime = now; player.tick(); }
    assert.equal(player.voices.size, 1, instrument + " does not retrigger at a tie");
    context.currentTime = 2.95;
    player.tick();
    assert.equal(player.voices.size, 2, instrument + " attacks the next untied note");
    player.stop();
  }
});

test("pause and resume within a tied chain preserve its ending and sample position", async t => {
  const tied = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC2-C2- | C4 |]");
  for (const instrument of ["violin", "guitar", "piano", "chimes", "marimba"]) {
    const { player, context } = audioFixture();
    t.after(() => player.stop());
    player.configure({ score: tied, instrument });
    await player.play();
    context.currentTime = 1.58;
    player.pause();
    assert.equal(player.currentBeat, 3, "Pause is inside the second notated C");
    context.currentTime = 10;
    await player.play();
    const resumedVoice = [...player.voices][0], resumed = resumedVoice.source;
    const sourceCount = context.sources.length;
    assert.equal(player.voices.size, 1, instrument);
    assert.equal(resumed.startedAt, 10.08);
    if (instrument === "violin") {
      assert.ok(Math.abs(resumed.stoppedAt - (12.58 + sustain.defaults(instrument).release + heldVoice.STOP_PAD)) < 1e-9,
        "Sustain releases after the chain's final beat");
      assert.equal(resumedVoice.held.envelopeAt(resumed.startedAt), 1,
        "Resume retains the tied note's age rather than replaying its attack");
    } else {
      assert.equal(resumed.offset, 1.5, "Resume seeks from the original attack, not the continuation");
    }
    context.currentTime = 10.45;
    player.tick();
    assert.equal(context.sources.length, sourceCount, "No new attack at the next notated continuation");
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
  const strings = [...player.voices].filter(voice => !voice.held).map(voice => voice.source);
  const violin = [...player.voices].filter(voice => voice.held).map(voice => voice.source);
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

test("buffer specifications and ending times match the actual shared instrument models", () => {
  const part = abc.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C\nC z3 |]");
  for (const rate of [16000, 44100, 48000]) for (const instrument of ["guitar", "mandolin", "piano", "fmep", "chimes", "marimba", "xylophone"]) {
    const { player, context, calls } = audioFixture();
    context.sampleRate = rate;
    player.transientModel = transient;
    player.strictBufferFrames = true;
    player.configure({ score: part, instrument });
    const event = player.playEvents[0], spec = player.bufferSpec(event, rate);
    assert.equal(context.buffers.length, 0, "planning has no sample-buffer side effects");
    assert.equal(calls.length, 0, "planning does not open audio");
    player.context = context;
    const buffer = player.bufferFor(spec);
    assert.equal(buffer.getChannelData(0).length, spec.frames, instrument + " " + rate);
    assert.ok(buffer.getChannelData(0).every(Number.isFinite));
    const shortEnd = instrument === "piano" || instrument === "fmep" ? 1.5 + .19 : 1 + buffer.duration;
    assert.equal(player.voiceEndTime(event, 1, 1.5, rate), shortEnd);
    assert.equal(player.voiceEndTime(event, 1, 7, rate), 1 + buffer.duration,
      "A held buffer cannot ring longer than its own modeled samples");
    assert.equal(player.bufferBytes, spec.frames * 4);
    player.clearBuffers();
    assert.equal(player.bufferBytes, 0);
    assert.equal(player.buffers.size, 0);
    assert.equal(player.bufferSizes.size, 0);
  }
});

test("each drum has a shared full-tail specification independent of its written note length", () => {
  const score = drumABC.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C clef=perc\n[CDEFG] z3 |]");
  const { player, context, calls } = audioFixture(playerModel.EnsemblePlayer);
  player.transientModel = transient;
  player.strictBufferFrames = true;
  player.configure({ tracks: [{ id: 1, instrument: "drums", score, volume: 50 }] });
  player.context = context;
  const seconds = { kick: 1.44, snare: .96, hat: .52, openHat: 1.92, woodblock: .96 };
  for (const event of player.playEvents) {
    const spec = player.bufferSpec(event, context.sampleRate), buffer = player.bufferFor(spec);
    assert.equal(spec.frames, Math.ceil(seconds[event.drum] * context.sampleRate));
    assert.equal(buffer.getChannelData(0).length, spec.frames);
    assert.equal(player.voiceEndTime(event, 2, 2.01, context.sampleRate),
      event.drum === "openHat" ? 2 + playerModel.HAT_CHOKE_SECONDS : 2 + buffer.duration,
      "The full open-hat sample exists, but a simultaneous closed hat cuts its audible tail");
  }
  assert.equal(calls.length, 0);
});

test("D2a extended kit events use distinct timed buffers in the shared player", () => {
  const score = drumABC.parse("M:4/4\nL:1/4\nQ:1/4=120\nK:C clef=perc\n[ABcdef] z3 |]");
  const { player, context } = audioFixture(playerModel.EnsemblePlayer);
  player.transientModel = transient;
  player.strictBufferFrames = true;
  player.configure({ tracks: [{ id: 1, instrument: "drums", score, volume: 65 }] });
  player.context = context;
  const kinds = { floorTom: "tom", midTom: "tom", highTom: "tom",
    ride: "ride", crash: "crash", rimshot: "rimshot" };
  const specs = player.playEvents.map(event => ({ drum: event.drum,
    spec: player.bufferSpec(event, context.sampleRate) }));
  assert.equal(specs.length, 6);
  for (const { drum, spec } of specs) {
    assert.equal(spec.options.drumVoice, kinds[drum]);
    assert.ok(spec.frames > context.sampleRate * .5);
    assert.ok(spec.frames <= context.sampleRate * 3,
      "New kit decays respect the 93-second export limit after a 90-second score");
    assert.ok(player.bufferFor(spec).getChannelData(0).every(Number.isFinite));
    assert.equal(player.voiceEndTime({ type: "drum", drum, partIndex: 0 }, 1, 1.1, context.sampleRate),
      1 + player.bufferFor(spec).duration);
  }
  assert.equal(new Set(specs.map(item => item.spec.key)).size, 6);
});

test("the default live cache remains FIFO 24 while an offline cache reuses more than 24 pitches", () => {
  for (const limit of [24, 1024]) {
    const { player, context, recipes } = audioFixture();
    player.bufferCacheLimit = limit;
    player.maxBufferBytes = 128 * 1024 * 1024;
    player.configure({ score: melody, instrument: "piano" });
    player.context = context;
    const events = Array.from({ length: 30 }, (_, index) => ({ ...player.playEvents[0],
      pitch: { letter: "CDEFGAB"[index % 7], accidental: 0, octave: 2 + Math.floor(index / 7) } }));
    const specs = events.map(event => player.bufferSpec(event, context.sampleRate));
    for (const spec of specs) player.bufferFor(spec);
    const original = player.buffers.get(specs[0].key);
    const reused = player.bufferFor(specs[0]);
    assert.equal(player.buffers.size, Math.min(limit, events.length));
    assert.equal(recipes.length, limit === 24 ? 31 : 30);
    if (limit === 1024) assert.equal(reused, original, "Future sources share one retained buffer per pitch");
    assert.equal(player.bufferBytes, player.buffers.size * context.sampleRate * 2 * 4);
  }
});

test("buffer budgets fail before model allocation and a failed note leaves no connected gain", () => {
  const { player, context, recipes } = audioFixture();
  player.configure({ score: melody, instrument: "guitar" });
  player.context = context;
  player.maxBufferBytes = 1;
  assert.throws(() => player.scheduleNote(player.playEvents[0], 0, 1),
    error => error.code === "limit" && /memory/.test(error.message));
  assert.equal(recipes.length, 0);
  assert.equal(context.buffers.length, 0);
  assert.equal(context.gains.length, 1);
  assert.equal(context.gains[0].disconnected, true);
  assert.equal(player.voices.size, 0);
  assert.equal(player.bufferBytes, 0);
});

test("strict offline buffers reject a changed model length instead of truncating release tails", () => {
  const { player, context } = audioFixture();
  player.configure({ score: melody, instrument: "guitar" });
  player.context = context;
  player.strictBufferFrames = true;
  assert.throws(() => player.bufferFor(player.bufferSpec(player.playEvents[0], context.sampleRate)), /unexpected audio sample/);
  assert.equal(context.buffers.length, 0, "The two-second test model does not match the 2.6-second recipe");
  assert.equal(player.bufferBytes, 0);
  assert.equal(player.buffers.size, 0);
});

test("audibility follows the same static mute, solo and volume rules as track buses", () => {
  const { player } = audioFixture(playerModel.EnsemblePlayer);
  const tracks = [
    { id: 1, score: melody, instrument: "flute", volume: 50, mute: true, solo: false },
    { id: 2, score: melody, instrument: "piano", volume: 0, mute: false, solo: true },
    { id: 3, score: melody, instrument: "guitar", volume: 50, mute: false, solo: false }
  ];
  player.configure({ tracks });
  assert.ok(player.playEvents.every(event => !player.isEventAudible(event)));
  player.updateMix(2, { volume: 40 });
  assert.ok(player.playEvents.filter(event => player.isEventAudible(event)).every(event => event.partIndex === 1));
  player.updateMix(2, { solo: false });
  assert.deepEqual([...new Set(player.playEvents.filter(event => player.isEventAudible(event)).map(event => event.partIndex))], [1, 2]);
});
