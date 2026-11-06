"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sound = require("./sound-sustain.js");

test("held instrument recipes are valid and spectrally distinct", () => {
  assert.deepEqual(sound.KINDS, ["flute", "clarinet", "violin", "morin"]);
  for (const kind of sound.KINDS) {
    const defaults = sound.defaults(kind);
    sound.validate(kind, 220, defaults.attack, defaults.release);
    assert.equal(sound.partials(kind).length, kind === "flute" ? 8 :
      kind === "clarinet" ? sound.clarinet.PARTIALS : sound.BOW_PARTIALS);
    assert.ok(defaults.noise > 0 && defaults.noise < .04);
    let peak = 0;
    for (let n = 0; n < 2048; n++) {
      const sample = sound.waveAt(2 * Math.PI * n / 2048, kind);
      peak = Math.max(peak, Math.abs(sample));
    }
    if (kind === "flute") {
      assert.ok(peak > .7 && peak < 1, "default flute includes its actual breath-driven amplitude");
    } else if (kind === "clarinet") {
      assert.ok(peak > .35 && peak < 1, "default clarinet level remains bounded");
    } else assert.ok(peak > .6 && peak < 1, kind + " default bowed level must remain bounded");
  }
  assert.ok(sound.partials("violin")[1] / sound.partials("violin")[0] >
    3 * sound.partials("flute")[1] / sound.partials("flute")[0],
  "bowed violin's second harmonic is much stronger relative to its fundamental than flute's");
  assert.ok(sound.partials("morin")[1] > sound.partials("violin")[1],
    "the morin-khuur-inspired model highlights its lower harmonics");
  assert.ok(sound.partials("morin")[4] < sound.partials("violin")[4] * .2,
    "the morin-khuur-inspired body is darker at the fifth harmonic");
  assert.notEqual(sound.waveAt(.43, "violin"), sound.waveAt(.43, "morin"));
});

test("flute jet model grows from silence, responds to blowing and respects the pitch range", () => {
  assert.equal(sound.fluteDrive(0), 0);
  assert.equal(sound.fluteNoiseGain(0), 0);
  assert.deepEqual(sound.partials("flute", 0), Array(8).fill(0));
  assert.equal(sound.waveAt(1.8, "flute", 0), 0);
  assert.equal(sound.fluteJetAt(0), 0);
  for (const breath of [10, 20, 40, 60, 80, 100]) {
    assert.ok(sound.fluteDrive(breath) > 0 && sound.fluteDrive(breath) <= .95);
    assert.ok(sound.fluteNoiseGain(breath) > 0 && sound.fluteNoiseGain(breath) < .03);
    const components = sound.fluteComponents(breath, 440);
    assert.equal(components.length, 8);
    const magnitudes = sound.partials("flute", breath, 440);
    assert.ok(magnitudes[0] > magnitudes[1] && magnitudes[1] > magnitudes[2],
      "a flute-like sound retains a dominant fundamental");
    for (let j = 0; j < 8; j++) {
      assert.ok(Math.abs(Math.hypot(components[j].sin, components[j].cos) - magnitudes[j]) < 1e-12);
    }
  }
  const gentle = sound.partials("flute", 20, 440);
  const strong = sound.partials("flute", 100, 440);
  assert.ok(strong[0] > gentle[0] * 2);
  assert.ok(strong[1] / strong[0] > 2.5 * gentle[1] / gentle[0],
    "blowing harder should increase relative upper-harmonic strength");
  assert.ok(sound.partials("flute", 100, 880)[4] < sound.partials("flute", 100, 220)[4],
    "the fixed air-column filter attenuates high-frequency partials");
  assert.throws(() => sound.fluteDrive(-1), RangeError);
  assert.throws(() => sound.fluteDrive(101), RangeError);
  assert.throws(() => sound.fluteJetAt(NaN), RangeError);
  assert.throws(() => sound.fluteComponents(60, 2000), RangeError);
});

test("flute breath turbulence stays far below the musical fundamental", () => {
  // The generated noise is bounded by +/-0.7 * noiseGain before the low-pass.
  // Compare this deliberately conservative bound to the modeled fundamental,
  // over the whole pitch range and gentle/default/strong blowing conditions.
  for (const hz of [110, 220, 440, 880]) {
    for (const breath of [10, 20, 60, 100]) {
      const fundamental = sound.partials("flute", breath, hz)[0];
      const maximumUnfilteredNoise = 0.7 * sound.fluteNoiseGain(breath);
      assert.ok(maximumUnfilteredNoise / fundamental < .003,
        `flute breath noise must be subtle at ${hz} Hz, blowing ${breath}%`);
    }
  }
});

test("flute's plotted periodic waveform has exactly its predicted harmonic magnitudes", () => {
  const count = 2048;
  for (const breath of [20, 60, 100]) {
    const components = sound.fluteComponents(breath, 440);
    const expected = sound.partials("flute", breath, 440);
    const samples = Array.from({ length: count }, (_, i) =>
      sound.fluteWaveFromComponents(2 * Math.PI * i / count, components));
    for (const harmonic of [1, 2, 3, 4, 5, 8]) {
      let sine = 0, cosine = 0;
      for (let i = 0; i < count; i++) {
        const angle = 2 * Math.PI * harmonic * i / count;
        sine += samples[i] * Math.sin(angle);
        cosine += samples[i] * Math.cos(angle);
      }
      const measured = 2 * Math.hypot(sine, cosine) / count;
      assert.ok(Math.abs(measured - expected[harmonic - 1]) < 1e-10,
        `breath ${breath}, harmonic ${harmonic}: ${measured} vs ${expected[harmonic - 1]}`);
    }
  }
});

test("flute spectral prediction agrees with an independently rendered jet and biquad signal", () => {
  // Verify the analytic phases/amplitudes against a sample-by-sample difference
  // equation, independently of fluteComponents and fluteWaveFromComponents.
  const sampleRate = 48000, hz = 440, count = 48000, window = 12000;
  function filter(input, type, cutoff) {
    const theta = 2 * Math.PI * cutoff / sampleRate;
    const c = Math.cos(theta), alpha = Math.sin(theta) / (2 * Math.SQRT1_2);
    const a0 = 1 + alpha, a1 = -2 * c, a2 = 1 - alpha;
    const b0 = (type === "highpass" ? 1 + c : 1 - c) / 2;
    const b1 = type === "highpass" ? -(1 + c) : 1 - c;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const output = new Float64Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const y = (b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0;
      output[i] = y;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
    }
    return output;
  }
  for (const breath of [20, 60, 100]) {
    const drive = sound.fluteDrive(breath);
    const jet = Float64Array.from({ length: count }, (_, i) =>
      sound.fluteJetAt(drive * Math.sin(2 * Math.PI * hz * i / sampleRate)));
    const hp = filter(jet, "highpass", sound.FLUTE_HIGHPASS);
    const output = filter(hp, "lowpass", sound.FLUTE_LOWPASS);
    const expected = sound.fluteComponents(breath, hz, sampleRate);
    for (const harmonic of [1, 2, 3, 5]) {
      let sine = 0, cosine = 0;
      for (let i = count - window; i < count; i++) {
        const theta = 2 * Math.PI * hz * harmonic * i / sampleRate;
        sine += output[i] * Math.sin(theta);
        cosine += output[i] * Math.cos(theta);
      }
      sine *= 2 * sound.FLUTE_TONE_GAIN / window;
      cosine *= 2 * sound.FLUTE_TONE_GAIN / window;
      assert.ok(Math.abs(sine - expected[harmonic - 1].sin) < 1e-5,
        `sine component ${harmonic} at blowing ${breath}`);
      assert.ok(Math.abs(cosine - expected[harmonic - 1].cos) < 1e-5,
        `cosine component ${harmonic} at blowing ${breath}`);
    }
  }
});

test("bow pressure changes a bounded stick/slip source while preserving pitch and silencing zero", () => {
  assert.equal(sound.DEFAULT_BOW_PRESSURE, 60);
  assert.deepEqual(sound.bowPressureWeights(0), { soft: 0, hard: 0 });
  assert.equal(sound.bowNoiseGain("violin", 0), 0);
  assert.equal(sound.bowNoiseGain("morin", 0), 0);
  for (const kind of ["violin", "morin"]) {
    assert.equal(sound.partials(kind, 0, 440).length, sound.BOW_PARTIALS);
    assert.ok(sound.partials(kind, 0, 440).every(value => value === 0));
    for (const hz of [110, 220, 440, 880]) {
      for (const pressure of [20, 60, 100]) {
        const components = sound.bowedComponents(kind, pressure, hz);
        const magnitudes = sound.partials(kind, pressure, hz);
        let peak = 0;
        for (let i = 0; i < 512; i++) {
          peak = Math.max(peak, Math.abs(sound.bowedWaveFromComponents(2 * Math.PI * i / 512, components)));
        }
        assert.ok(peak > 0 && peak < 1.15, `${kind} must remain bounded at ${hz} Hz, ${pressure}%`);
        assert.ok(Math.abs(magnitudes[0] - Math.hypot(components[0].sin, components[0].cos)) < 1e-12);
        assert.ok(sound.bowNoiseGain(kind, pressure) * .7 / magnitudes[0] < .015,
          "unpitched bow texture is substantially quieter than the musical fundamental");
      }
      const weak = sound.partials(kind, 20, hz);
      const strong = sound.partials(kind, 100, hz);
      assert.ok(strong[0] > weak[0] * 2);
      assert.ok(strong[4] / strong[0] > weak[4] / weak[0] * 2,
        "sharper slip should enrich the fifth harmonic under strong bowing");
    }
  }
  assert.throws(() => sound.bowPressureWeights(-1), RangeError);
  assert.throws(() => sound.bowPressureWeights(101), RangeError);
  assert.throws(() => sound.bowNoiseGain("flute", 40), RangeError);
  assert.throws(() => sound.bowSourceComponents("violin", "unknown"), RangeError);
  assert.throws(() => sound.bowedComponents("morin", 60, 2000), RangeError);
});

test("bowed waveform and 24 harmonic bars describe the same periodic tone", () => {
  const count = 4096;
  for (const kind of ["violin", "morin"]) {
    for (const pressure of [20, 60, 100]) {
      const components = sound.bowedComponents(kind, pressure, 440);
      const expected = sound.partials(kind, pressure, 440);
      const samples = Float64Array.from({ length: count }, (_, i) =>
        sound.bowedWaveFromComponents(2 * Math.PI * i / count, components));
      for (const harmonic of [1, 2, 5, 8, 16, 24]) {
        let sine = 0, cosine = 0;
        for (let i = 0; i < count; i++) {
          const angle = 2 * Math.PI * harmonic * i / count;
          sine += samples[i] * Math.sin(angle);
          cosine += samples[i] * Math.cos(angle);
        }
        const measured = 2 * Math.hypot(sine, cosine) / count;
        assert.ok(Math.abs(measured - expected[harmonic - 1]) < 1e-10,
          `${kind}, pressure ${pressure}, harmonic ${harmonic}`);
      }
    }
  }
});

test("bowed body-filter prediction agrees with independently implemented biquads", () => {
  const sampleRate = 48000, hz = 440, count = 48000, window = 12000;
  function filter(input, type, frequency, q, gainDb = 0) {
    const omega = 2 * Math.PI * frequency / sampleRate;
    const c = Math.cos(omega), alpha = Math.sin(omega) / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === "peaking") {
      const a = Math.pow(10, gainDb / 40);
      b0 = 1 + alpha * a; b1 = -2 * c; b2 = 1 - alpha * a;
      a0 = 1 + alpha / a; a1 = -2 * c; a2 = 1 - alpha / a;
    } else {
      b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0;
      a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    }
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const output = new Float64Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      output[i] = y;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
    }
    return output;
  }
  for (const kind of ["violin", "morin"]) {
    const soft = sound.bowSourceComponents(kind, "soft");
    const hard = sound.bowSourceComponents(kind, "hard");
    const weights = sound.bowPressureWeights(60);
    let rendered = Float64Array.from({ length: count }, (_, i) => {
      const phase = 2 * Math.PI * hz * i / sampleRate;
      let sample = 0;
      for (let j = 0; j < soft.length; j++) {
        const sin = weights.soft * soft[j].sin + weights.hard * hard[j].sin;
        const cos = weights.soft * soft[j].cos + weights.hard * hard[j].cos;
        sample += sin * Math.sin((j + 1) * phase) + cos * Math.cos((j + 1) * phase);
      }
      return sample;
    });
    const body = sound.bowBody(kind);
    for (const peak of body.peaks) {
      rendered = filter(rendered, "peaking", peak.frequency, peak.q, peak.gain);
    }
    rendered = filter(rendered, "lowpass", body.cutoff, sound.FLUTE_Q);
    const expected = sound.bowedComponents(kind, 60, hz, sampleRate);
    for (const harmonic of [1, 2, 5, 8]) {
      let sine = 0, cosine = 0;
      for (let i = count - window; i < count; i++) {
        const angle = 2 * Math.PI * harmonic * hz * i / sampleRate;
        sine += rendered[i] * Math.sin(angle);
        cosine += rendered[i] * Math.cos(angle);
      }
      sine *= 2 / window;
      cosine *= 2 / window;
      assert.ok(Math.abs(sine - expected[harmonic - 1].sin) < 2e-5,
        `${kind}, sine component ${harmonic}`);
      assert.ok(Math.abs(cosine - expected[harmonic - 1].cos) < 2e-5,
        `${kind}, cosine component ${harmonic}`);
    }
  }
});

test("attack, sustain and release curve stays continuous and bounded", () => {
  const attack = .24, release = .48, hold = 1.2;
  assert.equal(sound.envelopeAt(0, attack, release, hold), 0);
  assert.ok(sound.envelopeAt(.06, attack, release, hold) > 0);
  assert.equal(sound.envelopeAt(attack, attack, release, hold), 1);
  assert.equal(sound.envelopeAt(hold - .01, attack, release, hold), 1);
  assert.equal(sound.envelopeAt(hold, attack, release, hold), 1);
  assert.equal(sound.envelopeAt(hold + release / 2, attack, release, hold), .5);
  assert.equal(sound.envelopeAt(hold + release, attack, release, hold), 0);
  assert.equal(sound.envelopeAt(hold + release + 1, attack, release, hold), 0);
  for (let t = 0; t <= 3; t += .005) {
    assert.ok(sound.envelopeAt(t, attack, release, hold) >= 0);
    assert.ok(sound.envelopeAt(t, attack, release, hold) <= 1);
  }
  const earlyRelease = .04;
  assert.equal(sound.envelopeAt(earlyRelease, attack, release, earlyRelease),
    sound.attackLevelAt(earlyRelease, attack), "early release must begin at the current attack level");
  assert.equal(sound.envelopeAt(earlyRelease + release, attack, release, earlyRelease), 0);
});

test("pitch slider, bounds and invalid values are handled safely", () => {
  for (const hz of [110, 220, 440, 880]) {
    assert.ok(Math.abs(sound.sliderToHz(sound.hzToSlider(hz)) - hz) < 1e-9);
  }
  assert.throws(() => sound.validate("unknown", 220, .2, .3), RangeError);
  assert.throws(() => sound.validate("flute", 5000, .2, .3), RangeError);
  assert.throws(() => sound.validate("flute", 220, 0, .3), RangeError);
  assert.throws(() => sound.validate("flute", 220, .2, 5), RangeError);
  assert.throws(() => sound.waveAt(NaN, "violin"), RangeError);
  assert.throws(() => sound.partials("unknown"), RangeError);
  assert.throws(() => sound.envelopeAt(0, .2, .3, -1), RangeError);
});
