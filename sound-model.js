/* Sound Lab's small, dependency-free scientific model.
 * Pitch identity, tuning and sound recipe stay separate for future Compose.
 * This module is usable from a browser and from Node's built-in test runner.
 */
(function (root, makeModel) {
  "use strict";
  const model = makeModel();
  if (typeof module === "object" && module.exports) module.exports = model;
  if (root) root.SoundLabModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TAU = 2 * Math.PI;
  const REFERENCE_HZ = 440;
  const SLIDER_MIN_HZ = 80;
  const SLIDER_MAX_HZ = 2000;
  const INPUT_MIN_HZ = 20;
  const INPUT_MAX_HZ = 12000;
  const WAVEFORMS = Object.freeze(["sine", "triangle", "square", "sawtooth"]);
  const NOTE_EN = Object.freeze(["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]);
  const NOTE_MN = Object.freeze(["До", "До♯", "Ре", "Ре♯", "Ми", "Фа", "Фа♯", "Соль", "Соль♯", "Ля", "Ля♯", "Си"]);

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function phase01(cycles) {
    return ((cycles % 1) + 1) % 1;
  }

  function sampleWave(waveform, cycles) {
    const phase = phase01(cycles);
    switch (waveform) {
      case "sine": return Math.sin(TAU * phase);
      case "triangle": return (2 / Math.PI) * Math.asin(Math.sin(TAU * phase));
      case "square": return phase < 0.5 ? 1 : -1;
      case "sawtooth": return 2 * phase - 1;
      default: throw new RangeError("Unknown waveform: " + waveform);
    }
  }

  // Magnitudes relative to the fundamental of an ideal periodic waveform.
  // Phase/sign is intentionally omitted because the spectrum shows magnitude.
  function harmonicMagnitude(waveform, harmonicNumber) {
    if (!Number.isInteger(harmonicNumber) || harmonicNumber < 1) return 0;
    if (!WAVEFORMS.includes(waveform)) throw new RangeError("Unknown waveform: " + waveform);
    if (waveform === "sine") return harmonicNumber === 1 ? 1 : 0;
    if (waveform === "sawtooth") return 1 / harmonicNumber;
    if (harmonicNumber % 2 === 0) return 0;
    return waveform === "square" ? 1 / harmonicNumber : 1 / (harmonicNumber * harmonicNumber);
  }

  function midiFromHz(hz) {
    if (!(hz > 0) || !Number.isFinite(hz)) throw new RangeError("Frequency must be positive");
    return Math.round(69 + 12 * Math.log2(hz / REFERENCE_HZ));
  }

  function hzFromMidi(midi) {
    return REFERENCE_HZ * Math.pow(2, (midi - 69) / 12);
  }

  function nearestNote(hz) {
    const midi = midiFromHz(hz);
    const index = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return {
      midi: midi,
      english: NOTE_EN[index] + octave,
      mongolian: NOTE_MN[index] + octave,
      frequency: hzFromMidi(midi)
    };
  }

  // P1 supports 12-tone equal temperament only. Later tunings can resolve
  // symbolic pitch through a different strategy without changing sound recipes.
  function resolvePitch(pitch, tuning) {
    if (pitch.kind === "hz") return pitch.hz;
    if (pitch.kind === "midi" && tuning.id === "12tet") return hzFromMidi(pitch.midi);
    throw new RangeError("Unsupported pitch identity or tuning");
  }

  function snapFrequency(hz) {
    return resolvePitch({ kind: "midi", midi: midiFromHz(hz) }, { id: "12tet" });
  }

  function sliderToFrequency(position) {
    return SLIDER_MIN_HZ * Math.pow(SLIDER_MAX_HZ / SLIDER_MIN_HZ, clamp(position, 0, 1000) / 1000);
  }

  function frequencyToSlider(hz) {
    return 1000 * Math.log(clamp(hz, SLIDER_MIN_HZ, SLIDER_MAX_HZ) / SLIDER_MIN_HZ) /
      Math.log(SLIDER_MAX_HZ / SLIDER_MIN_HZ);
  }

  return Object.freeze({
    WAVEFORMS: WAVEFORMS,
    REFERENCE_HZ: REFERENCE_HZ,
    INPUT_MIN_HZ: INPUT_MIN_HZ,
    INPUT_MAX_HZ: INPUT_MAX_HZ,
    SLIDER_MIN_HZ: SLIDER_MIN_HZ,
    SLIDER_MAX_HZ: SLIDER_MAX_HZ,
    clamp: clamp,
    sampleWave: sampleWave,
    harmonicMagnitude: harmonicMagnitude,
    nearestNote: nearestNote,
    resolvePitch: resolvePitch,
    snapFrequency: snapFrequency,
    hzFromMidi: hzFromMidi,
    sliderToFrequency: sliderToFrequency,
    frequencyToSlider: frequencyToSlider
  });
});
