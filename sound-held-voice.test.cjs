/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("./sound-sustain.js");
const held = require("./sound-held-voice.js");

function param(initial = 0) {
  return {
    value: initial, initial, records: [], events: [],
    setValueAtTime(value, at) {
      if (this.throwSet) throw new Error("set failed");
      this.value = value; this.records.push(["set", value, at]);
      this.events.push({ type: "set", value, at });
    },
    linearRampToValueAtTime(value, at) {
      this.value = value; this.records.push(["ramp", value, at]);
      this.events.push({ type: "ramp", value, at });
    },
    setTargetAtTime(value, at, constant) {
      this.value = value; this.records.push(["target", value, at, constant]);
    },
    cancelScheduledValues(at) {
      if (this.throwCancel) throw new Error("cancel failed");
      this.records.push(["cancel", at]);
      this.events = this.events.filter(event => event.at < at);
    },
    valueAt(at) {
      const events = this.events.map((event, index) => ({ ...event, index }))
        .sort((a, b) => a.at - b.at || a.index - b.index);
      let previous = { at: 0, value: this.initial };
      for (const event of events) {
        if (event.at > at) {
          if (event.type === "ramp" && previous.at < event.at) {
            const fraction = (at - previous.at) / (event.at - previous.at);
            return previous.value + fraction * (event.value - previous.value);
          }
          break;
        }
        previous = event;
      }
      return previous.value;
    }
  };
}

function fixture() {
  const context = {
    currentTime: 0, sampleRate: 16000, nodes: [], buffers: [], waves: [], calls: [],
    createNode(kind, extra = {}) {
      this.calls.push(kind);
      if (this.failOn === this.calls.length) throw new Error("allocation failed");
      const node = { kind, connections: [], disconnects: 0,
        connect(target) { this.connections.push(target); },
        disconnect() { this.disconnects++; if (this.throwDisconnect) throw new Error("disconnect failed"); },
        ...extra };
      this.nodes.push(node);
      return node;
    },
    createGain() { return this.createNode("gain", { gain: param(1) }); },
    createBiquadFilter() {
      return this.createNode("filter", { type: "lowpass", frequency: param(350), Q: param(1), gain: param() });
    },
    createWaveShaper() { return this.createNode("shaper"); },
    createSource(kind, extra = {}) {
      return this.createNode(kind, { starts: [], stops: [],
        start(...args) { this.starts.push(args); if (this.throwStart) throw new Error("start failed"); },
        stop(at) { this.stops.push(at); if (this.throwStop) throw new Error("stop failed"); }, ...extra });
    },
    createOscillator() {
      return this.createSource("oscillator", { frequency: param(440), type: "sine",
        setPeriodicWave(wave) { this.wave = wave; this.type = "custom"; } });
    },
    createPeriodicWave(real, imag, options) {
      const wave = { real, imag, options }; this.waves.push(wave); return wave;
    },
    createBuffer(_channels, length, sampleRate) {
      if (this.failBuffer) throw new Error("buffer failed");
      const data = new Float32Array(length);
      const buffer = { length, sampleRate, duration: length / sampleRate, getChannelData() { return data; } };
      this.buffers.push(buffer);
      return buffer;
    },
    createBufferSource() { return this.createSource("buffer"); }
  };
  const output = {};
  const create = (options = {}) => held.createVoice({ context, output, kind: "flute", hz: 440, ...options });
  return { context, output, create };
}

function near(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("model defaults and memory metadata are available without audio allocation", () => {
  assert.deepEqual(held.KINDS, ["flute", "clarinet", "violin", "morin"]);
  assert.equal(held.MIN_HZ, model.MIN_HZ);
  assert.equal(held.MAX_HZ, model.MAX_HZ);
  for (const kind of held.KINDS) {
    assert.deepEqual(held.defaults(kind), { strength: 60,
      attack: model.defaults(kind).attack, release: model.defaults(kind).release });
  }
  assert.equal(held.NOISE_SECONDS, 1);
  assert.equal(held.bufferFrames(44100), 44100);
  assert.equal(held.bufferFrames(48000.1), 48001);
  assert.throws(() => held.defaults("reed"), /Unknown/);
  for (const value of [NaN, Infinity, 0, 8000, 1e9]) {
    assert.throws(() => held.bufferFrames(value), /sample rate/);
  }
});

test("flute uses the explorer's nonlinear jet, filters, tone gain and quiet noise", () => {
  const { create, context, output } = fixture();
  const voice = create({ at: 2, level: .24 });
  const f = voice.fluteNodes;
  assert.equal(voice.bowNodes, null);
  assert.equal(voice.oscillator.type, "sine");
  assert.equal(f.shaper.oversample, "4x");
  assert.equal(f.shaper.curve.length, 2049);
  for (const i of [0, 1, 400, 1024, 2048]) {
    near(f.shaper.curve[i], model.fluteJetAt(2 * i / 2048 - 1), 1e-7);
  }
  assert.equal(f.drive.gain.value, model.fluteDrive(60));
  assert.equal(f.highpass.type, "highpass");
  assert.equal(f.highpass.frequency.value, 70);
  assert.equal(f.lowpass.type, "lowpass");
  assert.equal(f.lowpass.frequency.value, 3400);
  assert.equal(f.highpass.Q.value, 20 * Math.log10(model.FLUTE_Q));
  assert.equal(f.lowpass.Q.value, 20 * Math.log10(model.FLUTE_Q));
  assert.equal(f.toneGain.gain.value, 1.2);
  assert.deepEqual(voice.oscillator.connections, [f.drive]);
  assert.deepEqual(f.drive.connections, [f.shaper]);
  assert.deepEqual(f.shaper.connections, [f.highpass]);
  assert.deepEqual(f.highpass.connections, [f.lowpass]);
  assert.deepEqual(f.lowpass.connections, [f.toneGain]);
  assert.deepEqual(f.toneGain.connections, [voice.envelope]);
  assert.deepEqual(voice.noise.connections, [voice.filter]);
  assert.deepEqual(voice.filter.connections, [voice.noiseGain]);
  assert.deepEqual(voice.noiseGain.connections, [voice.envelope]);
  assert.deepEqual(voice.envelope.connections, [voice.volume]);
  assert.deepEqual(voice.volume.connections, [output]);
  assert.equal(voice.noiseGain.gain.value, .002);
  assert.equal(voice.filter.frequency.value, 3600);
  assert.equal(voice.filter.Q.value, 1);
  assert.equal(voice.noise.loop, true);
  assert.deepEqual(voice.noise.starts, [[2, 0]]);
  assert.equal(voice.volume.gain.value, .24);
  assert.equal(voice.sources.length, 2);
  assert.equal(voice.nodes.length, context.nodes.length);
  assert.equal(voice.endTime, Infinity);
  assert.equal(voice.attack, .08);
  assert.equal(voice.releaseDuration, .16);
});

for (const kind of ["violin", "morin"]) {
  test(kind + " preserves phase-locked soft/hard sources and its body filters", () => {
    const { create } = fixture();
    const voice = create({ kind, at: 3, hz: 330 });
    const bow = voice.bowNodes, body = model.bowBody(kind);
    assert.equal(voice.fluteNodes, null);
    assert.equal(voice.sources.length, 3);
    assert.deepEqual(voice.oscillator.starts, [[3]]);
    assert.deepEqual(bow.sharpOscillator.starts, [[3]]);
    assert.equal(bow.sharpOscillator.frequency.value, 330);
    for (const [edge, osc] of [["soft", voice.oscillator], ["hard", bow.sharpOscillator]]) {
      const components = model.bowSourceComponents(kind, edge);
      assert.equal(osc.wave.options.disableNormalization, true);
      assert.deepEqual(osc.wave.real, new Float32Array([0, ...components.map(c => c.cos)]));
      assert.deepEqual(osc.wave.imag, new Float32Array([0, ...components.map(c => c.sin)]));
    }
    const weights = model.bowPressureWeights(60);
    assert.equal(bow.softGain.gain.value, weights.soft);
    assert.equal(bow.hardGain.gain.value, weights.hard);
    assert.deepEqual(bow.softGain.connections, [bow.peaks[0]]);
    assert.deepEqual(bow.hardGain.connections, [bow.peaks[0]]);
    assert.deepEqual(bow.peaks[0].connections, [bow.peaks[1]]);
    assert.deepEqual(bow.peaks[1].connections, [bow.lowpass]);
    for (let i = 0; i < body.peaks.length; i++) {
      assert.equal(bow.peaks[i].type, "peaking");
      assert.equal(bow.peaks[i].frequency.value, body.peaks[i].frequency);
      assert.equal(bow.peaks[i].Q.value, body.peaks[i].q);
      assert.equal(bow.peaks[i].gain.value, body.peaks[i].gain);
    }
    assert.equal(bow.lowpass.frequency.value, body.cutoff);
    assert.equal(bow.lowpass.Q.value, 20 * Math.log10(model.FLUTE_Q));
    assert.deepEqual(bow.lowpass.connections, [voice.envelope]);
    assert.equal(voice.noiseGain.gain.value, model.bowNoiseGain(kind, 60));
  });
}

test("I2b clarinet builds two phase-locked reed spectra, bore filters and a tongued onset", () => {
  const { create, context, output } = fixture();
  const voice = create({ kind: "clarinet", hz: 220, at: 1, strength: 60, level: .28 });
  const reed = model.clarinet;
  const nodes = voice.clarinetNodes;
  assert.equal(voice.fluteNodes, null);
  assert.equal(voice.bowNodes, null);
  assert.equal(voice.sources.length, 3);
  assert.equal(voice.oscillator.type, "custom");
  assert.equal(nodes.brightOscillator.type, "custom");
  assert.equal(voice.oscillator.frequency.value, 220);
  assert.equal(nodes.brightOscillator.frequency.value, 220);
  assert.deepEqual(voice.oscillator.starts, [[1]]);
  assert.deepEqual(nodes.brightOscillator.starts, [[1]]);
  for (const [profile, oscillator] of [["soft", voice.oscillator], ["bright", nodes.brightOscillator]]) {
    assert.equal(oscillator.wave.options.disableNormalization, true);
    assert.deepEqual(oscillator.wave.imag,
      new Float32Array([0, ...reed.SOURCES[profile].map(component => component.sin)]));
  }
  const weights = reed.strengthWeights(60);
  near(nodes.softGain.gain.value, weights.soft);
  near(nodes.brightGain.gain.valueAt(1), 0);
  near(nodes.brightGain.gain.valueAt(1 + reed.TONGUE_SECONDS), weights.bright);
  near(voice.noiseGain.gain.valueAt(1), reed.noiseGain(60) * reed.noiseOnset(0));
  near(voice.noiseGain.gain.valueAt(1 + reed.NOISE_SECONDS), reed.noiseGain(60));
  assert.equal(voice.filter.type, "bandpass");
  assert.equal(voice.filter.frequency.value, reed.BODY.noiseBandpass);
  assert.deepEqual(voice.oscillator.connections, [nodes.softGain]);
  assert.deepEqual(nodes.brightOscillator.connections, [nodes.brightGain]);
  assert.deepEqual(nodes.softGain.connections, [nodes.highpass]);
  assert.deepEqual(nodes.brightGain.connections, [nodes.highpass]);
  assert.deepEqual(nodes.highpass.connections, [nodes.peak]);
  assert.deepEqual(nodes.peak.connections, [nodes.lowpass]);
  assert.deepEqual(nodes.lowpass.connections, [voice.envelope]);
  assert.deepEqual(voice.envelope.connections, [voice.volume]);
  assert.deepEqual(voice.volume.connections, [output]);
  assert.equal(voice.nodes.length, context.nodes.length);
  voice.release(1.2);
  assert.ok(voice.sources.every(source => source.stops[0] === voice.endTime));
  context.currentTime = 1.3;
  assert.equal(voice.stop(), true);
  assert.ok(voice.nodes.every(node => node.disconnects > 0));
});

test("I2b clarinet pause/seek uses note age for tongue noise and brightening", () => {
  const reed = model.clarinet;
  const { create } = fixture();
  for (const offsetSeconds of [.025, .061, .25, 3]) {
    const voice = create({ kind: "clarinet", at: 5, hz: 330, offsetSeconds });
    const weights = reed.strengthWeights(60);
    near(voice.clarinetNodes.brightGain.gain.valueAt(5), weights.bright * reed.brightOnset(offsetSeconds));
    near(voice.noiseGain.gain.valueAt(5), reed.noiseGain(60) * reed.noiseOnset(offsetSeconds));
    near(voice.clarinetNodes.brightGain.gain.valueAt(5 + .2), weights.bright);
    near(voice.noiseGain.gain.valueAt(5 + .2), reed.noiseGain(60));
    assert.deepEqual(voice.noise.starts, [[5, offsetSeconds % held.NOISE_SECONDS]]);
  }
});

test("LP/HP dB-Q parameters reproduce the analytic linear-Q cutoff response; peaking Q stays linear", () => {
  function cutoffMagnitude(node, sampleRate) {
    const frequency = node.frequency.value;
    const w = 2 * Math.PI * frequency / sampleRate;
    const c = Math.cos(w), q = Math.pow(10, node.Q.value / 20);
    const alpha = Math.sin(w) / (2 * q);
    const b0 = (1 + (node.type === "highpass" ? c : -c)) / 2;
    const b1 = node.type === "highpass" ? -(1 + c) : 1 - c;
    const b2 = b0, a0 = 1 + alpha, a1 = -2 * c, a2 = 1 - alpha;
    const real = values => values[0] + values[1] * Math.cos(w) + values[2] * Math.cos(2 * w);
    const imag = values => -values[1] * Math.sin(w) - values[2] * Math.sin(2 * w);
    const numerator = [b0, b1, b2], denominator = [a0, a1, a2];
    return Math.hypot(real(numerator), imag(numerator)) /
      Math.hypot(real(denominator), imag(denominator));
  }
  for (const kind of held.KINDS) {
    const { create, context } = fixture();
    const voice = create({ kind });
    const toneFilters = voice.fluteNodes ? [voice.fluteNodes.highpass, voice.fluteNodes.lowpass] :
      voice.clarinetNodes ? [voice.clarinetNodes.highpass, voice.clarinetNodes.lowpass] :
        [voice.bowNodes.lowpass];
    for (const node of toneFilters) {
      near(Math.pow(10, node.Q.value / 20), model.FLUTE_Q);
      near(cutoffMagnitude(node, context.sampleRate), model.FLUTE_Q);
      assert.ok(node.Q.value < 0, "a Butterworth Q is about −3.01 dB, not +.707 dB");
    }
    if (voice.bowNodes) {
      voice.bowNodes.peaks.forEach((node, index) =>
        assert.equal(node.Q.value, model.bowBody(kind).peaks[index].q));
    }
    if (voice.clarinetNodes) assert.equal(voice.clarinetNodes.peak.Q.value, model.clarinet.BODY.peakQ);
    assert.equal(voice.filter.Q.value, 1, "quiet noise keeps its original native-Q coloration");
  }
});

function signature(voice) {
  const params = node => Object.fromEntries(["frequency", "gain", "Q"].filter(key => node[key])
    .map(key => [key, node[key].records.map(record => [record[0], record[1],
      Number((record[2] - voice.startedAt).toFixed(12)), ...record.slice(3)])]));
  return voice.nodes.map(node => ({ kind: node.kind, type: node.type,
    params: params(node), wave: node.wave, curve: node.curve, oversample: node.oversample,
    connections: node.connections.map(target => voice.nodes.indexOf(target)) }));
}

test("live and future-scheduled voices have exactly the same default signal graph", () => {
  for (const kind of held.KINDS) {
    const live = fixture().create({ kind });
    const scheduled = fixture().create({ kind, at: 7 });
    assert.deepEqual(signature(live), signature(scheduled));
    assert.deepEqual(live.noise.buffer.getChannelData(0), scheduled.noise.buffer.getChannelData(0));
  }
});

test("seeded noise allocates once per context and can be discarded after offline export", () => {
  const { create, context } = fixture();
  const a = create(), b = create({ kind: "morin" });
  assert.equal(context.buffers.length, 1);
  assert.equal(a.noise.buffer, b.noise.buffer);
  assert.equal(a.noise.buffer.length, held.bufferFrames(context.sampleRate));
  let seed = 0x518c3f27;
  for (let i = 0; i < 20; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    near(a.noise.buffer.getChannelData(0)[i], (seed / 0x80000000 - 1) * .7, 1e-7);
  }
  const other = fixture().create();
  assert.notEqual(a.noise.buffer, other.noise.buffer);
  assert.deepEqual(a.noise.buffer.getChannelData(0), other.noise.buffer.getChannelData(0));
  assert.equal(held.clearNoiseBuffer(context), true);
  const c = create();
  assert.equal(context.buffers.length, 2);
  assert.notEqual(c.noise.buffer, a.noise.buffer);
  assert.deepEqual(c.noise.buffer.getChannelData(0), a.noise.buffer.getChannelData(0));
  assert.ok(a.noise.buffer, "active voices retain their buffer after the cache is dropped");
});

test("zero strength silences both the periodic and turbulence source for every kind", () => {
  for (const kind of held.KINDS) {
    const voice = fixture().create({ kind, strength: 0 });
    assert.equal(voice.noiseGain.gain.value, 0);
    if (voice.fluteNodes) assert.equal(voice.fluteNodes.drive.gain.value, 0);
    else if (voice.clarinetNodes) {
      assert.equal(voice.clarinetNodes.softGain.gain.value, 0);
      assert.equal(voice.clarinetNodes.brightGain.gain.value, 0);
    } else {
      assert.equal(voice.bowNodes.softGain.gain.value, 0);
      assert.equal(voice.bowNodes.hardGain.gain.value, 0);
    }
  }
});

test("live pitch, strength and volume update in place using the explorer's smoothing", () => {
  for (const kind of held.KINDS) {
    const { create, context } = fixture();
    const voice = create({ kind });
    context.currentTime = .3;
    assert.equal(voice.update({ hz: 220, strength: 100, level: .17 }), true);
    assert.deepEqual(voice.oscillator.frequency.records.at(-1), ["target", 220, .3, .018]);
    assert.deepEqual(voice.volume.gain.records.at(-1), ["target", .17, .3, .015]);
    if (voice.fluteNodes) {
      assert.equal(voice.fluteNodes.drive.gain.value, model.fluteDrive(100));
      assert.equal(voice.noiseGain.gain.value, model.fluteNoiseGain(100));
    } else if (voice.clarinetNodes) {
      assert.equal(voice.clarinetNodes.brightOscillator.frequency.value, 220);
      assert.equal(voice.clarinetNodes.softGain.gain.value, model.clarinet.strengthWeights(100).soft);
      assert.equal(voice.clarinetNodes.brightGain.gain.value, model.clarinet.strengthWeights(100).bright);
      assert.equal(voice.noiseGain.gain.value, model.clarinet.noiseGain(100));
    } else {
      assert.equal(voice.bowNodes.sharpOscillator.frequency.value, 220);
      assert.equal(voice.bowNodes.softGain.gain.value, model.bowPressureWeights(100).soft);
      assert.equal(voice.bowNodes.hardGain.gain.value, model.bowPressureWeights(100).hard);
      assert.equal(voice.noiseGain.gain.value, model.bowNoiseGain(kind, 100));
    }
    voice.update({ strength: 0 });
    assert.equal(voice.noiseGain.gain.value, 0);
    assert.equal(context.nodes.length, voice.nodes.length, "updates do not recreate sources");
    const records = voice.oscillator.frequency.records.length;
    assert.throws(() => voice.update({ hz: 330, level: NaN }), /output level/);
    assert.equal(voice.oscillator.frequency.records.length, records, "validate all changes before applying any");
  }
});

test("scheduled note-off retains the full default release tail and stops all sources", () => {
  for (const kind of held.KINDS) {
    const voice = fixture().create({ kind, at: 2 });
    assert.equal(voice.release(3), true);
    const end = 3 + held.defaults(kind).release;
    near(voice.envelopeAt(3), 1);
    near(voice.envelopeAt(3 + held.defaults(kind).release / 2), .5);
    near(voice.envelopeAt(end), 0);
    near(voice.endTime, end + held.STOP_PAD);
    assert.ok(voice.sources.every(source => source.stops[0] === voice.endTime));
    assert.equal(voice.stopping, true);
    assert.equal(voice.ended, false);
    assert.equal(voice.release(3), false, "repeated note-off is idempotent");
    assert.equal(voice.release(4), false, "a later note-off cannot extend a stopped note");
    assert.ok(voice.sources.every(source => source.stops.length === 1));
  }
});

test("short-note release preserves the attack segment, without overlapping value curves", () => {
  const voice = fixture().create({ kind: "violin", at: 1 });
  const off = 1.041;
  const before = [1.001, 1.014, 1.023, 1.039, off].map(time => voice.envelopeAt(time));
  voice.release(off);
  for (const [i, time] of [1.001, 1.014, 1.023, 1.039, off].entries()) {
    near(voice.envelopeAt(time), before[i]);
    near(voice.envelope.gain.valueAt(time), before[i]);
  }
  near(voice.envelopeAt(off + voice.releaseDuration / 2), before.at(-1) / 2);
  assert.ok(voice.envelope.gain.records.every(record => ["set", "ramp", "cancel"].includes(record[0])));
  assert.ok(before.at(-1) > 0 && before.at(-1) < 1);
});

test("an earlier release safely shortens a future note-off; subsequent releases remain idempotent", () => {
  const { create, context } = fixture();
  const voice = create({ kind: "morin" });
  voice.release(8);
  context.currentTime = .2;
  assert.equal(voice.release(.2, .05), true);
  near(voice.endTime, .275);
  near(voice.envelopeAt(.2), 1);
  near(voice.envelopeAt(.225), .5);
  assert.ok(voice.sources.every(source => source.stops.at(-1) === voice.endTime));
  assert.equal(voice.release(.2, .05), false);
});

test("zero-duration notes are silent and still clean up every scheduled source", () => {
  const voice = fixture().create({ kind: "violin", at: 4 });
  voice.release(4);
  for (const time of [4, 4.1, 4.2]) near(voice.envelopeAt(time), 0);
  assert.ok(voice.sources.every(source => source.stops.length === 1));
});

test("instant release is a step at note-off, not a premature fade during attack", () => {
  const voice = fixture().create({ at: 1 });
  const before = voice.envelopeAt(1.04);
  voice.release(1.05, 0);
  near(voice.envelopeAt(1.04), before);
  near(voice.envelope.gain.valueAt(1.04), before);
  near(voice.envelopeAt(1.05), 0);
  near(voice.envelope.gain.valueAt(1.05), 0);
  near(voice.endTime, 1.05 + held.STOP_PAD);
});

test("resume restores note-age envelope and noise offset with an independent short fade", () => {
  const { create } = fixture();
  const original = create({ kind: "morin" });
  const resumed = create({ kind: "morin", at: 5, offsetSeconds: .047 });
  for (const dt of [0, .001, .01, .023, .063, 1]) {
    near(resumed.envelopeAt(5 + dt), original.envelopeAt(.047 + dt));
  }
  assert.deepEqual(resumed.noise.starts, [[5, .047]]);
  assert.deepEqual(resumed.oscillator.starts, [[5]], "native oscillator restarts, explicitly not bit-exact seek");
  assert.deepEqual(resumed.envelope.connections, [resumed.resumeGain]);
  assert.deepEqual(resumed.resumeGain.connections, [resumed.volume]);
  near(resumed.resumeGain.gain.valueAt(5), 0);
  near(resumed.resumeGain.gain.valueAt(5 + held.RESUME_FADE), 1);
  resumed.release(5.1);
  near(resumed.envelopeAt(5.1), 1);
  const late = create({ offsetSeconds: 8.25, at: 9 });
  near(late.envelopeAt(9), 1);
  near(late.envelopeAt(9.1), 1);
  assert.deepEqual(late.noise.starts, [[9, .25]]);
});

test("known written duration schedules the same envelope and complete release as note-off", () => {
  for (const kind of held.KINDS) {
    for (const duration of [0, .041, 1]) {
      const open = fixture().create({ kind, at: 2 });
      open.release(2 + duration);
      const scheduled = fixture().create({ kind, at: 2, noteDurationSeconds: duration });
      near(scheduled.endTime, open.endTime);
      for (let time = 2; time < open.endTime + .05; time += .0013) {
        near(scheduled.envelopeAt(time), open.envelopeAt(time));
        near(scheduled.envelope.gain.valueAt(time), open.envelope.gain.valueAt(time));
      }
      assert.ok(scheduled.sources.every(source => source.stops[0] === scheduled.endTime));
      assert.equal(scheduled.release(2 + duration), false, "already scheduled note-off stays idempotent");
    }
  }
});

test("resume during release keeps the elapsed tail instead of restarting an attack or sustain", () => {
  for (const kind of held.KINDS) {
    const release = held.defaults(kind).release;
    for (const duration of [.041, 1]) {
      const original = fixture().create({ kind, noteDurationSeconds: duration });
      const offset = duration + release * .5;
      const resumed = fixture().create({ kind, at: 5, noteDurationSeconds: duration, offsetSeconds: offset });
      const offLevel = original.envelopeAt(duration);
      near(resumed.envelopeAt(5), offLevel / 2);
      assert.ok(resumed.envelopeAt(5) <= .5);
      for (let dt = 0; dt < release * .5 + held.STOP_PAD; dt += .0013) {
        near(resumed.envelopeAt(5 + dt), original.envelopeAt(offset + dt));
        near(resumed.envelope.gain.valueAt(5 + dt), original.envelope.gain.valueAt(offset + dt));
      }
      near(resumed.endTime, 5 + release * .5 + held.STOP_PAD);
      assert.ok(resumed.sources.every(source => source.stops[0] === resumed.endTime));
      assert.equal(resumed.resumeGain.gain.valueAt(5), 0, "separate short gate avoids a seek click");
      near(resumed.envelopeAt(5 + release * .5), 0);
    }
  }
});

test("resuming within the zero-level cleanup pad or after a completed tail cannot retrigger", () => {
  const pad = fixture().create({ at: 5, noteDurationSeconds: 1, offsetSeconds: 1.16 + .01 });
  near(pad.envelopeAt(5), 0);
  near(pad.endTime, 5.015);
  assert.ok(pad.sources.every(source => source.stops[0] === pad.endTime));
  const expired = fixture().create({ at: 5, noteDurationSeconds: 1, offsetSeconds: 2 });
  assert.equal(expired.endTime, 5);
  assert.equal(expired.envelopeAt(5), 0);
  assert.ok(expired.sources.every(source => source.stops[0] === 5));
});

test("Stop cancels future notes and synchronously disconnects all sources and filters", () => {
  const { create, context } = fixture();
  let callbacks = 0;
  const voice = create({ kind: "violin", at: 7, onended: result => {
    assert.equal(result, voice); callbacks++;
  } });
  voice.release(8);
  const oldCallback = voice.oscillator.onended;
  context.currentTime = 1;
  assert.equal(voice.stop(), true);
  assert.equal(voice.ended, true);
  assert.equal(voice.endTime, 1);
  assert.ok(voice.sources.every(source => source.stops.at(-1) === 1));
  assert.ok(voice.nodes.every(node => node.disconnects === 1));
  assert.ok(voice.sources.every(source => source.onended === null));
  assert.equal(callbacks, 1);
  oldCallback();
  assert.equal(voice.stop(), false);
  assert.equal(voice.release(2), false);
  assert.equal(voice.update({ hz: 220 }), false);
  assert.equal(callbacks, 1, "delayed onended and repeated Stop cannot finish twice");
  assert.ok(voice.nodes.every(node => node.disconnects === 1));
});

test("Stop remains safe when browser stop, gain automation or disconnect calls throw", () => {
  const voice = fixture().create({ kind: "morin", at: 4 });
  voice.release(5);
  for (const source of voice.sources) source.throwStop = true;
  voice.envelope.gain.throwCancel = true;
  voice.volume.gain.throwSet = true;
  voice.nodes[0].throwDisconnect = true;
  assert.doesNotThrow(() => voice.stop());
  assert.ok(voice.nodes.every(node => node.disconnects === 1));
  assert.ok(voice.sources.every(source => source.stops.at(-1) === 0));
  assert.equal(voice.ended, true);
});

test("note-off before a scheduled start cancels rather than briefly playing that note", () => {
  const voice = fixture().create({ at: 4 });
  assert.equal(voice.release(1), true);
  assert.equal(voice.ended, true);
  assert.ok(voice.nodes.every(node => node.disconnects === 1));
  assert.ok(voice.sources.every(source => source.stops.at(-1) < 4));
});

test("natural end stops looped noise and disconnects every node exactly once", () => {
  const { create, context } = fixture();
  let callbacks = 0;
  const voice = create({ kind: "violin", onended: () => callbacks++ });
  voice.release(1);
  context.currentTime = voice.endTime;
  const callback = voice.oscillator.onended;
  callback();
  callback();
  assert.equal(callbacks, 1);
  assert.equal(voice.ended, true);
  assert.ok(voice.nodes.every(node => node.disconnects === 1));
  assert.ok(voice.sources.every(source => source.stops.at(-1) === context.currentTime));
});

test("invalid parameters fail before allocating any Web Audio nodes or buffers", () => {
  for (const options of [{ kind: "reed" }, { hz: 109 }, { hz: 881 }, { hz: NaN },
    { strength: -1 }, { strength: 101 }, { strength: Infinity }, { level: -1 }, { level: 2 },
    { level: NaN }, { attack: .001 }, { release: 2 }, { offsetSeconds: -1 },
    { offsetSeconds: Infinity }, { noteDurationSeconds: -1 }, { noteDurationSeconds: NaN },
    { noteDurationSeconds: Infinity }, { at: NaN }, { at: -1 }, { onended: true }]) {
    const { create, context } = fixture();
    assert.throws(() => create(options));
    assert.equal(context.nodes.length, 0);
    assert.equal(context.buffers.length, 0);
  }
  const { create, context } = fixture();
  context.sampleRate = 8000;
  assert.throws(() => create(), /sample rate/);
  assert.equal(context.nodes.length, 0);
});

test("partial graph allocation failures stop and disconnect everything already made", () => {
  for (const kind of held.KINDS) {
    const full = fixture().create({ kind });
    for (let failOn = 2; failOn <= full.nodes.length; failOn++) {
      const { create, context } = fixture();
      context.failOn = failOn;
      let callbacks = 0;
      assert.throws(() => create({ kind, onended: () => callbacks++ }), /allocation/);
      assert.equal(callbacks, 0, "failed constructors do not notify a handle that was never returned");
      assert.ok(context.nodes.every(node => node.disconnects === 1));
      assert.ok(context.nodes.filter(node => node.stops).every(source => source.stops.length === 1));
    }
  }
  const { create, context } = fixture();
  context.failBuffer = true;
  assert.throws(() => create(), /buffer failed/);
  assert.ok(context.nodes.every(node => node.disconnects === 1));
});

test("failed native start cleans even the sources whose starts had already succeeded", () => {
  const { create, context } = fixture();
  const originalFactory = context.createBufferSource;
  context.createBufferSource = function () {
    const node = originalFactory.call(this); node.throwStart = true; return node;
  };
  assert.throws(() => create({ kind: "violin" }), /start failed/);
  assert.equal(context.nodes.filter(node => node.kind === "oscillator").length, 2);
  assert.ok(context.nodes.every(node => node.disconnects === 1));
  assert.ok(context.nodes.filter(node => node.stops).every(source => source.stops.length === 1));
});
