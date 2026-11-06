/* Held wind and bowed-string teaching models. The flute uses an illustrative
 * nonlinear jet exciter followed by two bore/radiation filters. The Fourier
 * components below predict that Web Audio path for the plotted periodic tone.
 * This is not a self-oscillating, jet/bore-feedback physical flute model.
 * Bowed strings use a smoothed Helmholtz-like stick/slip velocity surrogate
 * followed by illustrative bridge/body filters. Their pitch is imposed: no
 * nonlinear bow/string waveguide feedback is solved in this teaching model.
 */
(function (root, makeModel) {
  "use strict";
  const clarinet = typeof module === "object" && module.exports ?
    require("./sound-clarinet.js") : root.SoundLabClarinet;
  const model = makeModel(clarinet);
  if (typeof module === "object" && module.exports) module.exports = model;
  if (root) root.SoundLabSustain = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function (clarinet) {
  "use strict";

  if (!clarinet) throw new Error("Load sound-clarinet.js before sound-sustain.js");
  const KINDS = Object.freeze(["flute", "clarinet", "violin", "morin"]);
  const MIN_HZ = 110;
  const MAX_HZ = 880;
  const MIN_ATTACK = 0.02;
  const MAX_ATTACK = 0.6;
  const MIN_RELEASE = 0.04;
  const MAX_RELEASE = 1.2;
  const EXAMPLE_HOLD = 1.2;
  const BOW_PARTIALS = 24;
  const DEFAULT_BOW_PRESSURE = 60;
  const BOW = Object.freeze({
    violin: Object.freeze({
      slipFraction: .135, sourceGain: 1.03, softWidth: .05, hardWidth: .013,
      body: Object.freeze({ cutoff: 6200, peaks: Object.freeze([
        Object.freeze({ frequency: 420, q: 1.15, gain: 3.5 }),
        Object.freeze({ frequency: 2850, q: 1.05, gain: 4 })
      ]) })
    }),
    morin: Object.freeze({
      slipFraction: .19, sourceGain: 1.0, softWidth: .055, hardWidth: .017,
      // Illustrative body coloration, not a measured morin-khuur response.
      body: Object.freeze({ cutoff: 3600, peaks: Object.freeze([
        Object.freeze({ frequency: 310, q: .9, gain: 3.5 }),
        Object.freeze({ frequency: 1050, q: .75, gain: 2.5 })
      ]) })
    })
  });
  const DEFAULTS = Object.freeze({
    // Breath turbulence should be barely audible beside the radiated tone;
    // the earlier .016 mix sounded too hissy at ordinary listening distance.
    flute: Object.freeze({ attack: .08, release: .16, noise: .002, cutoff: 3600 }),
    clarinet: Object.freeze({ attack: .055, release: .19, noise: .006, cutoff: clarinet.BODY.noiseBandpass }),
    violin: Object.freeze({ attack: .18, release: .29, noise: .003, cutoff: 4600 }),
    morin: Object.freeze({ attack: .11, release: .32, noise: .0035, cutoff: 2600 })
  });
  const DEFAULT_BREATH = 60;
  const FLUTE_TONE_GAIN = 1.2;
  const FLUTE_HIGHPASS = 70;
  const FLUTE_LOWPASS = 3400;
  const FLUTE_Q = Math.SQRT1_2;
  const FLUTE_PLOT_SAMPLE_RATE = 48000;

  // The oscillator stands in for a periodic bore pressure. A smoothly driven
  // asymmetric polynomial represents jet-flow saturation, producing a 2f
  // component as well as weaker odd harmonics. No samples or STK code are used.
  function fluteDrive(breath = DEFAULT_BREATH) {
    if (!Number.isFinite(breath) || breath < 0 || breath > 100) {
      throw new RangeError("Blowing strength must be between 0 and 100");
    }
    return .95 * Math.pow(breath / 100, .65);
  }
  function fluteJetAt(x) {
    if (!Number.isFinite(x) || Math.abs(x) > 1.000001) throw new RangeError("Invalid jet input");
    const x2 = x * x;
    return x + .30 * x2 - .27 * x2 * x + .08 * x2 * x2 * x;
  }
  function fluteNoiseGain(breath = DEFAULT_BREATH) {
    fluteDrive(breath); // Validate, including the completely silent zero case.
    return DEFAULTS.flute.noise * Math.pow(breath / DEFAULT_BREATH, .8);
  }
  // Complex transfer function of Web Audio's standard RBJ biquad (Q=1/sqrt(2)).
  // Same coefficients as a lowpass/highpass BiquadFilterNode, up to Web Audio's
  // implementation and the audio device's sample rate.
  function biquadResponse(type, frequency, cutoff, sampleRate) {
    const omega = 2 * Math.PI * cutoff / sampleRate;
    const c = Math.cos(omega), alpha = Math.sin(omega) / (2 * FLUTE_Q);
    const b0 = (1 + (type === "highpass" ? c : -c)) / 2;
    const b1 = type === "highpass" ? -(1 + c) : 1 - c;
    const b2 = b0;
    const a0 = 1 + alpha, a1 = -2 * c, a2 = 1 - alpha;
    const angle = 2 * Math.PI * frequency / sampleRate;
    const br = b0 + b1 * Math.cos(angle) + b2 * Math.cos(2 * angle);
    const bi = -b1 * Math.sin(angle) - b2 * Math.sin(2 * angle);
    const ar = a0 + a1 * Math.cos(angle) + a2 * Math.cos(2 * angle);
    const ai = -a1 * Math.sin(angle) - a2 * Math.sin(2 * angle);
    const divisor = ar * ar + ai * ai;
    return { real: (br * ar + bi * ai) / divisor,
      imag: (bi * ar - br * ai) / divisor };
  }
  function fluteComponents(breath = DEFAULT_BREATH, hz = 440, sampleRate = FLUTE_PLOT_SAMPLE_RATE) {
    const a = fluteDrive(breath);
    if (!Number.isFinite(hz) || hz < MIN_HZ || hz > MAX_HZ ||
        !Number.isFinite(sampleRate) || sampleRate < 16000) {
      throw new RangeError("Invalid flute pitch or sample rate");
    }
    const a2 = a * a, a3 = a2 * a, a5 = a3 * a2;
    const sourceSin = [a - .2025 * a3 + .05 * a5, 0, .0675 * a3 - .025 * a5,
      0, .005 * a5, 0, 0, 0];
    const sourceCos = [0, -.15 * a2, 0, 0, 0, 0, 0, 0];
    return sourceSin.map((sin, index) => {
      const frequency = (index + 1) * hz;
      const hp = biquadResponse("highpass", frequency, FLUTE_HIGHPASS, sampleRate);
      const lp = biquadResponse("lowpass", frequency, FLUTE_LOWPASS, sampleRate);
      const real = hp.real * lp.real - hp.imag * lp.imag;
      const imag = hp.real * lp.imag + hp.imag * lp.real;
      const cos = sourceCos[index];
      return Object.freeze({ sin: FLUTE_TONE_GAIN * (sin * real - cos * imag),
        cos: FLUTE_TONE_GAIN * (sin * imag + cos * real) });
    });
  }
  function fluteWaveFromComponents(phase, components) {
    if (!Number.isFinite(phase) || !Array.isArray(components) || components.length !== 8) {
      throw new RangeError("Invalid flute phase or components");
    }
    return components.reduce((sum, c, index) =>
      sum + c.sin * Math.sin((index + 1) * phase) + c.cos * Math.cos((index + 1) * phase), 0);
  }
  function bowBody(kind) {
    if (!BOW[kind]) throw new RangeError("Unknown bowed-string model");
    return BOW[kind].body;
  }
  function bowPressureWeights(pressure = DEFAULT_BOW_PRESSURE) {
    if (!Number.isFinite(pressure) || pressure < 0 || pressure > 100) {
      throw new RangeError("Bow pressure must be between 0 and 100");
    }
    const fraction = pressure / 100;
    const sharp = smoothstep(fraction);
    const drive = .88 * Math.pow(fraction, .6);
    return Object.freeze({ soft: drive * (1 - sharp), hard: drive * sharp });
  }
  function bowNoiseGain(kind, pressure = DEFAULT_BOW_PRESSURE) {
    bowBody(kind);
    bowPressureWeights(pressure);
    return DEFAULTS[kind].noise * Math.pow(pressure / DEFAULT_BOW_PRESSURE, .7);
  }
  // In idealized Helmholtz motion the bow-point string velocity alternates
  // between a long stick interval and a brief backward slip interval. The
  // Fourier coefficients of that zero-mean rectangular velocity have a 1/n
  // factor and a slip-duration-dependent spectral comb. Gaussian smoothing
  // represents a finite slip-transition time, not a solved friction law.
  function bowSourceComponents(kind, edge) {
    const preset = BOW[kind];
    if (!preset || !["soft", "hard"].includes(edge)) throw new RangeError("Invalid bow profile");
    const width = edge === "soft" ? preset.softWidth : preset.hardWidth;
    return Array.from({ length: BOW_PARTIALS }, (_, index) => {
      const n = index + 1, phase = 2 * Math.PI * n * preset.slipFraction;
      const rolloff = Math.exp(-.5 * Math.pow(2 * Math.PI * n * width, 2));
      const amplitude = preset.sourceGain * rolloff / (Math.PI * n);
      return Object.freeze({ sin: -amplitude * (1 - Math.cos(phase)),
        cos: -amplitude * Math.sin(phase) });
    });
  }
  const BOW_SOURCES = Object.freeze(Object.fromEntries(Object.keys(BOW).map(kind => [kind,
    Object.freeze({ soft: Object.freeze(bowSourceComponents(kind, "soft")),
      hard: Object.freeze(bowSourceComponents(kind, "hard")) })])));
  function complexProduct(a, b) {
    return { real: a.real * b.real - a.imag * b.imag,
      imag: a.real * b.imag + a.imag * b.real };
  }
  // RBJ peaking-biquad response: same coefficients as Web Audio's peaking
  // BiquadFilterNode, so the plotted phases match the generated body filter.
  function peakingResponse(hz, frequency, q, gain, sampleRate) {
    const omega = 2 * Math.PI * frequency / sampleRate;
    const c = Math.cos(omega), alpha = Math.sin(omega) / (2 * q);
    const a = Math.pow(10, gain / 40);
    const coefficients = { b0: 1 + alpha * a, b1: -2 * c, b2: 1 - alpha * a,
      a0: 1 + alpha / a, a1: -2 * c, a2: 1 - alpha / a };
    const theta = 2 * Math.PI * hz / sampleRate;
    const br = coefficients.b0 + coefficients.b1 * Math.cos(theta) +
      coefficients.b2 * Math.cos(2 * theta);
    const bi = -coefficients.b1 * Math.sin(theta) - coefficients.b2 * Math.sin(2 * theta);
    const ar = coefficients.a0 + coefficients.a1 * Math.cos(theta) +
      coefficients.a2 * Math.cos(2 * theta);
    const ai = -coefficients.a1 * Math.sin(theta) - coefficients.a2 * Math.sin(2 * theta);
    const divisor = ar * ar + ai * ai;
    return { real: (br * ar + bi * ai) / divisor,
      imag: (bi * ar - br * ai) / divisor };
  }
  function bowedBodyResponse(kind, frequency, sampleRate) {
    const body = bowBody(kind);
    let response = { real: 1, imag: 0 };
    for (const peak of body.peaks) {
      response = complexProduct(response,
        peakingResponse(frequency, peak.frequency, peak.q, peak.gain, sampleRate));
    }
    return complexProduct(response,
      biquadResponse("lowpass", frequency, body.cutoff, sampleRate));
  }
  function bowedComponents(kind, pressure = DEFAULT_BOW_PRESSURE, hz = 440,
    sampleRate = FLUTE_PLOT_SAMPLE_RATE) {
    bowBody(kind);
    if (!Number.isFinite(hz) || hz < MIN_HZ || hz > MAX_HZ ||
        !Number.isFinite(sampleRate) || sampleRate < 16000) {
      throw new RangeError("Invalid bowed-string pitch or sample rate");
    }
    const weights = bowPressureWeights(pressure);
    const source = BOW_SOURCES[kind];
    return source.soft.map((soft, index) => {
      const hard = source.hard[index];
      const sin = weights.soft * soft.sin + weights.hard * hard.sin;
      const cos = weights.soft * soft.cos + weights.hard * hard.cos;
      const response = bowedBodyResponse(kind, (index + 1) * hz, sampleRate);
      return Object.freeze({ sin: sin * response.real - cos * response.imag,
        cos: sin * response.imag + cos * response.real });
    });
  }
  function bowedWaveFromComponents(phase, components) {
    if (!Number.isFinite(phase) || !Array.isArray(components) ||
        components.length !== BOW_PARTIALS) throw new RangeError("Invalid bowed-string waveform");
    return components.reduce((value, c, index) => value +
      c.sin * Math.sin((index + 1) * phase) + c.cos * Math.cos((index + 1) * phase), 0);
  }
  function rangeFor(kind) {
    if (!KINDS.includes(kind)) throw new RangeError("Unknown held-sound model");
    return kind === "clarinet" ? [clarinet.MIN_HZ, clarinet.MAX_HZ] : [MIN_HZ, MAX_HZ];
  }
  function clarinetComponents(breath = DEFAULT_BREATH, hz = 440,
    sampleRate = FLUTE_PLOT_SAMPLE_RATE) {
    if (!Number.isFinite(hz) || hz < clarinet.MIN_HZ || hz > clarinet.MAX_HZ ||
        !Number.isFinite(sampleRate) || sampleRate < 16000 || sampleRate > 384000) {
      throw new RangeError("Invalid clarinet pitch or sample rate");
    }
    const weights = clarinet.strengthWeights(breath);
    const body = clarinet.BODY;
    return clarinet.SOURCES.soft.map((soft, index) => {
      const bright = clarinet.SOURCES.bright[index];
      const frequency = (index + 1) * hz;
      const hp = biquadResponse("highpass", frequency, body.highpass, sampleRate);
      const peak = peakingResponse(frequency, body.peak, body.peakQ, body.peakGain, sampleRate);
      const lp = biquadResponse("lowpass", frequency, body.lowpass, sampleRate);
      const transfer = complexProduct(complexProduct(hp, peak), lp);
      const sin = weights.soft * soft.sin + weights.bright * bright.sin;
      const cos = weights.soft * soft.cos + weights.bright * bright.cos;
      return Object.freeze({ sin: sin * transfer.real - cos * transfer.imag,
        cos: sin * transfer.imag + cos * transfer.real });
    });
  }
  function clarinetWaveFromComponents(phase, components) {
    if (!Number.isFinite(phase) || !Array.isArray(components) ||
        components.length !== clarinet.PARTIALS) throw new RangeError("Invalid clarinet waveform");
    return components.reduce((sum, c, i) => sum +
      c.sin * Math.sin((i + 1) * phase) + c.cos * Math.cos((i + 1) * phase), 0);
  }
  function validate(kind, hz, attack, release) {
    if (!KINDS.includes(kind)) throw new RangeError("Unknown held-sound model");
    const [lower, upper] = rangeFor(kind);
    if (!Number.isFinite(hz) || hz < lower || hz > upper) {
      throw new RangeError("Held-sound pitch outside supported range");
    }
    if (!Number.isFinite(attack) || attack < MIN_ATTACK || attack > MAX_ATTACK ||
        !Number.isFinite(release) || release < MIN_RELEASE || release > MAX_RELEASE) {
      throw new RangeError("Held-sound envelope outside supported range");
    }
  }
  function partials(kind, strength = DEFAULT_BREATH, hz = 440) {
    if (!KINDS.includes(kind)) throw new RangeError("Unknown held-sound model");
    const components = kind === "flute" ? fluteComponents(strength, hz) :
      kind === "clarinet" ? clarinetComponents(strength, hz) : bowedComponents(kind, strength, hz);
    return components.map(c => Math.hypot(c.sin, c.cos));
  }
  function defaults(kind) {
    if (!KINDS.includes(kind)) throw new RangeError("Unknown held-sound model");
    return DEFAULTS[kind];
  }
  function waveAt(phase, kind, strength = DEFAULT_BREATH, hz = 440) {
    if (!Number.isFinite(phase)) throw new RangeError("Invalid wave phase");
    if (kind === "flute") return fluteWaveFromComponents(phase, fluteComponents(strength, hz));
    if (kind === "clarinet") return clarinetWaveFromComponents(phase, clarinetComponents(strength, hz));
    return bowedWaveFromComponents(phase, bowedComponents(kind, strength, hz));
  }
  function smoothstep(fraction) {
    const x = Math.max(0, Math.min(1, fraction));
    return x * x * (3 - 2 * x);
  }
  function attackLevelAt(elapsed, attack) {
    if (!Number.isFinite(elapsed) || !Number.isFinite(attack) || attack <= 0) {
      throw new RangeError("Invalid attack time");
    }
    return smoothstep(elapsed / attack);
  }
  function releaseLevelAt(elapsed, startLevel, release) {
    if (!Number.isFinite(elapsed) || !Number.isFinite(startLevel) ||
        !Number.isFinite(release) || release <= 0) throw new RangeError("Invalid release time");
    return startLevel * (1 - smoothstep(elapsed / release));
  }
  function envelopeAt(elapsed, attack, release, hold = EXAMPLE_HOLD) {
    if (!Number.isFinite(hold) || hold < 0) throw new RangeError("Invalid held duration");
    if (elapsed < hold) return attackLevelAt(elapsed, attack);
    return releaseLevelAt(elapsed - hold, attackLevelAt(hold, attack), release);
  }
  function sliderToHz(position, kind = "flute") {
    const [minHz, maxHz] = rangeFor(kind);
    return minHz * Math.pow(maxHz / minHz, position / 1000);
  }
  function hzToSlider(hz, kind = "flute") {
    const [minHz, maxHz] = rangeFor(kind);
    return 1000 * Math.log(hz / minHz) / Math.log(maxHz / minHz);
  }

  return Object.freeze({
    KINDS, MIN_HZ, MAX_HZ, MIN_ATTACK, MAX_ATTACK, MIN_RELEASE, MAX_RELEASE,
    EXAMPLE_HOLD, DEFAULT_BREATH, DEFAULT_BOW_PRESSURE, BOW_PARTIALS,
    FLUTE_TONE_GAIN, FLUTE_HIGHPASS, FLUTE_LOWPASS, FLUTE_Q,
    validate, defaults, rangeFor, partials, waveAt, fluteDrive, fluteJetAt, fluteNoiseGain,
    fluteComponents, fluteWaveFromComponents, bowBody, bowPressureWeights,
    bowNoiseGain, bowSourceComponents, bowedComponents, bowedWaveFromComponents, smoothstep,
    clarinet, clarinetComponents, clarinetWaveFromComponents,
    attackLevelAt, releaseLevelAt, envelopeAt, sliderToHz, hzToSlider
  });
});
