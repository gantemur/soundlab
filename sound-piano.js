/* Small, deterministic struck-piano model for playback and plots.
 * Hammer velocity changes the excitation spectrum; stiff, slightly detuned
 * strings have two decay stages and broad soundboard-like coloration.
 * This is modal/commuted-style synthesis, not a hammer/string PDE solver.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabPiano = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TAU = 2 * Math.PI;
  const STIFFNESS = 0.00016;
  const PARTIALS = 11;
  const REFERENCE_RATE = 48000;
  const HAMMER_POINT = 1 / 7; // A hammer near a seventh of the string suppresses partial 7.
  // The central string carries a stable part of the tone. If all three
  // amplitudes are nearly equal, their beats can almost erase the fundamental
  // while an upper partial remains loud, making the late tail very metallic.
  const UNISONS = Object.freeze([
    Object.freeze({ ratio: Math.pow(2, -.68 / 1200), mix: .20 }),
    Object.freeze({ ratio: 1, mix: .60 }),
    Object.freeze({ ratio: Math.pow(2, .74 / 1200), mix: .20 })
  ]);
  const TOUCHES = Object.freeze(["press", "tap"]);
  const TAP_RELEASE = .16;
  const TAP_DAMPING = .055;
  const recipeCache = new Map();
  const waveCache = new Map();

  function pianoPartialHz(pitchHz, number) {
    if (!Number.isFinite(pitchHz) || pitchHz <= 0 ||
        !Number.isInteger(number) || number < 1) {
      throw new RangeError("Invalid piano-string partial");
    }
    return pitchHz * number * Math.sqrt(1 + STIFFNESS * number * number);
  }

  function validVelocity(velocity) {
    return Number.isFinite(velocity) && velocity >= 0 && velocity <= 1;
  }

  function validTouch(touch) {
    return TOUCHES.includes(touch);
  }

  function damperGain(time, touch = "press") {
    // A press represents a held key (free decay). A brief tap releases the
    // damper after 160 ms; exponential damping avoids an audible click.
    return touch === "tap" && time > TAP_RELEASE ?
      Math.exp(-(time - TAP_RELEASE) / TAP_DAMPING) : 1;
  }

  // A broad frequency response stands in for the bridge and soundboard. It
  // colors the vibrating strings without introducing unrelated fixed pitches.
  function soundboardGain(hz) {
    function peak(center, width) {
      const distance = (hz - center) / width;
      return 1 / (1 + distance * distance);
    }
    return .54 + .37 * peak(220, 210) + .28 * peak(620, 480) +
      .17 * peak(1900, 1100);
  }

  function makeRecipe(pitchHz, velocity) {
    const cutoff = 2.4 + 10.5 * velocity;
    const modes = [];
    let totalWeight = 0;
    for (let n = 1; n <= PARTIALS; n++) {
      const hz = pianoPartialHz(pitchHz, n);
      if (hz > 7900) break; // Keep analysis and audible synthesis below 8 kHz.
      const hammerPosition = Math.abs(Math.sin(Math.PI * n * HAMMER_POINT)) /
        Math.sin(Math.PI * HAMMER_POINT);
      const felt = Math.exp(-Math.pow((n - 1) / cutoff, 2));
      const weight = hammerPosition * felt *
        Math.pow(n, -1.15 - .45 * (1 - velocity)) * soundboardGain(hz);
      // Cap absolute unison detuning for high notes: a fixed cents offset
      // otherwise makes the upper keyboard's fundamental beat too rapidly.
      const frequencies = UNISONS.map(string => {
        const offset = Math.max(-.14, Math.min(.14, pitchHz * (string.ratio - 1)));
        return hz * (1 + offset / pitchHz);
      });
      modes.push({ n, weight, frequencies });
      totalWeight += weight;
    }
    return { modes, normalization: Math.max(1, totalWeight) };
  }

  function recipe(pitchHz, velocity) {
    const key = pitchHz + "|" + velocity;
    if (!recipeCache.has(key)) {
      if (recipeCache.size >= 12) recipeCache.delete(recipeCache.keys().next().value);
      recipeCache.set(key, makeRecipe(pitchHz, velocity));
    }
    return recipeCache.get(key);
  }

  function envelope(time, decaySec, touch = "press") {
    if (time <= 0) return 0;
    const attack = 1 - Math.exp(-time / .00055);
    return attack * (.64 * Math.exp(-time / (decaySec * .29)) +
      .36 * Math.exp(-time / (decaySec * 1.85))) *
      (touch === "tap" ? .72 : 1) * damperGain(time, touch);
  }

  function oscillator(hz) {
    const step = TAU * hz / REFERENCE_RATE;
    return { sin: 0, cos: 1, sineStep: Math.sin(step), cosineStep: Math.cos(step) };
  }

  function advance(osc) {
    const sine = osc.sin * osc.cosineStep + osc.cos * osc.sineStep;
    osc.cos = osc.cos * osc.cosineStep - osc.sin * osc.sineStep;
    osc.sin = sine;
  }

  function makeWave(pitchHz, decaySec, velocity) {
    const { modes, normalization } = recipe(pitchHz, velocity);
    const length = Math.max(.35, Math.min(3, decaySec * 4));
    const result = new Float32Array(Math.ceil(length * REFERENCE_RATE) + 2);
    const oscillators = modes.map(mode => {
      const higher = mode.n - 1;
      return {
        weight: mode.weight,
        strings: mode.frequencies.map(oscillator),
        early: 1,
        late: 1,
        earlyStep: Math.exp(-(1 + .15 * higher) / (REFERENCE_RATE * decaySec * .29)),
        lateStep: Math.exp(-(1 + .28 * higher) / (REFERENCE_RATE * decaySec * 1.85))
      };
    });
    const contactHigh = oscillator(4130), contactLow = oscillator(2530);
    const attackStep = Math.exp(-1 / (REFERENCE_RATE * .00055));
    const contactStep = Math.exp(-1 / (REFERENCE_RATE * .0035));
    let remainingAttack = 1, contactDecay = 1;
    for (let i = 0; i < result.length; i++) {
      let value = 0;
      for (const mode of oscillators) {
        let strings = 0;
        for (let j = 0; j < UNISONS.length; j++) {
          strings += UNISONS[j].mix * mode.strings[j].sin;
          advance(mode.strings[j]);
        }
        value += mode.weight * (.64 * mode.early + .36 * mode.late) * strings;
        mode.early *= mode.earlyStep;
        mode.late *= mode.lateStep;
      }
      // A short hammer/contact sparkle, much weaker for a gentle key press.
      const contact = (.025 + .075 * velocity) * contactDecay *
        (contactLow.sin + .34 * contactHigh.sin);
      result[i] = (1 - remainingAttack) * (.85 * value / normalization + contact);
      advance(contactLow);
      advance(contactHigh);
      remainingAttack *= attackStep;
      contactDecay *= contactStep;
    }
    return result;
  }

  function wave(pitchHz, decaySec, velocity) {
    const key = pitchHz + "|" + decaySec + "|" + velocity;
    if (!waveCache.has(key)) {
      if (waveCache.size >= 6) waveCache.delete(waveCache.keys().next().value);
      waveCache.set(key, makeWave(pitchHz, decaySec, velocity));
    }
    return waveCache.get(key);
  }

  function sampleAt(time, pitchHz, decaySec, velocity = .55, touch = "press") {
    if (!validVelocity(velocity) || !validTouch(touch)) {
      throw new RangeError("Invalid piano hammer velocity or touch");
    }
    if (time <= 0 || time >= Math.max(.35, Math.min(3, decaySec * 4))) return 0;
    // Tapping also excites fewer high modes: hammer speed and damper timing
    // remain separate physical effects even though the UI offers a preset.
    const samples = wave(pitchHz, decaySec, touch === "tap" ? .7 * velocity : velocity);
    const index = time * REFERENCE_RATE;
    const previous = Math.floor(index), fraction = index - previous;
    return (samples[previous] * (1 - fraction) + samples[previous + 1] * fraction) *
      (touch === "tap" ? .72 : 1) * damperGain(time, touch);
  }

  return Object.freeze({ STIFFNESS, PARTIALS, TOUCHES, pianoPartialHz, validVelocity,
    validTouch, soundboardGain, damperGain, envelope, sampleAt });
});
