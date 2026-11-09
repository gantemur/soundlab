"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const xylo = require("./sound-xylophone.js");
const marimba = require("./sound-marimba.js");
const transient = require("./sound-transient.js");
const spectrum = require("./sound-spectrum.js");
const analysis = require("./sound-analysis-dsp.js");

function stats(samples) {
  let peak = 0, energy = 0, dc = 0;
  for (const x of samples) {
    assert.ok(Number.isFinite(x), "Every PCM sample is finite");
    peak = Math.max(peak, Math.abs(x));
    energy += x * x;
    dc += x;
  }
  return { peak, rms: Math.sqrt(energy / samples.length), dc: dc / samples.length };
}

function band(result, hz) {
  const bin = Math.round(hz / result.binHz);
  return Math.max(...result.magnitudes.slice(Math.max(0, bin - 1), bin + 2));
}

function xyloFrame(pitchHz, velocity, time = .025) {
  return spectrum.spectrumAt(transient, {
    kind: "xylophone", pitchHz, decaySec: .32, options: { velocity }
  }, time);
}

test("xylophone is an independently bounded hard-struck bar with a shorter tail", () => {
  assert.equal(xylo.MIN_HZ, 261.6255);
  assert.equal(xylo.MAX_HZ, 2093.005);
  assert.equal(xylo.DEFAULT_DECAY, .32);
  assert.equal(xylo.DEFAULT_VELOCITY, .66);
  assert.deepEqual(xylo.MODE_RATIOS.slice(0, 3), [1, 3, 6.16]);
  assert.notDeepEqual(xylo.MODE_RATIOS.slice(0, 3), marimba.MODE_RATIOS.slice(0, 3));
  assert.ok(transient.duration(xylo.DEFAULT_DECAY) < transient.duration(marimba.DEFAULT_DECAY));
  const modes = xylo.modeData(400, .32, 1);
  assert.ok(Object.isFrozen(modes) && modes.every(Object.isFrozen));
  assert.deepEqual(modes.slice(0, 3).map(mode => mode.hz), [400, 1200, 2464]);
  assert.ok(modes.every((mode, i) => !i || mode.decaySec < modes[i - 1].decaySec));
});

test("xylophone rejects invalid pitch, strength, decay, rate or time", () => {
  for (const pitch of [NaN, Infinity, -Infinity, 19.999, 5000.001]) {
    assert.throws(() => xylo.sampleAt(.01, pitch), RangeError);
  }
  for (const decay of [NaN, Infinity, -.1, 0, .1199, 1.2001]) {
    assert.throws(() => xylo.sampleAt(.01, 523.251131, decay), RangeError);
  }
  for (const velocity of [NaN, Infinity, -.01, 1.01, "0.66", null]) {
    assert.equal(xylo.validVelocity(velocity), false);
    assert.throws(() => xylo.sampleAt(.01, 523.251131, .32, velocity), RangeError);
  }
  for (const rate of [NaN, Infinity, 7999, 192001]) {
    assert.throws(() => xylo.sampleAt(.01, 523.251131, .32, .66, rate), RangeError);
  }
  for (const time of [NaN, Infinity, -Infinity]) {
    assert.throws(() => xylo.sampleAt(time, 523.251131), RangeError);
    assert.throws(() => xylo.envelope(time), RangeError);
  }
  for (const pitch of [20, xylo.MIN_HZ, xylo.MAX_HZ, 5000]) {
    for (const rate of [8000, 192000]) {
      assert.doesNotThrow(() => xylo.validate(pitch, .32, .66, rate));
    }
  }
});

test("xylophone is stateless, deterministic and silent at zero strength", () => {
  for (const time of [0, .0001, .01, .1, .7, 1.3]) {
    assert.equal(xylo.sampleAt(time, 523.251131),
      xylo.sampleAt(time, 523.251131, .32, .66, 48000));
    assert.equal(xylo.sampleAt(time, 523.251131, .32, 0), 0);
    assert.equal(xylo.envelope(time, .32, 0), 0);
  }
  assert.equal(xylo.sampleAt(-1, 523.251131), 0);
  assert.equal(xylo.sampleAt(3, 523.251131), 0);
  const before = transient.makeSamples("xylophone", 523.251131, .32, 16000);
  transient.makeSamples("xylophone", 900, .12, 8000, "medium", { velocity: 1 });
  const after = transient.makeSamples("xylophone", 523.251131, .32, 16000);
  assert.deepEqual(before, after);
});

for (const pitch of [xylo.MIN_HZ, 523.251131, xylo.MAX_HZ]) {
  for (const velocity of [.2, .66, 1]) {
    test(`xylophone ${pitch} Hz, strength ${velocity}: bounded and finite ending`, () => {
      const sampleRate = 44100;
      const pcm = transient.makeSamples("xylophone", pitch, .32, sampleRate, "medium", { velocity });
      const { peak, rms, dc } = stats(pcm);
      assert.equal(pcm.length, Math.ceil(sampleRate * transient.duration(.32)));
      assert.ok(peak > .015 && peak < .89, "Bounded audible output");
      assert.ok(rms > .002 && rms < .28, "Healthy but not full-scale average");
      assert.ok(Math.abs(dc) < .001, "No material DC component");
      assert.equal(pcm[0], 0);
      assert.ok(Math.abs(pcm.at(-1)) < .001, "Short finite ring fades out");
      const early = stats(pcm.slice(Math.round(.003 * sampleRate), Math.round(.06 * sampleRate)));
      const late = stats(pcm.slice(Math.round(.6 * sampleRate), Math.round(.85 * sampleRate)));
      assert.ok(early.rms > late.rms * 7, "Decaying strike, not sustained oscillator");
    });
  }
}

test("strike strength changes relative brightness as well as amplitude", () => {
  const quiet = xyloFrame(400, .2), loud = xyloFrame(400, 1);
  const overtone = s => band(s, 1200) / band(s, 400);
  assert.ok(band(loud, 400) > band(quiet, 400));
  assert.ok(overtone(loud) > 3 * overtone(quiet));
  assert.ok(band(loud, 2464) / band(loud, 400) >
    4 * band(quiet, 2464) / band(quiet, 400));
});

test("higher xylophone modes decay faster than the fundamental", () => {
  const early = xyloFrame(400, .66, .018), later = xyloFrame(400, .66, .18);
  const third = s => band(s, 1200) / band(s, 400);
  const sixth = s => band(s, 2464) / band(s, 400);
  assert.ok(third(early) > third(later) * 2);
  assert.ok(sixth(early) > sixth(later) * 5);
});

test("xylophone modes are not the marimba's fourth, piano's second or chimes' 2.76", () => {
  const xy = xyloFrame(400, 1);
  const ma = spectrum.spectrumAt(transient, {
    kind: "marimba", pitchHz: 400, decaySec: .65, options: { velocity: 1 }
  }, .025);
  const piano = spectrum.spectrumAt(transient, {
    kind: "piano", pitchHz: 400, decaySec: .65, options: { velocity: .66 }
  }, .025);
  const chime = spectrum.spectrumAt(transient, {
    kind: "kick", pitchHz: 400, decaySec: .65,
    options: { drumVoice: "chimes", chimeHz: 400 }
  }, .025);
  assert.ok(band(xy, 1200) > band(ma, 1200) * 10, "Xylophone three-times mode");
  assert.ok(band(ma, 1600) > band(xy, 1600) * 10, "Marimba four-times mode");
  assert.ok(band(piano, 800) > band(xy, 800) * 10, "Piano near-harmonic second");
  assert.ok(band(chime, 1104) > band(xy, 1104) * 10, "Chime has distinct inharmonic mode");
});

test("sample-rate-aware taper removes modes before Nyquist", () => {
  for (const sampleRate of [8000, 11025, 16000, 44100, 48000, 192000]) {
    for (const pitch of [xylo.MIN_HZ, 440, 880, xylo.MAX_HZ]) {
      const modes = xylo.modeData(pitch, .32, 1, sampleRate);
      assert.ok(modes.every(mode => mode.hz < sampleRate / 2 && mode.hz < xylo.MAX_MODE_HZ));
      assert.ok(modes.every(mode => mode.weight > 0 && Number.isFinite(mode.weight)));
    }
  }
  assert.deepEqual(xylo.modeData(700, .32, 1, 8000).map(mode => mode.ratio), [1, 3]);
  assert.ok(xylo.modeData(700, .32, 1, 16000).some(mode => mode.ratio === 6.16));
  assert.ok(!xylo.modeData(7500 / 6.16, .32, 1).some(mode => mode.ratio === 6.16));
});

test("low-rate WAV samples cannot fold the removed sixth mode into the audible band", () => {
  const low = transient.makeSamples("xylophone", 700, .32, 8000, "medium", { velocity: 1 });
  const reference = transient.makeSamples("xylophone", 700, .32, 16000, "medium", { velocity: 1 });
  const lowFFT = analysis.spectrumAt(low, 8000, .04, 4096);
  const normalFFT = analysis.spectrumAt(reference, 16000, .04, 4096);
  assert.ok(band(normalFFT, 4312) > .005, "The sixth mode is present at 16 kHz");
  assert.ok(band(lowFFT, 3688) < .0001, "No alias of the suppressed 4,312 Hz mode at 8 kHz");
  assert.ok(band(lowFFT, 700) > .1);
});

test("16 kHz explorer and common browser sample rates share one model", () => {
  for (const pitch of [xylo.MIN_HZ, 523.251131, xylo.MAX_HZ]) {
    for (const time of [.0007, .0123, .086, .6, 1.27]) {
      const reference = xylo.sampleAt(time, pitch, .32, .66, 16000);
      for (const rate of [44100, 48000, 192000]) {
        assert.equal(xylo.sampleAt(time, pitch, .32, .66, rate), reference);
      }
    }
  }
});

test("extreme decay and sample-rate combinations stay within common sample and memory bounds", () => {
  for (const rate of [8000, 44100]) {
    for (const decay of [xylo.MIN_DECAY, xylo.MAX_DECAY]) {
      for (const pitch of [xylo.MIN_HZ, xylo.MAX_HZ]) {
        const pcm = transient.makeSamples("xylophone", pitch, decay, rate, "medium", { velocity: 1 });
        const data = stats(pcm);
        assert.ok(data.peak < .89 && Math.abs(data.dc) < .001);
        assert.ok(Math.abs(pcm.at(-1)) < .001);
        assert.ok(pcm.length <= 3 * rate);
      }
    }
  }
});
