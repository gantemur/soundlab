/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * A deliberately small, strict subset of ABC notation. One instrument can
 * contain independent V: blocks, each with its own rhythm and notation state.
 * Supports dynamics and hairpins, articulation, ornaments, grace notes,
 * piano pedal and barline Q: tempo changes. The optional Sound Lab
 * %%soundlab-tempo-ramp linear directive interpolates to the NEXT Q: mark.
 */
(function (root, factory) {
  const scoreModel = typeof module === "object" && module.exports ?
    require("./sound-score.js") : root.SoundLabScore;
  const api = factory(scoreModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabABC = api;
})(typeof window !== "undefined" ? window : null, function (scoreModel) {
  "use strict";

  const KEYS = Object.freeze({ C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6,
    F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6,
    Am: 0, Em: 1, Bm: 2, "F#m": 3, "C#m": 4, "G#m": 5,
    Dm: -1, Gm: -2, Cm: -3, Fm: -4, Bbm: -5, Ebm: -6 });
  const SHARPS = "FCGDAEB";
  const FLATS = "BEADGCF";
  const HEADERS = Object.freeze(["X", "T", "M", "L", "Q", "K"]);
  const DYNAMICS = Object.freeze({ pp: .42, p: .60, mp: .78, mf: 1,
    f: 1.17, ff: 1.32 });
  const ARTICULATIONS = Object.freeze(["staccato", "tenuto", "legato"]);
  // A file-size protection for the browser, not a musical bar or duration limit.
  const MAX_SOURCE_CHARACTERS = 1024 * 1024;

  class ABCError extends Error {
    constructor(message, line = null, column = null) {
      super(message);
      this.name = "ABCError";
      this.line = line;
      this.column = column;
    }
  }

  function fraction(value, where) {
    const match = /^(\d+)\/(\d+)$/.exec(value);
    if (!match || Number(match[2]) === 0) throw new ABCError("Invalid " + where + ": " + value);
    return Number(match[1]) / Number(match[2]);
  }

  function parseMeter(value) {
    if (value === "C") value = "4/4";
    if (value === "C|") value = "2/2";
    const match = /^(\d{1,2})\/(2|4|8|16)$/.exec(value);
    if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) {
      throw new ABCError("M: use a meter such as 4/4, 3/4 or 6/8");
    }
    const numerator = Number(match[1]), denominator = Number(match[2]);
    return { numerator, denominator, quarterBeats: 4 * numerator / denominator };
  }

  function parseUnit(value) {
    const length = fraction(value, "L: note length");
    if (!/^1\/(2|4|8|16|32)$/.test(value)) {
      throw new ABCError("L: use 1/4, 1/8 or another power-of-two unit");
    }
    return 4 * length;
  }

  function parseTempo(value) {
    // In Q:1/8=96 the eighth note, not the quarter, gets 96 beats/minute.
    const match = /^(?:(1\/(?:2|4|8|16))=)?(\d{2,3})$/.exec(value);
    if (!match) throw new ABCError("Q: use a tempo such as 1/4=96");
    const quarter = Number(match[2]) * (match[1] ? 4 * fraction(match[1], "Q: beat unit") : 1);
    if (quarter < 30 || quarter > 320) throw new ABCError("Q: tempo must be 30–320 quarter notes/min");
    return quarter;
  }

  function parseKey(value) {
    const normalized = value.replace(/♯/g, "#").replace(/♭/g, "b")
      .replace(/min(or)?$/i, "m").replace(/maj(or)?$/i, "");
    if (!Object.hasOwn(KEYS, normalized)) {
      throw new ABCError("K: unsupported key '" + value + "'; try C, G, F or Am");
    }
    const fifths = KEYS[normalized];
    const accidentals = {};
    const order = fifths >= 0 ? SHARPS.slice(0, fifths) : FLATS.slice(0, -fifths);
    for (const letter of order) accidentals[letter] = fifths >= 0 ? 1 : -1;
    return { name: normalized, fifths, accidentals };
  }

  function readDuration(body, cursor) {
    const match = /^(\d+)?(\/{1,5}(\d+)?)?/.exec(body.slice(cursor));
    const raw = match[0];
    let factor = match[1] ? Number(match[1]) : 1;
    if (match[2]) {
      const slashes = match[2].match(/^\/+|^\//)[0].length;
      const denominator = match[3] ? Number(match[3]) : 2 ** slashes;
      if (denominator === 0) throw new ABCError("Note length cannot divide by zero");
      factor /= denominator;
    }
    if (!Number.isFinite(factor) || factor <= 0 || factor > 128) {
      throw new ABCError("Invalid note length: " + raw);
    }
    return { factor, consumed: raw.length };
  }

  function parseSingle(source) {
    if (typeof source !== "string" || source.length > MAX_SOURCE_CHARACTERS) {
      throw new ABCError("The ABC text exceeds the 1 MiB editor safety budget");
    }
    const headers = {}, bodyLines = [];
    let musicStarted = false, keyFound = false;
    const lines = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed === "%%soundlab-tempo-ramp linear") {
        if (!keyFound || !musicStarted) throw new ABCError("Tempo ramps belong before a body Q: mark", index + 1);
        bodyLines.push({ ramp: true, line: index + 1 });
        return;
      }
      if (trimmed.startsWith("%%soundlab-tempo-ramp")) {
        throw new ABCError("Unsupported Sound Lab tempo-ramp directive", index + 1);
      }
      if (trimmed.startsWith("%")) return;
      const header = /^([A-Za-z]):\s*(.*?)\s*(?:%.*)?$/.exec(trimmed);
      if (header && !musicStarted) {
        const field = header[1].toUpperCase();
        if (!HEADERS.includes(field)) throw new ABCError("Unsupported ABC header " + field + ":", index + 1);
        if (Object.hasOwn(headers, field)) throw new ABCError("Repeated " + field + ": header", index + 1);
        if (keyFound) throw new ABCError("K: must be the final header before the notes", index + 1);
        headers[field] = header[2];
        if (field === "K") keyFound = true;
        return;
      }
      if (!keyFound) throw new ABCError("Add K:C (or another key) before the notes", index + 1);
      if (header && header[1].toUpperCase() === "Q" && musicStarted) {
        bodyLines.push({ tempo: parseTempo(header[2]), line: index + 1 });
        return;
      }
      if (header) throw new ABCError("Only Q: tempo changes are allowed after the notes begin", index + 1);
      musicStarted = true;
      bodyLines.push({ text: line.replace(/%.*/, ""), line: index + 1 });
    });
    if (!keyFound) throw new ABCError("A key is required (for example, K:C)");
    if (!headers.M || !headers.L || !headers.Q) {
      throw new ABCError("Include M:, L: and Q: so the rhythm is unambiguous");
    }
    const meter = parseMeter(headers.M);
    const unitBeats = parseUnit(headers.L);
    const tempoQuarter = parseTempo(headers.Q);
    const key = parseKey(headers.K);
    const score = { version: 1, title: (headers.T || "First melody").slice(0, 90),
      meter, unitBeats, tempoQuarter, key, referenceA4: 440,
      tuning: "equal", parts: [{ id: "melody", instrument: "flute", events: [] }],
      bars: [], totalBeats: 0 };
    const events = score.parts[0].events;
    let startBeat = 0, barStart = 0, bar = 1, closed = false;
    let carried = {}, pendingTie = null, lastToken = null;
    let markedLevel = null, accentNext = false;
    let articulationNext = null, graceNext = null, ornamentNext = null, pedalDown = false;
    let hairpin = null, pendingRamp = false;
    const pedalMap = [];
    const tempoMap = [{ beat: 0, tempoQuarter }];
    const expressive = event => {
      if (event.type !== "rest" && (markedLevel !== null || accentNext)) {
        event.velocity = Math.min(1.5, (markedLevel ?? 1) * (accentNext ? 1.16 : 1));
      }
      if (event.type !== "rest") {
        if (event.type === "chord" && ornamentNext) {
          throw new ABCError("Trills and mordents belong to individual notes");
        }
        if (articulationNext) event.articulation = articulationNext;
        if (ornamentNext) event.ornament = ornamentNext;
        if (graceNext) event.gracePitches = graceNext;
        if (hairpin) hairpin.attacks.push({ event, accent: accentNext });
        accentNext = false;
        articulationNext = null;
        ornamentNext = null;
        graceNext = null;
      }
    };
    const finishBar = (isLast, line) => {
      if (articulationNext || graceNext || ornamentNext) {
        throw new ABCError("Articulation and ornaments must precede a pitched note in the same bar", line);
      }
      const length = startBeat - barStart;
      if (length < 1e-8) throw new ABCError("Empty bar " + bar, line);
      if (length > meter.quarterBeats + 1e-7 ||
          (bar !== 1 && !isLast && Math.abs(length - meter.quarterBeats) > 1e-7)) {
        throw new ABCError("Bar " + bar + " has " + Number(length.toFixed(4)) +
          " quarter beats; M:" + meter.numerator + "/" + meter.denominator +
          " needs " + meter.quarterBeats, line);
      }
      score.bars.push({ number: bar, startBeat: barStart, durationBeats: length,
        partial: length < meter.quarterBeats - 1e-7 });
      bar++;
      barStart = startBeat;
      carried = {};
    };
    for (const { text: body, line, tempo, ramp } of bodyLines) {
      if (ramp) {
        if (pendingRamp || tempoMap.at(-1).beat >= startBeat ||
            Math.abs(startBeat - barStart) > 1e-8 || closed) {
          throw new ABCError("Place a tempo ramp after a previous Q: mark and before the next Q:", line);
        }
        pendingRamp = true;
        continue;
      }
      if (tempo !== undefined) {
        if (Math.abs(startBeat - barStart) > 1e-8 || closed || startBeat <= 0) {
          throw new ABCError("Q: tempo changes must be between complete bars", line);
        }
        if (pendingRamp) tempoMap.at(-1).interpolation = "linear";
        if (tempoMap.at(-1).beat === startBeat) tempoMap.at(-1).tempoQuarter = tempo;
        else tempoMap.push({ beat: startBeat, tempoQuarter: tempo });
        pendingRamp = false;
        continue;
      }
      if (pendingRamp) throw new ABCError("Follow %%soundlab-tempo-ramp linear immediately with Q:", line);
      for (let i = 0; i < body.length;) {
        const c = body[i];
        if (/\s/.test(c)) { i++; continue; }
        if (closed) throw new ABCError("Nothing may follow the final |]", line, i + 1);
        if (c === "!") {
          const end = body.indexOf("!", i + 1);
          if (end < 0) throw new ABCError("Close each dynamic mark with !", line, i + 1);
          const name = body.slice(i + 1, end);
          if (Object.hasOwn(DYNAMICS, name)) {
            markedLevel = DYNAMICS[name];
            if (hairpin) hairpin.target = markedLevel;
          }
          else if (name === "accent") accentNext = true;
          else if (name === "<(" || name === ">(") {
            if (hairpin) throw new ABCError("Close one hairpin before opening another", line, i + 1);
            hairpin = { direction: name[0], startBeat, from: markedLevel ?? 1,
              target: null, attacks: [] };
          } else if (name === "<)" || name === ">)") {
            if (!hairpin || hairpin.direction !== name[0] ||
                startBeat <= hairpin.startBeat || hairpin.target === null ||
                (hairpin.direction === "<" && hairpin.target <= hairpin.from) ||
                (hairpin.direction === ">" && hairpin.target >= hairpin.from)) {
              throw new ABCError("Hairpins need a matching close and a louder/softer end dynamic", line, i + 1);
            }
            for (const { event, accent } of hairpin.attacks) {
              const fraction = (event.startBeat - hairpin.startBeat) / (startBeat - hairpin.startBeat);
              event.velocity = Math.min(1.5, (hairpin.from +
                fraction * (hairpin.target - hairpin.from)) * (accent ? 1.16 : 1));
            }
            hairpin = null;
          } else if (name === "trill" || name === "mordent") {
            if (ornamentNext) throw new ABCError("One ornament per note", line, i + 1);
            ornamentNext = name;
          }
          else if (ARTICULATIONS.includes(name)) {
            if (articulationNext) throw new ABCError("One articulation per note", line, i + 1);
            articulationNext = name;
          } else if (name === "ped" || name === "ped-up") {
            const down = name === "ped";
            if (down === pedalDown || pedalMap.at(-1)?.beat === startBeat) {
              throw new ABCError("Piano pedal changes must alternate at distinct score positions", line, i + 1);
            }
            pedalMap.push({ beat: startBeat, down });
            pedalDown = down;
          }
          else throw new ABCError("Unsupported dynamic mark !" + name + "!", line, i + 1);
          i = end + 1;
          continue;
        }
        if (c === "{") {
          const end = body.indexOf("}", i + 1);
          if (end < 0 || graceNext) throw new ABCError("Use one closed grace-note group before a note", line, i + 1);
          const group = body.slice(i + 1, end).replace(/^\//, "").trim();
          const pitches = [];
          for (let pos = 0; pos < group.length;) {
            if (/\s/.test(group[pos])) { pos++; continue; }
            const match = /^(\^\^|__|\^|_|=)?([A-Ga-g])([,']*)/.exec(group.slice(pos));
            if (!match) throw new ABCError("Grace notes use pitches only", line, i + 1);
            const octave = (/[a-g]/.test(match[2]) ? 5 : 4) +
              [...match[3]].reduce((v, mark) => v + (mark === "," ? -1 : 1), 0);
            if (octave < 1 || octave > 7) throw new ABCError("Grace pitch outside supported octaves", line, i + 1);
            const letter = match[2].toUpperCase();
            const accidental = match[1] === undefined ?
              (carried[letter + octave] ?? key.accidentals[letter] ?? 0) :
              { "^^": 2, "^": 1, "=": 0, _: -1, __: -2 }[match[1]];
            pitches.push({ letter, accidental, octave });
            pos += match[0].length;
          }
          if (!pitches.length || pitches.length > 8) throw new ABCError("A grace group needs 1–8 pitches", line, i + 1);
          graceNext = pitches;
          i = end + 1;
          continue;
        }
        if (c === "-") {
          if (!lastToken || lastToken.type !== "note" || pendingTie) {
            throw new ABCError("A tie must follow a note", line, i + 1);
          }
          lastToken.tieToNext = true;
          pendingTie = { event: lastToken, line, column: i + 1 };
          lastToken = null;
          i++;
          continue;
        }
        if (c === "|") {
          if (body[i + 1] === ":") throw new ABCError("Repeats are not supported in C1", line, i + 1);
          const finalBar = body[i + 1] === "]";
          const width = finalBar || body[i + 1] === "|" ? 2 : 1;
          const isLast = finalBar || (bodyLines.at(-1).line === line && !body.slice(i + width).trim());
          finishBar(isLast, line);
          lastToken = null;
          i += width;
          if (finalBar) closed = true;
          continue;
        }
        if (c === "[") {
          // Standard ABC chord: all pitches begin together and share the
          // duration written after ]. Individual voices/ties are not yet used.
          const startIndex = i++;
          const pitches = [];
          while (i < body.length && body[i] !== "]") {
            const match = /^(\^\^|__|\^|_|=)?([A-Ga-g])([,']*)/.exec(body.slice(i));
            if (!match) throw new ABCError("Invalid note inside chord", line, i + 1);
            const [, accidentalText, letter, marks] = match;
            const base = letter.toUpperCase();
            const octave = (/[a-g]/.test(letter) ? 5 : 4) +
              [...marks].reduce((value, mark) => value + (mark === "," ? -1 : 1), 0);
            if (octave < 1 || octave > 7) throw new ABCError("Note outside supported octaves", line, i + 1);
            const spelling = base + octave;
            const explicit = accidentalText === undefined ? null :
              { "^^": 2, "^": 1, "=": 0, _: -1, __: -2 }[accidentalText];
            if (explicit !== null) carried[spelling] = explicit;
            pitches.push({ letter: base, accidental: explicit !== null ? explicit :
              (carried[spelling] ?? key.accidentals[base] ?? 0), octave });
            i += match[0].length;
          }
          if (body[i] !== "]" || pitches.length < 2 || pitches.length > 6) {
            throw new ABCError("A chord needs 2–6 notes and a closing ]", line, startIndex + 1);
          }
          i++;
          const length = readDuration(body, i);
          i += length.consumed;
          const durationBeats = unitBeats * length.factor;
          if (durationBeats > 32) throw new ABCError("One chord may not exceed 32 quarter beats", line, startIndex + 1);
          if (pendingTie) throw new ABCError("Ties to chords are not supported", line, startIndex + 1);
          if (new Set(pitches.map(p => scoreModel.pitchNumber(p))).size !== pitches.length) {
            throw new ABCError("A chord cannot repeat a pitch", line, startIndex + 1);
          }
          const event = { type: "chord", startBeat, durationBeats, bar,
            pitches, abc: body.slice(startIndex, i) };
          expressive(event);
          events.push(event);
          lastToken = event;
          startBeat += durationBeats;
          continue;
        }
        const startIndex = i;
        const accidentalMatch = /^(\^\^|__|\^|_|=)/.exec(body.slice(i));
        let explicit = null;
        if (accidentalMatch) {
          explicit = { "^^": 2, "^": 1, "=": 0, _: -1, __: -2 }[accidentalMatch[0]];
          i += accidentalMatch[0].length;
        }
        if (!/[A-Ga-gz]/.test(body[i] || "") || !/^[A-Ga-gz]$/.test(body[i])) {
          throw new ABCError("Unsupported symbol '" + (body[i] ?? "end") +
            "' (Compose supports notes, chords, rests, lengths, ties and barlines)", line, i + 1);
        }
        const letter = body[i++];
        const isRest = letter === "z";
        if (isRest && explicit !== null) throw new ABCError("Rests cannot have accidentals", line, startIndex + 1);
        const base = letter.toUpperCase();
        let octave = /[a-g]/.test(letter) ? 5 : 4;
        if (!isRest) while (body[i] === "," || body[i] === "'") {
          octave += body[i] === "," ? -1 : 1;
          i++;
        }
        if (octave < 1 || octave > 7) throw new ABCError("Note outside supported octaves", line, startIndex + 1);
        const length = readDuration(body, i);
        i += length.consumed;
        const durationBeats = unitBeats * length.factor;
        if (durationBeats > 32) throw new ABCError("One note/rest may not exceed 32 quarter beats", line, startIndex + 1);
        const event = { type: isRest ? "rest" : "note", startBeat,
          durationBeats, bar, abc: body.slice(startIndex, i) };
        if (isRest && (articulationNext || graceNext || ornamentNext)) {
          throw new ABCError("Articulation and ornaments must precede a pitched note", line, startIndex + 1);
        }
        if (pendingTie && isRest) {
          throw new ABCError("A tie must join notes of the same spelled pitch", line, startIndex + 1);
        }
        if (!isRest) {
          const spelling = base + octave;
          if (explicit !== null) carried[spelling] = explicit;
          // A tied continuation retains the previous pitch across a barline,
          // without carrying its accidental into later untied notes in that bar.
          const accidental = explicit !== null ? explicit : pendingTie ?
            pendingTie.event.pitch.accidental : (carried[spelling] ?? key.accidentals[base] ?? 0);
          event.pitch = { letter: base, accidental, octave };
          event.tieFromPrevious = Boolean(pendingTie);
          event.tieToNext = false;
          if (pendingTie) {
            if (graceNext || articulationNext || ornamentNext) {
              throw new ABCError("A tied continuation cannot start an ornament or articulation", line, startIndex + 1);
            }
            const previous = pendingTie.event.pitch;
            if (base !== previous.letter || octave !== previous.octave || accidental !== previous.accidental) {
              throw new ABCError("A tie must join notes of the same spelled pitch", line, startIndex + 1);
            }
            pendingTie = null;
          }
        }
        expressive(event);
        events.push(event);
        lastToken = event;
        startBeat += durationBeats;
      }
    }
    if (pendingTie) throw new ABCError("A tie must continue to another note", pendingTie.line, pendingTie.column);
    if (pendingRamp) throw new ABCError("Complete tempo ramps with a Q: mark");
    if (hairpin) throw new ABCError("Close !<(! or !>(! with a matching hairpin end");
    if (pedalDown) throw new ABCError("Release !ped! with !ped-up! before the score ends");
    if (startBeat > barStart + 1e-8) finishBar(true, lines.length);
    if (!events.length) throw new ABCError("Write at least one note or rest after K:");
    score.bars[0].pickup = score.bars.length > 1 && score.bars[0].partial;
    score.totalBeats = startBeat;
    if (tempoMap.length > 1) score.tempoMap = tempoMap;
    if (pedalMap.length) score.pedalMap = pedalMap;
    scoreModel.validate(score);
    return score;
  }

  function parse(source) {
    if (typeof source !== "string" || source.length > MAX_SOURCE_CHARACTERS) {
      throw new ABCError("The ABC text exceeds the 1 MiB editor safety budget");
    }
    const lines = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
    const firstVoice = lines.findIndex(line => /^\s*V:/.test(line));
    if (firstVoice < 0) return parseSingle(source);

    // Only the standard block form of V: is supported, not interleaved inline
    // voices or staff directives. Leave the original line positions intact in
    // each isolated voice so syntax errors still point to the editable text.
    const voiceIds = [];
    const voiceLines = new Map();
    let current = null, sawKey = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], trimmed = line.trim();
      if (trimmed.startsWith("%%soundlab-tempo-ramp") &&
          trimmed !== "%%soundlab-tempo-ramp linear") {
        throw new ABCError("Unsupported Sound Lab tempo-ramp directive", i + 1);
      }
      if (!trimmed || (trimmed.startsWith("%") &&
          trimmed !== "%%soundlab-tempo-ramp linear")) continue;
      const field = /^([A-Za-z]):\s*(.*?)\s*(?:%.*)?$/.exec(trimmed);
      if (i < firstVoice) {
        if (field?.[1].toUpperCase() === "K") sawKey = true;
        else if (!field) throw new ABCError("Put all notes inside a V: voice block", i + 1);
        continue;
      }
      if (field?.[1].toUpperCase() === "V") {
        if (!sawKey) throw new ABCError("Write K: before the first V: voice", i + 1);
        const id = field[2];
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(id)) {
          throw new ABCError("V: needs a short voice ID (letters, digits, _ or -)", i + 1);
        }
        if (voiceLines.has(id)) throw new ABCError("Repeated V: voice " + id, i + 1);
        if (voiceIds.length >= 16) throw new ABCError("At most 16 V: voices per instrument", i + 1);
        current = id;
        voiceIds.push(id);
        voiceLines.set(id, []);
      } else if (field) {
        if (field[1].toUpperCase() === "Q" && current) voiceLines.get(current).push(i);
        else throw new ABCError("Only V: voices and Q: tempo changes are allowed after K:", i + 1);
      } else if (!current) {
        throw new ABCError("Put all notes inside a V: voice block", i + 1);
      } else {
        voiceLines.get(current).push(i);
      }
    }
    if (!voiceIds.length) throw new ABCError("Write at least one V: voice");
    const voiceScores = voiceIds.map(id => {
      const included = new Set(voiceLines.get(id));
      if (!included.size) throw new ABCError("V:" + id + " has no notes or rests");
      const isolated = lines.map((line, i) => i < firstVoice || included.has(i) ? line : "").join("\n");
      return parseSingle(isolated);
    });
    const first = voiceScores[0];
    voiceScores.slice(1).forEach((other, index) => {
      if (first.bars.length !== other.bars.length ||
          Math.abs(first.totalBeats - other.totalBeats) > 1e-7 ||
          first.bars.some((bar, i) =>
            Math.abs(bar.startBeat - other.bars[i].startBeat) > 1e-7 ||
            Math.abs(bar.durationBeats - other.bars[i].durationBeats) > 1e-7)) {
        throw new ABCError("V:" + voiceIds[index + 1] +
          " must have the same barlines and duration as the first voice");
      }
    });
    const explicitMaps = voiceScores.filter(voice => voice.tempoMap).map(voice => voice.tempoMap);
    // Rational tuplets are accumulated in floating point separately by each
    // V: voice; distinct spellings can differ by ~1e-13 at the same barline.
    const agreeing = (left, right) => left.length === right.length &&
      left.every((mark, index) => Math.abs(mark.beat - right[index].beat) < 1e-7 &&
        mark.tempoQuarter === right[index].tempoQuarter &&
        mark.interpolation === right[index].interpolation);
    if (explicitMaps.some(map => !agreeing(map, explicitMaps[0]))) {
      throw new ABCError("V: voice tempo maps must agree");
    }
    if (explicitMaps.length) first.tempoMap = explicitMaps[0];
    const explicitPedals = voiceScores.filter(voice => voice.pedalMap).map(voice => voice.pedalMap);
    if (explicitPedals.some(map => map.length !== explicitPedals[0].length ||
        map.some((mark, index) => Math.abs(mark.beat - explicitPedals[0][index].beat) >= 1e-7 ||
          mark.down !== explicitPedals[0][index].down))) {
      throw new ABCError("V: voice pedal maps must agree");
    }
    if (explicitPedals.length) first.pedalMap = explicitPedals[0];
    first.parts[0].voiceIds = voiceIds;
    first.parts[0].events = voiceScores.flatMap((voice, i) =>
      voice.parts[0].events.map(event => ({ ...event, voiceId: voiceIds[i] })))
      .sort((a, b) => a.startBeat - b.startBeat);
    scoreModel.validate(first);
    return first;
  }

  return Object.freeze({ MAX_SOURCE_CHARACTERS, DYNAMICS, ARTICULATIONS, ABCError, parse, parseKey });
});
