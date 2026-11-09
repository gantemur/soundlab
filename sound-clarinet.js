/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * A bounded, original reed-inspired clarinet teaching voice.
 *
 * A cylindrical stopped/open bore favours odd resonance orders; this model
 * prescribes an odd-rich periodic reed/bore spectrum, two blowing-dependent
 * spectra, fixed radiation/body filtering, and a brief tongued onset. It does
 * NOT solve the nonlinear reed/bore feedback, tone holes or register changes.
 * Frequencies are concert pitch, not written B-flat-clarinet transposition.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabClarinet = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MIN_HZ = 146.8323839587038; // Concert D3.
  // The original demonstration stops at E5. Above that we extrapolate the
  // same reed spectrum (without claiming a simulated clarion/altissimo shift).
  const REFERENCE_MAX_HZ = 659.2551138257398; // Concert E5.
  const MAX_HZ = 1046.5022612023945; // Concert C6, approximate extension.
  const PARTIALS = 12; // Plotting drops components beyond the host's Nyquist.
  const DEFAULT_BREATH = 60;
  const TONGUE_SECONDS = .095;
  const NOISE_SECONDS = .07;
  const BODY = Object.freeze({ highpass: 105, peak: 1250, peakQ: .9,
    peakGain: 2.6, lowpass: 4300, noiseBandpass: 2100 });

  function requireBreath(breath) {
    if (!Number.isFinite(breath) || breath < 0 || breath > 100) {
      throw new RangeError("Clarinet blowing strength must be within 0–100%");
    }
  }
  function smoothstep(value) {
    const x = Math.max(0, Math.min(1, value));
    return x * x * (3 - 2 * x);
  }
  function sourceComponents(profile) {
    if (profile !== "soft" && profile !== "bright") {
      throw new RangeError("Unknown clarinet excitation profile");
    }
    return Object.freeze(Array.from({ length: PARTIALS }, (_, index) => {
      const n = index + 1;
      const odd = n % 2 === 1;
      // A stronger reed drive keeps much more energy in upper odd modes.
      // The deliberately weak even modes keep the tone from being an ideal
      // square wave, without asserting an exact clarinet impedance curve.
      const sin = odd ? (n === 1 ? (profile === "soft" ? .64 : .55) :
        profile === "soft" ? .36 * Math.pow(n, -.95) * Math.exp(-.18 * (n - 3)) :
          .75 * Math.pow(n, -.72) * Math.exp(-.08 * (n - 3))) :
        (profile === "soft" ? .035 : .10) * Math.pow(n, -1.15);
      return Object.freeze({ sin, cos: 0 });
    }));
  }
  const SOURCES = Object.freeze({ soft: sourceComponents("soft"), bright: sourceComponents("bright") });

  function strengthWeights(breath = DEFAULT_BREATH) {
    requireBreath(breath);
    const drive = .67 * Math.pow(breath / 100, .72);
    const bright = smoothstep(breath / 100);
    return Object.freeze({ soft: drive * (1 - bright), bright: drive * bright });
  }
  function noiseGain(breath = DEFAULT_BREATH) {
    requireBreath(breath);
    return breath === 0 ? 0 : .006 * Math.pow(breath / DEFAULT_BREATH, .72);
  }
  // The initial reed source is soft, and its upper harmonics settle after a
  // short tongue/air onset. Noise has a stronger but finite attack component.
  function brightOnset(age) {
    if (!Number.isFinite(age) || age < 0) throw new RangeError("Invalid clarinet note age");
    return smoothstep(age / TONGUE_SECONDS);
  }
  function noiseOnset(age) {
    if (!Number.isFinite(age) || age < 0) throw new RangeError("Invalid clarinet note age");
    return 1 + 1.7 * (1 - smoothstep(age / NOISE_SECONDS));
  }

  return Object.freeze({ MIN_HZ, MAX_HZ, REFERENCE_MAX_HZ, PARTIALS, DEFAULT_BREATH,
    TONGUE_SECONDS, NOISE_SECONDS, BODY, SOURCES,
    sourceComponents, strengthWeights, noiseGain, brightOnset, noiseOnset });
});
