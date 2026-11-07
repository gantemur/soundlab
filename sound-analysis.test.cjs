/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const reader = require("./sound-wave-reader.js");
const dsp = require("./sound-analysis-dsp.js");
const spectro = require("./sound-analysis-spectrogram.js");
const examples = require("./sound-analysis-examples.js");
const encoder = require("./sound-wav.js");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "sound-analysis.js"), "utf8");
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${a} is not close to ${b}`);
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

function pcm(channels, sampleRate = 16000) {
  let peak = 0;
  for (const samples of channels) for (const value of samples) peak = Math.max(peak, Math.abs(value));
  return { channels, sampleRate, frames: channels[0].length, duration: channels[0].length / sampleRate,
    encoding: "Test Float32", peak };
}
function sine(seconds = 1, sampleRate = 16000, amplitude = .5, hz = 500) {
  return Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) =>
    amplitude * Math.sin(2 * Math.PI * hz * i / sampleRate));
}
function fileOf(bytes, name = "local.wav") {
  return { name, size: bytes.byteLength,
    async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } };
}
function floatWav(channels, sampleRate = 16000) {
  const frames = channels[0].length, count = channels.length;
  const bytes = new Uint8Array(44 + frames * count * 4), view = new DataView(bytes.buffer);
  const ascii = (at, text) => { for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i); };
  ascii(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); ascii(8, "WAVE");
  ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 3, true);
  view.setUint16(22, count, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * count * 4, true); view.setUint16(32, count * 4, true);
  view.setUint16(34, 32, true); ascii(36, "data"); view.setUint32(40, bytes.length - 44, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) for (const samples of channels) {
    view.setFloat32(offset, samples[i], true); offset += 4;
  }
  return bytes;
}

function fixture({ exampleModel = examples, dspModel = dsp, width = 920 } = {}) {
  const elements = new Map(), translations = [], canvasCalls = { count: 0, labels: [] };
  let document;
  const drawing = {};
  for (const method of ["setTransform", "clearRect", "fillRect", "moveTo", "lineTo", "arc"]) {
    drawing[method] = (...args) => {
      assert.ok(args.every(Number.isFinite), `${method} must receive finite coordinates`);
      canvasCalls.count++;
    };
  }
  for (const method of ["beginPath", "closePath", "stroke", "fill"]) drawing[method] = () => { canvasCalls.count++; };
  drawing.setLineDash = values => assert.ok(values.every(Number.isFinite));
  drawing.fillText = (value, x, y) => {
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    canvasCalls.labels.push(String(value));
    if (canvasCalls.labels.length > 1000) canvasCalls.labels.splice(0, 500);
  };

  class Element {
    constructor(tag = "div", attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.id = attrs.id || "";
      this.value = attrs.value || ""; this.textContent = ""; this.children = [];
      this.disabled = "disabled" in attrs; this.hidden = "hidden" in attrs; this.files = [];
      this.width = 920; this.height = 280; this.events = new Map(); this.captures = new Set(); this.clicks = 0;
      const classes = new Set((attrs.class || "").split(/\s+/).filter(Boolean));
      this.classList = { contains: name => classes.has(name), toggle(name, enabled) {
        const chosen = enabled === undefined ? !classes.has(name) : enabled;
        if (chosen) classes.add(name); else classes.delete(name); return chosen;
      } };
    }
    set innerHTML(_) { throw new Error("The analyzer must not inject HTML from a filename or label"); }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, listener) {
      if (!this.events.has(name)) this.events.set(name, []);
      this.events.get(name).push(listener);
    }
    dispatch(name, values = {}) {
      const event = { target: this, currentTarget: this, button: 0, pointerId: 1,
        prevented: false, preventDefault() { this.prevented = true; }, ...values };
      for (const listener of this.events.get(name) || []) listener(event);
      return event;
    }
    click() { this.clicks++; this.dispatch("click"); }
    focus() { document.activeElement = this; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    getBoundingClientRect() { return { left: 20, top: 30, width, height: 280 }; }
    getContext(kind) { assert.equal(kind, "2d"); return drawing; }
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const attrs = {};
    for (const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? "";
    if (!attrs.id?.startsWith("analysis") && !attrs["data-analysis-i18n"]) continue;
    const element = new Element(match[1], attrs);
    if (attrs.id) elements.set(attrs.id, element);
    if (attrs["data-analysis-i18n"]) translations.push(element);
  }
  document = {
    activeElement: null,
    getElementById(id) { assert.ok(elements.has(id), "Missing HTML control #" + id); return elements.get(id); },
    createElement(tag) { assert.equal(tag, "option"); return new Element(tag); },
    querySelectorAll(selector) { assert.equal(selector, "[data-analysis-i18n]"); return translations; }
  };

  let nextHandle = 1, timerNow = 0;
  const timers = new Map(), frames = new Map();
  const window = {
    devicePixelRatio: 2, SoundLabWaveReader: reader, SoundLabAnalysisDSP: dspModel,
    SoundLabAnalysisExamples: exampleModel, SoundLabSpectrogram: spectro,
    setTimeout(callback, delay) { const id = nextHandle++; timers.set(id, { callback, at: timerNow + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { const id = nextHandle++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    fetch() { throw new Error("No network requests permitted"); },
    AudioContext() { throw new Error("Use the supplied, explicitly started context owner"); },
    navigator: { mediaDevices: { getUserMedia() { throw new Error("No microphone requests permitted"); } } }
  };
  const buffers = [], nodes = [], gains = [];
  const audioParam = () => ({ events: [],
    setValueAtTime(value, at) { this.events.push(["set", value, at]); },
    linearRampToValueAtTime(value, at) { this.events.push(["ramp", value, at]); },
    setTargetAtTime(value, at, constant) { this.events.push(["target", value, at, constant]); },
    cancelScheduledValues(at) { this.events.push(["cancel", at]); }
  });
  const context = {
    currentTime: 5,
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      const buffer = { numberOfChannels: channels, length, sampleRate, getChannelData: i => data[i] };
      buffers.push(buffer); return buffer;
    },
    createBufferSource() {
      const node = { buffer: null, onended: null, started: [], stopped: 0, disconnected: false,
        connect(target) { this.target = target; }, disconnect() { this.disconnected = true; },
        start(...args) { this.started.push(args); }, stop() { this.stopped++; }
      };
      nodes.push(node); return node;
    },
    createGain() {
      const gain = { gain: audioParam(), disconnected: false,
        connect(target) { this.target = target; }, disconnect() { this.disconnected = true; } };
      gains.push(gain); return gain;
    }
  };
  const owner = { context, output: {}, readyCalls: 0,
    async readyContext() { this.readyCalls++; return context; }
  };
  vm.runInNewContext(source, { window }, { filename: "sound-analysis.js" });
  const controller = new window.SoundLabAnalysis.Controller({ document, window, contextOwner: owner });

  async function until(predicate) {
    for (let i = 0; i < 10000; i++) {
      await nextTurn();
      if (predicate()) return;
      if (timers.size) {
        const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        timers.delete(id); timerNow = timer.at; timer.callback();
      }
    }
    throw new Error("Controller did not reach expected state");
  }
  async function settle() {
    return until(() => !timers.size && !controller.sourceBusy && !controller.analysisBusy &&
      !controller.spectroBusy && !controller.starting);
  }
  const api = { controller, document, window, owner, context, buffers, nodes, gains, frames, timers,
    canvasCalls, translations, get: id => document.getElementById(id), until, settle,
    async activate() { controller.setActive(true); await settle(); },
    async load(pcmValue, name = "test.wav") {
      if (!controller.active) await api.activate();
      const pending = controller.load(async () => pcmValue, { kind: "imported", classId: "local", name });
      await settle(); return pending;
    },
    async open(file) {
      if (!controller.active) await api.activate();
      const pending = controller.openFile(file); await settle(); return pending;
    },
    tickFrame() {
      const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback());
    }
  };
  return api;
}

test("Analysis is a lazy eighth tab with two compact source buttons and a separate microphone screen", async () => {
  const f = fixture(), c = f.controller;
  assert.equal(c.pcm, null); assert.equal(c.active, false); assert.equal(f.owner.readyCalls, 0);
  assert.equal(f.timers.size, 0); assert.equal(f.frames.size, 0);
  assert.equal(c.language, "mn");
  assert.equal(f.get("analysisPlay").disabled, true);
  assert.deepEqual(f.get("analysisClass").children.map(item => item.value),
    ["reference", "instruments", "nature", "wildlife", "objects", "footsteps", "mechanical"]);
  assert.equal(f.get("analysisExample").children.length, 4);
  assert.match(html, /id="modeCompose"[\s\S]*id="modeAnalysis"/);
  assert.match(html, /id="analysisWorkspace" hidden/);
  const markup = html.slice(html.indexOf('id="analysisWorkspace"'), html.indexOf('id="analysisWorkspace"') + 18000);
  assert.equal([...markup.matchAll(/<details class="analysis-settings">/g)].length, 2);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|getUserMedia|decodeAudioData)\s*\(/);
  assert.match(markup, /id="analysisOpen"[\s\S]*id="analysisMicOpen"/);
  assert.match(html, /id="analysisMicWorkspace" hidden[\s\S]*id="analysisMicRecord"/);
  assert.doesNotMatch(markup.slice(0, markup.indexOf('id="analysisOfflineVisuals"')), /id="analysisMicRecord"/);
  assert.doesNotMatch(markup, /id="analysis(?:Pitch|Compare)/);
  for (const element of f.translations) {
    const key = element.getAttribute("data-analysis-i18n");
    assert.ok(f.window.SoundLabAnalysis.messages.mn[key], "MN: " + key);
    assert.ok(f.window.SoundLabAnalysis.messages.en[key], "EN: " + key);
  }
  await f.activate();
  assert.equal(c.source.exampleId, "reference-sine-440");
  assert.equal(c.pcm.frames, 88200);
  assert.equal(c.pcm.channels.length, 1);
  assert.ok(c.spectrum && c.measure);
  assert.equal(c.isPlaying(), false); assert.equal(f.owner.readyCalls, 0);
  assert.equal(f.frames.size, 0); assert.ok(f.canvasCalls.count > 0);
  assert.equal(f.get("analysisChannelField").hidden, true);
  assert.equal(f.get("analysisWorkspace").getAttribute("aria-busy"), "false");
  const old = c.pcm;
  c.setActive(false); c.setActive(true); await f.settle();
  assert.equal(c.pcm, old, "re-entering the tab does not regenerate the source");
});

test("A2a spectrogram stays linked to waveform time, cursor, selection, channel and frequency without rescanning on pointer moves", async () => {
  const f = fixture({ width: 390 }), c = f.controller;
  await f.activate();
  c.setView("spectrogram");
  await f.settle();
  assert.equal(f.get("analysisSpectrumView").hidden, true);
  assert.equal(f.get("analysisSpectroView").hidden, false);
  assert.equal(f.get("analysisSpectrumModes").hidden, true);
  assert.equal(f.get("analysisSpectroFFTField").hidden, false);
  assert.equal(f.get("analysisSpectroMaxHzField").hidden, false);
  assert.equal(f.get("analysisViewSpectro").getAttribute("aria-pressed"), "true");
  assert.ok(c.spectrogram && c.spectrogram.pixels.length > 0);
  assert.equal(c.spectrogram.minDb, -100); assert.equal(c.spectrogram.maxDb, 0);
  assert.ok(c.spectrogram.columns <= 384);
  assert.equal(c.spectrogram.fftSize, 1024);
  assert.equal(c.spectrogram.maxHz, 5000);
  const unchanged = c.spectrogram, oldCursor = c.cursor;
  c.setCursor(.72, true);
  c.setSelection(.25, .92);
  await f.settle();
  assert.equal(c.spectrogram, unchanged, "cursor and selection overlay should not recompute STFT tiles");
  assert.notEqual(c.cursor, oldCursor);
  close(c.start, .25); close(c.end, .92);
  const pointer = f.get("analysisSpectroCanvas");
  pointer.dispatch("pointerdown", { clientX: 20 + 50 + (390 - 66) / 2, clientY: 30 + 38 + (280 - 70) / 2 });
  close(c.cursor, 1, 1 / c.pcm.sampleRate);
  close(c.frequency, 2500, 10);
  c.zoom(.5); await f.settle();
  close(c.viewSpan, 1);
  assert.notEqual(c.spectrogram, unchanged);
  assert.ok(c.spectrogram.columns <= 384);
  c.pan(1); await f.settle();
  assert.ok(c.spectrogram.timeStart <= c.viewStart + c.spectrogram.hopSeconds);
  assert.ok(c.spectrogram.timeEnd >= c.viewStart + c.viewSpan);
  f.get("analysisAxis").value = "log"; f.get("analysisAxis").dispatch("change");
  f.get("analysisSpectroFFT").value = "4096"; f.get("analysisSpectroFFT").dispatch("change");
  await f.settle();
  assert.equal(c.spectrogram.axis, "log");
  assert.equal(c.spectrogram.fftSize, 4096);
  f.get("analysisSpectroMaxHz").value = "2000"; f.get("analysisSpectroMaxHz").dispatch("change");
  await f.settle();
  assert.equal(c.spectrogram.maxHz, 2000);
  assert.equal(c.spectrogram.minHz, c.pcm.sampleRate / c.spectroFFT);
  assert.ok(c.frequency <= 2000, "frequency readout follows the visible top frequency");
  f.get("analysisSpectroMaxHz").value = "all"; f.get("analysisSpectroMaxHz").dispatch("change");
  await f.settle();
  assert.equal(c.spectrogram.maxHz, c.pcm.sampleRate / 2);
  assert.ok(c.spectroCache.tiles.size <= spectro.MAX_TILES);
  c.renderLanguage("en");
  assert.match(f.get("analysisSpectroInfo").textContent, /Hann.*4096 samples/);
  assert.match(f.get("analysisSpectroHint").textContent, /unit-peak/);
  c.setView("spectrum"); await f.settle();
  assert.equal(f.get("analysisSpectrumView").hidden, false);
  assert.ok(c.spectrum && c.spectrum.magnitudes.length === 2049);
  assert.equal(c.viewSpan, 1, "switching views preserves waveform zoom");
  assert.equal(f.get("analysisSpectroMaxHzField").hidden, true);
  assert.equal(f.owner.readyCalls, 0, "analysis does not start audio on view changes");
});

test("A2a prepared REC/Compose WAV uses the same decoder as Open WAV and supersedes lazy initial examples", async () => {
  const f = fixture(), c = f.controller;
  const samples = sine(.4, 48000, .28, 660);
  const blob = new Blob([encoder.encodeWav([samples], 48000)], { type: "audio/wav" });
  c.setActive(true); // Initiates a lazy example which the prepared sound must supersede.
  assert.equal(c.sourceBusy, true);
  const pending = c.openPrepared(blob, "My Compose.wav");
  await f.settle();
  assert.equal(await pending, true);
  assert.equal(c.source.kind, "prepared");
  assert.equal(c.source.name, "My Compose.wav");
  assert.equal(c.pcm.sampleRate, 48000);
  assert.equal(c.pcm.frames, samples.length);
  assert.equal(f.get("analysisClass").value, "local");
  assert.match(f.get("analysisSourceInfo").textContent, /Sound Lab/);
  assert.equal(f.get("analysisSourceName").textContent, "My Compose.wav");
  const previous = c.pcm;
  const invalid = new Blob([new Uint8Array(50)], { type: "audio/wav" });
  const fail = c.openPrepared(invalid, "broken.wav");
  await f.settle();
  assert.equal(await fail, false);
  assert.equal(c.pcm, previous, "invalid prepared WAV must not replace previously loaded PCM");
  assert.equal(f.owner.readyCalls, 0);
});

test("M2 mic capture is a distinct Analysis source, with class, mode, and origin preserved for Compare", async () => {
  const f = fixture(), c = f.controller;
  await f.activate();
  const samples = sine(.2, 48000, .3, 523.25);
  const blob = new Blob([encoder.encodeWav([samples], 48000, { maxSeconds: 30 })], { type: "audio/wav" });
  const stamped = "microphone-2026-11-07T14-00-00Z.wav";
  const pending = c.openPrepared(blob, stamped, { kind: "microphone", classId: "microphone",
    captureMode: "rolling", origin: "microphone", recordedAt: "2026-11-07T14:00:00Z" });
  await f.settle(); assert.equal(await pending, true);
  assert.equal(c.source.kind, "microphone");
  assert.equal(c.source.origin, "microphone");
  assert.equal(c.source.captureMode, "rolling");
  assert.equal(c.source.recordedAt, "2026-11-07T14:00:00Z");
  assert.equal(f.get("analysisClass").value, "microphone");
  assert.equal(f.get("analysisExample").value, "microphone");
  assert.equal(f.get("analysisSourceName").textContent, stamped);
  assert.match(f.get("analysisSourceBadge").textContent, /Микрофон/);
  assert.match(f.get("analysisSourceInfo").textContent, /Микрофон/);
  assert.match(f.get("analysisSourceDescription").textContent, /30 секунд/);
  assert.equal(c.pcm.frames, samples.length);
  c.renderLanguage("en");
  assert.match(f.get("analysisSourceBadge").textContent, /Recorded with microphone/);
  assert.match(f.get("analysisSourceDescription").textContent, /Last 30 seconds/);
  const take = c.openPrepared(blob, stamped, { kind: "microphone", captureMode: "take" });
  await f.settle(); assert.equal(await take, true);
  assert.match(f.get("analysisSourceDescription").textContent, /Explicit microphone take/);
  assert.equal(c.source.captureMode, "take");
  f.get("analysisClass").value = "reference";
  f.get("analysisClass").dispatch("change"); await f.settle();
  assert.equal(c.source.origin, "catalogue");
  assert.match(f.get("analysisSourceBadge").textContent, /Generated signal/);
});

test("class/example dropdowns use the catalogue and language changes preserve all inspection state", async () => {
  const calls = [];
  const model = { ...examples, async create(id) { calls.push(id); return pcm([sine(.2)]); } };
  const f = fixture({ exampleModel: model }), c = f.controller;
  await f.activate();
  f.get("analysisClass").value = "instruments"; f.get("analysisClass").dispatch("change"); await f.settle();
  assert.equal(c.source.exampleId, "model-guitar-a3");
  assert.deepEqual(f.get("analysisExample").children.map(item => item.value),
    ["model-guitar-a3", "model-flute-a4", "model-chime-c5"]);
  f.get("analysisExample").value = "model-flute-a4"; f.get("analysisExample").dispatch("change"); await f.settle();
  assert.equal(c.source.exampleId, "model-flute-a4");
  c.setCursor(.1); c.setSelection(.05, .15); await f.settle(); c.zoom(.5);
  const saved = { pcm: c.pcm, cursor: c.cursor, start: c.start, end: c.end, span: c.viewSpan, source: c.source };
  c.renderLanguage("en");
  assert.match(f.get("analysisSourceDescription").textContent, /including breath noise/);
  assert.equal(f.get("analysisClass").value, "instruments");
  assert.equal(f.get("analysisExample").value, "model-flute-a4");
  c.renderLanguage("mn");
  for (const [key, value] of Object.entries(saved)) assert.equal(key === "span" ? c.viewSpan : c[key], value);
  assert.deepEqual(calls, ["reference-sine-440", "model-guitar-a3", "model-flute-a4"]);
  assert.equal(f.owner.readyCalls, 0);
});

test("recorded catalogue groups are bilingual and show original creator and license links", async () => {
  const model = { ...examples, async create(id) { return pcm([sine(.5)]); } };
  const f = fixture({ exampleModel: model }), c = f.controller;
  await f.activate();
  f.get("analysisClass").value = "nature"; f.get("analysisClass").dispatch("change"); await f.settle();
  assert.equal(c.source.exampleId, "nature-rain");
  assert.equal(f.get("analysisExample").children.length, 3);
  assert.equal(f.get("analysisRecordingCredit").hidden, false);
  assert.equal(f.get("analysisRecordingSource").textContent, "Anthousai");
  assert.match(f.get("analysisRecordingSource").href, /^https:\/\/freesound\.org\//);
  assert.equal(f.get("analysisRecordingLicense").textContent, "CC0 1.0");
  c.renderLanguage("en");
  assert.match(f.get("analysisSourceDescription").textContent, /real rain recording/);
  f.get("analysisClass").value = "objects"; f.get("analysisClass").dispatch("change"); await f.settle();
  f.get("analysisExample").value = "object-latch"; f.get("analysisExample").dispatch("change"); await f.settle();
  assert.equal(f.get("analysisRecordingSource").textContent, "Gravity Sound");
  assert.equal(f.get("analysisRecordingLicense").textContent, "CC BY 4.0");
  assert.match(f.get("analysisRecordingLicense").href, /by\/4\.0/);
  f.get("analysisClass").value = "reference"; f.get("analysisClass").dispatch("change"); await f.settle();
  assert.equal(f.get("analysisRecordingCredit").hidden, true);
  assert.equal(f.owner.readyCalls, 0);
});

test("valid local WAV import retains source rate and treats malicious filenames as plain text", async () => {
  const f = fixture(), c = f.controller;
  const bytes = encoder.encodeWav([sine(.3, 48000, .25, 750)], 48000);
  const name = '<img src=x onerror="alert(1)">\n<script>bad</script>.wav';
  assert.equal(await f.open(fileOf(bytes, name)), true);
  assert.equal(c.pcm.sampleRate, 48000);
  assert.equal(c.pcm.frames, 14400);
  assert.equal(c.source.kind, "imported");
  assert.equal(f.get("analysisClass").value, "local");
  assert.equal(f.get("analysisExample").value, "local");
  assert.equal(f.get("analysisSourceName").textContent, name.replace("\n", " "));
  assert.equal(f.get("analysisExample").children[0].textContent, c.source.name);
  assert.equal(f.owner.readyCalls, 0);
  close(c.spectrum.binHz, 48000 / 4096);
  f.get("analysisOpen").click();
  assert.equal(f.get("analysisFile").clicks, 1);
  f.get("analysisFile").files = []; f.get("analysisFile").dispatch("change");
  assert.equal(c.pcm.sampleRate, 48000, "closing a chooser without a file keeps the source");
});

test("invalid, nonfinite, oversized, unsupported and unreadable replacements retain PCM and selection atomically", async () => {
  const f = fixture(), c = f.controller; await f.activate();
  c.setSelection(.2, .6); c.setCursor(.4); await f.settle();
  const prior = c.pcm, selected = [c.start, c.end, c.cursor];
  const unsupported = floatWav([sine(.1)]); new DataView(unsupported.buffer).setUint16(20, 0xfffe, true);
  const malformed = new Uint8Array([1, 2, 3]);
  const nonfinite = floatWav([Float32Array.from([0, NaN, .1])]);
  for (const [file, key] of [
    [fileOf(malformed), "errorInvalid"], [fileOf(unsupported), "errorUnsupported"],
    [fileOf(nonfinite), "errorNonfinite"],
    [{ name: "large.wav", size: reader.MAX_INPUT_BYTES + 1, arrayBuffer() { throw new Error("must not read oversized input"); } }, "errorLimit"],
    [{ name: "unreadable.wav", size: 44, async arrayBuffer() { throw new Error("file read error"); } }, "errorGeneric"]
  ]) {
    assert.equal(await f.open(file), false);
    assert.equal(c.statusKey, key); assert.equal(c.error, true);
    assert.equal(c.pcm, prior); assert.deepEqual([c.start, c.end, c.cursor], selected);
    assert.equal(c.sourceBusy, false); assert.equal(f.get("analysisCancel").hidden, true);
    assert.equal(f.get("analysisOpen").disabled, false);
    assert.equal(f.get("analysisWorkspace").getAttribute("aria-busy"), "false");
  }
});

test("cancelled stale source work cannot replace a newer source, and imports are serialized while busy", async () => {
  const f = fixture(), c = f.controller; await f.activate();
  let resolveOld, began = false;
  const old = c.load(async ({ onProgress }) => {
    began = true; onProgress(.4);
    return new Promise(resolve => { resolveOld = resolve; });
  }, { kind: "imported", classId: "local", name: "old.wav" });
  await f.until(() => began);
  assert.equal(f.get("analysisOpen").disabled, true);
  assert.equal(f.get("analysisCancel").hidden, false);
  assert.equal(f.get("analysisWorkspace").getAttribute("aria-busy"), "true");
  assert.match(f.get("analysisStatus").textContent, /26%/);
  let extra = 0;
  assert.equal(await c.load(async () => { extra++; return pcm([sine(.1)]); }, {}), false);
  assert.equal(extra, 0);
  c.cancelWork();
  assert.equal(c.sourceBusy, false);
  assert.equal(c.statusKey, "cancelled");
  assert.equal(await f.load(pcm([sine(.3, 16000, .125)]), "new.wav"), true);
  const current = c.pcm;
  resolveOld(pcm([sine(.1)])); await old; await f.settle();
  assert.equal(c.pcm, current); assert.equal(c.source.name, "new.wav");
  assert.equal(c.statusKey, "complete");
  assert.equal(f.get("analysisOpen").disabled, false);
});

test("leaving Analysis stops and cancels a pending import without changing the previous source", async () => {
  const f = fixture(), c = f.controller; await f.activate();
  const previous = c.pcm; let resolveBytes;
  const pending = c.openFile({ name: "slow.wav", size: 44,
    arrayBuffer() { return new Promise(resolve => { resolveBytes = resolve; }); } });
  await f.until(() => !!resolveBytes);
  c.setActive(false);
  resolveBytes(new ArrayBuffer(44)); await pending; await f.settle();
  assert.equal(c.pcm, previous); assert.equal(c.sourceBusy, false); assert.equal(c.analysisBusy, false);
  assert.equal(c.statusKey, "stopped"); assert.equal(f.frames.size, 0); assert.equal(f.owner.readyCalls, 0);
  c.setActive(true); await f.settle(); assert.equal(c.pcm, previous);
});

test("numeric, pointer and keyboard selection controls stay sample-aligned, independent of playback and FFT zoom", async () => {
  const f = fixture({ width: 375 }), c = f.controller; await f.activate();
  f.get("analysisStart").value = ".20001"; f.get("analysisStart").dispatch("change");
  f.get("analysisEnd").value = "1.5"; f.get("analysisEnd").dispatch("change"); await f.settle();
  close(c.start * c.pcm.sampleRate, Math.round(.20001 * c.pcm.sampleRate));
  close(c.end, 1.5);
  const previous = [c.start, c.end, c.cursor];
  c.setSelection(1.7, 1.2); c.setCursor(9); await f.settle();
  assert.equal(c.statusKey, "errorTime"); assert.deepEqual([c.start, c.end, c.cursor], previous);
  const canvas = f.get("analysisWaveCanvas");
  const x = t => 20 + 50 + t / c.viewSpan * (375 - 66);
  canvas.dispatch("pointerdown", { clientX: x(c.start), clientY: 30 + 30, pointerId: 4 });
  assert.equal(c.drag.target, "start"); assert.equal(canvas.hasPointerCapture(4), true);
  canvas.dispatch("pointermove", { clientX: x(.5), clientY: 60, pointerId: 4 });
  canvas.dispatch("pointerup", { clientX: x(.5), clientY: 60, pointerId: 4 }); await f.settle();
  close(c.start, .5, 1 / c.pcm.sampleRate); assert.equal(c.drag, null); assert.equal(canvas.hasPointerCapture(4), false);
  canvas.dispatch("pointerdown", { clientX: x(1), clientY: 150, pointerId: 5 });
  assert.equal(c.drag.target, "cursor");
  canvas.dispatch("pointerup", { clientX: x(1), clientY: 150, pointerId: 5 }); await f.settle();
  close(c.cursor, 1, 1 / c.pcm.sampleRate); assert.equal(c.position, 0);
  const normal = canvas.dispatch("keydown", { key: "ArrowRight", shiftKey: false }); await f.settle();
  assert.equal(normal.prevented, true); close(c.cursor, 1.02, 1 / c.pcm.sampleRate);
  canvas.dispatch("keydown", { key: "ArrowLeft", shiftKey: true }); await f.settle();
  close(c.cursor, .82, 1 / c.pcm.sampleRate);
  canvas.dispatch("keydown", { key: "End" }); await f.settle(); close(c.cursor, 2);
  canvas.dispatch("keydown", { key: "Home" }); await f.settle(); close(c.cursor, 0);
  const n = c.fftSize, spectrum = c.spectrum, bin = c.spectrum.binHz;
  f.get("analysisZoomIn").click(); f.get("analysisPanRight").click();
  assert.equal(c.viewSpan, 1); assert.equal(c.viewStart, .5);
  assert.equal(c.fftSize, n); assert.equal(c.spectrum, spectrum); assert.equal(c.spectrum.binHz, bin);
  f.get("analysisFit").click(); assert.equal(c.viewSpan, 2); assert.equal(c.viewStart, 0);
  f.get("analysisSelectAll").click(); await f.settle(); assert.equal(c.start, 0); assert.equal(c.end, 2);
  assert.equal(f.owner.readyCalls, 0);
});

test("stereo channel inspection does not downmix opposite phases and listening volume cannot change measurements", async () => {
  const left = sine(1), right = Float32Array.from(left, value => -value);
  const f = fixture(), c = f.controller; assert.equal(await f.open(fileOf(floatWav([left, right]))), true);
  assert.equal(c.pcm.channels.length, 2); assert.equal(f.get("analysisChannelField").hidden, false);
  const initial = c.measure, magnitudes = c.spectrum.magnitudes;
  assert.ok(initial.rms > .35); assert.ok(initial.peak >= .5);
  f.get("analysisChannel").value = "1"; f.get("analysisChannel").dispatch("change"); await f.settle();
  assert.equal(c.channel, 1); close(c.measure.rms, initial.rms); close(c.measure.peak, initial.peak);
  assert.deepEqual(c.spectrum.magnitudes, magnitudes);
  const measure = c.measure, spectrum = c.spectrum;
  f.get("analysisVolume").value = "80"; f.get("analysisVolume").dispatch("input");
  assert.equal(c.volume, .8); assert.equal(c.measure, measure); assert.equal(c.spectrum, spectrum);
  assert.equal(f.get("analysisVolumeValue").textContent, "80%");
  f.get("analysisAverage").click(); await f.settle();
  assert.equal(c.spectrumMode, "average"); assert.ok(c.spectrum.windowCount > 1);
  assert.equal(f.get("analysisAverage").getAttribute("aria-pressed"), "true");
  assert.equal(f.get("analysisAtCursor").getAttribute("aria-pressed"), "false");
  close(c.measure.rms, initial.rms);
  f.get("analysisFFT").value = "16384"; f.get("analysisFFT").dispatch("change"); await f.settle();
  assert.equal(c.fftSize, 16384); close(c.spectrum.binHz, 16000 / 16384);
  f.get("analysisAxis").value = "log"; f.get("analysisAxis").dispatch("change");
  assert.equal(c.axis, "log"); assert.match(f.get("analysisPadding").textContent, /DC|тогтмол/);
  c.renderLanguage("en"); assert.match(f.get("analysisPadding").textContent, /Log axis omits DC/);
  assert.equal(f.owner.readyCalls, 0);
});

test("stale asynchronous average cannot overwrite a later local spectrum", async () => {
  let resolveAverage, captured, began = false;
  const custom = { ...dsp, async spectrumAverage(...args) {
    began = true; captured = args; return new Promise(resolve => { resolveAverage = resolve; });
  } };
  const f = fixture({ dspModel: custom }), c = f.controller; await f.activate();
  c.setSpectrumMode("average"); await f.until(() => began);
  assert.equal(c.analysisBusy, true); assert.equal(f.get("analysisCancel").hidden, false);
  c.setSpectrumMode("local"); await f.settle();
  const local = c.spectrum;
  resolveAverage({ ...dsp.spectrumAt(captured[0], captured[1], .25, captured[4]), windowCount: 999 });
  await nextTurn(); await f.settle();
  assert.equal(c.spectrum, local); assert.equal(c.spectrumMode, "local");
  assert.equal(c.spectrum.windowCount, 1); assert.equal(c.statusKey, "complete");
});

test("silence, boundary windows and frequency readout remain finite on a phone-sized canvas", async () => {
  const f = fixture({ width: 320 }), c = f.controller;
  await f.load(pcm([new Float32Array(8)], 16000));
  assert.ok(c.measure, JSON.stringify({ status: c.statusKey, duration: c.pcm?.duration,
    end: c.end, cursor: c.cursor, busy: c.analysisBusy, peak: c.indexes[0]?.peak }));
  assert.equal(c.measure.peak, 0); assert.equal(c.measure.rms, 0);
  assert.ok(c.spectrum.paddedSamples > 0);
  c.renderLanguage("en"); assert.match(f.get("analysisPadding").textContent, /zero-padded.*no new information/);
  assert.match(f.get("analysisPeak").textContent, /−∞/);
  f.get("analysisAxis").value = "log"; f.get("analysisAxis").dispatch("change");
  f.get("analysisSpectrumCanvas").dispatch("pointermove", { clientX: 100, clientY: 100 });
  assert.ok(c.frequency > 0 && c.frequency <= 8000);
  assert.doesNotMatch(f.get("analysisSpectrumReadout").textContent, /NaN/);
  for (let i = 0; i < 8; i++) c.zoom(.5);
  c.pan(1); c.draw(); assert.ok(f.canvasCalls.count > 0);
});

test("playback uses a peak-safe copy of every channel without changing original float samples or inspection", async () => {
  const original = Float32Array.from({ length: 8000 }, (_, i) => i % 2 ? -2 : 2);
  const right = Float32Array.from(original, value => value / 2);
  const f = fixture(), c = f.controller; await f.open(fileOf(floatWav([original, right], 8000)));
  c.setCursor(.5); c.setSelection(.2, .6); await f.settle();
  const previous = Float32Array.from(c.pcm.channels[0]), measure = c.measure;
  c.renderLanguage("en"); assert.match(f.get("analysisListeningHint").textContent, /attenuated.*unchanged/);
  assert.equal(f.get("analysisLevelWarning").hidden, false);
  const pending = c.play(true); await f.settle(); assert.equal(await pending, true);
  assert.equal(f.owner.readyCalls, 1); assert.equal(f.nodes.length, 1); assert.equal(f.buffers.length, 1);
  const node = f.nodes[0], buffer = f.buffers[0];
  assert.equal(buffer.numberOfChannels, 2); assert.equal(buffer.sampleRate, 8000);
  close(buffer.getChannelData(0)[0], .98); close(buffer.getChannelData(1)[0], .49);
  assert.deepEqual(c.pcm.channels[0], previous); assert.equal(c.measure, measure);
  node.started[0].forEach((value, i) => close(value, [5, .2, .4][i]));
  assert.equal(c.cursor, .5); assert.equal(c.start, .2); assert.equal(c.end, .6);
  assert.equal(c.playing, true); assert.equal(f.frames.size, 1);
  f.context.currentTime = 5.1; f.tickFrame(); close(c.currentPosition(), .3);
  c.pause();
  assert.equal(c.playing, false); assert.equal(c.paused, true); close(c.position, .3);
  assert.equal(f.frames.size, 0); assert.equal(node.onended, null); assert.equal(node.buffer, null);
  assert.equal(node.stopped, 1); assert.equal(node.disconnected, true); assert.equal(c.cursor, .5);
  const resumed = c.play(false); await f.settle(); assert.equal(await resumed, true);
  close(f.nodes[1].started[0][1], .3); close(f.nodes[1].started[0][2], .3);
  assert.equal(c.playEnd, .6, "resume retains the selection's playback end");
  c.stop();
  assert.equal(c.position, 0); assert.equal(c.paused, false); assert.equal(c.isPlaying(), false);
  assert.equal(f.frames.size, 0); assert.equal(c.pcm.channels[0][0], 2);
  assert.equal(c.start, .2); assert.equal(c.end, .6); assert.equal(c.cursor, .5);
});

test("cricket-length Analysis playback limits heavy redraws and Pause wins immediately during a spectrogram", async () => {
  const f = fixture({ width: 320 }), c = f.controller;
  await f.load(pcm([sine(5, 16000, .18, 3100)], 16000), "cricket.wav");
  c.setView("spectrogram"); await f.settle();
  let wavePaints = 0, spectroPaints = 0;
  const drawWave = c.drawWave.bind(c), drawSpectrogram = c.drawSpectrogram.bind(c);
  c.drawWave = () => { wavePaints++; drawWave(); };
  c.drawSpectrogram = () => { spectroPaints++; drawSpectrogram(); };
  const firstPlayback = c.play(false); await f.settle();
  assert.equal(await firstPlayback, true);
  const startedAt = f.nodes.at(-1).started[0][0];
  for (let i = 1; i <= 60; i++) {
    f.context.currentTime = startedAt + i / 60;
    f.tickFrame();
  }
  assert.ok(wavePaints <= 10 && spectroPaints <= 10,
    "60 frames of 5-second playback should paint at most about eight expensive spectrogram frames");
  f.get("analysisPlay").click();
  assert.equal(c.paused, true); assert.equal(c.isPlaying(), false);
  assert.ok(c.position >= .95 && c.position <= 1.05);
  assert.equal(f.frames.size, 0, "Pause must cancel its animation immediately");
  assert.equal(f.nodes.at(-1).disconnected, true, "Pause disconnects sound synchronously");
  assert.equal(f.get("analysisPlay").attrs["aria-pressed"], "false");
  assert.match(f.get("analysisPlaybackStatus").textContent, /Түр зогссон/);
  const resumedPlayback = c.play(false); await f.settle();
  assert.equal(await resumedPlayback, true, "Resume remains playable");
  c.stop();
});

test("Analysis Pause reacts on pointerdown without double-toggling on the following click", async () => {
  const f = fixture({ width: 320 }), c = f.controller;
  await f.load(pcm([sine(5, 16000, .18, 3100)], 16000), "cricket.wav");
  c.setView("spectrogram"); await f.settle();
  const firstPlayback = c.play(false); await f.settle(); assert.equal(await firstPlayback, true);
  const node = f.nodes.at(-1), button = f.get("analysisPlay");
  const label = button.textContent;
  let buttonWrites = 0, currentLabel = label;
  Object.defineProperty(button, "textContent", {
    configurable: true,
    get() { return currentLabel; },
    set(value) { currentLabel = value; buttonWrites++; }
  });
  for (let i = 1; i <= 60; i++) {
    f.context.currentTime = 5 + i / 60;
    f.tickFrame();
  }
  assert.equal(buttonWrites, 0, "playhead paints must not replace the active Pause button label");
  button.dispatch("pointerdown", { button: 0, pointerType: "touch" });
  assert.equal(node.stopped, 1, "audio stops on the first pointer event, before click");
  assert.equal(node.disconnected, true);
  assert.equal(c.paused, true); assert.equal(c.isPlaying(), false);
  assert.equal(f.frames.size, 0);
  button.dispatch("click", { detail: 1, pointerType: "touch" });
  assert.equal(c.isPlaying(), false, "the synthesized touch click cannot immediately restart audio");
  assert.equal(f.nodes.length, 1);
  assert.equal(f.timers.size, 0, "pointer-click suppression timer clears after click");
  button.dispatch("click", { detail: 0 }); // Keyboard/SR activation still works.
  await f.settle();
  assert.equal(c.playing, true); assert.equal(f.nodes.length, 2);
  const secondNode = f.nodes.at(-1);
  button.dispatch("pointerdown", { button: 0, pointerType: "mouse" });
  button.dispatch("click", { detail: 1, pointerType: "mouse" });
  assert.equal(secondNode.stopped, 1); assert.equal(c.paused, true);
  assert.equal(f.nodes.length, 2, "mouse click does not double-toggle either");
  c.stop();
});

test("Analysis pointer Pause cancels async startup even if no click event is delivered", async () => {
  const f = fixture(), c = f.controller; await f.activate();
  let resolveContext;
  f.owner.readyContext = () => new Promise(resolve => { resolveContext = resolve; });
  const pending = c.play(false); await f.until(() => !!resolveContext);
  assert.equal(c.starting, true);
  f.get("analysisPlay").dispatch("pointerdown", { button: 0, pointerType: "touch" });
  assert.equal(c.starting, false); assert.equal(c.paused, true);
  resolveContext(f.context); await pending; await f.settle();
  assert.equal(f.nodes.length, 0, "late audio startup cannot create a source after Pause");
  assert.equal(c.isPlaying(), false);
  // A new tap must work even if WebKit never dispatched the previous click.
  f.owner.readyContext = async () => f.context;
  f.get("analysisPlay").dispatch("pointerdown", { button: 0, pointerType: "touch" });
  const second = f.get("analysisPlay").dispatch("click", { detail: 1, pointerType: "touch" });
  assert.equal(second.prevented, false);
  await f.settle(); assert.equal(c.playing, true);
  c.stop();
});

test("global Stop's controller hook cancels pending audio startup and leaves source and FFT data inspectable", async () => {
  const f = fixture(), c = f.controller; await f.activate();
  let resolveContext;
  f.owner.readyContext = () => new Promise(resolve => { resolveContext = resolve; });
  const previous = c.pcm, spectrum = c.spectrum;
  const pending = c.play(false); await f.until(() => !!resolveContext);
  assert.equal(c.starting, true); assert.equal(c.isPlaying(), true);
  c.stop(); resolveContext(f.context); await pending; await f.settle();
  assert.equal(c.isPlaying(), false); assert.equal(c.starting, false);
  assert.equal(c.pcm, previous); assert.equal(c.spectrum, spectrum);
  assert.equal(f.nodes.length, 0); assert.equal(f.buffers.length, 0); assert.equal(f.frames.size, 0);
  assert.equal(c.statusKey, "stopped");
});

test("playback failure is visible and a cancelled playback-copy job cannot create a late source node", async () => {
  const f = fixture(), c = f.controller; await f.activate(); c.renderLanguage("en");
  f.owner.readyContext = async () => { throw new Error("denied"); };
  assert.equal(await c.play(false), false); await f.settle();
  assert.match(f.get("analysisPlaybackStatus").textContent, /could not play/);
  assert.equal(c.isPlaying(), false); assert.ok(c.spectrum); assert.equal(f.frames.size, 0);
  f.owner.readyContext = async () => f.context;
  await f.load(pcm([sine(10, 16000)], 16000));
  const pending = c.play(false);
  await f.until(() => f.buffers.length === 1);
  c.stop(); await f.settle(); assert.equal(await pending, false);
  assert.equal(f.nodes.length, 0); assert.equal(c.playing, false); assert.equal(c.starting, false);
});

test("analysis failure offers retry and cancellation without damaging the active source", async () => {
  let fail = true;
  const custom = { ...dsp, spectrumAt(...args) { if (fail) throw new Error("calculation failed"); return dsp.spectrumAt(...args); } };
  const f = fixture({ dspModel: custom }), c = f.controller; await f.activate();
  assert.equal(c.statusKey, "errorAnalysis"); assert.ok(c.pcm); assert.equal(c.spectrum, null);
  assert.equal(c.analysisBusy, false); assert.equal(f.get("analysisRetry").hidden, false);
  fail = false; f.get("analysisRetry").click(); await f.settle();
  assert.equal(c.statusKey, "complete"); assert.ok(c.spectrum); assert.equal(f.get("analysisRetry").hidden, true);
});

test("a long app-encoded WAV remains navigable at phone width, with late selections and a larger independent FFT", async () => {
  const f = fixture({ width: 375 }), c = f.controller; await f.activate();
  const bytes = encoder.encodeWav([sine(93, 8000, .25, 250)], 8000);
  f.get("analysisFile").value = "C:\\fakepath\\long.wav";
  f.get("analysisFile").files = [fileOf(bytes, "long.wav")];
  f.get("analysisFile").dispatch("change"); await f.settle();
  assert.equal(f.get("analysisFile").value, "");
  assert.equal(c.pcm.duration, 93); assert.equal(c.pcm.sampleRate, 8000);
  assert.equal(f.get("analysisCursorSlider").max, "93");
  f.get("analysisCursorSlider").value = "92.5";
  f.get("analysisCursorSlider").dispatch("input"); await f.settle();
  assert.equal(c.cursor, 92.5);
  const n = c.fftSize;
  for (let i = 0; i < 8; i++) f.get("analysisZoomIn").click();
  assert.ok(c.viewStart > 90 && c.viewStart + c.viewSpan <= 93);
  assert.equal(c.fftSize, n);
  f.get("analysisPanLeft").click(); f.get("analysisPanRight").click();
  c.setSelection(92.25, 92.75); await f.settle();
  close(c.measure.duration, .5); assert.ok(c.measure.rms > .17);
  f.get("analysisFFT").value = "65536"; f.get("analysisFFT").dispatch("change");
  f.get("analysisAverage").click(); await f.settle();
  assert.equal(c.fftSize, 65536); assert.equal(c.spectrumMode, "average");
  close(c.spectrum.binHz, 8000 / 65536); assert.ok(c.spectrum.paddedWindowCount > 0);
  c.renderLanguage("en"); assert.match(f.get("analysisPadding").textContent, /padded window/);
  f.get("analysisFit").click(); assert.equal(c.viewStart, 0); assert.equal(c.viewSpan, 93);
  assert.equal(c.cursor, 92.5); assert.equal(c.start, 92.25); assert.equal(c.end, 92.75);
  assert.equal(f.owner.readyCalls, 0); assert.equal(c.error, false);
});

test("replacing a coarse source with one sample releases the cached envelope's old index reference", async () => {
  let envelopeCalls = 0;
  const custom = { ...dsp, waveformEnvelope(...args) { envelopeCalls++; return dsp.waveformEnvelope(...args); } };
  const f = fixture({ dspModel: custom, width: 375 }), c = f.controller;
  await f.load(pcm([sine(12)]));
  const oldIndex = c.indexes[0], cached = c.waveEnvelope, calls = envelopeCalls;
  assert.ok(cached && cached.index === oldIndex);
  c.drawWave(); c.drawWave();
  assert.equal(c.waveEnvelope, cached); assert.equal(envelopeCalls, calls, "unchanged viewport reuses the bounded envelope");
  const tiny = pcm([Float32Array.of(.125)]);
  assert.equal(await f.load(tiny), true);
  assert.equal(c.pcm, tiny); assert.notEqual(c.indexes[0], oldIndex);
  assert.equal(c.waveEnvelope, null, "a fine-sample replacement must not retain the previous large source through its cache");
  c.renderLanguage("en"); c.drawWave();
  assert.equal(c.waveEnvelope, null); assert.equal(c.measure.frames, 1); assert.equal(c.measure.peak, .125);
  assert.equal(c.spectrum.paddedSamples, c.fftSize - 1);
});

test("positive PCM8 full scale warns at 127/128 and the warning follows the selected interval", async () => {
  const bytes = new Uint8Array(48);
  bytes.set(floatWav([new Float32Array(4)], 8000).subarray(0, 44));
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 40, true); view.setUint16(20, 1, true);
  view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  view.setUint32(40, 4, true); bytes.set([128, 255, 128, 128], 44);
  const f = fixture(), c = f.controller; assert.equal(await f.open(fileOf(bytes, "pcm8.wav")), true);
  assert.equal(c.pcm.encoding, "PCM8"); assert.equal(c.pcm.fullScaleSamples, 1);
  assert.equal(c.measure.peak, 127 / 128); assert.ok(c.measure.peak < .9999);
  assert.equal(f.get("analysisLevelWarning").hidden, false);
  c.setSelection(0, 1 / 8000); await f.settle();
  assert.equal(c.measure.peak, 0); assert.equal(f.get("analysisLevelWarning").hidden, true);
  c.setSelection(1 / 8000, 2 / 8000); await f.settle();
  assert.equal(f.get("analysisLevelWarning").hidden, false);
});

test("listening-volume automation is separate from fades, so muting cannot be revived by a scheduled tail level", async () => {
  const f = fixture(), c = f.controller; await f.load(pcm([sine(1)]));
  const pending = c.play(false); await f.settle(); assert.equal(await pending, true);
  const { node, envelope, gain } = c.voice;
  assert.notEqual(envelope, gain);
  assert.equal(node.target, envelope); assert.equal(envelope.target, gain); assert.equal(gain.target, f.owner.output);
  const fades = envelope.gain.events.map(event => [...event]);
  assert.deepEqual(gain.gain.events, [["set", .2, 5]], "listening gain has no pre-scheduled positive end value");
  f.context.currentTime = 5.1;
  f.get("analysisVolume").value = "80"; f.get("analysisVolume").dispatch("input");
  f.context.currentTime = 5.25;
  f.get("analysisVolume").value = "0"; f.get("analysisVolume").dispatch("input");
  assert.deepEqual(gain.gain.events.at(-1), ["target", 0, 5.25, .01]);
  assert.ok(envelope.gain.events.some(event => event[1] === 1 && event[2] > 5.25),
    "the end fade still exists, independently of listening level");
  assert.equal(gain.gain.events.some(event => event[1] > 0 && event[2] > 5.25), false);
  assert.deepEqual(envelope.gain.events, fades);
  f.context.currentTime = 5.99; f.tickFrame();
  assert.deepEqual(gain.gain.events.at(-1), ["target", 0, 5.25, .01]);
  assert.equal(c.volume, 0); assert.equal(c.pcm.channels[0][8], .5);
  c.stop();
  assert.equal(node.disconnected, true); assert.equal(envelope.disconnected, true); assert.equal(gain.disconnected, true);
});
