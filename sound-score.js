/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * Instrument-independent, spelled-pitch score events for Sound Lab Compose.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabScore = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const LETTER_OFFSETS = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
  const MIN_NOTE_HZ = 110;
  const MAX_NOTE_HZ = 880;
  const TUNINGS = Object.freeze(["equal", "pythagorean", "just"]);
  const mod = (value, n) => ((value % n) + n) % n;

  function pitchNumber(pitch) {
    if (!pitch || !Object.hasOwn(LETTER_OFFSETS, pitch.letter) ||
        !Number.isInteger(pitch.accidental) || pitch.accidental < -2 || pitch.accidental > 2 ||
        !Number.isInteger(pitch.octave) || pitch.octave < 1 || pitch.octave > 7) {
      throw new RangeError("Invalid spelled pitch");
    }
    return 12 * (pitch.octave + 1) + LETTER_OFFSETS[pitch.letter] + pitch.accidental;
  }

  function pitchName(pitch) {
    const sign = pitch.accidental < 0 ? "♭".repeat(-pitch.accidental) :
      pitch.accidental > 0 ? "♯".repeat(pitch.accidental) : "";
    return pitch.letter + sign + pitch.octave;
  }

  function frequency(pitch, tuning = "equal", a4 = 440, temperamentModel = null) {
    if (!TUNINGS.includes(tuning) || !Number.isFinite(a4) || a4 < 400 || a4 > 480) {
      throw new RangeError("Invalid tuning or reference frequency");
    }
    const midi = pitchNumber(pitch);
    if (tuning === "equal") return a4 * 2 ** ((midi - 69) / 12);
    if (!temperamentModel || typeof temperamentModel.frequency !== "function") {
      throw new Error("Temperament model unavailable");
    }
    const normalizedOctave = Math.floor(midi / 12) - 1;
    // The tuning visualizer covers octaves 2–6. A piano can legitimately play
    // outside that range; temperament ratios repeat exactly by octaves.
    const octaveForTemperament = Math.max(2, Math.min(6, normalizedOctave));
    return temperamentModel.frequency(tuning, mod(midi, 12), octaveForTemperament, a4) *
      2 ** (normalizedOctave - octaveForTemperament);
  }

  function secondsPerBeat(score) {
    return 60 / score.tempoQuarter;
  }

  // Quarter-beat score positions map to absolute audio-clock seconds. An E3
  // entry steps immediately to its Q. An E5 entry with interpolation="linear"
  // ramps the quarter-note BPM to the NEXT entry's Q. The analytic integral
  // of 60/Q and its inverse keep live seeking and offline WAV synchronized.
  function tempoSegments(score) {
    return score.tempoMap?.length ? score.tempoMap :
      [{ beat: 0, tempoQuarter: score.tempoQuarter }];
  }

  function tempoAtBeat(score, beat) {
    if (!Number.isFinite(beat) || beat < 0) throw new RangeError("Invalid score beat");
    const segments = tempoSegments(score);
    for (let i = segments.length - 1; i >= 0; i--) {
      if (beat >= segments[i].beat) {
        const item = segments[i], next = segments[i + 1];
        if (item.interpolation === "linear" && next) {
          const progress = (beat - item.beat) / (next.beat - item.beat);
          return item.tempoQuarter + (next.tempoQuarter - item.tempoQuarter) * progress;
        }
        return item.tempoQuarter;
      }
    }
    return score.tempoQuarter;
  }

  function tempoIntervalSeconds(item, next, beats) {
    if (beats <= 0) return 0;
    if (item.interpolation === "linear" && next) {
      const slope = (next.tempoQuarter - item.tempoQuarter) / (next.beat - item.beat);
      if (Math.abs(slope) > 1e-12) {
        return 60 * Math.log1p(slope * beats / item.tempoQuarter) / slope;
      }
    }
    return 60 * beats / item.tempoQuarter;
  }

  function tempoIntervalBeats(item, next, seconds) {
    if (seconds <= 0) return 0;
    if (item.interpolation === "linear" && next) {
      const slope = (next.tempoQuarter - item.tempoQuarter) / (next.beat - item.beat);
      if (Math.abs(slope) > 1e-12) {
        return item.tempoQuarter * Math.expm1(slope * seconds / 60) / slope;
      }
    }
    return seconds * item.tempoQuarter / 60;
  }

  function beatToSeconds(score, beat) {
    if (!Number.isFinite(beat) || beat < 0) throw new RangeError("Invalid score beat");
    const segments = tempoSegments(score);
    let seconds = 0;
    for (let i = 0; i < segments.length; i++) {
      const item = segments[i], next = segments[i + 1]?.beat ?? Infinity;
      const span = Math.min(beat, next) - item.beat;
      if (span > 0) seconds += tempoIntervalSeconds(item, segments[i + 1], span);
      if (beat <= next) break;
    }
    return seconds;
  }

  function secondsToBeat(score, seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("Invalid score time");
    const segments = tempoSegments(score);
    let elapsed = 0;
    for (let i = 0; i < segments.length; i++) {
      const item = segments[i], next = segments[i + 1]?.beat ?? Infinity;
      const duration = tempoIntervalSeconds(item, segments[i + 1], next - item.beat);
      if (seconds <= elapsed + duration) {
        return item.beat + tempoIntervalBeats(item, segments[i + 1], seconds - elapsed);
      }
      elapsed += duration;
    }
    return segments.at(-1).beat;
  }

  // Notation fixes the key-release time. If the piano damper pedal is down
  // when a key is released, the damper only returns on the next pedal-up.
  // This is an absolute score timeline, so Pause/Seek/Resume and WAV agree.
  function pedalReleaseBeat(score, keyReleaseBeat) {
    if (!Number.isFinite(keyReleaseBeat) || keyReleaseBeat < 0) {
      throw new RangeError("Invalid key-release beat");
    }
    let down = false;
    for (const change of score.pedalMap || []) {
      if (change.beat <= keyReleaseBeat + 1e-9) down = change.down;
      else if (down && !change.down) return change.beat;
      else if (change.beat > keyReleaseBeat) break;
    }
    return keyReleaseBeat;
  }

  function validate(score) {
    if (!score || score.version !== 1 || !Array.isArray(score.parts) || score.parts.length !== 1 ||
        !Array.isArray(score.parts[0].events) || !Number.isFinite(score.tempoQuarter) ||
        score.tempoQuarter < 30 || score.tempoQuarter > 320 ||
        !score.meter || !Number.isFinite(score.meter.quarterBeats) ||
        score.meter.quarterBeats <= 0) throw new RangeError("Invalid score structure");
    const events = score.parts[0].events;
    if (!Array.isArray(score.bars) || !score.bars.length || !events.length ||
        !Number.isSafeInteger(score.bars.length) || !Number.isSafeInteger(events.length) ||
        !Number.isFinite(score.totalBeats) || score.totalBeats <= 0 ||
        !Number.isFinite(score.totalBeats * secondsPerBeat(score))) {
      throw new RangeError("A score needs valid bars, events and finite playback duration");
    }
    if (score.tempoMap !== undefined) {
      if (!Array.isArray(score.tempoMap) || !score.tempoMap.length ||
          score.tempoMap.length > score.bars.length + 1 ||
          score.tempoMap[0]?.beat !== 0 ||
          score.tempoMap[0]?.tempoQuarter !== score.tempoQuarter ||
          score.tempoMap.some((mark, index) => !Number.isFinite(mark?.beat) ||
            mark.beat < 0 || mark.beat >= score.totalBeats ||
            !Number.isFinite(mark.tempoQuarter) || mark.tempoQuarter < 30 ||
            mark.tempoQuarter > 320 ||
            (mark.interpolation !== undefined && (mark.interpolation !== "linear" ||
              index === score.tempoMap.length - 1)) ||
            (index > 0 && mark.beat <= score.tempoMap[index - 1].beat))) {
        throw new RangeError("Invalid score tempo map");
      }
    }
    if (score.pedalMap !== undefined) {
      let held = false, previous = -1;
      if (!Array.isArray(score.pedalMap) || score.pedalMap.length > 4096 ||
          score.pedalMap.some(mark => {
            const invalid = !Number.isFinite(mark?.beat) || mark.beat < 0 ||
              mark.beat > score.totalBeats || mark.beat <= previous ||
              typeof mark.down !== "boolean" || mark.down === held;
            previous = mark?.beat;
            held = mark?.down;
            return invalid;
          }) || held) {
        throw new RangeError("Invalid piano pedal map");
      }
    }
    if (!Number.isFinite(beatToSeconds(score, score.totalBeats))) {
      throw new RangeError("A score needs a finite tempo-mapped duration");
    }
    const ids = score.parts[0].voiceIds;
    const polyphonic = ids !== undefined;
    if (polyphonic && (!Array.isArray(ids) || !ids.length || ids.length > 16 ||
        ids.some(id => typeof id !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(id)) ||
        new Set(ids).size !== ids.length)) {
      throw new RangeError("Invalid score voice IDs");
    }
    const states = new Map((polyphonic ? ids : ["melody"])
      .map(id => [id, { cursor: 0, previous: null }]));
    let lastStart = -Infinity;
    for (const event of events) {
      const id = polyphonic ? event?.voiceId : "melody";
      const state = states.get(id);
      if (!state || (!polyphonic && event?.voiceId !== undefined) ||
          (polyphonic && event.startBeat < lastStart - 1e-7)) {
        throw new RangeError("Invalid event voice or ordering");
      }
      if (!event || !["note", "chord", "rest"].includes(event.type) ||
          !Number.isFinite(event.startBeat) || Math.abs(event.startBeat - state.cursor) > 1e-7 ||
          !Number.isFinite(event.durationBeats) || event.durationBeats <= 0 ||
          event.durationBeats > 32 || !Number.isInteger(event.bar) || event.bar < 1 ||
          event.bar > score.bars.length) {
        throw new RangeError("Invalid event timing");
      }
      if (event.type === "note") pitchNumber(event.pitch);
      if (event.velocity !== undefined &&
          (event.type === "rest" || !Number.isFinite(event.velocity) ||
           event.velocity < .1 || event.velocity > 1.5)) {
        throw new RangeError("A pitched note dynamic must be between 0.1 and 1.5");
      }
      if (event.articulation !== undefined &&
          (event.type === "rest" || !["staccato", "tenuto", "legato"].includes(event.articulation))) {
        throw new RangeError("Invalid score articulation");
      }
      if (event.ornament !== undefined &&
          (event.type !== "note" || !["trill", "mordent"].includes(event.ornament) ||
            event.tieFromPrevious)) {
        throw new RangeError("Ornaments belong to the initial attack of a pitched note");
      }
      if (event.gracePitches !== undefined &&
          (event.type === "rest" || !Array.isArray(event.gracePitches) ||
            !event.gracePitches.length || event.gracePitches.length > 8 ||
            event.gracePitches.some(pitch => {
              try { pitchNumber(pitch); return false; } catch (_) { return true; }
            }))) {
        throw new RangeError("Invalid grace-note pitches");
      }
      if (event.type === "chord") {
        if (!Array.isArray(event.pitches) || event.pitches.length < 2 || event.pitches.length > 6 ||
            new Set(event.pitches.map(pitchNumber)).size !== event.pitches.length) {
          throw new RangeError("A chord needs 2–6 distinct pitched notes");
        }
      }
      if (["tieToNext", "tieFromPrevious"].some(flag =>
        event[flag] !== undefined && typeof event[flag] !== "boolean") ||
          (event.type !== "note" && (event.tieToNext || event.tieFromPrevious)) ||
          Boolean(event.tieFromPrevious) !== Boolean(state.previous && state.previous.tieToNext)) {
        throw new RangeError("Invalid note tie");
      }
      if (event.tieFromPrevious && (state.previous.type !== "note" ||
          state.previous.pitch.letter !== event.pitch.letter ||
          state.previous.pitch.accidental !== event.pitch.accidental ||
          state.previous.pitch.octave !== event.pitch.octave)) {
        throw new RangeError("A tie must join notes of the same spelled pitch");
      }
      state.cursor += event.durationBeats;
      state.previous = event;
      lastStart = event.startBeat;
    }
    for (const { cursor, previous } of states.values()) {
      if (previous?.tieToNext) throw new RangeError("A tie must continue to another note");
      if (Math.abs(cursor - score.totalBeats) > 1e-7) throw new RangeError("Score duration mismatch");
    }
    return score;
  }

  return Object.freeze({ LETTER_OFFSETS, MIN_NOTE_HZ, MAX_NOTE_HZ,
    TUNINGS, pitchNumber, pitchName, frequency, secondsPerBeat, tempoAtBeat,
    beatToSeconds, secondsToBeat, pedalReleaseBeat,
    validate });
});
