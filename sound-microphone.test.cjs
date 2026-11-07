/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 */
"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const mic = require("./sound-microphone.js");
const wav = require("./sound-wav.js");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "sound-microphone.js"), "utf8");

function track() {
  const listeners = new Map();
  return {
    readyState: "live", stops: 0,
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
    dispatch(type) { listeners.get(type)?.(); },
    stop() { this.stops++; this.readyState = "ended"; },
    get listenerCount() { return listeners.size; }
  };
}
const stream = (...tracks) => ({ tracks, getTracks() { return tracks; }, getAudioTracks() { return tracks; } });

function fixture({ width = 390, secure = true, api = true, worklet = true,
  graphFails = false, resumePending = false, moduleFails = false } = {}) {
  const elements = new Map(), translations = [], events = new Map();
  const requests = [], contexts = [], timers = new Map(), frames = new Map(), views = [], captures = [];
  const drawing = { count: 0 }; let lastFrame = 0, lastTimer = 0, begins = 0, stops = 0;
  const canvas = {};
  for (const method of ["setTransform", "clearRect", "fillRect", "strokeRect", "moveTo", "lineTo"]) {
    canvas[method] = (...args) => { assert.ok(args.every(Number.isFinite), `${method} must be finite`); drawing.count++; };
  }
  canvas.beginPath = () => {}; canvas.stroke = () => {};
  canvas.fillText = (_, x, y) => { assert.ok(Number.isFinite(x) && Number.isFinite(y)); };
  class Element {
    constructor(attrs) {
      this.attrs = attrs; this.textContent = ""; this.dataset = {}; this.value = attrs.id === "analysisMicMaxHz" ? "5000" : "linear";
      this.hidden = "hidden" in attrs; this.disabled = false;
      this.events = new Map(); this.width = 920; this.height = 255;
      const classes = new Set();
      this.classList = { toggle(name, yes) { if (yes) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); } };
    }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getBoundingClientRect() { return { width, height: 210 }; }
    getContext(kind) { assert.equal(kind, "2d"); return canvas; }
    addEventListener(name, fn) { this.events.set(name, fn); }
    click() { return this.events.get("click")?.({ target: this }); }
    dispatch(type) { return this.events.get(type)?.({ target: this }); }
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const attrs = {};
    for (const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? "";
    if (!attrs.id?.startsWith("analysis") && !attrs["data-mic-i18n"]) continue;
    const element = new Element(attrs);
    if (attrs.id) elements.set(attrs.id, element);
    if (attrs["data-mic-i18n"]) translations.push(element);
  }
  const document = {
    hidden: false,
    getElementById(id) { assert.ok(elements.has(id), `Missing #${id}`); return elements.get(id); },
    querySelectorAll(selector) { assert.equal(selector, "[data-mic-i18n]"); return translations; },
    addEventListener(type, fn) { events.set("document:" + type, fn); }
  };
  class Node {
    constructor(kind) { this.kind = kind; this.connections = []; this.disconnected = false; }
    connect(node) { this.connections.push(node); }
    disconnect() { this.disconnected = true; }
  }
  class FakeAudioContext {
    constructor() {
      this.state = "suspended"; this.sampleRate = 48000; this.destination = { speaker: true };
      this.nodes = []; this.closes = 0; this.modules = []; contexts.push(this);
      this.audioWorklet = worklet ? { addModule: async url => {
        this.modules.push(url);
        if (moduleFails) throw new Error("Cannot load AudioWorklet module");
      } } : undefined;
    }
    createMediaStreamSource(input) { this.input = input; return this.node("source"); }
    node(kind) { const node = new Node(kind); this.nodes.push(node); return node; }
    createAnalyser() {
      const node = this.node("analyser");
      Object.defineProperty(node, "frequencyBinCount", { get() { return node.fftSize / 2; } });
      node.getFloatTimeDomainData = data => {
        for (let i = 0; i < data.length; i++) data[i] = .3 * Math.sin(i / 14);
      };
      node.getFloatFrequencyData = data => { data.fill(-100); data[43] = -15; };
      return node;
    }
    createGain() {
      if (graphFails) throw new Error("Gain unavailable");
      const node = this.node("sink"); node.gain = { value: 1 }; return node;
    }
    resume() {
      if (resumePending) return new Promise(resolve => { this.finishResume = () => { this.state = "running"; resolve(); }; });
      this.state = "running"; return Promise.resolve();
    }
    async close() { this.closes++; this.state = "closed"; }
  }
  class FakeAudioWorkletNode extends Node {
    constructor(context, name, options) {
      super("capture"); assert.equal(name, "soundlab-mic-capture");
      assert.deepEqual(options.outputChannelCount, [1]);
      this.context = context; context.nodes.push(this);
      const sent = [];
      this.port = { sent, onmessage: null,
        postMessage(message) { sent.push(message); },
        send(message) { this.onmessage?.({ data: message }); } };
    }
  }
  const window = {
    isSecureContext: secure, devicePixelRatio: 2, Blob, SoundLabWav: wav,
    navigator: api ? { mediaDevices: { getUserMedia: settings => new Promise((resolve, reject) => {
      requests.push({ settings, resolve, reject });
    }) } } : {},
    AudioContext: FakeAudioContext,
    AudioWorkletNode: worklet ? FakeAudioWorkletNode : undefined,
    addEventListener(type, fn) { events.set("window:" + type, fn); },
    requestAnimationFrame(fn) { frames.set(++lastFrame, fn); return lastFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn) { timers.set(++lastTimer, fn); return lastTimer; },
    clearTimeout(id) { timers.delete(id); },
    fetch() { throw new Error("Microphone must never upload sound"); }
  };
  const controller = new mic.Controller({ document, window,
    onBegin: () => { begins++; }, onStop: () => { stops++; },
    onViewChange: open => views.push(open),
    onCapture: async (blob, name, origin) => { captures.push({ blob, name, origin }); return true; }
  });
  const get = id => document.getElementById(id);
  return { controller, get, document, window, contexts, requests, timers, frames, captures, views, drawing,
    get begins() { return begins; }, get stops() { return stops; },
    grant(index = requests.length - 1, input = stream(track())) { requests[index].resolve(input); return input; },
    async start() { controller.setActive(true); const opened = controller.openView(); const input = this.grant();
      assert.equal(await opened, true); return input; },
    captureNode() { return contexts.at(-1).nodes.find(node => node.kind === "capture"); },
    snapshot(data = new Float32Array([0, .5, -.5, .25]), mode = "rolling") {
      const node = this.captureNode(); const id = node.port.sent.at(-1).id;
      node.port.send({ type: "snapshot", id, mode, sampleRate: 48000, samples: data });
    },
    hide() { document.hidden = true; events.get("document:visibilitychange")(); },
    leave() { events.get("window:pagehide")(); },
    step(t = 125) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(t)); },
    expire() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); }
  };
}

test("M2 source pickers are exclusive: two compact buttons, separate mic workspace, no unsolicited permission", () => {
  const f = fixture(), c = f.controller;
  assert.match(html, /id="analysisExample"[\s\S]*class="analysis-source-actions"[\s\S]*id="analysisOpen"[\s\S]*id="analysisMicOpen"/);
  assert.match(html, /id="analysisWorkspace"[\s\S]*id="analysisMicWorkspace" hidden/);
  assert.doesNotMatch(html.slice(html.indexOf('id="analysisWorkspace"'), html.indexOf('id="analysisMicWorkspace"')),
    /id="analysisMicRecord"/);
  assert.equal(f.requests.length, 0); assert.equal(c.open, false);
  c.setActive(true); c.renderLanguage("en"); c.renderLanguage("mn");
  assert.equal(f.requests.length, 0);
  assert.equal(f.get("analysisWorkspace").hidden, false);
  assert.equal(f.get("analysisMicWorkspace").hidden, true);
  assert.match(f.get("analysisMicRecord").textContent, /Бичих/);
  assert.doesNotMatch(source, /(?:fetch|XMLHttpRequest|MediaRecorder|localStorage)\s*\(/);
  for (const element of f.document.querySelectorAll("[data-mic-i18n]")) {
    const key = element.getAttribute("data-mic-i18n");
    assert.ok(mic.words.mn[key] && mic.words.en[key], `Missing bilingual text ${key}`);
  }
});

test("M2 explicit microphone opening builds a silent worklet capture graph and live waveform/spectrum", async () => {
  const f = fixture(), c = f.controller; c.setActive(true);
  const start = c.openView();
  assert.equal(f.requests.length, 1, "permission requested by button action only");
  assert.deepEqual(f.requests[0].settings, { audio: { echoCancellation: false,
    noiseSuppression: false, autoGainControl: false }, video: false });
  assert.equal(c.phase, "requesting");
  assert.equal(f.get("analysisWorkspace").hidden, true);
  assert.equal(f.get("analysisMicWorkspace").hidden, false);
  const input = f.grant(); assert.equal(await start, true);
  assert.equal(c.phase, "live"); assert.equal(f.contexts.length, 1);
  const ctx = f.contexts[0];
  assert.equal(ctx.modules[0], "./sound-mic-capture-worklet.js?v=s077");
  assert.deepEqual(ctx.nodes.map(node => node.kind), ["source", "analyser", "capture", "sink"]);
  assert.deepEqual(ctx.nodes.map(node => node.connections.length), [1, 1, 1, 1]);
  assert.equal(ctx.nodes[1].fftSize, 4096);
  assert.equal(ctx.nodes[3].gain.value, 0);
  assert.equal(ctx.nodes[3].connections[0], ctx.destination);
  assert.ok(f.drawing.count > 2000);
  assert.equal(f.get("analysisMicIndicator").dataset.state, "live");
  c.stop();
  assert.equal(input.tracks[0].stops, 1); assert.equal(input.tracks[0].listenerCount, 0);
  assert.equal(ctx.closes, 1); assert.ok(ctx.nodes.every(n => n.disconnected));
  assert.equal(f.get("analysisWorkspace").hidden, false);
  assert.equal(f.get("analysisMicWorkspace").hidden, true);
  assert.deepEqual(f.views, [true, false]); assert.equal(f.captures.length, 0);
});

test("M2 Close & analyze without Record passes a valid bounded rolling WAV and its microphone origin", async () => {
  const f = fixture(), c = f.controller, input = await f.start();
  f.captureNode().port.send({ type: "progress", available: 4.2, take: null });
  assert.match(f.get("analysisMicRecordingStatus").textContent, /4\.2/);
  const pending = c.finish();
  f.snapshot();
  assert.equal(await pending, true);
  assert.equal(input.tracks[0].stops, 1);
  assert.equal(f.captures.length, 1);
  const captured = f.captures[0];
  assert.equal(captured.origin.kind, "microphone");
  assert.equal(captured.origin.origin, "microphone");
  assert.equal(captured.origin.captureMode, "rolling");
  assert.match(captured.name, /^microphone-.*\.wav$/);
  assert.equal(captured.blob.type, "audio/wav");
  const bytes = new Uint8Array(await captured.blob.arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), "RIFF");
  assert.equal(new DataView(bytes.buffer).getUint32(40, true), 8);
  assert.equal(f.get("analysisMicWorkspace").hidden, true);
  assert.equal(f.get("analysisWorkspace").hidden, false);
});

test("M2 Record and Stop freeze a specific take; Close uses that take, not the newer rolling sound", async () => {
  const f = fixture(), c = f.controller; await f.start();
  assert.equal(c.beginTake(), true);
  assert.deepEqual(f.captureNode().port.sent.at(-1), { type: "beginTake", takeId: 1 });
  f.captureNode().port.send({ type: "progress", available: 5, take: 2.3 });
  assert.match(f.get("analysisMicRecordingStatus").textContent, /2\.3/);
  assert.equal(c.stopTake(), true);
  assert.deepEqual(f.captureNode().port.sent.at(-1), { type: "stopTake" });
  f.captureNode().port.send({ type: "takeStopped", takeId: 1, reason: "manual", frames: 96000, sampleRate: 48000 });
  assert.match(f.get("analysisMicRecordingStatus").textContent, /2/);
  assert.equal(c.takeReady, true);
  const done = c.finish();
  f.snapshot(new Float32Array([.4, -.4]), "take");
  assert.equal(await done, true);
  assert.equal(f.captures[0].origin.captureMode, "take");
  assert.equal(f.captures.length, 1);
});

test("M2 auto-stop at 30 s updates buttons, while Discard keeps existing Analysis source", async () => {
  const f = fixture(), c = f.controller; await f.start();
  c.beginTake();
  f.captureNode().port.send({ type: "takeStopped", takeId: 1, reason: "limit", frames: 1440000, sampleRate: 48000 });
  assert.equal(c.recording, false); assert.equal(c.takeReady, true);
  assert.equal(f.get("analysisMicRecordStop").hidden, true);
  assert.match(f.get("analysisMicStatus").textContent, /30 секунд/);
  f.get("analysisMicDiscard").click();
  assert.equal(f.captures.length, 0); assert.equal(f.get("analysisWorkspace").hidden, false);
});

test("M2 rapid Stop/Record ignores a delayed stop acknowledgement from the older take", async () => {
  const f = fixture(), c = f.controller; await f.start();
  c.beginTake(); c.stopTake(); c.beginTake();
  assert.equal(c.recording, true);
  f.captureNode().port.send({ type: "takeStopped", takeId: 1, reason: "manual",
    frames: 12000, sampleRate: 48000 });
  assert.equal(c.recording, true, "Old take must not stop the new one");
  assert.equal(c.takeReady, false);
  f.captureNode().port.send({ type: "takeStopped", takeId: 2, reason: "manual",
    frames: 24000, sampleRate: 48000 });
  assert.equal(c.recording, false);
  assert.equal(c.takeDuration, .5);
  c.stop();
});

test("M2 delayed permissions and AudioContext resume cannot restart after cancel or replace new graph", async () => {
  const f = fixture({ resumePending: true }), c = f.controller; c.setActive(true);
  const first = c.openView(); c.stop();
  const oldStream = f.grant(0); assert.equal(await first, false);
  assert.equal(oldStream.tracks[0].stops, 1); assert.equal(f.contexts.length, 0);
  const second = c.openView(), current = f.grant(1);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.contexts.length, 1);
  // The old M1 guard also protects cancellation during context.resume.
  for (let i = 0; i < 6 && !f.contexts[0].finishResume; i++) await Promise.resolve();
  assert.equal(typeof f.contexts[0].finishResume, "function");
  c.stop(); f.contexts[0].finishResume();
  assert.equal(await second, false);
  assert.equal(current.tracks[0].stops, 1);
  assert.equal(f.captures.length, 0);
});

test("M2 invalid/no audio is not imported; Stop while snapshot is pending rejects stale results", async () => {
  const f = fixture(), c = f.controller; await f.start();
  let pending = c.finish(); f.snapshot(new Float32Array(0));
  assert.equal(await pending, false);
  assert.equal(c.open, true);
  assert.match(f.get("analysisMicStatus").textContent, /сорьц/);
  pending = c.finish();
  c.stop();
  assert.equal(await pending, false);
  assert.equal(f.captures.length, 0);
  assert.equal(f.timers.size, 0);
});

test("M2 permission failures are visible/retryable; unsupported and failed graphs release hardware", async () => {
  const denied = fixture(), c = denied.controller; c.setActive(true);
  const attempt = c.openView();
  const error = new Error("denied"); error.name = "NotAllowedError";
  denied.requests[0].reject(error);
  assert.equal(await attempt, false);
  assert.equal(c.phase, "error"); assert.equal(c.open, true);
  assert.equal(denied.get("analysisMicRetry").hidden, false);
  const retry = c.start(); const ok = denied.grant(1); assert.equal(await retry, true);
  c.stop(); assert.equal(ok.tracks[0].stops, 1);
  for (const options of [{ api: false }, { secure: false }, { worklet: false }]) {
    const f = fixture(options); f.controller.setActive(true);
    assert.equal(await f.controller.openView(), false);
    assert.equal(f.contexts.length, 0); assert.equal(f.requests.length, 0);
    assert.equal(f.controller.phase, "error"); f.controller.stop();
  }
  for (const options of [{ graphFails: true }, { moduleFails: true }]) {
    const f = fixture(options); f.controller.setActive(true);
    const pending = f.controller.openView(), input = f.grant();
    assert.equal(await pending, false); assert.equal(input.tracks[0].stops, 1);
    assert.equal(f.contexts[0].closes, 1);
    assert.ok(f.contexts[0].nodes.every(n => n.disconnected));
  }
});

test("M2 hide, pagehide, unplug and global Stop always release capture and never import implicitly", async () => {
  for (const action of [f => f.hide(), f => f.leave(), f => f.input.tracks[0].dispatch("ended"),
    f => f.controller.stop(), f => f.controller.setActive(false)]) {
    const f = fixture(); f.input = await f.start(); action(f);
    assert.equal(f.input.tracks[0].stops, 1); assert.equal(f.contexts[0].closes, 1);
    assert.equal(f.controller.open, false); assert.equal(f.frames.size, 0);
    assert.equal(f.captures.length, 0);
  }
});

test("M2 live axes, language, mute, and redraw throttle stay inside a single capture session", async () => {
  const f = fixture({ width: 320 }), c = f.controller; await f.start();
  const node = c.capture, before = f.drawing.count;
  f.get("analysisMicAxis").value = "log"; f.get("analysisMicAxis").dispatch("change");
  f.get("analysisMicMaxHz").value = "all"; f.get("analysisMicMaxHz").dispatch("change");
  c.renderLanguage("en");
  assert.equal(c.capture, node); assert.equal(f.requests.length, 1);
  assert.ok(f.drawing.count > before);
  f.step(0); const at0 = f.drawing.count;
  f.step(50); assert.equal(f.drawing.count, at0);
  f.step(125); assert.ok(f.drawing.count > at0);
  f.contexts[0].input.tracks[0].dispatch("mute");
  assert.equal(c.statusKey, "muted");
  f.contexts[0].input.tracks[0].dispatch("unmute");
  assert.equal(c.statusKey, "live");
  c.stop();
});
