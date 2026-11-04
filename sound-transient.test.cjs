"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const sound = require("./sound-transient.js");
const spectrum = require("./sound-spectrum.js");

test("pluck, kick and modeled piano are distinct bounded decaying mathematical signals", () => {
  for (const kind of sound.KINDS) {
    const decay = kind === "pluck" ? 0.65 : 0.3;
    assert.equal(sound.sampleAt(kind, 0, 220, decay), 0);
    assert.ok(sound.envelope(kind, 0.01, decay) > sound.envelope(kind, 1, decay));
    assert.equal(sound.plottedEnvelope(kind, sound.duration(decay), decay), 0);
    const samples = sound.makeSamples(kind, 220, decay, 16000);
    assert.ok(samples.length > 10000);
    assert.ok(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1));
    assert.ok(Math.abs(samples.at(-1)) < 0.001, "Output fades at the end");
  }
  assert.notEqual(sound.sampleAt("pluck", 0.012, 220, 0.65), sound.sampleAt("kick", 0.012, 220, 0.65));
  assert.notEqual(sound.sampleAt("piano", 0.012, 220, 0.65), sound.sampleAt("pluck", 0.012, 220, 0.65));
});

test("membrane fundamentals depend on size and the square root of tension", () => {
  assert.equal(sound.kickFrequency(0), sound.kickFrequency(.3));
  assert.ok(Math.abs(sound.kickFrequency(0) - 112) < 0.1);
  assert.ok(Math.abs(sound.kickFrequency(0, "medium", 2) / sound.kickFrequency(0) - Math.sqrt(2)) < 1e-9);
  const modes = sound.drumModeFrequencies("medium");
  assert.equal(modes.length, 8);
  assert.ok(modes[1] > 1.5 * modes[0] && modes[1] < 1.7 * modes[0]);
  assert.ok(modes[2] > 2.1 * modes[0] && modes[2] < 2.2 * modes[0]);
  for (const hz of [110, 220, 440, 880]) {
    assert.ok(Math.abs(sound.sliderToHz(sound.hzToSlider(hz)) - hz) < 1e-7);
  }
});

test("six percussion families share bounded playback/plot samples and distinct frequency responses", () => {
  assert.deepEqual(sound.DRUM_VOICES, ["membrane", "snare", "cymbal", "steelpan", "chimes", "woodblock"]);
  assert.equal(sound.drumReferenceHz("medium", 1, "cymbal"), null);
  assert.ok(Math.abs(sound.drumReferenceHz("medium", 1, "chimes") - 659.25) < .02);
  assert.equal(sound.drumReferenceHz("small", 1, "woodblock"), null);
  assert.ok(Math.abs(sound.drumReferenceHz("large", 1, "steelpan") - 261.6256) < .001);
  assert.ok(Math.abs(sound.drumReferenceHz("medium", 1, "steelpan") - 329.6276) < .001);
  assert.ok(Math.abs(sound.drumReferenceHz("small", 1, "steelpan") - 391.9954) < .001);
  assert.ok(sound.drumReferenceHz("small", 1.5, "snare") >
    sound.drumReferenceHz("large", 1.5, "snare"));
  const sampleRate = 16000;
  const signatures = [];
  for (const voice of sound.DRUM_VOICES) {
    const decay = { membrane: .3, snare: .33, cymbal: .55, steelpan: .8,
      chimes: .7, woodblock: .24 }[voice];
    for (const size of Object.keys(sound.KICK_SIZES)) {
      const options = { drumVoice: voice, drumTension: 1 };
      const samples = sound.makeSamples("kick", 220, decay, sampleRate, size, options);
      assert.ok(samples.length >= 5000);
      assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1),
        voice + "/" + size + " is safe in a four-voice percussion mix");
      assert.ok(Math.abs(samples.at(-1)) < .001, "Every hit has a silent end");
      for (const index of [100, 330, 2400, 6000]) {
        assert.ok(Math.abs(samples[index] -
          sound.plottedSampleAt("kick", index / sampleRate, 220, decay, size, options)) < 1e-6,
        "Playback and zoomed plot sample exactly the same modeled sound");
      }
      const max = Math.max(...samples.slice(0, 1000).map(Math.abs));
      assert.ok(max > .03, "New voices remain audible at normal strength");
      if (size === "medium") signatures.push([samples[277], samples[1111], samples[4444]].join("|"));
    }
  }
  assert.equal(new Set(signatures).size, 6, "All six families have distinct waveforms");
  const pan = spectrum.spectrumAt(sound, { kind: "kick", pitchHz: 220, decaySec: .8,
    kickSize: "medium", options: { drumVoice: "steelpan" } }, .1);
  assert.ok(pan.magnitudes[Math.round(sound.STEELPAN_PITCHES.medium / pan.binHz)] > .1,
    "Steel pan produces a pitched Fourier component");
});

test("large membrane adds audible beater/body presence without clipping", () => {
  const energyAbove300Hz = size => {
    const spec = spectrum.spectrumAt(sound, { kind: "kick", pitchHz: 220,
      decaySec: .3, kickSize: size, options: { drumVoice: "membrane" } }, .027);
    return spec.magnitudes.reduce((energy, magnitude, i) =>
      energy + (i * spec.binHz >= 300 && i * spec.binHz <= 1800 ? magnitude ** 2 : 0), 0);
  };
  assert.ok(energyAbove300Hz("large") > 2 * energyAbove300Hz("medium"),
    "Beater gives the bass drum an audible upper-frequency attack for small speakers");
  for (const size of ["large", "medium", "small"]) {
    const samples = sound.makeSamples("kick", 220, .3, 48000, size);
    assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
  }
});

test("struck chimes have definite pitches and long metallic resonance unlike woodblocks", () => {
  const rate = 16000;
  const rms = (samples, start, end) => {
    let energy = 0, count = 0;
    for (let i = Math.floor(start * rate); i < Math.floor(end * rate); i++) {
      energy += samples[i] ** 2;
      count++;
    }
    return Math.sqrt(energy / count);
  };
  const low = sound.makeSamples("kick", 220, .7, rate, "large", { drumVoice: "chimes" });
  const high = sound.makeSamples("kick", 220, .7, rate, "small", { drumVoice: "chimes" });
  const chosen = sound.makeSamples("kick", 220, .7, rate, "medium", { drumVoice: "chimes", chimeHz: 440 });
  const block = sound.makeSamples("kick", 220, .24, rate, "medium", { drumVoice: "woodblock" });
  assert.notDeepEqual([...low.slice(150, 160)], [...high.slice(150, 160)],
    "Different chime bars have distinct tonal waveforms");
  assert.notDeepEqual([...chosen.slice(150, 160)], [...high.slice(150, 160)],
    "Compose can choose any supported chime pitch");
  assert.ok(rms(block, 0, .02) > 3 * rms(block, .12, .16),
    "Woodblock has a dry transient rather than sustained metallic ringing");
  assert.ok(rms(high, .24, .34) > 2 * rms(block, .24, .34),
    "Struck metal continues ringing after a woodblock fades");
});

test("invalid or unbounded transient recipes are rejected", () => {
  assert.throws(() => sound.makeSamples("other", 220, 0.5, 44100), RangeError);
  assert.throws(() => sound.makeSamples("pluck", 2000, 0.5, 44100), RangeError);
  assert.throws(() => sound.makeSamples("piano", 2000, 0.5, 44100), RangeError);
  assert.throws(() => sound.makeSamples("pluck", 220, 10, 44100), RangeError);
  assert.throws(() => sound.makeSamples("kick", 220, 0.3, 0), RangeError);
  assert.throws(() => sound.makeSamples("kick", 220, 0.3, 44100, "giant"), RangeError);
  assert.throws(() => sound.makeSamples("kick", 220, .3, 44100, "medium", { drumTension: 3 }), RangeError);
  assert.throws(() => sound.makeSamples("kick", 220, .3, 44100, "medium", { drumVoice: "timpani" }), RangeError);
  assert.throws(() => sound.makeSamples("pluck", 220, .3, 44100, "medium", { strumChord: "other" }), RangeError);
  assert.throws(() => sound.makeSamples("pluck", 220, .3, 44100, "medium", { strumChord: "am", strumPattern: "wrong" }), RangeError);
  assert.throws(() => sound.makeSamples("piano", 440, .3, 44100, "medium", { velocity: 1.1 }), RangeError);
  assert.throws(() => sound.makeSamples("piano", 440, .3, 44100, "medium", { velocity: NaN }), RangeError);
  assert.throws(() => sound.makeSamples("piano", 440, .3, 44100, "medium", { touch: "unknown" }), RangeError);
  assert.ok(sound.duration(sound.MAX_DECAY) <= 3);
});

test("modeled piano overtones are slightly inharmonic, unlike an ideal string", () => {
  assert.ok(sound.pianoPartialHz(440, 2) > 880);
  assert.ok(sound.pianoPartialHz(440, 8) > 3520);
  assert.ok(sound.pianoPartialHz(440, 8) < 3600);
  assert.throws(() => sound.pianoPartialHz(0, 3), RangeError);
  const t = 0.013, sr = 16000;
  const samples = sound.makeSamples("piano", 440, .65, sr);
  assert.ok(Math.abs(samples[Math.round(t * sr)] -
    sound.plottedSampleAt("piano", t, 440, .65)) < 1e-6);
});

test("pluck and hammer share decay controls but have measurably different early harmonic spectra", () => {
  const pitchHz = 440, decaySec = .65;
  const at = kind => spectrum.spectrumAt(sound, { kind, pitchHz, decaySec }, .03);
  const pluck = at("pluck"), piano = at("piano");
  const partial = (result, n) => result.magnitudes[Math.round(n * pitchHz / result.binHz)];
  assert.ok(partial(piano, 2) / partial(piano, 1) >
    1.2 * partial(pluck, 2) / partial(pluck, 1),
  "Hammered preset has a stronger second partial relative to its fundamental");
  assert.ok(partial(piano, 3) > partial(pluck, 3) * 1.3,
    "The third partial is audibly more prominent early in the piano model");
  // Both notes freely vibrate after the hammer/pluck event; neither is simply
  // forced silent at an arbitrary fixed note duration.
  for (const kind of ["pluck", "piano"]) {
    let energy = 0;
    for (let i = 0; i < 480; i++) {
      const sample = sound.sampleAt(kind, .4 + i / 16000, pitchHz, decaySec);
      energy += sample * sample;
    }
    assert.ok(energy > .01, kind + " still vibrates long after the initial excitation");
  }
});

test("hammer strength changes piano timbre, not just loudness, and the note decays in two stages", () => {
  const pitchHz = 440, decaySec = .8;
  const at = velocity => spectrum.spectrumAt(sound,
    { kind: "piano", pitchHz, decaySec, options: { velocity } }, .03);
  const soft = at(.2), hard = at(1);
  const magnitude = (spec, n) => spec.magnitudes[Math.round(n * pitchHz / spec.binHz)];
  const brightness = spec => [4, 5, 6].reduce((sum, n) => sum + magnitude(spec, n), 0) /
    magnitude(spec, 1);
  assert.ok(brightness(hard) > 2 * brightness(soft),
    "A harder felt-hammer strike excites much more high-frequency energy");
  const earlyRate = -Math.log(sound.envelope("piano", .24, decaySec) /
    sound.envelope("piano", .08, decaySec)) / .16;
  const lateRate = -Math.log(sound.envelope("piano", 1.2, decaySec) /
    sound.envelope("piano", .7, decaySec)) / .5;
  assert.ok(earlyRate > 1.5 * lateRate,
    "Piano notes fade quickly after the attack, then ring more slowly");

  for (const velocity of [0, .2, .55, 1]) {
    const sampleRate = 16000;
    const audio = sound.makeSamples("piano", pitchHz, decaySec, sampleRate,
      "medium", { velocity });
    for (const index of [50, 500, 5000, 13000]) {
      const modeled = sound.plottedSampleAt("piano", index / sampleRate,
        pitchHz, decaySec, "medium", { velocity });
      assert.ok(Math.abs(audio[index] - modeled) < 1e-6,
        "Zoom, spectrum and audio must sample the same velocity-dependent note");
    }
    assert.ok(audio.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
  }
});

test("piano late decay retains its fundamental across notes and strike strengths", () => {
  const partial = (result, pitch, number) => {
    const index = Math.round(sound.pianoPartialHz(pitch, number) / result.binHz);
    return Math.max(...result.magnitudes.slice(index - 1, index + 2));
  };
  for (const pitch of [110, 220, 284.5, 440, 660, 880]) {
    for (const velocity of [.2, .55, 1]) {
      for (const time of [.5, 1.5, 2, 2.5]) {
        const result = spectrum.spectrumAt(sound,
          { kind: "piano", pitchHz: pitch, decaySec: .8, options: { velocity } }, time);
        const fundamental = partial(result, pitch, 1);
        const loudestOvertone = Math.max(...[2, 3, 4, 5, 6]
          .filter(n => sound.pianoPartialHz(pitch, n) < 7900)
          .map(n => partial(result, pitch, n)));
        assert.ok(loudestOvertone < .85 * fundamental,
          `${pitch} Hz at ${time}s, velocity ${velocity}: fundamental must survive unison beating`);
      }
    }
  }
});

test("tapping is a quieter, shorter piano touch with a continuous damper envelope", () => {
  assert.deepEqual(sound.PIANO_TOUCHES, ["press", "tap"]);
  const pitch = 284.5, decay = .8, velocity = .8, sampleRate = 16000;
  const pressOptions = { velocity, touch: "press" };
  const tapOptions = { velocity, touch: "tap" };
  const press = sound.makeSamples("piano", pitch, decay, sampleRate, "medium", pressOptions);
  const tap = sound.makeSamples("piano", pitch, decay, sampleRate, "medium", tapOptions);
  const rms = (samples, start, length = 800) => {
    const from = Math.round(start * sampleRate);
    let energy = 0;
    for (let i = from; i < from + length; i++) energy += samples[i] ** 2;
    return Math.sqrt(energy / length);
  };
  assert.ok(rms(tap, .04) < rms(press, .04), "A tap strikes more softly");
  assert.ok(rms(tap, .5) < .03 * rms(press, .5),
    "Short key hold allows the damper to stop the string early");
  assert.ok(Math.abs(sound.envelope("piano", .16 - 1e-7, decay, tapOptions) -
    sound.envelope("piano", .16 + 1e-7, decay, tapOptions)) < 1e-5,
  "Damper returns without an abrupt envelope jump");
  for (const options of [pressOptions, tapOptions]) {
    const samples = options.touch === "press" ? press : tap;
    for (const i of [80, 800, 2400, 6400, 12000]) {
      assert.ok(Math.abs(samples[i] - sound.plottedSampleAt("piano", i / sampleRate,
        pitch, decay, "medium", options)) < 1e-6,
      "Audio buffers and Fourier/wave plots must use the same piano touch");
    }
  }
});

test("kick-size presets change pitch and preserve modeled waveform/sample agreement", () => {
  assert.deepEqual(Object.keys(sound.KICK_SIZES), ["large", "medium", "small"]);
  assert.ok(sound.kickFrequency(0.02, "large") < sound.kickFrequency(0.02, "medium"));
  assert.ok(sound.kickFrequency(0.02, "medium") < sound.kickFrequency(0.02, "small"));
  const sampleRate = 16000, t = 0.016;
  for (const size of Object.keys(sound.KICK_SIZES)) {
    const samples = sound.makeSamples("kick", 220, 0.3, sampleRate, size);
    assert.ok(Math.abs(samples[Math.round(t * sampleRate)] -
      sound.plottedSampleAt("kick", t, 220, 0.3, size)) < 1e-6);
  }
  assert.equal(sound.plottedSampleAt("pluck", 3, 220, 0.65), 0);
});

test("one strum reuses the same plotted and audible wave, with chord-specific spectra", () => {
  const options = { strumChord: "em", position: .22 };
  const rate = 16000;
  const buffer = sound.makeSamples("pluck", 220, .65, rate, "medium", options);
  for (const index of [100, 400, 1200, 4000]) {
    assert.ok(Math.abs(buffer[index] - sound.plottedSampleAt("pluck", index / rate,
      220, .65, "medium", options)) < 1e-6);
  }
  assert.notEqual(sound.sampleAt("pluck", .1, 220, .65, "medium", options),
    sound.sampleAt("pluck", .1, 220, .65));
});
