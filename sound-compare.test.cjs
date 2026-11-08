/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const compare = require("./sound-compare.js");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function sine(rate, length = .12, frequency = 440, amplitude = .4) {
  return Float32Array.from({ length: Math.round(rate * length) }, (_, i) =>
    amplitude * Math.sin(2 * Math.PI * frequency * i / rate));
}
function pcm(channels, sampleRate) {
  return { channels, frames: channels[0].length, sampleRate,
    duration: channels[0].length / sampleRate,
    peak: Math.max(...channels.map(samples => samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0))) };
}
function floatWav(channels, rate) {
  const count = channels.length, frames = channels[0].length;
  const bytes = new Uint8Array(44 + frames * count * 4), view = new DataView(bytes.buffer);
  for (const [at, word] of [[0, "RIFF"], [8, "WAVE"], [12, "fmt "], [36, "data"]]) {
    for (let i = 0; i < word.length; i++) bytes[at + i] = word.charCodeAt(i);
  }
  view.setUint32(4, bytes.length - 8, true); view.setUint32(16, 16, true);
  view.setUint16(20, 3, true); view.setUint16(22, count, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * count * 4, true);
  view.setUint16(32, count * 4, true); view.setUint16(34, 32, true);
  view.setUint32(40, bytes.length - 44, true);
  for (let frame = 0; frame < frames; frame++) for (let c = 0; c < count; c++) {
    view.setFloat32(44 + (frame * count + c) * 4, channels[c][frame], true);
  }
  return bytes;
}
function fixture() {
  const elements = new Map(), translations = [], draws = { count: 0 }, microphones = [];
  const intervals = new Map(); let nextInterval = 0;
  const drawing = {};
  for (const name of ["setTransform", "clearRect", "fillRect", "moveTo", "lineTo"]) {
    drawing[name] = (...values) => {
      assert.ok(values.every(Number.isFinite), `${name} has nonfinite drawing coordinates`);
      draws.count++;
    };
  }
  drawing.beginPath = drawing.stroke = () => { draws.count++; };
  drawing.fillText = (_, x, y) => { assert.ok(Number.isFinite(x) && Number.isFinite(y)); draws.count++; };
  class Element {
    constructor(tag, attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attrs = attrs; this.textContent = "";
      this.value = attrs.value || ""; this.children = []; this.events = new Map();
      this.hidden = "hidden" in attrs; this.disabled = false; this.files = [];
      this.width = 580; this.height = 200;
      const names = new Set((attrs.class || "").split(/\s+/).filter(Boolean));
      this.classList = { toggle(name, yes) { if (yes) names.add(name); else names.delete(name); },
        contains(name) { return names.has(name); } };
    }
    set innerHTML(_) { throw new Error("File names must never be injected as HTML"); }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    replaceChildren(...items) { this.children = items; }
    addEventListener(name, fn) {
      const list = this.events.get(name) || []; list.push(fn); this.events.set(name, list);
    }
    dispatch(name, values = {}) {
      const event = { target: this, clientX: 300, preventDefault() {}, ...values };
      for (const fn of this.events.get(name) || []) fn(event);
    }
    click() { this.dispatch("click"); }
    getBoundingClientRect() { return { left: 0, width: 580, height: 200 }; }
    getContext(kind) { assert.equal(kind, "2d"); return drawing; }
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const attrs = {};
    for (const token of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[token[1]] = token[2] ?? "";
    if (!attrs.id?.startsWith("compare") && !attrs["data-compare-i18n"]) continue;
    const element = new Element(match[1], attrs);
    if (attrs.id) elements.set(attrs.id, element);
    if (attrs["data-compare-i18n"]) translations.push(element);
  }
  const document = {
    getElementById(id) { assert.ok(elements.has(id), `Missing Compare control #${id}`); return elements.get(id); },
    createElement(tag) { assert.equal(tag, "option"); return new Element(tag); },
    querySelectorAll(selector) { assert.equal(selector, "[data-compare-i18n]"); return translations; }
  };
  const nodes = [], buffers = [], gains = [];
  const param = () => ({ events: [],
    setValueAtTime(...args) { this.events.push(["set", ...args]); },
    linearRampToValueAtTime(...args) { this.events.push(["ramp", ...args]); },
    setTargetAtTime(...args) { this.events.push(["target", ...args]); }
  });
  const context = {
    currentTime: 0,
    createBuffer(count, frames, sampleRate) {
      const channels = Array.from({ length: count }, () => new Float32Array(frames));
      const buffer = { channels, sampleRate, getChannelData(i) { return channels[i]; } };
      buffers.push(buffer); return buffer;
    },
    createBufferSource() {
      const node = { stops: 0, started: false, connect(to) { this.target = to; },
        disconnect() {}, stop() { this.stops++; },
        start(...args) { this.started = true; this.startArgs = args; }, onended: null };
      nodes.push(node); return node;
    },
    createGain() {
      const gain = { gain: param(), connect(to) { this.target = to; }, disconnect() {} };
      gains.push(gain); return gain;
    }
  };
  const owner = { context, output: {}, readyCalls: 0,
    async readyContext() { this.readyCalls++; return context; } };
  const window = { devicePixelRatio: 2, setTimeout, clearTimeout,
    setInterval(fn) { const id = ++nextInterval; intervals.set(id, fn); return id; },
    clearInterval(id) { intervals.delete(id); },
    navigator: { mediaDevices: { getUserMedia() { throw new Error("Unsolicited mic permission"); } } } };
  let analysis = null;
  const controller = new compare.Controller({ document, window, contextOwner: owner,
    getAnalysis: () => analysis, onMic: key => microphones.push(key) });
  // Tests use short deterministic PCM; the app itself lazy-loads catalog examples.
  controller.active = true; controller.initialized = true;
  const get = id => document.getElementById(id);
  const load = (key, value, source = { kind: "generated", classId: "reference", exampleId: "reference-sine-440" }) =>
    controller.load(key, async () => value, source);
  return { controller, get, microphones, owner, context, draws, nodes, buffers, gains, intervals,
    load, setAnalysis(value) { analysis = value; } };
}

test("C2a keeps peer Analysis sub-tabs, moves Single source modes to its right chart, and adds an A/B overlay", () => {
  const f = fixture();
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.match(html, /id="analysisKindModes"[\s\S]*id="analysisKindSingle"[\s\S]*id="analysisKindCompare"[\s\S]*id="analysisViewModes"[\s\S]*id="analysisViewSpectrum"[\s\S]*id="analysisViewSpectro"/);
  assert.match(html, /id="compareKindModes"[\s\S]*id="compareKindSingle"[\s\S]*id="compareKindCompare"/);
  assert.doesNotMatch(html, /id="analysisViewCompare"|id="compareNavSpectrum"|id="compareNavSpectro"/);
  assert.match(html, /id="analysisCompareWorkspace" hidden/);
  const singleLeft = html.slice(html.indexOf('id="analysisWorkspace"'), html.indexOf('id="analysisOfflineVisuals"'));
  assert.doesNotMatch(singleLeft, /id="analysisPlay"|id="analysisVolume"|id="analysisViewModes"|id="analysisSpectrumModes"/);
  assert.match(html.slice(html.indexOf('id="analysisWaveTitle"'), html.indexOf('id="analysisWaveCanvas"')),
    /id="analysisPlay"[\s\S]*id="analysisVolume"/);
  const singleResult = html.slice(html.indexOf('class="analysis-result-toolbar"'), html.indexOf('id="analysisSpectrumView"'));
  assert.match(singleResult, /id="analysisViewModes"[\s\S]*id="analysisViewSpectrum"[\s\S]*id="analysisViewSpectro"/);
  assert.match(singleResult, /id="analysisSpectrumModes"[\s\S]*id="analysisAtCursor"[\s\S]*id="analysisAverage"/);
  const compareLeft = html.slice(html.indexOf('id="analysisCompareWorkspace"'), html.indexOf('class="visuals compare-visuals"'));
  assert.doesNotMatch(compareLeft, /id="compare[AB]Play"|id="compare[AB]Volume"/);
  for (const key of ["A", "B"]) {
    const plot = html.slice(html.indexOf(`id="compare${key}VisualTitle"`),
      html.indexOf(`id="compare${key}Wave"`));
    assert.match(plot, new RegExp(`id="compare${key}Play"[\\s\\S]*id="compare${key}Volume"`));
  }
  assert.match(compareLeft, /id="compareVolume"[^>]*value="100"/);
  assert.match(html, /id="compareAClass"[\s\S]*id="compareAExample"[\s\S]*id="compareAOpen"[\s\S]*id="compareAMic"/);
  assert.match(html, /id="compareBClass"[\s\S]*id="compareBExample"[\s\S]*id="compareBOpen"[\s\S]*id="compareBMic"/);
  const compareResults = html.slice(html.indexOf('class="visuals compare-visuals"'), html.indexOf('id="analysisMicWorkspace"'));
  assert.match(compareResults, /id="compareAVisualTitle"[\s\S]*id="compareBVisualTitle"[\s\S]*class="panel chart-panel compare-sync-panel"[\s\S]*class="panel chart-panel compare-overlay-panel"/);
  assert.match(compareResults, /id="compareSyncModeA"[\s\S]*id="compareSyncModeB"[\s\S]*id="compareSyncModeBoth"[\s\S]*id="compareSyncModeAuto"[\s\S]*id="compareSyncSwitchPeriod"[\s\S]*id="compareSyncReplay"[\s\S]*id="compareSyncPlay"[\s\S]*id="compareSyncSeek"[\s\S]*id="compareSyncOffsetNumber"/);
  assert.match(compareResults, /id="compareLinkCursors"[\s\S]*id="compareNormalize"[\s\S]*id="compareOverlaySpectrum"/);
  const singleCards = compareResults.slice(0, compareResults.indexOf('class="panel chart-panel compare-overlay-panel"'));
  assert.doesNotMatch(singleCards, /id="compare[AB]Spectrum"/, "individual FFT charts leave the main A/B cards");
  assert.match(compareResults, /id="compareIndividualDetails"[\s\S]*id="compareASpectrum"[\s\S]*id="compareBSpectrum"/);
  assert.equal(f.get("compareIndividualDetails").open, undefined, "individual spectra start collapsed");
  assert.deepEqual(f.controller.slots.A.pcm, null);
  assert.deepEqual(f.controller.slots.B.pcm, null);
  assert.equal(f.owner.readyCalls, 0);
  f.controller.renderLanguage("en");
  assert.equal(f.get("compareTitle").textContent, "Compare two sounds");
  assert.equal(f.get("compareKindSingle").textContent, "Single source");
  assert.equal(f.get("compareKindCompare").textContent, "Compare");
  assert.equal(f.get("compareVolumeValue").textContent, "100%");
  assert.equal(f.get("compareAMic").textContent, "Microphone…");
  assert.equal(f.get("compareOverlayTitle").textContent, "Spectral comparison A/B");
  assert.match(singleCards, /data-compare-i18n="visualTitle">Долгионы хэлбэр/);
  assert.equal(f.get("compareIndividualDetails").tagName, "DETAILS");
  assert.equal(f.get("compareLinkCursors").checked, false);
  assert.equal(f.get("compareNormalize").checked, false);
  f.get("compareAMic").click(); f.get("compareBMic").click();
  assert.deepEqual(f.microphones, ["A", "B"]);
});

test("C2a overlays native spectra without resampling or silently normalizing their amplitudes", () => {
  const am = new Float64Array(201), bm = new Float64Array(201);
  am[3] = .4; bm[4] = .1;
  const slots = {
    A: { pcm: { sampleRate: 16000 }, spectrum: { magnitudes: am, binHz: 40, fftSize: 400 } },
    B: { pcm: { sampleRate: 8000 }, spectrum: { magnitudes: bm, binHz: 20, fftSize: 400 } }
  };
  const original = compare.overlayModel(slots, { maxHz: 5000, axis: "log" });
  assert.equal(original.low, 20);
  assert.equal(original.high, 5000);
  assert.deepEqual(original.traces.map(t => [t.key, t.spectrum.binHz, t.nyquist, t.last, t.referenceDb]),
    [["A", 40, 8000, 125, 0], ["B", 20, 4000, 200, 0]]);
  assert.deepEqual(original.traces.map(t => t.windowMs), [25, 50]);
  const normalized = compare.overlayModel(slots, { maxHz: 5000, normalize: true });
  assert.ok(Math.abs(normalized.traces[0].referenceDb - 20 * Math.log10(.4)) < 1e-10);
  assert.ok(Math.abs(normalized.traces[1].referenceDb - 20 * Math.log10(.1)) < 1e-10);
  assert.equal(am[3], .4);
  assert.equal(bm[4], .1);
  assert.equal(compare.overlayModel({ A: {}, B: {} }), null);
});

test("S083 subtracts continuous spectral amplitudes and optionally displays a floored dB ratio at unequal rates", () => {
  const a = pcm([sine(16000, 1, 440, .4)], 16000);
  const b = pcm([sine(48000, 1, 440, .2)], 48000);
  const slots = { A: { pcm: a, channel: 0, cursor: .5 }, B: { pcm: b, channel: 0, cursor: .5 } };
  const matched = compare.matchedSpectra(slots, 16384);
  assert.equal(matched.fftSamples, 16384);
  assert.ok(Math.abs(matched.A.windowSeconds - matched.B.windowSeconds) < 1 / 16000);
  assert.notEqual(matched.A.windowSamples, matched.B.windowSamples);
  const model = compare.differenceModel(matched, { axis: "linear", maxHz: 50000 });
  assert.equal(model.high, 8000, "no imaginary measurements beyond the lower native Nyquist");
  assert.equal(model.low, 0);
  const probe = compare.differenceAt(model, 440);
  assert.equal(probe.valid, true);
  assert.ok(Math.abs(probe.delta - .2) < .015, `expected ~0.2 amplitude difference, received ${probe.delta}`);
  const relative = compare.differenceModel(matched, { axis: "log", maxHz: 5000, normalize: true });
  assert.ok(Math.abs(compare.differenceAt(relative, 440).delta) < .5, "matching peaks removes a global gain difference from shape");
  assert.equal(compare.differenceAt(model, 9000), null);
  assert.equal(compare.differenceAt(relative, 0), null, "logarithmic axis starts above zero");
  assert.equal(compare.differenceAt(model, 2000).valid, true, "small amplitudes remain in the continuous difference");
  const ratio = compare.differenceModel(matched, { axis: "linear", maxHz: 5000, measure: "ratio" });
  assert.ok(Math.abs(compare.differenceAt(ratio, 440).delta - 6.0206) < .4);
  assert.ok(Math.abs(compare.differenceAt(compare.differenceModel(matched, {
    axis: "linear", maxHz: 5000, measure: "ratio", normalize: true }), 440).delta) < .5);
  assert.equal(a.channels[0][10], sine(16000, 1, 440, .4)[10]);
});

test("S083 keeps overlay default, switches three peer views, probes amplitudes and dB without playing", async () => {
  const f = fixture();
  assert.equal(f.get("compareShowOverlay").attrs["aria-pressed"], "true");
  assert.equal(f.get("compareDifferenceView").hidden, true);
  const a = pcm([sine(16000, 1, 440, .4)], 16000);
  const b = pcm([sine(48000, 1, 440, .2)], 48000);
  await f.load("A", a); await f.load("B", b);
  f.controller.setCursor("A", .5); f.controller.setCursor("B", .5);
  f.get("compareShowDifference").click();
  assert.equal(f.get("compareOverlayView").hidden, true);
  assert.equal(f.get("compareDifferenceView").hidden, false);
  assert.equal(f.get("compareShowDifference").attrs["aria-pressed"], "true");
  assert.match(f.get("compareDifferenceInfo").textContent, /Hann 85\.33 ms|Hann 85\.33/);
  f.get("compareDifferenceHz").value = "440";
  f.get("compareDifferenceHz").dispatch("input");
  assert.match(f.get("compareDifferenceProbe").textContent, /A−B/);
  assert.match(f.get("compareDifferenceProbe").textContent, /A−B \+(0\.1\d|0\.2)/);
  f.get("compareDifferenceNormalize").checked = true;
  f.get("compareDifferenceNormalize").dispatch("change");
  assert.match(f.get("compareDifferenceInfo").textContent, /зураг/);
  assert.match(f.get("compareDifferenceProbe").textContent, /оргилд харьцуулсан/);
  f.controller.renderLanguage("en");
  assert.equal(f.get("compareShowDifference").textContent, "Difference A−B");
  assert.match(f.get("compareDifferenceNote").textContent, /interpolated/);
  assert.match(f.get("compareDifferenceTitle").textContent, /amplitude/);
  f.get("compareDifferenceNormalize").checked = false;
  f.get("compareDifferenceNormalize").dispatch("change");
  f.get("compareShowRatio").click();
  assert.equal(f.get("compareShowRatio").attrs["aria-pressed"], "true");
  assert.match(f.get("compareDifferenceTitle").textContent, /ratio/);
  assert.match(f.get("compareDifferenceProbe").textContent, /A\/B \+(5\.9\d|6\.0\d) dB/);
  assert.match(f.get("compareDifferenceNote").textContent, /floor/);
  f.get("compareShowDifference").click();
  f.get("compareDifferenceHz").value = "20000"; f.get("compareDifferenceHz").dispatch("input");
  assert.match(f.get("compareDifferenceProbe").textContent, /inside the shared/);
  f.get("compareDifferenceSpectrum").dispatch("pointerdown", { clientX: 330 });
  assert.ok(Number(f.get("compareDifferenceHz").value) > 20, "click probes a physical Hz coordinate");
  f.get("compareDifferenceSpectrum").dispatch("keydown", { key: "Home" });
  assert.equal(Number(f.get("compareDifferenceHz").value), 20, "keyboard Home moves to the displayed low frequency");
  f.get("compareDifferenceHz").value = "440"; f.get("compareDifferenceHz").dispatch("input");
  f.get("compareShowOverlay").click();
  assert.equal(f.get("compareDifferenceView").hidden, true);
  assert.equal(f.get("compareOverlayView").hidden, false);
  assert.match(f.get("compareOverlayInfo").textContent, /Original levels/);
  assert.equal(f.owner.readyCalls, 0);
});

test("S083 retains silent spectral points in signed amplitude difference and floor-limits level ratio", async () => {
  const f = fixture(), a = pcm([sine(16000, .15, 440, .4)], 16000);
  const silence = pcm([new Float32Array(48000)], 48000);
  await f.load("A", a); await f.load("B", silence);
  f.get("compareShowDifference").click();
  f.get("compareDifferenceHz").value = "440"; f.get("compareDifferenceHz").dispatch("input");
  assert.match(f.get("compareDifferenceProbe").textContent, /A−B/);
  assert.match(f.get("compareDifferenceStatus").textContent, /холбов/);
  f.get("compareShowRatio").click();
  assert.match(f.get("compareDifferenceProbe").textContent, /босгоор хязгаарласан/);
  assert.match(f.get("compareDifferenceStatus").textContent, /−90/);
  f.controller.setCursor("A", 0);
  assert.match(f.get("compareDifferencePadding").textContent, /A-ийн/);
  assert.equal(f.controller.slots.A.pcm, a);
  assert.equal(f.controller.slots.B.pcm, silence);
  assert.equal(f.owner.readyCalls, 0);
});

test("S083 gives a negative 220-Hz and positive 440-Hz magnitude difference without spectral gaps", () => {
  const a = pcm([sine(44100, 1, 440, .5)], 44100);
  const b = pcm([sine(44100, 1, 220, .25)], 44100);
  const slots = { A: { pcm: a, channel: 0, cursor: .5 }, B: { pcm: b, channel: 0, cursor: .5 } };
  const matched = compare.matchedSpectra(slots, 4096);
  const model = compare.differenceModel(matched, { axis: "log", maxHz: 5000 });
  assert.ok(compare.differenceAt(model, 220).delta < -.2, "B dominates around its 220-Hz fundamental");
  assert.ok(compare.differenceAt(model, 440).delta > .4, "A dominates around 440 Hz");
  for (let hz = 20; hz <= 5000; hz += 5) {
    const point = compare.differenceAt(model, hz);
    assert.equal(point.valid, true, "no hard floor removes faint frequencies");
    assert.ok(Number.isFinite(point.delta));
  }
  const ratio = compare.differenceModel(matched, { axis: "log", maxHz: 5000, measure: "ratio" });
  assert.ok(compare.differenceAt(ratio, 220).delta < -60);
  assert.ok(compare.differenceAt(ratio, 440).delta > 60);
  assert.equal(compare.differenceAt(ratio, 1000).floorLimited, true);
  assert.ok(Number.isFinite(compare.differenceAt(ratio, 1000).delta), "ratio uses floor instead of gaps");
});

test("C2a links inspection times in seconds, clamps unequal durations and leaves independent mode available", async () => {
  const f = fixture();
  await f.load("A", pcm([sine(16000, .4, 440)], 16000));
  await f.load("B", pcm([sine(8000, .08, 700)], 8000));
  f.controller.renderLanguage("en");
  assert.match(f.get("compareOverlayInfo").textContent, /Original levels \(dBFS\)/);
  assert.match(f.get("compareOverlayInfo").textContent, /above 4000 Hz/);
  f.controller.setCursor("A", .12);
  assert.notEqual(f.controller.slots.B.cursor, .08);
  f.get("compareLinkCursors").checked = true;
  f.get("compareLinkCursors").dispatch("change");
  assert.equal(f.controller.linkCursors, true);
  assert.equal(f.controller.slots.B.cursor, .08, "shorter recording is clamped to its endpoint");
  f.controller.setCursor("B", .03);
  assert.equal(f.controller.slots.A.cursor, .03, "moving B changes A to the same time in seconds");
  const aSpectrum = f.controller.slots.A.spectrum, bSpectrum = f.controller.slots.B.spectrum;
  f.get("compareNormalize").checked = true;
  f.get("compareNormalize").dispatch("change");
  assert.match(f.get("compareOverlayInfo").textContent, /Each displayed peak = 0 dB/);
  assert.equal(f.controller.slots.A.spectrum, aSpectrum, "display normalization never changes FFT samples");
  assert.equal(f.controller.slots.B.spectrum, bSpectrum);
  f.get("compareLinkCursors").checked = false;
  f.get("compareLinkCursors").dispatch("change");
  f.controller.setCursor("A", .2);
  assert.equal(f.controller.slots.B.cursor, .03, "independent inspection resumes when unchecked");
  assert.equal(f.owner.readyCalls, 0, "plot controls never initiate audio");
});

test("S084 shared timeline defines the B offset in seconds without resampling", () => {
  assert.equal(compare.sharedDuration(2, 3, .5), 2.5);
  assert.equal(compare.sharedDuration(2, 3, -.5), 3.5);
  assert.equal(compare.sharedDuration(4, 1, 2), 4);
  assert.equal(compare.sharedDuration(NaN, 2, 0), 0);
  assert.deepEqual(compare.sharedStart(3, 1, .25), { delay: 0, offset: 1.25 });
  assert.deepEqual(compare.sharedStart(3, 0, -.4), { delay: .4, offset: 0 });
  const shifted = compare.sharedStart(3, .5, -.4);
  assert.equal(shifted.delay, 0);
  assert.ok(Math.abs(shifted.offset - .1) < 1e-12);
  assert.equal(compare.sharedStart(3, 2, 1), null, "an exhausted source is absent from this section of the shared timeline");
  assert.equal(compare.sharedStart(3, -1, 0), null);
});

test("S084 switches live A/B/Together gains on one clock and pauses and resumes from the same playhead", async () => {
  const f = fixture();
  const a = pcm([sine(16000, .3, 440)], 16000), b = pcm([sine(48000, .22, 220)], 48000);
  await f.load("A", a); await f.load("B", b);
  const aSpectrum = f.controller.slots.A.spectrum, bSpectrum = f.controller.slots.B.spectrum;
  f.controller.renderLanguage("en");
  assert.equal(f.get("compareSyncPlay").disabled, false);
  assert.equal(f.get("compareSyncModeA").attrs["aria-pressed"], "true");
  f.get("compareSyncModeB").click();
  assert.equal(f.owner.readyCalls, 0, "changing the shared mode cannot autoplay");
  f.get("compareSyncModeA").click();
  assert.equal(await f.controller.playShared(), true);
  assert.equal(f.controller.playingKey, null, "individual players remain independent");
  assert.equal(f.get("compareSyncPlay").attrs["aria-pressed"], "true");
  assert.equal(f.nodes.length, 2);
  assert.deepEqual(f.buffers.map(buffer => buffer.sampleRate), [16000, 48000]);
  assert.deepEqual(f.nodes.map(node => node.startArgs), [[0, 0], [0, 0]]);
  assert.deepEqual(f.gains.map(g => g.gain.events.at(-1)[1]), [.2, 0]);
  f.get("compareSyncModeB").click();
  assert.equal(f.nodes.length, 2, "switching must not restart either native playback buffer");
  assert.equal(f.nodes[0].stops, 0);
  assert.deepEqual(f.gains.map(g => g.gain.events.at(-1)[1]), [0, .2]);
  f.get("compareSyncModeBoth").click();
  assert.deepEqual(f.gains.map(g => g.gain.events.at(-1)[1]), [.1, .1], "a shared mix leaves headroom");
  f.get("compareVolume").value = "50"; f.get("compareVolume").dispatch("input");
  assert.deepEqual(f.gains.map(g => g.gain.events.at(-1)[1]), [.05, .05]);
  f.get("compareAVolume").value = "40"; f.get("compareAVolume").dispatch("input");
  assert.deepEqual(f.gains.map(g => g.gain.events.at(-1)[1]), [.1, .05]);
  f.context.currentTime = .07; f.controller.tickShared();
  assert.match(f.get("compareSyncTime").textContent, /0\.07 \/ 0\.3/);
  f.get("compareSyncPlay").click();
  assert.equal(f.controller.syncVoice, null);
  assert.equal(f.intervals.size, 0);
  assert.ok(Math.abs(f.controller.syncPosition - .07) < 1e-10);
  assert.equal(f.nodes[0].stops, 1);
  assert.equal(await f.controller.playShared(), true);
  assert.equal(f.nodes.length, 4);
  assert.deepEqual(f.nodes.slice(-2).map(node => node.startArgs), [[.07, .07], [.07, .07]]);
  assert.equal(f.controller.slots.A.spectrum, aSpectrum);
  assert.equal(f.controller.slots.B.spectrum, bSpectrum);
  assert.equal(a.channels[0][1], sine(16000, .3, 440)[1], "shared audio must not alter the analysis PCM");
  f.controller.stop();
  assert.equal(f.intervals.size, 0);
  assert.equal(f.nodes[2].stops, 1);
  assert.equal(f.nodes[3].stops, 1);
});

test("S084 manual B offset moves linked inspection cursors and precisely schedules positive/negative offsets", async () => {
  const f = fixture(), a = pcm([sine(16000, .3)], 16000), b = pcm([sine(32000, .2)], 32000);
  await f.load("A", a); await f.load("B", b);
  f.get("compareLinkCursors").checked = true;
  f.get("compareLinkCursors").dispatch("change");
  f.get("compareSyncOffsetNumber").value = "0.05";
  f.get("compareSyncOffsetNumber").dispatch("change");
  f.controller.setCursor("A", .1);
  assert.ok(Math.abs(f.controller.slots.B.cursor - .15) < 1e-10);
  f.controller.setCursor("B", .03);
  assert.equal(f.controller.slots.A.cursor, 0, "reverse-linked cursor is clamped to A's beginning");
  assert.equal(f.owner.readyCalls, 0, "adjusting the offset never starts playback");
  await f.controller.playShared();
  assert.deepEqual(f.nodes.map(node => node.startArgs), [[0, 0], [0, .05]], "positive τ skips B's beginning");
  f.get("compareSyncPlay").click();
  f.get("compareSyncOffsetNumber").value = "-0.04";
  f.get("compareSyncOffsetNumber").dispatch("change");
  f.controller.setCursor("A", .07);
  assert.ok(Math.abs(f.controller.slots.B.cursor - .03) < 1e-10);
  assert.equal(await f.controller.playShared(), true);
  assert.deepEqual(f.nodes.slice(-2).map(node => node.startArgs), [[0, 0], [.04, 0]], "negative τ delays B's entrance");
  f.context.currentTime = .06;
  assert.equal(await f.controller.seekShared(.08), true);
  assert.deepEqual(f.nodes.slice(-2).map(node => node.startArgs), [[.06, .08], [.06, .04]]);
  assert.equal(await f.controller.setSyncOffset(.05), true);
  assert.ok(Math.abs(f.controller.syncPosition - .08) < 1e-10);
  assert.deepEqual(f.nodes.slice(-2).map(node => node.startArgs), [[.06, .08], [.06, .13]],
    "changing alignment while playing restarts at the current shared time");
  f.get("compareLinkCursors").checked = false;
  f.get("compareLinkCursors").dispatch("change");
  const independent = f.controller.slots.B.cursor;
  f.controller.setCursor("A", .11);
  assert.equal(f.controller.slots.B.cursor, independent, "unlinked inspection is still independent");
  await f.controller.setSyncOffset(0);
  assert.equal(Number(f.get("compareSyncOffsetNumber").value), 0);
  f.controller.stop();
  assert.equal(f.intervals.size, 0);
});

test("S084 shared transport completes, stops when an independent player takes over, and cancels pending starts", async () => {
  const f = fixture();
  await f.load("A", pcm([sine(16000, .12)], 16000));
  await f.load("B", pcm([sine(16000, .08)], 16000));
  assert.equal(await f.controller.playShared(), true);
  const first = f.controller.syncVoice;
  first.voices[0].node.onended();
  assert.equal(f.controller.syncVoice, first, "the shorter branch may end before the shared timeline");
  first.voices[1].node.onended();
  assert.equal(f.controller.syncVoice, null);
  assert.equal(f.controller.syncPosition, 0, "natural completion returns to the beginning");
  assert.equal(f.intervals.size, 0);
  assert.equal(await f.controller.playShared(), true);
  const sharedNodes = f.nodes.slice(-2);
  assert.equal(await f.controller.play("A"), true);
  assert.equal(f.controller.syncVoice, null);
  assert.deepEqual(sharedNodes.map(n => n.stops), [1, 1]);
  assert.equal(f.controller.playingKey, "A");
  f.controller.stop();
  let release;
  f.owner.readyContext = () => new Promise(resolve => { release = resolve; });
  const pending = f.controller.playShared();
  assert.equal(f.controller.syncStarting, true);
  const nodesBefore = f.nodes.length;
  f.controller.stop();
  release(f.context);
  assert.equal(await pending, false);
  assert.equal(f.nodes.length, nodesBefore, "cancelled start must never attach fresh audio nodes");
  assert.equal(f.intervals.size, 0);
});

test("S085 Auto A/B offers a bilingual, non-autoplaying repeated-excerpt audition", async () => {
  const f = fixture();
  await f.load("A", pcm([sine(16000, 1)], 16000));
  await f.load("B", pcm([sine(48000, 1)], 48000));
  f.controller.renderLanguage("en");
  assert.equal(f.get("compareSyncModeAuto").textContent, "Auto A/B");
  assert.equal(f.get("compareSyncAutoControls").hidden, true);
  assert.equal(f.get("compareSyncSwitchPeriod").value, "0.6");
  assert.equal(f.get("compareSyncReplay").checked, true);
  assert.equal(f.get("compareSyncSwitchPeriod").children[1].textContent, "0.6 s");
  f.get("compareSyncModeAuto").click();
  assert.equal(f.controller.syncMode, "auto");
  assert.equal(f.get("compareSyncModeAuto").attrs["aria-pressed"], "true");
  assert.equal(f.get("compareSyncAutoControls").hidden, false);
  assert.equal(f.get("compareSyncPositionLabel").textContent, "Repeated excerpt starts at");
  assert.match(f.get("compareSyncAutoHelp").textContent, /pluck/);
  assert.equal(f.owner.readyCalls, 0, "mode, period and repeat controls must never autoplay");
  f.get("compareSyncSwitchPeriod").value = "1";
  f.get("compareSyncSwitchPeriod").dispatch("change");
  assert.equal(f.controller.syncSwitchPeriod, 1);
  f.get("compareSyncReplay").checked = false;
  f.get("compareSyncReplay").dispatch("change");
  assert.equal(f.controller.syncReplay, false);
  assert.match(f.get("compareSyncAutoHelp").textContent, /original recordings/);
  assert.equal(f.get("compareSyncPositionLabel").textContent, "Shared playback position");
  f.controller.renderLanguage("mn");
  assert.equal(f.get("compareSyncModeAuto").textContent, "A/B ээлжлэх");
  assert.equal(f.get("compareSyncSwitchPeriod").children[1].textContent, "0.6 сек");
  assert.match(f.get("compareSyncAutoHelp").textContent, /эх бичлэг/);
  assert.equal(f.owner.readyCalls, 0);
});

test("S085 repeated Auto A/B loops each native short excerpt with audio-clock gated turns", async () => {
  const f = fixture();
  const a = pcm([sine(16000, 2, 440, .45)], 16000);
  const pluck = new Float32Array(48000 * 2);
  pluck[480] = .7; pluck[24000] = .01; // An early attack and much weaker late content.
  const b = pcm([pluck], 48000);
  await f.load("A", a); await f.load("B", b);
  f.controller.renderLanguage("en");
  f.get("compareSyncModeAuto").click();
  assert.equal(await f.controller.playShared(), true);
  const shared = f.controller.syncVoice;
  assert.equal(shared.auto, true); assert.equal(shared.repeat, true);
  assert.equal(shared.period, .6);
  assert.deepEqual(f.buffers.map(buffer => [buffer.sampleRate, buffer.channels[0].length]),
    [[16000, 9600], [48000, 28800]], "only excerpts are copied at original native rates");
  assert.deepEqual(f.nodes.map(node => node.startArgs), [[.025, 0], [.025, 0]]);
  assert.deepEqual(f.nodes.map(node => node.loop), [true, true]);
  assert.deepEqual(f.nodes.map(node => node.loopStart), [0, 0]);
  assert.deepEqual(f.nodes.map(node => node.loopEnd), [.6, .6]);
  assert.ok(Math.abs(f.buffers[1].channels[0][480] - .7) < 1e-6,
    "B's initial pluck is present each time its loop restarts");
  assert.ok(Math.abs(f.buffers[1].channels[0][24000] - .01) < 1e-6,
    "B retains its quiet tail inside the excerpt, but loops back to the attack on its next turn");
  assert.equal(f.gains.length, 4, "Auto uses independent volume controls and scheduled A/B gates");
  const [aVolume, aGate, bVolume, bGate] = f.gains;
  assert.deepEqual([aVolume.target, bVolume.target], [aGate, bGate]);
  assert.equal(aGate.target, f.owner.output); assert.equal(bGate.target, f.owner.output);
  const aTurns = aGate.gain.events.filter(event => event[0] === "target");
  assert.deepEqual(aTurns.slice(0, 3).map(event => [event[1], event[3]]), [[1, .006], [0, .006], [1, .006]]);
  assert.ok(Math.abs(aTurns[0][2] - .025) < 1e-10 && Math.abs(aTurns[1][2] - .625) < 1e-10 &&
    Math.abs(aTurns[2][2] - 1.225) < 1e-10);
  assert.deepEqual(bGate.gain.events.filter(event => event[0] === "target").slice(0, 2),
    [["target", 0, .025, .006], ["target", 1, .625, .006]]);
  const scheduled = aGate.gain.events.length;
  f.get("compareBVolume").value = "60"; f.get("compareBVolume").dispatch("input");
  assert.equal(bVolume.gain.events.at(-1)[1], .6);
  assert.equal(aGate.gain.events.length, scheduled, "volume changes must not override gate automation");
  f.context.currentTime = 10; f.controller.tickShared();
  assert.equal(f.controller.syncVoice, shared, "a repeated audition does not finish at original source end");
  assert.equal(f.controller.currentSyncPosition(), 0, "the seek slider remains anchored at excerpt start");
  assert.ok(f.controller.sharedMarkerTime() > 0 && f.controller.sharedMarkerTime() < .6);
  assert.match(f.get("compareSyncStatus").textContent, /repeating 0.6 s/);
  assert.equal(a.channels[0][1], sine(16000, 2, 440, .45)[1], "analysis PCM is unchanged");
  assert.ok(Math.abs(b.channels[0][480] - .7) < 1e-6);
  f.get("compareSyncPlay").click();
  assert.equal(f.controller.syncVoice, null);
  assert.equal(f.controller.syncPosition, 0);
  assert.equal(f.intervals.size, 0);
  assert.deepEqual(f.nodes.map(node => node.stops), [1, 1]);
});

test("S085 repetition honors positive/negative B offsets, excerpt seeking, and cancel on global stop", async () => {
  const f = fixture(), a = pcm([sine(8000, 1)], 8000);
  const bSamples = new Float32Array(16000);
  bSamples.fill(.3);
  const b = pcm([bSamples], 16000);
  await f.load("A", a); await f.load("B", b);
  f.get("compareSyncModeAuto").click();
  await f.controller.seekShared(.15);
  await f.controller.setSyncOffset(.05);
  assert.equal(await f.controller.playShared(), true);
  assert.ok(Math.abs(f.buffers[1].channels[0][160] - .3) < 1e-6,
    "positive B offset reads later native samples");
  assert.equal(f.controller.syncPosition, .15);
  f.context.currentTime = .4;
  assert.equal(await f.controller.seekShared(.2), true);
  assert.equal(f.controller.syncPosition, .2);
  assert.ok(Math.abs(f.buffers[3].channels[0][160] - .3) < 1e-6);
  assert.equal(await f.controller.setSyncOffset(-.4), true);
  const delayedB = f.buffers[5].channels[0];
  assert.equal(delayedB[160], 0, "negative B time generates true silence before source start");
  assert.ok(Math.abs(delayedB[3200 + 160] - .3) < 1e-6,
    "B arrives after 0.2 s padding without shifting the PCM");
  const beforeStop = f.nodes.length;
  f.controller.stop();
  assert.equal(f.intervals.size, 0);
  assert.equal(f.controller.syncVoice, null);
  assert.equal(f.nodes.length, beforeStop);
  assert.equal(a.channels[0][0], 0); assert.ok(Math.abs(b.channels[0][160] - .3) < 1e-6);
});

test("S085 continuous Auto A/B switches on the native shared timeline and ends naturally", async () => {
  const f = fixture();
  await f.load("A", pcm([sine(16000, .55)], 16000));
  await f.load("B", pcm([sine(48000, .45)], 48000));
  f.get("compareSyncModeAuto").click();
  await f.controller.setSyncAutoOptions(.3, false);
  assert.equal(await f.controller.playShared(), true);
  assert.equal(f.controller.syncVoice.repeat, false);
  assert.equal(f.controller.syncVoice.auto, true);
  assert.deepEqual(f.buffers.map(buffer => buffer.channels[0].length), [8800, 21600],
    "continuous Auto keeps full original audio buffers");
  assert.deepEqual(f.nodes.map(node => node.startArgs), [[.025, 0], [.025, 0]]);
  assert.deepEqual(f.nodes.map(node => node.loop), [undefined, undefined]);
  assert.deepEqual(f.gains[1].gain.events.filter(e => e[0] === "target").slice(0, 2).map(e => e[1]), [1, 0]);
  assert.deepEqual(f.gains[3].gain.events.filter(e => e[0] === "target").slice(0, 2).map(e => e[1]), [0, 1]);
  f.context.currentTime = .2; f.controller.tickShared();
  assert.ok(Math.abs(f.controller.currentSyncPosition() - .175) < 1e-9);
  assert.match(f.get("compareSyncTime").textContent, /0\.18 \/ 0\.55/);
  f.context.currentTime = .59; f.controller.tickShared();
  assert.equal(f.controller.syncVoice, null, "no repeat means completion at shared duration");
  assert.equal(f.controller.syncPosition, 0);
  assert.equal(f.intervals.size, 0);
});

test("S085 toggles Auto during playback safely, restarts after period changes and never autoplays when stopped", async () => {
  const f = fixture();
  await f.load("A", pcm([sine(8000, 2)], 8000));
  await f.load("B", pcm([sine(16000, 2)], 16000));
  assert.equal(await f.controller.playShared(), true);
  f.context.currentTime = .27;
  assert.equal(await f.controller.setSyncMode("auto"), true);
  assert.ok(Math.abs(f.controller.syncPosition - .27) < 1e-10);
  assert.equal(f.controller.syncVoice.repeat, true);
  assert.deepEqual(f.nodes.slice(0, 2).map(node => node.stops), [1, 1]);
  const firstAuto = f.controller.syncVoice;
  f.context.currentTime = .43;
  assert.equal(await f.controller.setSyncAutoOptions(1, true), true);
  assert.notEqual(f.controller.syncVoice, firstAuto);
  assert.ok(Math.abs(f.controller.syncPosition - .27) < 1e-10, "changing period keeps the excerpt start");
  assert.equal(f.controller.syncVoice.period, 1);
  f.context.currentTime = .63;
  const marker = f.controller.sharedMarkerTime();
  assert.equal(await f.controller.setSyncMode("B"), true);
  assert.ok(Math.abs(f.controller.syncPosition - marker) < 1e-10,
    "leaving a repeated audition returns to the audible point on the original timeline");
  assert.equal(f.controller.syncVoice.auto, false);
  assert.equal(f.controller.syncMode, "B");
  f.controller.stop();
  const calls = f.owner.readyCalls;
  await f.controller.setSyncMode("auto");
  await f.controller.setSyncAutoOptions(.6, false);
  assert.equal(f.owner.readyCalls, calls, "stopped mode/option changes never request the audio context");
});


function alignmentPcm(rate, duration, attacks, { gain = .65, frequency = 430, noise = 0 } = {}) {
  const samples = new Float32Array(Math.round(rate * duration));
  for (let i = 0; i < samples.length; i++) {
    const time = i / rate;
    let envelope = 0;
    for (let j = 0; j < attacks.length; j++) {
      const after = time - attacks[j];
      if (after >= 0 && after < .25)
        envelope += Math.exp(-after * (13 + j % 3 * 3)) * (1 - (j % 3) * .17);
    }
    samples[i] = gain * envelope * Math.sin(2 * Math.PI * frequency * time) +
      noise * Math.sin(2 * Math.PI * 137 * time);
  }
  return pcm([samples], rate);
}
test("S086/C2e estimates signed B(t+τ) offset from independent native-rate envelopes", () => {
  const events = [.38, .96, 1.52, 2.43];
  const A = alignmentPcm(16000, 3, events, { frequency: 440 });
  const B = alignmentPcm(22050, 3.6, events.map(t => t + .33),
    { frequency: 660, gain: .19, noise: .001 });
  const originalA = A.channels[0][1200], originalB = B.channels[0][18000];
  const positive = compare.estimateTimeOffset(A, B);
  assert.equal(positive.ok, true, JSON.stringify(positive));
  assert.ok(Math.abs(positive.offset - .33) <= .02, JSON.stringify(positive));
  assert.equal(positive.confidence, "high");
  assert.equal(A.channels[0][1200], originalA);
  assert.equal(B.channels[0][18000], originalB);
  assert.equal(A.sampleRate, 16000); assert.equal(B.sampleRate, 22050);
  const earlyA = alignmentPcm(16000, 3, [.68, 1.32, 1.84, 2.53]);
  const earlyB = alignmentPcm(48000, 3, [.45, 1.09, 1.61, 2.30], { frequency: 600 });
  const negative = compare.estimateTimeOffset(earlyA, earlyB);
  assert.equal(negative.ok, true, JSON.stringify(negative));
  assert.ok(Math.abs(negative.offset + .23) <= .02, JSON.stringify(negative));
});
test("S086/C2e refuses steady tones, silence, unrelated events and ambiguous periodic patterns", () => {
  const A = alignmentPcm(16000, 3, [.38, .96, 1.52, 2.43]);
  assert.equal(compare.estimateTimeOffset(pcm([sine(16000, 3)], 16000), A).reason, "noPattern");
  assert.equal(compare.estimateTimeOffset(A, pcm([new Float32Array(96000)], 32000)).reason, "noPattern");
  const unrelated = alignmentPcm(22050, 3, [.58, 1.27, 1.44, 2.72]);
  assert.equal(compare.estimateTimeOffset(A, unrelated).ok, false);
  const periodic = (rate, duration, delay) => {
    const samples = new Float32Array(Math.round(rate * duration));
    for (let i = 0; i < samples.length; i++) {
      const time = i / rate, phase = ((time - delay - .3) % .4 + .4) % .4;
      samples[i] = phase < .13 ? .7 * Math.exp(-25 * phase) * Math.sin(2 * Math.PI * 430 * time) : 0;
    }
    return pcm([samples], rate);
  };
  const repeating = compare.estimateTimeOffset(periodic(8000, 4, 0), periodic(11025, 4.2, .2));
  assert.equal(repeating.ok, false, JSON.stringify(repeating));
  assert.equal(repeating.reason, "ambiguous");
});
test("S086/C2e respects chosen stereo channel and never guesses a silent side", () => {
  const A = alignmentPcm(12000, 3, [.4, 1.03, 1.55, 2.29]);
  const bCorrect = alignmentPcm(24000, 3.4, [.62, 1.25, 1.77, 2.51], { frequency: 720 });
  const B = pcm([new Float32Array(bCorrect.frames), bCorrect.channels[0]], 24000);
  assert.equal(compare.estimateTimeOffset(A, B, { channelB: 0 }).ok, false);
  const result = compare.estimateTimeOffset(A, B, { channelB: 1 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(Math.abs(result.offset - .22) <= .02);
});
test("S086/C2e only suggests alignment until explicitly applied; edits invalidate the estimate", async () => {
  const f = fixture();
  const A = alignmentPcm(16000, 3, [.38, .96, 1.52, 2.43]);
  const B = alignmentPcm(22050, 3.4, [.71, 1.29, 1.85, 2.76], { frequency: 660 });
  await f.load("A", A); await f.load("B", B);
  f.controller.renderLanguage("en");
  assert.equal(f.get("compareSyncEstimate").textContent, "Estimate B offset");
  assert.equal(f.get("compareSyncApplyEstimate").hidden, true);
  assert.equal(f.get("compareSyncEstimate").disabled, false);
  assert.equal(await f.controller.estimateSyncOffset(), true);
  assert.equal(f.controller.syncOffset, 0, "estimation itself must not alter playback");
  assert.equal(f.get("compareSyncApplyEstimate").hidden, false);
  assert.match(f.get("compareSyncEstimateResult").textContent, /Suggested τ = \+0\.33/);
  assert.equal(f.owner.readyCalls, 0, "estimation must not start any audio");
  assert.equal(f.controller.applySyncEstimate(), true);
  assert.ok(Math.abs(f.controller.syncOffset - .33) < .02);
  assert.equal(f.get("compareSyncApplyEstimate").hidden, true);
  assert.match(f.get("compareSyncEstimateResult").textContent, /Applied τ/);
  assert.equal(f.owner.readyCalls, 0);
  f.controller.setSyncOffset(-.15);
  assert.equal(f.controller.alignmentResult, null, "manual adjustment clears the previous suggestion");
  assert.equal(f.get("compareSyncEstimateResult").textContent, "");
  assert.equal(await f.controller.estimateSyncOffset(), true);
  await f.load("B", alignmentPcm(22050, 3, [.21, .88, 1.49, 2.29]));
  assert.equal(f.controller.alignmentResult, null, "replacing the source invalidates an estimate");
  assert.equal(f.get("compareSyncApplyEstimate").hidden, true);
  f.controller.renderLanguage("mn");
  assert.equal(f.get("compareSyncEstimate").textContent, "B-ийн зөрүүг тооцох");
  assert.equal(A.channels[0].length, A.frames);
  assert.equal(B.channels[0].length, B.frames);
});
test("S086/C2e reports an unalignable sine-vs-pluck pair without playback or changing τ", async () => {
  const f = fixture();
  await f.load("A", pcm([sine(16000, 2, 440, .5)], 16000));
  await f.load("B", alignmentPcm(22050, 3, [0], { frequency: 220 }));
  assert.equal(await f.controller.estimateSyncOffset(), false);
  assert.match(f.get("compareSyncEstimateResult").textContent, /Найдвартай зөрүү олдсонгүй/);
  assert.equal(f.get("compareSyncApplyEstimate").hidden, true);
  assert.equal(f.controller.syncOffset, 0);
  assert.equal(f.owner.readyCalls, 0);
});

test("C1 compares modeled guitar A with microphone piano B at different rates and keeps origins explicit", async () => {
  const f = fixture(), a = pcm([sine(16000, .2, 220)], 16000);
  assert.equal(await f.load("A", a, { kind: "modeled", classId: "instruments", exampleId: "model-guitar-a3" }), true);
  const bLeft = sine(22050, .15, 523.25), bRight = new Float32Array(bLeft.length);
  const bWav = floatWav([bLeft, bRight], 22050);
  const bBlob = new Blob([bWav], { type: "audio/wav" });
  assert.equal(await f.controller.openPrepared("B", bBlob, "piano-mic.wav", {
    kind: "microphone", captureMode: "take", recordedAt: "2026-11-07T00:00:00Z"
  }), true);
  assert.equal(f.controller.slots.A.pcm, a);
  assert.equal(f.controller.slots.A.pcm.sampleRate, 16000);
  assert.equal(f.controller.slots.B.pcm.sampleRate, 22050);
  assert.equal(f.controller.slots.B.source.kind, "microphone");
  assert.equal(f.controller.slots.B.source.captureMode, "take");
  assert.equal(f.get("compareABadge").textContent, "Хөгжмийн загвар");
  assert.equal(f.get("compareBBadge").textContent, "Микрофоны бичлэг");
  assert.match(f.get("compareBDescription").textContent, /тусгайлан/);
  assert.equal(f.get("compareBChannelField").hidden, false);
  assert.ok(f.controller.slots.B.index.peak > .35);
  f.get("compareBChannel").value = "1"; f.get("compareBChannel").dispatch("change");
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(f.controller.slots.B.channel, 1);
  assert.equal(f.controller.slots.B.index.peak, 0);
  assert.ok(f.controller.slots.A.index.peak > .35);
  f.get("compareIndividualDetails").open = true;
  f.get("compareIndividualDetails").dispatch("toggle");
  assert.match(f.get("compareBSpectrumInfo").textContent, /Hann 4096/);
  assert.ok(f.draws.count > 50, "Both waveforms and spectra should draw");
  assert.equal(f.owner.readyCalls, 0, "analysis does not start audio");
});

test("C1 independent listening is exclusive; controls do not modify source samples or analysis", async () => {
  const f = fixture(), a = pcm([sine(16000)], 16000), b = pcm([sine(32000, .08, 700)], 32000);
  await f.load("A", a); await f.load("B", b);
  assert.equal(await f.controller.play("A"), true);
  assert.equal(f.controller.playingKey, "A");
  assert.equal(f.buffers[0].sampleRate, 16000);
  assert.deepEqual(f.gains[0].gain.events.at(-1), ["ramp", .2, .008]);
  f.get("compareAVolume").value = "35"; f.get("compareAVolume").dispatch("input");
  assert.equal(f.controller.slots.A.volume, .35);
  assert.deepEqual(f.gains[0].gain.events.at(-1), ["target", .35, 0, .01]);
  f.get("compareBVolume").value = "50"; f.get("compareBVolume").dispatch("input");
  assert.equal(f.controller.slots.B.volume, .5);
  assert.equal(f.gains[0].gain.events.at(-1)[1], .35, "B volume cannot change A listening");
  assert.equal(await f.controller.play("B"), true);
  assert.equal(f.controller.playingKey, "B");
  assert.equal(f.nodes[0].stops, 1);
  assert.equal(f.buffers[1].sampleRate, 32000);
  assert.deepEqual(f.gains[1].gain.events.at(-1), ["ramp", .5, .008]);
  f.get("compareVolume").value = "12"; f.get("compareVolume").dispatch("input");
  assert.equal(f.controller.volume, .12);
  assert.deepEqual(f.gains[1].gain.events.at(-1), ["target", .06, 0, .01]);
  assert.equal(f.get("compareAVolumeValue").textContent, "35%");
  assert.equal(f.get("compareBVolumeValue").textContent, "50%");
  assert.equal(f.get("compareVolumeValue").textContent, "12%");
  f.get("compareBPlay").click();
  assert.equal(f.controller.playingKey, null);
  assert.equal(f.nodes[1].stops, 1);
  assert.equal(f.owner.readyCalls, 2);
  assert.equal(a.channels[0][1], sine(16000)[1]);
  assert.ok(f.controller.slots.A.index.peak > .39);
  assert.ok(f.controller.slots.B.index.peak > .39);
  f.get("compareACursor").value = "0.06"; f.get("compareACursor").dispatch("input");
  assert.equal(f.controller.slots.A.cursor, .06);
  assert.notEqual(f.controller.slots.B.cursor, .06);
  f.controller.stop(); assert.equal(f.controller.playingKey, null);
});

test("C1 rejected WAVs, memory-limit failures and stale loads preserve both prior sources", async () => {
  const f = fixture(), a = pcm([sine(16000)], 16000), b = pcm([sine(32000)], 32000);
  await f.load("A", a); await f.load("B", b);
  const invalid = new Blob([new Uint8Array([1, 2, 3])]);
  assert.equal(await f.controller.openPrepared("B", invalid, "invalid.wav"), false);
  assert.equal(f.controller.slots.B.pcm, b);
  assert.equal(f.controller.slots.A.pcm, a);
  assert.equal(f.get("compareBStatus").classList.contains("error"), true);
  const oversized = { channels: [{ byteLength: 65 * 1024 * 1024 }], frames: 1, sampleRate: 16000 };
  assert.equal(await f.controller.load("A", async () => oversized, { kind: "imported", classId: "local" }), false);
  assert.equal(f.controller.slots.A.pcm, a);
  assert.match(f.get("compareAStatus").textContent, /64 МиБ/);
  let release;
  const pending = f.controller.load("A", () => new Promise(resolve => { release = resolve; }),
    { kind: "imported", classId: "local", name: "stale.wav" });
  await new Promise(resolve => setTimeout(resolve, 10));
  const updated = pcm([sine(16000, .09, 660)], 16000);
  assert.equal(await f.load("A", updated), true);
  release(a); assert.equal(await pending, false);
  assert.equal(f.controller.slots.A.pcm, updated);
  assert.equal(f.controller.slots.B.pcm, b);
});

test("C1 can copy current Analysis source independently into either slot without uploading", async () => {
  const f = fixture(), b = pcm([sine(16000)], 16000);
  await f.load("B", b);
  const fromAnalysis = pcm([sine(22050, .08, 400)], 22050);
  f.setAnalysis({ pcm: fromAnalysis, source: { kind: "prepared", classId: "local", name: "compose.wav" } });
  f.get("compareAFromAnalysis").click();
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(f.controller.slots.A.pcm, fromAnalysis);
  assert.equal(f.controller.slots.A.source.name, "compose.wav");
  assert.equal(f.controller.slots.B.pcm, b);
  assert.equal(f.get("compareABadge").textContent, "Sound Lab-ийн WAV");
  f.controller.renderLanguage("en");
  assert.equal(f.get("compareABadge").textContent, "Sound Lab WAV");
  assert.equal(f.get("compareAName").textContent, "compose.wav");
  assert.equal(f.owner.readyCalls, 0);
});
