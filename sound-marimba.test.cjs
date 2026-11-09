"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const marimba = require("./sound-marimba.js");
const transient = require("./sound-transient.js");
const spectrum = require("./sound-spectrum.js");
const sourceAnalysis = require("./sound-analysis-dsp.js");

function statistics(samples) {
  let peak = 0, squares = 0, sum = 0;
  for (const sample of samples) {
    assert.ok(Number.isFinite(sample));
    peak = Math.max(peak, Math.abs(sample));
    squares += sample * sample;
    sum += sample;
  }
  return { peak, rms: Math.sqrt(squares / samples.length), mean: sum / samples.length };
}

function band(result, hz) {
  const bin = Math.round(hz / result.binHz);
  return Math.max(...result.magnitudes.slice(Math.max(0, bin - 1), bin + 2));
}

function frame(pitchHz, velocity, time = .06, options = {}) {
  return spectrum.spectrumAt(transient, { kind: "marimba", pitchHz,
    decaySec: marimba.DEFAULT_DECAY, options: { velocity, ...options } }, time);
}

test("marimba has one stable pitched-hit contract and illustrative bar modes", () => {
  assert.equal(marimba.MIN_HZ, 110);
  assert.equal(marimba.MAX_HZ, 1760);
  assert.equal(marimba.DEFAULT_DECAY, .65);
  assert.equal(marimba.DEFAULT_VELOCITY, .62);
  assert.deepEqual(marimba.MODE_RATIOS.slice(0, 3), [1, 4, 10]);
  assert.ok(marimba.MODE_RATIOS.slice(3).every(ratio => !Number.isInteger(ratio)),
    "The remaining illustrative bar modes are not piano-like integer partials");
  const modes = marimba.modeData(220);
  assert.ok(Object.isFrozen(modes) && modes.every(Object.isFrozen));
  assert.deepEqual(modes.slice(0, 3).map(mode => mode.hz), [220, 880, 2200]);
  for (let index = 1; index < modes.length; index++) {
    assert.ok(modes[index].decaySec < modes[index - 1].decaySec,
      "Higher bar modes decay sooner than the fundamental");
  }
});

test("marimba rejects nonfinite and unsupported pitches, strengths, decays and rates", () => {
  for (const pitch of [NaN, Infinity, -Infinity, 19.999, 5000.001]) {
    assert.throws(() => marimba.sampleAt(.1, pitch), RangeError);
  }
  for (const decay of [NaN, Infinity, -.1, 0, .119, 1.201]) {
    assert.throws(() => marimba.sampleAt(.1, 440, decay), RangeError);
  }
  for (const velocity of [NaN, Infinity, -.001, 1.001, "0.62", null]) {
    assert.equal(marimba.validVelocity(velocity), false);
    assert.throws(() => marimba.sampleAt(.1, 440, .65, velocity), RangeError);
  }
  for (const sampleRate of [NaN, Infinity, 7999, 192001]) {
    assert.throws(() => marimba.sampleAt(.1, 440, .65, .62, sampleRate), RangeError);
  }
  for (const time of [NaN, Infinity, -Infinity]) {
    assert.throws(() => marimba.sampleAt(time, 440), RangeError);
    assert.throws(() => marimba.envelope(time), RangeError);
  }
  for (const pitch of [20, marimba.MIN_HZ, marimba.MAX_HZ, 5000]) {
    for (const rate of [8000, 192000]) assert.doesNotThrow(() => marimba.validate(pitch, .65, .62, rate));
  }
});

test("marimba defaults, deterministic repeated strikes and zero strength are exact", () => {
  for (const time of [0, .0001, .01, .15, .8, 2.5]) {
    assert.equal(marimba.sampleAt(time, 440), marimba.sampleAt(time, 440, .65, .62, 48000));
    assert.equal(marimba.sampleAt(time, 440, .65, 0), 0);
    assert.equal(marimba.envelope(time, .65, 0), 0);
  }
  assert.equal(marimba.sampleAt(-1, 440), 0);
  assert.equal(marimba.sampleAt(3, 440), 0);
  assert.equal(marimba.sampleAt(Number.MAX_VALUE, 440), 0);
  const first = transient.makeSamples("marimba", 440, .65, 16000);
  // Exercise recipe changes between repeats: no phase/noise state may leak.
  transient.makeSamples("marimba", 110, .12, 8000, "medium", { velocity: 1 });
  const second = transient.makeSamples("marimba", 440, .65, 16000);
  assert.deepEqual(first, second);
});

for (const pitchHz of [110, 440, 1760]) {
  for (const velocity of [.2, .62, 1]) {
    test(`marimba ${pitchHz} Hz at strength ${velocity} is bounded, DC-safe and finitely faded`, () => {
      const sampleRate = 48000;
      const samples = transient.makeSamples("marimba", pitchHz, .65, sampleRate, "medium", { velocity });
      const stats = statistics(samples);
      assert.equal(samples.length, Math.ceil(transient.duration(.65) * sampleRate));
      assert.ok(stats.peak > .03 && stats.peak < .927, "Nonzero output stays below the fixed triangle bound");
      assert.ok(stats.rms > .005 && stats.rms < .25);
      assert.ok(Math.abs(stats.mean) < .001, "No material DC offset");
      assert.equal(samples[0], 0);
      assert.ok(Math.abs(samples[1]) < .0001, "Soft contact starts continuously");
      assert.ok(Math.abs(samples.at(-1)) < .00002, "The finite buffer ends near zero");
      assert.equal(transient.plottedSampleAt("marimba", 2.6, pitchHz, .65, "medium", { velocity }), 0);
      const attack = samples.slice(Math.round(.01 * sampleRate), Math.round(.12 * sampleRate));
      const late = samples.slice(Math.round(2 * sampleRate), Math.round(2.5 * sampleRate));
      assert.ok(statistics(attack).rms > statistics(late).rms * 10,
        "A single hit rings down without sustained excitation");
    });
  }
}

test("marimba strength changes both level and relative overtone content", () => {
  const soft = frame(250, .2), medium = frame(250, .62), strong = frame(250, 1);
  assert.ok(band(soft, 250) < band(medium, 250) && band(medium, 250) < band(strong, 250));
  const relativeFourth = result => band(result, 1000) / band(result, 250);
  const relativeTenth = result => band(result, 2500) / band(result, 250);
  assert.ok(relativeFourth(strong) > 4 * relativeFourth(soft), "A hard strike is brighter, not just louder");
  assert.ok(relativeTenth(strong) > 5 * relativeTenth(soft));
  assert.ok(relativeFourth(medium) > relativeFourth(soft) && relativeFourth(medium) < relativeFourth(strong));
});

test("marimba short-time spectrum loses upper modes while retaining its fundamental", () => {
  const early = frame(250, .62, .05), later = frame(250, .62, .4);
  const fourth = result => band(result, 1000) / band(result, 250);
  const tenth = result => band(result, 2500) / band(result, 250);
  assert.ok(fourth(early) > fourth(later) * 2.5);
  assert.ok(tenth(early) > tenth(later) * 15);
  const maximum = Math.max(...later.magnitudes);
  assert.equal(band(later, 250), maximum, "Fundamental remains the strongest later component");
});

test("marimba modal identity differs from acoustic piano and existing chimes at one pitch", () => {
  const marimbaFrame = frame(250, .62);
  const pianoFrame = spectrum.spectrumAt(transient,
    { kind: "piano", pitchHz: 250, decaySec: .65, options: { velocity: .62 } }, .06);
  const chimeFrame = spectrum.spectrumAt(transient,
    { kind: "kick", pitchHz: 250, decaySec: .65, options: { drumVoice: "chimes", chimeHz: 250 } }, .06);
  assert.ok(band(marimbaFrame, 1000) > .04 && band(marimbaFrame, 2500) > .01,
    "The deliberately tuned fourth and tenth components are present");
  assert.ok(band(pianoFrame, 500) > band(marimbaFrame, 500) * 100,
    "A marimba bar is not relabeled piano harmonics");
  assert.ok(band(chimeFrame, 690) > band(marimbaFrame, 690) * 100,
    "The existing 2.76 f0 chime mode is not the marimba's four-times mode");
  assert.ok(band(marimbaFrame, 1000) > band(chimeFrame, 1000) * 100);
});

test("marimba suppresses modes near Nyquist and smoothly limits the teaching band", () => {
  for (const sampleRate of [8000, 11025, 16000, 44100, 48000, 192000]) {
    for (const pitch of [110, 440, 880, 1760]) {
      const modes = marimba.modeData(pitch, .65, 1, sampleRate);
      assert.ok(modes.every(mode => mode.hz < sampleRate / 2 && mode.hz < marimba.MAX_MODE_HZ));
      assert.ok(modes.every(mode => mode.weight > 0 && Number.isFinite(mode.weight)));
    }
  }
  assert.deepEqual(marimba.modeData(440, .65, 1, 8000).map(mode => mode.ratio), [1, 4]);
  assert.ok(marimba.modeData(440, .65, 1, 48000).some(mode => mode.ratio === 10));
  const before = marimba.modeData(7499 / 10, .65, 1).find(mode => mode.ratio === 10);
  assert.ok(before.weight < 1e-6, "A departing mode is tapered almost to zero before removal");
  assert.ok(!marimba.modeData(7500 / 10, .65, 1).some(mode => mode.ratio === 10));
});

test("an actual low-rate marimba PCM render has no folded tenth-mode alias", () => {
  // 10 * 440 Hz would alias to 3600 Hz in an 8 kHz file if it were retained.
  const lowRate = transient.makeSamples("marimba", 440, .65, 8000, "medium", { velocity: 1 });
  const normalRate = transient.makeSamples("marimba", 440, .65, 16000, "medium", { velocity: 1 });
  const lowSpectrum = sourceAnalysis.spectrumAt(lowRate, 8000, .08, 1024);
  const normalSpectrum = sourceAnalysis.spectrumAt(normalRate, 16000, .08, 1024);
  assert.ok(band(normalSpectrum, 4400) > .02, "The normal-rate file retains the tenth mode");
  assert.ok(band(lowSpectrum, 3600) < 1e-5, "The unavailable mode does not fold into the lower-rate file");
  assert.ok(band(lowSpectrum, 440) > .3 && band(lowSpectrum, 1760) > .08,
    "Dropping the unavailable mode preserves the lower bar modes");
});

test("marimba 16 kHz analysis and normal playback evaluate precisely the same bandlimited sound", () => {
  for (const pitch of [110, 440, 1760]) {
    for (const time of [.0007, .0123, .086, .6, 2.48]) {
      const reference = marimba.sampleAt(time, pitch, .65, .62, 16000);
      assert.equal(marimba.sampleAt(time, pitch, .65, .62, 44100), reference);
      assert.equal(marimba.sampleAt(time, pitch, .65, .62, 48000), reference);
      assert.equal(marimba.sampleAt(time, pitch, .65, .62, 192000), reference);
    }
  }
});

test("marimba extremes of decay and sample rate stay bounded with a finite common tail", () => {
  for (const sampleRate of [8000, 44100]) {
    for (const decay of [marimba.MIN_DECAY, marimba.MAX_DECAY]) {
      for (const pitch of [marimba.MIN_HZ, marimba.MAX_HZ]) {
        const samples = transient.makeSamples("marimba", pitch, decay, sampleRate, "medium", { velocity: 1 });
        const stats = statistics(samples);
        assert.ok(stats.peak < .927 && Math.abs(stats.mean) < .001);
        assert.ok(Math.abs(samples.at(-1)) < .001);
        assert.ok(samples.length <= 3 * sampleRate);
      }
    }
  }
});
