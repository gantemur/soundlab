/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Local, versioned Compose projects. Validation never changes the live editor.
 */
(function (root, factory) {
  const score = typeof module === "object" && module.exports ? require("./sound-score.js") : root.SoundLabScore;
  const player = typeof module === "object" && module.exports ? require("./sound-score-player.js") : root.SoundLabScorePlayer;
  const drums = typeof module === "object" && module.exports ? require("./sound-drum-abc.js") : root.SoundLabDrumABC;
  const patterns = typeof module === "object" && module.exports ? require("./sound-drum-patterns.js") : root.SoundLabDrumPatterns;
  const api = factory(score, player, drums, patterns);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabProject = api;
})(typeof window !== "undefined" ? window : null, function (scoreModel, playerModel, drums, drumPatterns) {
  "use strict";

  const FORMAT = "soundlab-project";
  const VERSION = 1;
  // Unused, editable pattern definitions are also saved. Their bounded grids
  // can be substantially larger than the expanded, 8,192-character ABC song.
  const MAX_BYTES = 16 * 1024 * 1024;
  const MAX_TEXT = 8192;
  const MAX_ERROR = 512;
  const MAX_ID = Number.MAX_SAFE_INTEGER - 1;
  const DRUM_IDS = drums.DRUMS.map(drum => drum.id);
  const STRENGTHS = Object.keys(drums.VELOCITIES);
  const VELOCITIES = Object.values(drums.VELOCITIES);
  const ARTICULATIONS = drums.ARTICULATIONS;
  const same = (a, b) => Math.abs(a - b) < 1e-7;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  class ProjectError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "ProjectError";
      this.code = code;
    }
  }
  function invalid(path, reason) {
    throw new ProjectError("invalid", path + ": " + reason);
  }
  function record(value, path, allowed, required = allowed) {
    if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path, "expected an object");
    const prototype = Object.getPrototypeOf(value);
    // Accept ordinary objects from another window/test realm, but not class
    // instances or an object inheriting user-defined settings.
    if (prototype !== null && Object.getPrototypeOf(prototype) !== null) invalid(path, "expected a plain object");
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowed.includes(key)) invalid(path, "unsupported field");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!own(descriptor, "value") || !descriptor.enumerable) invalid(path, "expected ordinary data fields");
    }
    if (required.some(key => !own(value, key))) invalid(path, "required field is missing");
    return value;
  }
  function list(value, path, min, max) {
    if (!Array.isArray(value) || value.length < min || value.length > max) {
      invalid(path, "expected " + min + "–" + max + " entries");
    }
    if (Reflect.ownKeys(value).length !== value.length + 1) invalid(path, "expected a dense array");
    const result = [];
    for (let i = 0; i < value.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !own(descriptor, "value") || !descriptor.enumerable) invalid(path, "expected ordinary array entries");
      result.push(descriptor.value);
    }
    return result;
  }
  function string(value, path, max, min = 0) {
    if (typeof value !== "string" || value.length < min || value.length > max) {
      invalid(path, "expected text of " + min + "–" + max + " characters");
    }
    return value;
  }
  function number(value, path, min, max, integer = false) {
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
      invalid(path, "number is outside its supported range");
    }
    return value;
  }
  function choice(value, path, choices) {
    if (!choices.includes(value)) invalid(path, "unsupported choice");
    return value;
  }
  function drumHit(value, path) {
    if (typeof value === "number") return choice(value, path, VELOCITIES);
    record(value, path, ["velocity", "articulation"]);
    return { velocity: choice(value.velocity, path + ".velocity", VELOCITIES),
      articulation: choice(value.articulation, path + ".articulation", ["flam", "roll"]) };
  }
  function boolean(value, path) {
    if (typeof value !== "boolean") invalid(path, "expected true or false");
    return value;
  }
  function guitar(value, path) {
    record(value, path, ["mode", "spacingMs"]);
    return { mode: choice(value.mode, path + ".mode", playerModel.GUITAR_MODES),
      spacingMs: number(value.spacingMs, path + ".spacingMs", 0, 60) };
  }
  function cleanError(error) {
    return String(error?.message || error || "Invalid saved pattern")
      .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ERROR);
  }
  function patternName(value, path) {
    string(value, path, 90, 1);
    if (/[\r\n%]/.test(value) || value !== value.trim()) invalid(path, "pattern titles must fit one trimmed ABC header");
    return value;
  }
  function checked(path, action) {
    try { return action(); }
    catch (error) { invalid(path, cleanError(error)); }
  }
  function patternProject(value, path) {
    record(value, path, ["title", "number", "meter", "tempoQuarter", "barDurations", "patterns", "sequence", "nextId"]);
    record(value.meter, path + ".meter", ["numerator", "denominator", "quarterBeats"]);
    const numerator = number(value.meter.numerator, path + ".meter.numerator", 1, 12, true);
    const denominator = choice(value.meter.denominator, path + ".meter.denominator", [2, 4, 8, 16]);
    const quarterBeats = number(value.meter.quarterBeats, path + ".meter.quarterBeats", .25, 24);
    if (!same(quarterBeats, 4 * numerator / denominator)) invalid(path + ".meter", "inconsistent beat length");
    const project = {
      title: patternName(value.title, path + ".title"),
      number: number(value.number, path + ".number", 0, MAX_ID, true),
      meter: { numerator, denominator, quarterBeats },
      tempoQuarter: number(value.tempoQuarter, path + ".tempoQuarter", 30, 320),
      barDurations: list(value.barDurations, path + ".barDurations", 1, scoreModel.MAX_BARS).map((duration, i) => {
        number(duration, path + ".barDurations[" + i + "]", .25, quarterBeats + 1e-7);
        if (!same(duration * 4, Math.round(duration * 4))) invalid(path + ".barDurations", "bars must fit sixteenth-note cells");
        return duration;
      }),
      patterns: [], sequence: [], nextId: number(value.nextId, path + ".nextId", 1, MAX_ID, true)
    };
    const ids = new Set();
    project.patterns = list(value.patterns, path + ".patterns", 1, 64).map((source, i) => {
      const at = path + ".patterns[" + i + "]";
      record(source, at, ["id", "name", "bars"]);
      const id = number(source.id, at + ".id", 1, MAX_ID, true);
      if (ids.has(id)) invalid(at + ".id", "duplicate pattern ID");
      ids.add(id);
      const bars = list(source.bars, at + ".bars", 1, 4);
      if (![1, 2, 4].includes(bars.length)) invalid(at + ".bars", "patterns contain 1, 2 or 4 bars");
      return { id, name: patternName(source.name, at + ".name"),
        bars: bars.map((bar, b) => {
          const barPath = at + ".bars[" + b + "]";
          record(bar, barPath, ["cells"]);
          return { cells: list(bar.cells, barPath + ".cells", 1, Math.round(quarterBeats * 4)).map((cell, c) => {
            const cellPath = barPath + ".cells[" + c + "]";
            record(cell, cellPath, DRUM_IDS, []);
            const clean = {};
            for (const id of DRUM_IDS) if (own(cell, id)) clean[id] = drumHit(cell[id], cellPath + "." + id);
            return clean;
          }) };
        }) };
    });
    if (project.nextId <= Math.max(...ids)) invalid(path + ".nextId", "must follow every pattern ID");
    project.sequence = list(value.sequence, path + ".sequence", 1, scoreModel.MAX_BARS).map((slot, i) => {
      const at = path + ".sequence[" + i + "]";
      record(slot, at, ["id", "offset"]);
      const id = number(slot.id, at + ".id", 1, MAX_ID, true);
      if (!ids.has(id)) invalid(at + ".id", "unknown pattern ID");
      return { id, offset: number(slot.offset, at + ".offset", 0, 3, true) };
    });
    if (project.sequence.length !== project.barDurations.length) invalid(path, "bar lengths and sequence do not match");
    // toABC validates active occurrences, while patternABC also checks unused
    // definitions which must remain safe when selected later in the editor.
    for (const pattern of project.patterns) checked(path, () => drumPatterns.patternABC(project, pattern.id));
    checked(path, () => drumPatterns.toABC(project));
    return project;
  }
  function consistentDrums(text, project, path) {
    const parsed = checked(path, () => drums.parse(text));
    const raw = checked(path, () => drums.gridOf(parsed));
    const expanded = checked(path, () => drumPatterns.expanded(project));
    const sameHit = (a, b) => a === b || (a && b && typeof a === "object" && typeof b === "object" &&
      a.velocity === b.velocity && a.articulation === b.articulation);
    if (parsed.title !== project.title || parsed.meter.numerator !== project.meter.numerator ||
        parsed.meter.denominator !== project.meter.denominator || !same(parsed.tempoQuarter, project.tempoQuarter) ||
        raw.length !== expanded.length || raw.some((bar, i) => bar.cells.length !== expanded[i].cells.length ||
          bar.cells.some((cell, step) => DRUM_IDS.some(id => !sameHit(cell[id], expanded[i].cells[step][id]))))) {
      invalid(path, "linked patterns and whole-song ABC describe different music");
    }
  }
  function track(value, path) {
    const fields = ["id", "name", "instrument", "volume", "mute", "solo", "abc", "guitar", "patterns", "patternBar", "patternId", "textMode", "patternDraft"];
    record(value, path, fields, ["id", "name", "instrument", "volume", "mute", "solo", "abc"]);
    const result = {
      id: number(value.id, path + ".id", 1, MAX_ID, true),
      name: string(value.name, path + ".name", 40),
      instrument: choice(value.instrument, path + ".instrument", [...playerModel.INSTRUMENTS, "drums"]),
      volume: number(value.volume, path + ".volume", 0, 100),
      mute: boolean(value.mute, path + ".mute"), solo: boolean(value.solo, path + ".solo"),
      abc: string(value.abc, path + ".abc", MAX_TEXT)
    };
    if (own(value, "guitar")) result.guitar = guitar(value.guitar, path + ".guitar");
    result.patterns = null;
    result.textMode = "full";
    result.patternDraft = null;
    if (own(value, "textMode")) choice(value.textMode, path + ".textMode", ["full", "pattern"]);
    if (own(value, "patternBar")) number(value.patternBar, path + ".patternBar", 1, 32, true);
    if (own(value, "patternId")) number(value.patternId, path + ".patternId", 1, MAX_ID, true);
    if (own(value, "patterns") && value.patterns !== null) {
      if (result.instrument !== "drums") invalid(path + ".patterns", "only drum tracks use linked patterns");
      result.patterns = patternProject(value.patterns, path + ".patterns");
      result.patternBar = number(value.patternBar, path + ".patternBar", 1, result.patterns.sequence.length, true);
      result.patternId = number(value.patternId, path + ".patternId", 1, MAX_ID, true);
      if (!result.patterns.patterns.some(pattern => pattern.id === result.patternId)) invalid(path + ".patternId", "unknown selected pattern");
      if (drumPatterns.atBar(result.patterns, result.patternBar).pattern.id !== result.patternId) {
        invalid(path + ".patternId", "selected pattern does not belong to the selected song bar");
      }
      result.textMode = choice(value.textMode, path + ".textMode", ["full", "pattern"]);
      consistentDrums(result.abc, result.patterns, path + ".abc");
    }
    if (own(value, "patternDraft") && value.patternDraft !== null) {
      const at = path + ".patternDraft";
      if (!result.patterns || result.textMode !== "pattern") invalid(at, "a draft needs an active pattern editor");
      record(value.patternDraft, at, ["id", "text", "error"], ["id", "text"]);
      const id = number(value.patternDraft.id, at + ".id", 1, MAX_ID, true);
      if (id !== result.patternId) invalid(at + ".id", "draft must belong to the selected pattern");
      const text = string(value.patternDraft.text, at + ".text", MAX_TEXT);
      if (own(value.patternDraft, "error")) string(value.patternDraft.error, at + ".error", MAX_ERROR);
      let error = "Saved pattern draft has not been applied. Edit it or restore the last valid pattern.";
      try { drumPatterns.updatePatternABC(result.patterns, id, text); }
      catch (cause) { error = cleanError(cause); }
      result.patternDraft = { id, text, error };
    }
    return result;
  }
  function normalize(value) {
    record(value, "project", ["format", "version", "title", "mode", "content"]);
    if (value.format !== FORMAT) throw new ProjectError("format", "This is not a Sound Lab project file");
    if (value.version !== VERSION) throw new ProjectError("version", "This Sound Lab project version is not supported");
    const project = { format: FORMAT, version: VERSION,
      title: string(value.title, "project.title", 120),
      mode: choice(value.mode, "project.mode", ["solo", "ensemble"]), content: null };
    const source = value.content, path = "project.content";
    if (project.mode === "solo") {
      record(source, path, ["abc", "instrument", "tuning", "volume", "guitar"]);
      project.content = {
        abc: string(source.abc, path + ".abc", MAX_TEXT),
        instrument: choice(source.instrument, path + ".instrument", playerModel.INSTRUMENTS),
        tuning: choice(source.tuning, path + ".tuning", scoreModel.TUNINGS),
        volume: number(source.volume, path + ".volume", 0, 100),
        guitar: guitar(source.guitar, path + ".guitar")
      };
    } else {
      record(source, path, ["tuning", "tracks", "selectedId", "nextId", "editor"]);
      const tracks = list(source.tracks, path + ".tracks", 1, playerModel.MAX_PARTS).map((item, i) => track(item, path + ".tracks[" + i + "]"));
      const ids = new Set(tracks.map(item => item.id));
      if (ids.size !== tracks.length) invalid(path + ".tracks", "duplicate track ID");
      const selectedId = number(source.selectedId, path + ".selectedId", 1, MAX_ID, true);
      if (!ids.has(selectedId)) invalid(path + ".selectedId", "unknown selected track");
      const nextId = number(source.nextId, path + ".nextId", 1, MAX_ID, true);
      if (nextId <= Math.max(...ids)) invalid(path + ".nextId", "must follow every track ID");
      record(source.editor, path + ".editor", ["gridBar", "gridStep", "gridStrength", "gridArticulation"],
        ["gridBar", "gridStep", "gridStrength"]);
      project.content = { tuning: choice(source.tuning, path + ".tuning", scoreModel.TUNINGS),
        tracks, selectedId, nextId, editor: {
          gridBar: number(source.editor.gridBar, path + ".editor.gridBar", 1, 32, true),
          gridStep: choice(source.editor.gridStep, path + ".editor.gridStep", [8, 16]),
          gridStrength: choice(source.editor.gridStrength, path + ".editor.gridStrength", STRENGTHS),
          gridArticulation: choice(own(source.editor, "gridArticulation") ? source.editor.gridArticulation : "plain",
            path + ".editor.gridArticulation", ARTICULATIONS)
        } };
    }
    return project;
  }
  function checkSize(text) {
    if (typeof text !== "string") invalid("project", "expected a JSON string");
    if (text.length > MAX_BYTES) throw new ProjectError("size", "Sound Lab project files must fit within 16 MiB");
    if (text.length * 3 <= MAX_BYTES) return;
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 0x80) bytes++;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length &&
          text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
      else bytes += 3;
      if (bytes > MAX_BYTES) throw new ProjectError("size", "Sound Lab project files must fit within 16 MiB");
    }
  }
  function serialize(project) {
    const text = JSON.stringify(project, null, 2) + "\n";
    checkSize(text);
    return text;
  }
  function validate(project) {
    const result = normalize(project);
    serialize(result); // Every accepted project can also be saved with encode.
    return result;
  }
  function encode(project) { return serialize(normalize(project)); }
  function decode(text) {
    checkSize(text);
    let value;
    try { value = JSON.parse(text.replace(/^\uFEFF/, "")); }
    catch (_) { throw new ProjectError("invalid", "The project file is not valid JSON"); }
    return validate(value);
  }
  function filename(title) {
    let stem = typeof title === "string" ? title.trim() : "";
    stem = stem.replace(/\.soundlab\.json$/i, "").replace(/[\u0000-\u001f\u007f<>:"/\\|?*\u202a-\u202e\u2066-\u2069]/g, "-")
      .replace(/\s+/g, " ").trim().replace(/^\.+/, "");
    stem = Array.from(stem).slice(0, 100).join("").replace(/[. ]+$/, "");
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = "sound-lab-" + stem;
    return (stem || "sound-lab-project") + ".soundlab.json";
  }
  return Object.freeze({ FORMAT, VERSION, MAX_BYTES, ProjectError, encode, decode, validate, filename });
});
