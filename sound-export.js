/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Render a captured Compose project locally, without opening live audio.
 */
(function (root, factory) {
  const project = typeof module === "object" && module.exports ? require("./sound-project.js") : root.SoundLabProject;
  const abc = typeof module === "object" && module.exports ? require("./sound-abc.js") : root.SoundLabABC;
  const drums = typeof module === "object" && module.exports ? require("./sound-drum-abc.js") : root.SoundLabDrumABC;
  const score = typeof module === "object" && module.exports ? require("./sound-score.js") : root.SoundLabScore;
  const player = typeof module === "object" && module.exports ? require("./sound-score-player.js") : root.SoundLabScorePlayer;
  const held = typeof module === "object" && module.exports ? require("./sound-held-voice.js") : root.SoundLabHeldVoice;
  const wav = typeof module === "object" && module.exports ? require("./sound-wav.js") : root.SoundLabWav;
  const api = factory(project, abc, drums, score, player, held, wav);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabExport = api;
})(typeof window !== "undefined" ? window : null, function (projects, abc, drums, scoreModel, playerModel, held, wav) {
  "use strict";

  const SAMPLE_RATE = 44100;
  // A cap on retained mono PCM sample buffers, including shared held noise.
  // Native oscillators/filters and PeriodicWaves are separate allocations.
  const MAX_BUFFER_BYTES = 128 * 1024 * 1024;
  // Limit peak offline rendering memory by actual output bytes, not an arbitrary
  // piece duration. This permits many minutes of music on mobile browsers.
  const MAX_RENDER_PCM_BYTES = 256 * 1024 * 1024;
  const PEAK_LIMIT = .98;
  const END_PAD_SECONDS = .02;
  const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));

  class ExportError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "ExportError";
      this.code = code;
    }
  }
  function detail(error) {
    return String(error?.message || "Audio export failed")
      .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 512);
  }
  function limit(message) { throw new ExportError("limit", message); }

  function prepare(snapshot, models) {
    // captureProject may return live ensemble references. Copy and validate
    // synchronously, before the first yield, so later edits cannot change this file.
    const project = projects.validate({ format: projects.FORMAT, version: projects.VERSION,
      title: "", mode: snapshot?.mode, content: snapshot?.content });
    const content = project.content;
    if (project.mode === "ensemble" && content.tracks.some(track => track.patternDraft !== null)) {
      throw new ExportError("invalid", "Correct or restore the unfinished drum pattern before exporting audio");
    }
    const owner = { output: null, readyContext() {
      throw new Error("Offline export must not open a live audio context");
    } };
    const Player = project.mode === "solo" ? playerModel.Player : playerModel.EnsemblePlayer;
    // A fixed-size cache bounds simultaneous retained instrument timbres;
    // it does not limit the number of score events.
    const synth = new Player({ ...models, contextOwner: owner,
      bufferCacheLimit: playerModel.MAX_BUFFER_CACHE, maxBufferBytes: MAX_BUFFER_BYTES,
      strictBufferFrames: true });
    if (project.mode === "solo") {
      synth.configure({ ...content, score: abc.parse(content.abc) });
    } else {
      const tracks = content.tracks.map(track => ({ ...track,
        score: track.instrument === "drums" ? drums.parse(track.abc) : abc.parse(track.abc) }));
      // Validate every part, even a muted one. Export never hides bad drafts.
      synth.configure({ tracks, tuning: content.tuning });
    }
    let end = scoreModel.beatToSeconds(synth.score, synth.score.totalBeats);
    if (!Number.isFinite(end) || end <= 0) limit("The score has an invalid playback length");
    const schedule = [], specs = new Map();
    let bufferBytes = 0, sharedBytes = 0;
    for (const event of synth.playEvents) {
      if (!synth.isEventAudible(event)) continue;
      const at = scoreModel.beatToSeconds(synth.score, event.startBeat);
      const endsAt = scoreModel.beatToSeconds(synth.score, event.startBeat + event.durationBeats);
      sharedBytes = Math.max(sharedBytes, synth.sharedBufferBytes(event, SAMPLE_RATE));
      const spec = synth.bufferSpec(event, SAMPLE_RATE);
      if (spec && !specs.has(spec.key)) {
        if (!Number.isSafeInteger(spec.frames) || spec.frames <= 0) limit("An instrument requires an unsupported audio buffer length");
        bufferBytes += spec.frames * 4;
        specs.set(spec.key, spec);
      }
      if (!Number.isSafeInteger(bufferBytes + sharedBytes) || bufferBytes + sharedBytes > MAX_BUFFER_BYTES) {
        limit("This arrangement needs more than 128 MiB of instrument sample buffers; use fewer distinct instrument pitches");
      }
      end = Math.max(end, synth.voiceEndTime(event, at, endsAt, SAMPLE_RATE));
      schedule.push({ event, at, endsAt });
    }
    const frames = Math.ceil((end + END_PAD_SECONDS) * SAMPLE_RATE);
    if (!Number.isSafeInteger(frames) || frames <= 0 || frames * 4 > MAX_RENDER_PCM_BYTES) {
      limit("This recording exceeds the 256 MiB offline PCM memory budget on this device; export a shorter selection or use a larger-memory renderer");
    }
    // Reserve the one shared excitation-noise buffer before transient models
    // allocate their caches. Both allocation paths fit the same memory cap.
    synth.maxBufferBytes = MAX_BUFFER_BYTES - sharedBytes;
    return { synth, owner, schedule, specs, frames };
  }

  function dispose(plan) {
    if (!plan) return;
    const synth = plan.synth, sources = [...synth.voices].flatMap(voice =>
      voice.held ? voice.held.sources : [voice.source]);
    for (const source of sources) source.onended = null;
    try { synth.stop(); }
    finally {
      // Source nodes may hold buffers even after they leave the reusable cache.
      for (const source of sources) {
        try { if ("buffer" in source) source.buffer = null; } catch (_) { /* Already released. */ }
      }
      held.clearNoiseBuffer(synth.context);
      synth.clearBuffers();
      synth.playEvents = [];
      synth.score = null;
      synth.context = null;
      plan.owner.output = null;
      plan.specs.clear();
      plan.schedule.length = 0;
    }
  }

  async function render(snapshot, { transientModel, sustainModel, temperamentModel, OfflineAudioContext } = {}) {
    if (typeof OfflineAudioContext !== "function") {
      throw new ExportError("unsupported", "This browser does not support offline audio rendering");
    }
    if (!transientModel || !sustainModel || !wav) {
      throw new ExportError("unsupported", "Sound Lab audio export models are unavailable");
    }
    let plan;
    try { plan = prepare(snapshot, { transientModel, sustainModel, temperamentModel }); }
    catch (error) {
      if (error instanceof ExportError) throw error;
      throw new ExportError(error?.code === "size" || error?.code === "limit" ? "limit" : "invalid", detail(error));
    }
    try {
      // This yield lets the Rendering status paint. It is not a playback timer.
      await yieldTask();
      const context = new OfflineAudioContext(1, plan.frames, SAMPLE_RATE);
      if (typeof context.startRendering !== "function") {
        throw new ExportError("unsupported", "This browser does not support offline audio rendering");
      }
      plan.synth.context = context;
      plan.owner.output = context.destination;
      plan.synth.preparePlayback(context);
      let count = 0;
      for (const spec of plan.specs.values()) {
        plan.synth.bufferFor(spec);
        if (++count % 4 === 0) await yieldTask();
      }
      count = 0;
      for (const { event, at, endsAt } of plan.schedule) {
        plan.synth.scheduleNote(event, at, endsAt);
        if (++count % 64 === 0) await yieldTask();
      }
      const rendered = await context.startRendering();
      if (!rendered || rendered.numberOfChannels !== 1 || rendered.sampleRate !== SAMPLE_RATE || rendered.length !== plan.frames) {
        throw new ExportError("render", "Offline rendering returned an unexpected audio format or length");
      }
      const samples = rendered.getChannelData(0);
      if (!samples || samples.length !== plan.frames) {
        throw new ExportError("render", "Offline rendering returned an unexpected audio channel length");
      }
      let peak = 0;
      for (let i = 0; i < samples.length; i++) {
        const value = samples[i];
        if (!Number.isFinite(value)) throw new ExportError("render", "An instrument produced invalid audio samples");
        peak = Math.max(peak, Math.abs(value));
      }
      // Preserve the chosen mix. Only reduce an overloaded mix as one whole;
      // quiet arrangements are never normalized upward and parts are not remixed.
      const gain = peak > PEAK_LIMIT ? PEAK_LIMIT / peak : 1;
      const bytes = wav.encodeWav([samples], SAMPLE_RATE,
        { maxSeconds: Math.ceil(plan.frames / SAMPLE_RATE), gain });
      return { bytes, duration: plan.frames / SAMPLE_RATE, sampleRate: SAMPLE_RATE, peak, gain };
    } catch (error) {
      if (error instanceof ExportError) throw error;
      throw new ExportError(error?.code === "limit" ? "limit" : "render", detail(error));
    } finally { dispose(plan); }
  }

  return Object.freeze({ SAMPLE_RATE, MAX_BUFFER_BYTES, MAX_RENDER_PCM_BYTES,
    PEAK_LIMIT, ExportError, render });
});
