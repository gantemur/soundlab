/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * D1: reusable percussion patterns and their bar-aligned song arrangement.
 * Only ordinary expanded ABC is exported; links are a local editing convenience.
 */
(function (root, factory) {
  const drums = typeof module === "object" && module.exports ?
    require("./sound-drum-abc.js") : root.SoundLabDrumABC;
  const api = factory(drums);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabDrumPatterns = api;
})(typeof window !== "undefined" ? window : null, function (drums) {
  "use strict";
  const copy = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => Math.abs(a - b) < 1e-7;
  const letterName = index => String.fromCharCode(65 + index % 26) +
    (index < 26 ? "" : String(Math.floor(index / 26) + 1));

  function fromABC(text) {
    const score = drums.parse(text);
    const bars = drums.gridOf(score);
    const patterns = [], sequence = [], byContent = new Map();
    bars.forEach(bar => {
      const key = JSON.stringify(bar.cells);
      let pattern = byContent.get(key);
      if (!pattern) {
        pattern = { id: patterns.length + 1, name: letterName(patterns.length),
          bars: [{ cells: copy(bar.cells) }] };
        byContent.set(key, pattern);
        patterns.push(pattern);
      }
      sequence.push({ id: pattern.id, offset: 0 });
    });
    const x = /^X:\s*(\d+)/m.exec(text);
    return { title: score.title, number: x ? Number(x[1]) : 1,
      meter: copy(score.meter), tempoQuarter: score.tempoQuarter,
      barDurations: score.bars.map(bar => bar.durationBeats),
      patterns, sequence, nextId: patterns.length + 1 };
  }
  function getPattern(project, id) {
    const pattern = project.patterns.find(pattern => pattern.id === Number(id));
    if (!pattern) throw new Error("Choose an existing drum pattern");
    return pattern;
  }
  function atBar(project, barNumber) {
    if (!Number.isInteger(barNumber) || barNumber < 1 || barNumber > project.sequence.length) {
      throw new Error("Choose a bar within the drum score");
    }
    const slot = project.sequence[barNumber - 1], pattern = getPattern(project, slot.id);
    const startBar = barNumber - slot.offset;
    if (slot.offset < 0 || slot.offset >= pattern.bars.length ||
        startBar < 1 || startBar + pattern.bars.length - 1 > project.sequence.length ||
        pattern.bars.some((_, offset) => {
          const match = project.sequence[startBar + offset - 1];
          return match.id !== pattern.id || match.offset !== offset;
        })) throw new Error("Incomplete drum pattern occurrence");
    return { pattern, startBar, offset: slot.offset };
  }
  function expanded(project) {
    if (project.sequence.length !== project.barDurations.length ||
        project.sequence.length < 1 || project.sequence.length > 32) throw new Error("Invalid drum arrangement length");
    return project.sequence.map((slot, index) => {
      const { pattern } = atBar(project, index + 1);
      const cells = pattern.bars[slot.offset].cells;
      if (!same(cells.length / 4, project.barDurations[index])) {
        throw new Error("Pattern bar length does not match the song meter/pickup");
      }
      return { number: index + 1, cells: copy(cells) };
    });
  }
  function toABC(project) {
    const text = drums.fromGrid({ meter: project.meter, tempoQuarter: project.tempoQuarter,
      title: project.title }, expanded(project));
    return text.replace(/^X:1$/m, "X:" + project.number);
  }
  function patternABC(project, id) {
    const pattern = getPattern(project, id);
    return drums.fromGrid({ meter: project.meter, tempoQuarter: project.tempoQuarter,
      title: pattern.name }, pattern.bars.map((bar, index) =>
      ({ number: index + 1, cells: copy(bar.cells) })));
  }
  function changedPattern(project, id, bars, name) {
    const current = getPattern(project, id);
    if (bars.length !== current.bars.length || bars.some((bar, i) =>
      bar.cells.length !== current.bars[i].cells.length)) {
      throw new Error("Pattern editing must keep its length and meter");
    }
    const next = copy(project), target = getPattern(next, id);
    target.bars = bars.map(bar => ({ cells: copy(bar.cells) }));
    if (name !== undefined) target.name = name;
    toABC(next); // Refuse to exceed parser, hit, or song-length limits.
    return next;
  }
  function updatePatternABC(project, id, text) {
    const score = drums.parse(text);
    if (!same(score.meter.quarterBeats, project.meter.quarterBeats) ||
        score.meter.numerator !== project.meter.numerator ||
        score.meter.denominator !== project.meter.denominator ||
        !same(score.tempoQuarter, project.tempoQuarter)) {
      throw new Error("A drum pattern must use the song's M: and Q:");
    }
    return changedPattern(project, id, drums.gridOf(score), score.title);
  }
  function toggleHit(project, id, patternBar, sixteenth, voice, velocity) {
    const text = drums.toggleGridHit(drums.parse(patternABC(project, id)),
      patternBar, sixteenth, voice, velocity);
    return updatePatternABC(project, id, text);
  }
  function nextPattern(project, bars, name) {
    if (project.patterns.length >= 64) throw new Error("Limit of 64 drum patterns reached");
    const id = project.nextId++;
    const pattern = { id, name: name || letterName(project.patterns.length), bars: copy(bars) };
    project.patterns.push(pattern);
    return pattern;
  }
  function makeUnique(project, barNumber) {
    const occurrence = atBar(project, barNumber), next = copy(project);
    const duplicate = nextPattern(next, occurrence.pattern.bars);
    occurrence.pattern.bars.forEach((_, i) => {
      next.sequence[occurrence.startBar + i - 1] = { id: duplicate.id, offset: i };
    });
    toABC(next);
    return { project: next, patternId: duplicate.id, startBar: occurrence.startBar };
  }
  function boundary(project, index) {
    return index === project.sequence.length || project.sequence[index].offset === 0;
  }
  function replaceRange(project, id, first, last) {
    const pattern = getPattern(project, id);
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 ||
        last < first || last > project.sequence.length) throw new Error("Choose a valid bar range");
    const n = pattern.bars.length;
    if ((last - first + 1) % n || !boundary(project, first - 1) || !boundary(project, last)) {
      throw new Error("The range must contain complete pattern occurrences");
    }
    for (let i = first - 1; i < last; i++) {
      if (!same(project.barDurations[i], pattern.bars[(i - first + 1) % n].cells.length / 4)) {
        throw new Error("This pattern does not fit the selected bar lengths or pickup");
      }
    }
    const next = copy(project);
    for (let i = first - 1; i < last; i++) {
      next.sequence[i] = { id: pattern.id, offset: (i - first + 1) % n };
    }
    toABC(next);
    return next;
  }
  // Assign a named pattern at a particular song bar. If the replacement cuts
  // through another multi-bar occurrence, preserve its untouched fragments as
  // new complete patterns rather than accidentally changing adjacent bars.
  function assignAtBar(project, id, first) {
    const pattern = getPattern(project, id), count = pattern.bars.length;
    const last = first + count - 1;
    if (!Number.isInteger(first) || first < 1 || last > project.sequence.length) {
      throw new Error("This pattern needs " + count + " bar(s) starting within the song");
    }
    for (let i = 0; i < count; i++) {
      if (!same(project.barDurations[first + i - 1], pattern.bars[i].cells.length / 4)) {
        throw new Error("This pattern does not fit the selected bar lengths or pickup");
      }
    }
    const current = atBar(project, first);
    if (current.startBar === first && current.pattern.id === pattern.id) return copy(project);
    const next = copy(project), before = expanded(project);
    const fragments = [];
    for (let bar = 1; bar <= project.sequence.length;) {
      const occurrence = atBar(project, bar);
      const end = bar + occurrence.pattern.bars.length - 1;
      if (bar <= last && end >= first) {
        if (bar < first) fragments.push({ first: bar, last: first - 1 });
        if (end > last) fragments.push({ first: last + 1, last: end });
      }
      bar = end + 1;
    }
    for (const fragment of fragments) {
      for (let bar = fragment.first; bar <= fragment.last;) {
        // Avoid synthesizing 3-bar definitions from a split 4-bar pattern.
        const count = Math.min(2, fragment.last - bar + 1);
        const bars = before.slice(bar - 1, bar + count - 1).map(b => ({ cells: b.cells }));
        let existing = next.patterns.find(candidate => candidate.bars.length === bars.length &&
          candidate.bars.every((b, i) => JSON.stringify(b.cells) === JSON.stringify(bars[i].cells)));
        if (!existing) existing = nextPattern(next, bars);
        for (let offset = 0; offset < count; offset++) {
          next.sequence[bar + offset - 1] = { id: existing.id, offset };
        }
        bar += count;
      }
    }
    for (let offset = 0; offset < count; offset++) {
      next.sequence[first + offset - 1] = { id: pattern.id, offset };
    }
    toABC(next);
    return next;
  }
  function groupBars(project, first, count) {
    if (![1, 2, 4].includes(count) || !Number.isInteger(first) || first < 1 ||
        first + count - 1 > project.sequence.length ||
        !boundary(project, first - 1) || !boundary(project, first + count - 1)) {
      throw new Error("Select 1, 2 or 4 complete bars for a new pattern");
    }
    const next = copy(project), bars = expanded(project).slice(first - 1, first + count - 1)
      .map(bar => ({ cells: bar.cells }));
    const pattern = nextPattern(next, bars);
    for (let i = 0; i < count; i++) next.sequence[first + i - 1] = { id: pattern.id, offset: i };
    toABC(next);
    return { project: next, patternId: pattern.id, startBar: first };
  }
  function runs(project) {
    const groups = [];
    for (let index = 0; index < project.sequence.length;) {
      const { pattern, startBar } = atBar(project, index + 1);
      if (startBar !== index + 1) throw new Error("Invalid pattern boundary");
      let times = 1, following = index + pattern.bars.length;
      while (following < project.sequence.length) {
        const next = atBar(project, following + 1);
        if (next.pattern.id !== pattern.id || next.offset !== 0) break;
        times++; following += pattern.bars.length;
      }
      groups.push({ id: pattern.id, name: pattern.name, startBar: index + 1,
        endBar: following, repeats: times });
      index = following;
    }
    return groups;
  }
  return Object.freeze({ fromABC, toABC, patternABC, updatePatternABC, toggleHit,
    atBar, getPattern, expanded, makeUnique, replaceRange, assignAtBar, groupBars, runs });
});
