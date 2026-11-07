/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mic = require("./sound-microphone.js");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "sound-microphone.js"), "utf8");

function track() {
  const listeners = new Map();
  return {
    readyState: "live", stops: 0,
    addEventListener(event, fn) { listeners.set(event, fn); },
    removeEventListener(event, fn) { if (listeners.get(event) === fn) listeners.delete(event); },
    dispatch(event) { listeners.get(event)?.(); },
    stop() { this.stops++; this.readyState = "ended"; },
    get listenerCount() { return listeners.size; }
  };
}
function stream(...tracks) {
  return { tracks, getTracks() { return tracks; }, getAudioTracks() { return tracks; } };
}
function fixture({ width = 390, api = true, secure = true, audioContext = true,
  graphFails = false, resumePending = false } = {}) {
  const elements = new Map(), translated = [], events = new Map(), requests = [], contexts = [];
  const drawings = { finite: 0, labels: [], traces: 0 };
  const frames = new Map(); let nextFrame = 0;
  let begins = 0, stops = 0;
  const drawing = {};
  for (const method of ["setTransform", "clearRect", "fillRect", "strokeRect", "moveTo", "lineTo"]) {
    drawing[method] = (...numbers) => {
      assert.ok(numbers.every(Number.isFinite), `${method} must have finite coordinates`);
      drawings.finite++;
    };
  }
  drawing.beginPath = () => {}; drawing.stroke = () => { drawings.traces++; };
  drawing.fillText = (label, x, y) => {
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    drawings.labels.push(String(label));
    if (drawings.labels.length > 300) drawings.labels.splice(0, 100);
  };
  class Element {
    constructor(attrs = {}) {
      this.attrs = attrs; this.textContent = ""; this.dataset = {};
      this.value = attrs.id === "analysisMicAxis" ? "linear" : attrs.id === "analysisMicMaxHz" ? "5000" : "";
      this.hidden = "hidden" in attrs; this.disabled = false;
      this.width = 920; this.height = 255; this.events = new Map();
      const classes = new Set();
      this.classList = {
        toggle(name, desired) {
          if (desired) classes.add(name); else classes.delete(name);
        },
        contains(name) { return classes.has(name); }
      };
    }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getBoundingClientRect() { return { width, height: 210 }; }
    getContext(kind) { assert.equal(kind, "2d"); return drawing; }
    addEventListener(name, fn) { this.events.set(name, fn); }
    dispatch(name) { this.events.get(name)?.({ target: this }); }
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const attrs = {};
    for (const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? "";
    if (!attrs.id?.startsWith("analysis") && !attrs["data-mic-i18n"]) continue;
    const element = new Element(attrs);
    if (attrs.id) elements.set(attrs.id, element);
    if (attrs["data-mic-i18n"]) translated.push(element);
  }
  const document = {
    hidden: false,
    getElementById(id) { assert.ok(elements.has(id), `Missing #${id}`); return elements.get(id); },
    querySelectorAll(selector) { assert.equal(selector, "[data-mic-i18n]"); return translated; },
    addEventListener(event, fn) { events.set(`document:${event}`, fn); }
  };
  class FakeAudioContext {
    constructor() { this.state = "suspended"; this.sampleRate = 48000; this.destination = { speaker: true };
      this.nodes = []; this.closes = 0; contexts.push(this); }
    node(kind) {
      const node = { kind, connections: [], disconnected: false,
        connect(other) { this.connections.push(other); }, disconnect() { this.disconnected = true; } };
      this.nodes.push(node); return node;
    }
    createMediaStreamSource(input) { this.input = input; return this.node("source"); }
    createAnalyser() {
      const node = this.node("analyser");
      Object.defineProperty(node, "frequencyBinCount", { get() { return node.fftSize / 2; } });
      node.getFloatTimeDomainData = array => {
        for (let i = 0; i < array.length; i++) array[i] = .5 * Math.sin(2 * Math.PI * i / 80);
      };
      node.getFloatFrequencyData = array => { array.fill(-100); array[43] = -9.5; };
      return node;
    }
    createGain() {
      if (graphFails) throw new Error("Cannot create gain");
      const node = this.node("gain"); node.gain = { value: 1 }; return node;
    }
    resume() {
      if (resumePending) return new Promise(resolve => { this.finishResume = () => {
        this.state = "running"; resolve();
      }; });
      this.state = "running"; return Promise.resolve();
    }
    async close() { this.closes++; this.state = "closed"; }
  }
  const window = {
    isSecureContext: secure, devicePixelRatio: 2,
    navigator: api ? { mediaDevices: { getUserMedia: settings => new Promise((resolve, reject) => {
      requests.push({ settings, resolve, reject });
    }) } } : {},
    AudioContext: audioContext ? FakeAudioContext : undefined,
    addEventListener(event, fn) { events.set(`window:${event}`, fn); },
    requestAnimationFrame(fn) { const id = ++nextFrame; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    fetch() { throw new Error("Mic must never upload audio"); }
  };
  const controller = new mic.Controller({ document, window,
    onBegin: () => { begins++; }, onStop: () => { stops++; } });
  const get = id => document.getElementById(id);
  return { controller, document, window, get, requests, contexts, frames, drawings, events, translated,
    get begins() { return begins; }, get stops() { return stops; },
    step(time = 125) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(time)); },
    grant(index = 0, input = stream(track())) { requests[index].resolve(input); return input; },
    hide() { document.hidden = true; events.get("document:visibilitychange")(); },
    leave() { events.get("window:pagehide")(); }
  };
}

test("M1 is a separate Analysis source with explicit permission, own plots, and no implicit microphone use", () => {
  const f = fixture(), c = f.controller;
  assert.equal(f.requests.length, 0);
  assert.equal(f.contexts.length, 0);
  assert.equal(c.active, false);
  assert.equal(f.get("analysisMicStart").hidden, false);
  assert.equal(f.get("analysisMicStop").hidden, true);
  assert.equal(f.get("analysisMicVisuals").hidden, true);
  assert.equal(f.get("analysisOfflineVisuals").hidden, false);
  assert.match(f.get("analysisMicStatus").textContent, /Микрофон асаах/);
  c.setActive(true);
  c.renderLanguage("en");
  assert.equal(f.requests.length, 0, "entering Analysis or switching language cannot access the mic");
  assert.match(f.get("analysisMicStart").textContent, /Use microphone/);
  assert.match(html, /id="analysisMicWaveCanvas"[\s\S]*id="analysisMicSpectrumCanvas"/);
  assert.doesNotMatch(source, /(?:fetch|XMLHttpRequest|MediaRecorder|Blob|createMediaElementSource|localStorage)\s*\(/);
  for (const item of f.translated) {
    const key = item.getAttribute("data-mic-i18n");
    assert.ok(mic.words.mn[key] && mic.words.en[key], `Missing translation ${key}`);
  }
});

test("Start awaits permission, shows Stop, then draws fixed-scale live waveform and FFT with silent sink", async () => {
  const f = fixture(), c = f.controller; c.setActive(true);
  const pending = c.start();
  assert.equal(f.requests.length, 1);
  assert.equal(f.contexts.length, 0, "AudioContext is not created before permission");
  assert.deepEqual(f.requests[0].settings, {
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false
  });
  assert.equal(c.phase, "requesting");
  assert.equal(f.get("analysisMicStart").hidden, true);
  assert.equal(f.get("analysisMicStop").hidden, false);
  assert.equal(f.get("analysisOfflineVisuals").hidden, true);
  assert.equal(f.get("analysisWorkspace").classList.contains("analysis-mic-live"), true);
  const input = f.grant(); assert.equal(await pending, true);
  assert.equal(f.begins, 1);
  assert.equal(c.phase, "live");
  assert.equal(f.get("analysisMicVisuals").hidden, false);
  assert.equal(f.get("analysisMicIndicator").dataset.state, "live");
  assert.equal(f.contexts.length, 1);
  const ctx = f.contexts[0];
  assert.equal(ctx.input, input);
  assert.equal(ctx.nodes.length, 3);
  assert.equal(ctx.nodes[1].fftSize, 4096);
  assert.equal(ctx.nodes[1].minDecibels, -100);
  assert.equal(ctx.nodes[1].maxDecibels, 0);
  assert.equal(ctx.nodes[2].gain.value, 0, "No speaker monitoring at any time");
  assert.deepEqual(ctx.nodes.map(node => node.connections.length), [1, 1, 1]);
  assert.equal(ctx.nodes[2].connections[0], ctx.destination);
  assert.equal(c.timeData.length, 4096);
  assert.equal(c.frequencyData.length, 2048);
  assert.ok(f.drawings.finite > 1000);
  assert.match(f.get("analysisMicWaveInfo").textContent, /peak 0\.5|орг.+0\.5/);
  assert.match(f.get("analysisMicSpectrumInfo").textContent, /504|505|503/);
  assert.ok(f.frames.size > 0);
  c.stop();
  assert.equal(input.tracks[0].stops, 1);
  assert.equal(input.tracks[0].listenerCount, 0);
  assert.equal(ctx.closes, 1);
  assert.ok(ctx.nodes.every(node => node.disconnected));
  assert.equal(c.context, null); assert.equal(c.stream, null);
  assert.equal(c.timeData, null); assert.equal(c.frequencyData, null);
  assert.equal(f.frames.size, 0);
  assert.equal(f.get("analysisOfflineVisuals").hidden, false);
  assert.equal(f.get("analysisMicVisuals").hidden, true);
  assert.equal(f.get("analysisWorkspace").classList.contains("analysis-mic-live"), false);
  assert.equal(f.stops, 1);
});

test("live axes, language, and redraw throttle do not restart microphone or change source", async () => {
  const f = fixture({ width: 320 }), c = f.controller; c.setActive(true);
  const pending = c.start(); f.grant(); await pending;
  const previous = c.stream, before = f.drawings.traces;
  f.get("analysisMicAxis").value = "log"; f.get("analysisMicAxis").dispatch("change");
  f.get("analysisMicMaxHz").value = "all"; f.get("analysisMicMaxHz").dispatch("change");
  c.renderLanguage("en");
  assert.equal(c.stream, previous);
  assert.equal(f.requests.length, 1);
  assert.match(f.get("analysisMicWaveInfo").textContent, /RMS/);
  assert.match(f.get("analysisMicSpectrumInfo").textContent, /FFT 4096/);
  const afterSettings = f.drawings.traces;
  assert.ok(afterSettings >= before + 6);
  f.step(0); const afterFrame = f.drawings.traces;
  f.step(50); assert.equal(f.drawings.traces, afterFrame, "At most 10 plot frames per second");
  f.step(125); assert.ok(f.drawings.traces > afterFrame);
  c.setActive(false);
  assert.equal(previous.tracks[0].stops, 1);
  assert.equal(f.frames.size, 0);
});

test("late permission grants after Stop or tab exit are closed immediately, without starting a graph", async () => {
  const f = fixture(), c = f.controller; c.setActive(true);
  let pending = c.start(); c.stop();
  const first = f.grant(); assert.equal(await pending, false);
  assert.equal(first.tracks[0].stops, 1);
  assert.equal(f.contexts.length, 0);
  assert.equal(c.phase, "idle");
  pending = c.start(); f.leave();
  const second = f.grant(1); assert.equal(await pending, false);
  assert.equal(second.tracks[0].stops, 1);
  assert.equal(f.frames.size, 0);
});

test("a stale first request cannot tear down a newly running microphone session", async () => {
  const f = fixture(), c = f.controller; c.setActive(true);
  const oldRequest = c.start(); c.stop();
  const newRequest = c.start();
  const current = f.grant(1); assert.equal(await newRequest, true);
  const stale = f.grant(0); assert.equal(await oldRequest, false);
  assert.equal(stale.tracks[0].stops, 1);
  assert.equal(current.tracks[0].stops, 0);
  assert.equal(c.stream, current);
  assert.equal(c.phase, "live");
  c.stop(); assert.equal(current.tracks[0].stops, 1);
});

test("cancelling during delayed AudioContext resume cannot release a later session", async () => {
  const f = fixture({ resumePending: true }), c = f.controller; c.setActive(true);
  const firstRequest = c.start(), old = f.grant();
  await Promise.resolve();
  assert.equal(f.contexts.length, 1);
  c.stop();
  const secondRequest = c.start(), current = f.grant(1);
  await Promise.resolve();
  assert.equal(f.contexts.length, 2);
  f.contexts[1].finishResume();
  assert.equal(await secondRequest, true);
  f.contexts[0].finishResume();
  assert.equal(await firstRequest, false);
  assert.equal(old.tracks[0].stops, 1);
  assert.equal(current.tracks[0].stops, 0);
  assert.equal(c.stream, current);
  assert.equal(f.contexts[1].closes, 0);
  c.stop(); assert.equal(current.tracks[0].stops, 1);
});

test("an incomplete audio graph is disconnected, context closed and tracks released", async () => {
  const f = fixture({ graphFails: true }), c = f.controller; c.setActive(true);
  const request = c.start(), input = f.grant();
  assert.equal(await request, false);
  assert.equal(c.phase, "error");
  assert.equal(input.tracks[0].stops, 1);
  assert.equal(f.contexts[0].closes, 1);
  assert.ok(f.contexts[0].nodes.every(node => node.disconnected));
  assert.equal(c.stream, null);
  assert.equal(f.frames.size, 0);
});

test("denied, missing and busy permissions are retryable and never leave owned devices or contexts", async () => {
  const f = fixture(), c = f.controller; c.setActive(true);
  for (const [index, name, label] of [[0, "NotAllowedError", /зөвшөөрөл/i],
    [1, "NotFoundError", /олдсонгүй/i], [2, "NotReadableError", /боломжгүй/i]]) {
    const attempt = c.start(); const error = new Error(name); error.name = name;
    f.requests[index].reject(error); assert.equal(await attempt, false);
    assert.equal(c.phase, "error");
    assert.match(f.get("analysisMicStatus").textContent, label);
    assert.equal(f.get("analysisMicStart").hidden, false);
    assert.equal(f.contexts.length, 0);
  }
  const attempt = c.start(), good = f.grant(3);
  assert.equal(await attempt, true);
  c.stop(); assert.equal(good.tracks[0].stops, 1);
});

test("unsupported insecure/API-less browsers never request permission", async () => {
  for (const options of [{ api: false }, { secure: false }, { audioContext: false }]) {
    const f = fixture(options), c = f.controller; c.setActive(true);
    assert.equal(await c.start(), false);
    assert.equal(c.phase, "error");
    assert.equal(f.requests.length, 0);
    assert.equal(f.contexts.length, 0);
  }
});

test("hiding the page, device removal, and global-style Stop always release the microphone", async () => {
  for (const exit of [f => f.hide(), f => f.leave(), f => f.granted.tracks[0].dispatch("ended"),
    f => f.controller.stop()]) {
    const f = fixture(), c = f.controller; c.setActive(true);
    const pending = c.start(); f.granted = f.grant(); await pending;
    exit(f);
    assert.equal(f.granted.tracks[0].stops, 1);
    assert.equal(f.contexts[0].closes, 1);
    assert.equal(c.phase, "idle");
    assert.equal(f.frames.size, 0);
  }
});

test("mute is announced without releasing capture; unmute restores active status", async () => {
  const f = fixture(), c = f.controller; c.setActive(true);
  const pending = c.start(), input = f.grant(); await pending;
  input.tracks[0].dispatch("mute"); assert.equal(c.statusKey, "muted");
  assert.equal(c.phase, "live");
  input.tracks[0].dispatch("unmute"); assert.equal(c.statusKey, "live");
  c.stop();
});
