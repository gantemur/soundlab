/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * A strict ABC-like percussion part. C D E F G retain the original five voices;
 * A B c d e f g add seven D2 kit voices. Lowercase notes are percussion identifiers.
 * Per-hit dynamics, !flam!/!roll!, !R!/!L! sticking and per-track groove
 * are Sound Lab extensions, not claims of general-purpose ABC compatibility.
 */
(function (root, factory) {
  const score = typeof module === "object" && module.exports ? require("./sound-score.js") : root.SoundLabScore;
  const api = factory(score);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabDrumABC = api;
})(typeof window !== "undefined" ? window : null, function (scoreModel) {
  "use strict";
  const DRUMS = Object.freeze([
    { id: "kick", note: "C", midi: 36, en: "Bass drum", mn: "Их бөмбөр" },
    { id: "snare", note: "D", midi: 38, en: "Snare", mn: "Жижиг бөмбөр" },
    { id: "hat", note: "E", midi: 42, en: "Closed hi-hat", mn: "Хаалттай цан" },
    { id: "openHat", note: "F", midi: 46, en: "Open hi-hat", mn: "Нээлттэй цан" },
    { id: "woodblock", note: "G", midi: 76, en: "Woodblock", mn: "Модон цохилуур" },
    { id: "floorTom", note: "A", midi: 41, en: "Floor tom", mn: "Суурь том" },
    { id: "midTom", note: "B", midi: 47, en: "Mid tom", mn: "Дунд том" },
    { id: "highTom", note: "c", midi: 50, en: "High tom", mn: "Өндөр том" },
    { id: "ride", note: "d", midi: 51, en: "Ride cymbal", mn: "Райд цан" },
    { id: "crash", note: "e", midi: 49, en: "Crash cymbal", mn: "Крэш цан" },
    { id: "rimshot", note: "f", midi: 40, en: "Rimshot", mn: "Хүрээтэй цохилт" },
    { id: "halfHat", note: "g", midi: 44, en: "Half-open hi-hat", mn: "Хагас нээлттэй цан" }
  ]);
  const BY_NOTE = Object.fromEntries(DRUMS.map(drum => [drum.note, drum]));
  const BY_ID = Object.fromEntries(DRUMS.map(drum => [drum.id, drum]));
  const VELOCITIES = Object.freeze({ ghost: .34, p: .55, normal: .8, accent: 1 });
  const ARTICULATIONS = Object.freeze(["plain", "flam", "roll"]);
  const HANDS = Object.freeze(["auto", "R", "L"]);
  const TOUCHES = Object.freeze(["even", "expressive"]);
  // Playback feel never rewrites ABC or its linked pattern definitions.
  // Ratios describe where the eighth-note offbeat falls within a quarter beat.
  const FEELS = Object.freeze({ straight: .5, light: .58, swing: 2 / 3 });
  const FLAM_GAP_SECONDS = .032;
  const ROLL_STROKES = Object.freeze([.68, .82, .74, 1]);
  const MAX_HITS = 512;
  class DrumABCError extends Error {
    constructor(message, line = null, column = null) {
      super(message); this.name = "DrumABCError"; this.line = line; this.column = column;
    }
  }
  function meterOf(raw) {
    if (raw === "C") raw = "4/4";
    if (raw === "C|") raw = "2/2";
    const match = /^(\d{1,2})\/(2|4|8|16)$/.exec(raw);
    if (!match || +match[1] < 1 || +match[1] > 12) throw new DrumABCError("M: use 4/4, 3/4, 6/8, etc.");
    return { numerator: +match[1], denominator: +match[2], quarterBeats: 4 * +match[1] / +match[2] };
  }
  function tempoOf(raw) {
    const match = /^(?:(1\/(?:2|4|8|16))=)?(\d{2,3})$/.exec(raw);
    if (!match) throw new DrumABCError("Q: use a tempo such as 1/4=96");
    const quarter = +match[2] * (match[1] ? 4 / +match[1].split("/")[1] : 1);
    if (quarter < 30 || quarter > 320) throw new DrumABCError("Q: tempo must be 30–320 quarter notes/min");
    return quarter;
  }
  function unitOf(raw) {
    if (!/^1\/(2|4|8|16|32)$/.test(raw)) throw new DrumABCError("L: use 1/4, 1/8 or 1/16");
    return 4 / +raw.split("/")[1];
  }
  function durationOf(body, at) {
    const match = /^(\d+)?(\/{1,5}(\d+)?)?/.exec(body.slice(at));
    const raw = match[0];
    const factor = (match[1] ? +match[1] : 1) /
      (match[2] ? (match[3] ? +match[3] : 2 ** match[2].match(/^\/+/)[0].length) : 1);
    if (!Number.isFinite(factor) || factor <= 0 || factor > 128) throw new DrumABCError("Invalid note length: " + raw);
    return { factor, length: raw.length };
  }
  function otherHand(hand) { return hand === "R" ? "L" : "R"; }
  // Deliberately small, repeatable emphasis for comparison with even touch.
  // The score, its written dynamics, and groove timing remain unmodified.
  function expressiveVelocity(velocity, event, barStart) {
    if (velocity === VELOCITIES.ghost || velocity === VELOCITIES.accent) return velocity;
    const sixteenths = Math.round((event.startBeat - barStart) * 4);
    const aligned = Math.abs((event.startBeat - barStart) * 4 - sixteenths) < 1e-7;
    const weight = aligned ? (sixteenths % 4 === 0 ? 1.04 : sixteenths % 2 === 0 ? .965 : .93) : .975;
    const fourBarCycle = [1, .985, 1.01, .995][(event.bar - 1) % 4];
    return Math.min(1, +(velocity * weight * fourBarCycle).toFixed(5));
  }
  function parse(source) {
    if (typeof source !== "string" || source.length > 8192) throw new DrumABCError("Drum ABC must fit in 8,192 characters");
    const lines = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
    const headers = {}, bodyLines = [], mapped = new Set();
    let keyFound = false, musicStarted = false, channel = false;
    lines.forEach((line, n) => {
      const trimmed = line.trim();
      if (!trimmed || (trimmed.startsWith("%") && !trimmed.startsWith("%%"))) return;
      if (trimmed.startsWith("%%")) {
        if (keyFound && musicStarted) throw new DrumABCError("Percussion directives belong before the notes", n + 1);
        if (trimmed === "%%MIDI channel 10") { if (channel) throw new DrumABCError("Repeated MIDI channel", n + 1); channel = true; return; }
        const mapping = /^%%MIDI drummap ([A-Ga-g]) (\d+)$/.exec(trimmed);
        if (!mapping || !BY_NOTE[mapping[1]] || +mapping[2] !== BY_NOTE[mapping[1]].midi || mapped.has(mapping[1])) {
          throw new DrumABCError("Only fixed Sound Lab MIDI drum maps are supported", n + 1);
        }
        mapped.add(mapping[1]); return;
      }
      const header = /^([A-Za-z]):\s*(.*?)\s*(?:%.*)?$/.exec(trimmed);
      if (header && !musicStarted) {
        const key = header[1].toUpperCase();
        if (!"XTMLQK".includes(key) || headers[key] !== undefined || (keyFound && key !== "K")) {
          throw new DrumABCError("Unsupported, repeated, or misplaced " + key + ": header", n + 1);
        }
        if (keyFound) throw new DrumABCError("K: must be the final header", n + 1);
        headers[key] = header[2]; if (key === "K") keyFound = true;
        return;
      }
      if (!keyFound || header) throw new DrumABCError("Put M:, L:, Q: and K:C clef=perc before percussion notes", n + 1);
      musicStarted = true;
      bodyLines.push({ body: line.replace(/%.*/, ""), line: n + 1 });
    });
    if (!headers.M || !headers.L || !headers.Q || !/^C\s+clef=perc$/i.test(headers.K || "")) {
      throw new DrumABCError("Drum ABC needs M:, L:, Q: and K:C clef=perc");
    }
    if (mapped.size && !channel) throw new DrumABCError("Add %%MIDI channel 10 before drum maps");
    const meter = meterOf(headers.M), unitBeats = unitOf(headers.L), tempoQuarter = tempoOf(headers.Q);
    const result = { version: 2, percussion: true, title: (headers.T || "Drums").slice(0, 90),
      meter, unitBeats, tempoQuarter, bars: [], totalBeats: 0,
      parts: [{ id: "drums", instrument: "drums", events: [] }] };
    const events = result.parts[0].events;
    let beat = 0, barStart = 0, bar = 1, closed = false, hitsCount = 0;
    let tripletRemaining = 0;
    const finishBar = (isLast, line) => {
      if (tripletRemaining) throw new DrumABCError("Finish all three triplet notes before the bar line", line);
      const length = beat - barStart;
      if (bar > scoreModel.MAX_BARS || length < 1e-8 || length > meter.quarterBeats + 1e-7 ||
          (bar !== 1 && !isLast && Math.abs(length - meter.quarterBeats) > 1e-7)) {
        throw new DrumABCError("Bar " + bar + " must contain " + meter.quarterBeats + " quarter beats (except a pickup/final bar)", line);
      }
      result.bars.push({ number: bar, startBeat: barStart, durationBeats: length, partial: length < meter.quarterBeats - 1e-7 });
      bar++; barStart = beat;
    };
    const readHit = (body, position, line) => {
      let i = position, velocity = VELOCITIES.normal, articulation = "plain", hand = "auto";
      let hasDynamic = false;
      while (body[i] === "!") {
        const decoration = /^!([^!]*)!/.exec(body.slice(i));
        if (!decoration) throw new DrumABCError("Close the drum decoration with !", line, i + 1);
        const name = decoration[1];
        if (["p", "mf", "accent", "ghost"].includes(name) && !hasDynamic) {
          velocity = name === "mf" ? VELOCITIES.normal : VELOCITIES[name];
          hasDynamic = true;
        } else if (["flam", "roll"].includes(name) && articulation === "plain") {
          articulation = name;
        } else if (["R", "L"].includes(name) && hand === "auto") {
          hand = name;
        } else throw new DrumABCError("Use at most one dynamic, technique and !R!/!L! hand per hit", line, i + 1);
        i += decoration[0].length;
      }
      const drum = BY_NOTE[body[i]];
      if (!drum) throw new DrumABCError("Expected mapped drum note C–G, A, B, or c–g", line, i + 1);
      return { hit: { drum: drum.id, velocity, ...(articulation === "plain" ? {} : { articulation }),
        ...(hand === "auto" ? {} : { hand }) },
        position: i + 1 };
    };
    for (const { body, line } of bodyLines) {
      for (let i = 0; i < body.length;) {
        if (/\s/.test(body[i])) { i++; continue; }
        if (closed) throw new DrumABCError("Nothing may follow |]", line, i + 1);
        if (body[i] === "(") {
          if (body.slice(i, i + 2) !== "(3" || tripletRemaining) {
            throw new DrumABCError("Use (3 before exactly three triplet steps; no nested tuplets", line, i + 1);
          }
          tripletRemaining = 3;
          i += 2; continue;
        }
        if (body[i] === "|") {
          if (body[i + 1] === ":") throw new DrumABCError("Repeats are not supported", line, i + 1);
          const final = body[i + 1] === "]", width = final || body[i + 1] === "|" ? 2 : 1;
          finishBar(final || (bodyLines.at(-1).line === line && !body.slice(i + width).trim()), line);
          if (final) closed = true;
          i += width; continue;
        }
        const at = i; let hits = [];
        if (body[i] === "z") { i++; }
        else if (body[i] === "[") {
          i++;
          while (i < body.length && body[i] !== "]") {
            if (/\s/.test(body[i])) { i++; continue; }
            const next = readHit(body, i, line);
            if (hits.some(hit => hit.drum === next.hit.drum)) throw new DrumABCError("Duplicate drum in chord", line, i + 1);
            hits.push(next.hit); i = next.position;
          }
          if (!hits.length || body[i] !== "]") throw new DrumABCError("Use nonempty, closed [CE] drum chords", line, at + 1);
          i++;
        } else {
          const next = readHit(body, i, line);
          hits = [next.hit]; i = next.position;
        }
        const duration = durationOf(body, i); i += duration.length;
        const durationBeats = unitBeats * duration.factor * (tripletRemaining ? 2 / 3 : 1);
        if (tripletRemaining) tripletRemaining--;
        if (durationBeats > 32) throw new DrumABCError("Drum step exceeds 32 quarter beats", line, at + 1);
        events.push({ type: hits.length ? "drum-step" : "rest", startBeat: beat, durationBeats, bar, hits });
        beat += durationBeats;
        hitsCount += hits.length;
        if (hitsCount > MAX_HITS || events.length > 512 || beat > scoreModel.MAX_BEATS + 1e-7) {
          throw new DrumABCError("Drum score limit: 512 hits/steps or 256 quarter beats", line, at + 1);
        }
      }
    }
    if (tripletRemaining) throw new DrumABCError("Unfinished (3 triplet: write three notes or rests");
    if (beat > barStart + 1e-8) finishBar(true, lines.length);
    if (!events.length) throw new DrumABCError("Write at least one drum note or rest");
    result.bars[0].pickup = result.bars.length > 1 && result.bars[0].partial;
    result.totalBeats = beat;
    return validate(result);
  }
  function validate(score) {
    if (!score || !score.percussion || score.version !== 2 || !Array.isArray(score.parts) ||
        score.parts.length !== 1 || !Array.isArray(score.parts[0].events) ||
        !Number.isFinite(score.tempoQuarter) || score.tempoQuarter < 30 || score.tempoQuarter > 320 ||
        !score.meter || !Number.isFinite(score.meter.quarterBeats) || !Array.isArray(score.bars) ||
        score.bars.length < 1 || score.bars.length > 32 || !Number.isFinite(score.totalBeats) ||
        score.totalBeats <= 0 || score.totalBeats > 256 || score.totalBeats * 60 / score.tempoQuarter > 90) {
      throw new DrumABCError("Invalid percussion score or 90-second/32-bar limit exceeded");
    }
    const events = score.parts[0].events;
    let beat = 0, hits = 0;
    if (!events.length || events.length > 512) throw new DrumABCError("Drum score must contain 1–512 steps");
    for (const event of events) {
      if (!event || !["drum-step", "rest"].includes(event.type) ||
          Math.abs(event.startBeat - beat) > 1e-7 || !Number.isFinite(event.durationBeats) ||
          event.durationBeats <= 0 || !Array.isArray(event.hits) ||
          (event.type === "rest" && event.hits.length) ||
          (event.type === "drum-step" && !event.hits.length)) throw new DrumABCError("Invalid percussion event timing");
      const used = new Set();
      for (const hit of event.hits) {
        if (!BY_ID[hit.drum] || used.has(hit.drum) || !Object.values(VELOCITIES).includes(hit.velocity) ||
            (hit.articulation !== undefined && !["flam", "roll"].includes(hit.articulation)) ||
            (hit.hand !== undefined && !["R", "L"].includes(hit.hand))) {
          throw new DrumABCError("Unknown or duplicate drum/strength/technique");
        }
        used.add(hit.drum); hits++;
      }
      beat += event.durationBeats;
    }
    if (hits > MAX_HITS || Math.abs(beat - score.totalBeats) > 1e-7) throw new DrumABCError("Percussion score exceeds hit or timing limits");
    return score;
  }
  function swungBeat(beat, barStart, ratio) {
    if (ratio === .5) return beat;
    const local = beat - barStart;
    const whole = Math.floor(local + 1e-9), fraction = local - whole;
    if (Math.abs(fraction) < 1e-9) return barStart + whole;
    return barStart + whole + (fraction <= .5 ? fraction * 2 * ratio :
      ratio + (fraction - .5) * 2 * (1 - ratio));
  }
  function scheduledEvents(score, feel = "straight", touch = "even") {
    validate(score);
    if (!Object.hasOwn(FEELS, feel)) throw new DrumABCError("Unknown drum rhythmic feel");
    if (!TOUCHES.includes(touch)) throw new DrumABCError("Unknown drum touch");
    const ratio = FEELS[feel];
    const sounding = [];
    for (const event of score.parts[0].events) for (const hit of event.hits) {
      const barStart = score.bars[event.bar - 1].startBeat;
      const warp = beat => swungBeat(beat, barStart, ratio);
      const start = warp(event.startBeat), end = warp(event.startBeat + event.durationBeats);
      const velocity = touch === "expressive" ? expressiveVelocity(hit.velocity, event, barStart) : hit.velocity;
      const base = { type: "drum", startBeat: start,
        durationBeats: end - start, bar: event.bar, drum: hit.drum, velocity,
        ...(hit.hand ? { hand: hit.hand } : {}) };
      if (hit.articulation === "flam") {
        const gap = Math.min(FLAM_GAP_SECONDS * score.tempoQuarter / 60, base.durationBeats * .35);
        const canLead = start >= barStart + gap;
        sounding.push({ ...base, startBeat: canLead ? start - gap : start,
          velocity: velocity * .5, stroke: "flam-grace",
          ...(hit.hand ? { hand: otherHand(hit.hand) } : {}) });
        sounding.push({ ...base, startBeat: canLead ? start : start + gap,
          stroke: "flam-main" });
      } else if (hit.articulation === "roll") {
        ROLL_STROKES.forEach((strength, index) => {
          const from = warp(event.startBeat + event.durationBeats * index / ROLL_STROKES.length);
          const to = warp(event.startBeat + event.durationBeats * (index + 1) / ROLL_STROKES.length);
          sounding.push({ ...base, startBeat: from, durationBeats: to - from,
            velocity: velocity * strength, stroke: "roll-" + (index + 1),
            ...(hit.hand ? { hand: index % 2 ? otherHand(hit.hand) : hit.hand } : {}) });
        });
      } else sounding.push(base);
    }
    sounding.sort((a, b) => a.startBeat - b.startBeat);
    // The next closed-hat strike cuts short earlier open and half-open tails,
    // even across a bar line. Annotate each stroke so playback, seeking and WAV export
    // all apply the same choke without depending on scheduling order.
    const closed = sounding.filter(hit => hit.drum === "hat").map(hit => hit.startBeat);
    for (const hit of sounding) if (hit.drum === "openHat" || hit.drum === "halfHat") {
      let low = 0, high = closed.length;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (closed[mid] < hit.startBeat - 1e-8) low = mid + 1;
        else high = mid;
      }
      if (low < closed.length) hit.chokeBeat = closed[low];
    }
    return sounding;
  }
  function gridOf(score) {
    validate(score);
    const bars = score.bars.map(bar => {
      const steps = bar.durationBeats * 4;
      if (Math.abs(steps - Math.round(steps)) > 1e-7) throw new DrumABCError("Grid needs sixteenth-note-aligned bars");
      return { number: bar.number, cells: Array.from({ length: Math.round(steps) }, () => ({})) };
    });
    for (const event of score.parts[0].events) {
      const bar = score.bars[event.bar - 1];
      if (!bar) throw new DrumABCError("Invalid percussion bar index");
      const position = (event.startBeat - bar.startBeat) * 4;
      if (Math.abs(position - Math.round(position)) > 1e-7 ||
          Math.abs(event.durationBeats * 4 - Math.round(event.durationBeats * 4)) > 1e-7) {
        throw new DrumABCError("Grid needs sixteenth-note-aligned events; keep editing the ABC text");
      }
      const cell = bars[event.bar - 1].cells[Math.round(position)];
      if (!cell) throw new DrumABCError("Percussion event outside bar");
      for (const hit of event.hits) {
        if (Object.hasOwn(cell, hit.drum)) throw new DrumABCError("Two hits of the same drum overlap in one grid cell");
        cell[hit.drum] = hit.articulation || hit.hand ?
          { velocity: hit.velocity, ...(hit.articulation ? { articulation: hit.articulation } : {}),
            ...(hit.hand ? { hand: hit.hand } : {}) } : hit.velocity;
      }
    }
    return bars;
  }
  function fromGrid(score, bars) {
    const meter = score.meter, tempo = score.tempoQuarter;
    const header = ["X:1", "T:" + score.title.replace(/[\r\n]/g, " "),
      "M:" + meter.numerator + "/" + meter.denominator, "L:1/16", "Q:1/4=" + tempo,
      "K:C clef=perc", "%%MIDI channel 10", ...DRUMS.map(d => "%%MIDI drummap " + d.note + " " + d.midi)];
    const token = cell => {
      const hits = DRUMS.filter(d => Object.hasOwn(cell, d.id)).map(d => {
        const value = cell[d.id], v = typeof value === "number" ? value : value?.velocity;
        const articulation = typeof value === "number" ? "plain" : value?.articulation || "plain";
        const hand = typeof value === "number" ? "auto" : value?.hand || "auto";
        if (!Object.values(VELOCITIES).includes(v) || !ARTICULATIONS.includes(articulation) ||
            !HANDS.includes(hand)) {
          throw new DrumABCError("Unknown grid strength, technique or sticking");
        }
        return (v === VELOCITIES.ghost ? "!ghost!" : v === VELOCITIES.p ? "!p!" :
          v === VELOCITIES.accent ? "!accent!" : "") +
          (articulation === "plain" ? "" : "!" + articulation + "!") +
          (hand === "auto" ? "" : "!" + hand + "!") + d.note;
      });
      return hits.length > 1 ? "[" + hits.join("") + "]" : (hits[0] || "z");
    };
    // Preserve the source's notated rhythmic durations wherever the grid did
    // not add an intervening onset. Only the edited beat is split when needed.
    const original = score.parts?.[0]?.events || [];
    const lines = bars.map((bar, i) => {
      const sourceBar = score.bars?.[i];
      const boundaries = new Set([0, bar.cells.length]);
      if (sourceBar) for (const event of original) {
        if (event.bar === sourceBar.number) boundaries.add(Math.round((event.startBeat - sourceBar.startBeat) * 4));
      }
      bar.cells.forEach((cell, step) => { if (Object.keys(cell).length) boundaries.add(step); });
      const indices = [...boundaries].sort((a, b) => a - b);
      const notation = indices.slice(0, -1).map((start, j) => {
        const count = indices[j + 1] - start;
        if (count < 1) throw new DrumABCError("Invalid grid cell timing");
        return token(bar.cells[start]) + (count === 1 ? "" : count);
      });
      return notation.join(" ") + (i === bars.length - 1 ? " |]" : " |");
    });
    const source = [...header, ...lines].join("\n");
    parse(source); // Do not export a grid the parser cannot read.
    return source;
  }
  function toggleGridHit(score, barNumber, sixteenth, drum, velocity = VELOCITIES.normal,
      articulation = "plain", hand = "auto") {
    const bars = gridOf(score);
    const bar = bars[barNumber - 1];
    if (!bar || !Number.isInteger(sixteenth) || sixteenth < 0 || sixteenth >= bar.cells.length ||
        !BY_ID[drum] || !Object.values(VELOCITIES).includes(velocity) ||
        !ARTICULATIONS.includes(articulation) || !HANDS.includes(hand)) {
      throw new DrumABCError("Invalid grid position or instrument");
    }
    const cell = bar.cells[sixteenth];
    const existing = cell[drum];
    if (existing === velocity && articulation === "plain" && hand === "auto" ||
        existing?.velocity === velocity && (existing?.articulation || "plain") === articulation &&
        (existing?.hand || "auto") === hand) delete cell[drum];
    else cell[drum] = articulation === "plain" && hand === "auto" ? velocity :
      { velocity, ...(articulation === "plain" ? {} : { articulation }),
        ...(hand === "auto" ? {} : { hand }) };
    return fromGrid(score, bars);
  }
  function groove({ meter, tempoQuarter, totalBeats, barDurations }, id = 1, title = "Drums") {
    // Triplets can leave tiny rounding errors in otherwise grid-aligned bars.
    // Use integer grid counts throughout so Array.from cannot truncate a step.
    const gridSteps = beats => {
      if (!Number.isFinite(beats)) return NaN;
      const steps = beats * 4;
      return Math.abs(steps - Math.round(steps)) <= 1e-7 ? Math.round(steps) : NaN;
    };
    const totalSteps = gridSteps(totalBeats);
    if (!Number.isInteger(totalSteps) || totalSteps <= 0 || totalSteps > 1024) throw new DrumABCError("Cannot make a drum groove for this length");
    const stepsPerBar = gridSteps(meter.quarterBeats);
    if (!Number.isInteger(stepsPerBar) || stepsPerBar <= 0) throw new DrumABCError("Automatic drum groove needs sixteenth-note-aligned meters");
    if (!barDurations) {
      if (totalSteps % stepsPerBar !== 0) {
        throw new DrumABCError("A score with pickups needs its actual bar durations");
      }
      barDurations = Array.from({ length: totalSteps / stepsPerBar }, () => meter.quarterBeats);
    }
    const barSteps = Array.isArray(barDurations) ? barDurations.map(gridSteps) : [];
    if (!barSteps.length || barSteps.length > 32 ||
        barSteps.reduce((sum, steps) => sum + steps, 0) !== totalSteps ||
        barSteps.some(steps => !Number.isInteger(steps) || steps <= 0 || steps > stepsPerBar)) {
      throw new DrumABCError("Invalid bar durations for generated percussion");
    }
    const bars = [];
    for (let b = 0; b < barSteps.length; b++) {
      const cells = Array.from({ length: barSteps[b] }, (_, step) => {
        const cell = {};
        if (step % 2 === 0) cell.hat = VELOCITIES.normal;
        if (step === 0 || (meter.numerator >= 4 && step === 8)) cell.kick = VELOCITIES.accent;
        if (step === 4 || (meter.numerator >= 4 && step === 12)) cell.snare = VELOCITIES.normal;
        return cell;
      });
      bars.push({ number: b + 1, cells });
    }
    const placeholder = { meter, tempoQuarter, title };
    return fromGrid(placeholder, bars).replace(/^X:1$/m, "X:" + id);
  }
  return Object.freeze({ DRUMS, VELOCITIES, ARTICULATIONS, HANDS, FEELS, TOUCHES,
    FLAM_GAP_SECONDS, ROLL_STROKES,
    MAX_HITS, DrumABCError, parse, validate,
    scheduledEvents, gridOf, fromGrid, toggleGridHit, groove });
});
