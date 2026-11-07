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
        disconnect() {}, stop() { this.stops++; }, start() { this.started = true; }, onended: null };
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
    navigator: { mediaDevices: { getUserMedia() { throw new Error("Unsolicited mic permission"); } } } };
  let analysis = null;
  const controller = new compare.Controller({ document, window, contextOwner: owner,
    getAnalysis: () => analysis, onMic: key => microphones.push(key) });
  // Tests use short deterministic PCM; the app itself lazy-loads catalog examples.
  controller.active = true; controller.initialized = true;
  const get = id => document.getElementById(id);
  const load = (key, value, source = { kind: "generated", classId: "reference", exampleId: "reference-sine-440" }) =>
    controller.load(key, async () => value, source);
  return { controller, get, microphones, owner, context, draws, nodes, buffers, gains,
    load, setAnalysis(value) { analysis = value; } };
}

test("C1 uses peer Analysis sub-tabs, nested Single source views and plot-side listening controls", () => {
  const f = fixture();
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.match(html, /id="analysisKindModes"[\s\S]*id="analysisKindSingle"[\s\S]*id="analysisKindCompare"[\s\S]*id="analysisViewModes"[\s\S]*id="analysisViewSpectrum"[\s\S]*id="analysisViewSpectro"/);
  assert.match(html, /id="compareKindModes"[\s\S]*id="compareKindSingle"[\s\S]*id="compareKindCompare"/);
  assert.doesNotMatch(html, /id="analysisViewCompare"|id="compareNavSpectrum"|id="compareNavSpectro"/);
  assert.match(html, /id="analysisCompareWorkspace" hidden/);
  const singleLeft = html.slice(html.indexOf('id="analysisWorkspace"'), html.indexOf('id="analysisOfflineVisuals"'));
  assert.doesNotMatch(singleLeft, /id="analysisPlay"|id="analysisVolume"/);
  assert.match(html.slice(html.indexOf('id="analysisWaveTitle"'), html.indexOf('id="analysisWaveCanvas"')),
    /id="analysisPlay"[\s\S]*id="analysisVolume"/);
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
  assert.deepEqual(f.controller.slots.A.pcm, null);
  assert.deepEqual(f.controller.slots.B.pcm, null);
  assert.equal(f.owner.readyCalls, 0);
  f.controller.renderLanguage("en");
  assert.equal(f.get("compareTitle").textContent, "Compare two sounds");
  assert.equal(f.get("compareKindSingle").textContent, "Single source");
  assert.equal(f.get("compareKindCompare").textContent, "Compare");
  assert.equal(f.get("compareVolumeValue").textContent, "100%");
  assert.equal(f.get("compareAMic").textContent, "Microphone…");
  f.get("compareAMic").click(); f.get("compareBMic").click();
  assert.deepEqual(f.microphones, ["A", "B"]);
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
