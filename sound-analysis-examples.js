/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Seven local teaching examples: four exact generated signals and three
 * current Compose/offline instrument models. No recordings or live playback.
 */
(function (root, factory) {
  "use strict";
  const node = typeof module === "object" && module.exports;
  const exporter = node ? require("./sound-export.js") : root.SoundLabExport;
  const reader = node ? require("./sound-wave-reader.js") : root.SoundLabWaveReader;
  const defaults = {
    transientModel: node ? require("./sound-transient.js") : root.SoundLabTransientModel,
    sustainModel: node ? require("./sound-sustain.js") : root.SoundLabSustain,
    temperamentModel: node ? require("./sound-temperaments.js") : root.SoundLabTemperaments,
    OfflineAudioContext: root.OfflineAudioContext || root.webkitOfflineAudioContext
  };
  const api = factory(exporter, reader, defaults);
  if (node) module.exports = api;
  if (root) root.SoundLabAnalysisExamples = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (exporter, reader, defaults) {
  "use strict";
  const SAMPLE_RATE = 44100;
  const CHUNK_FRAMES = 16384;
  const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
  const label = (mn, en) => Object.freeze({ mn, en });
  const CLASSES = Object.freeze([
    Object.freeze({ id: "reference", title: label("Жишиг дохионууд", "Reference signals") }),
    Object.freeze({ id: "instruments", title: label("Хөгжмийн загварууд", "Modeled instruments") })
  ]);
  const CATALOGUE = Object.freeze([
    {
      id: "reference-sine-440", classId: "reference", kind: "generated", duration: 2,
      title: label("Синус · 440 Гц", "Sine · 440 Hz"),
      description: label("440 Гц давтамжтай, 0.5 далайцтай жишиг синус. Үе ба спектрийн оргилыг харьцуулаарай.",
        "A 440 Hz reference sine with amplitude 0.5. Compare its period and spectral peak.")
    },
    {
      id: "reference-beats-440-444", classId: "reference", kind: "generated", duration: 4,
      title: label("Ойр хоёр давтамж · 440 + 444 Гц", "Two close tones · 440 + 444 Hz"),
      description: label("Тус бүр 0.25 далайцтай хоёр синус. Ойр оргилуудыг ялгахын тулд FFT цонхыг уртасгаж үзээрэй.",
        "Two sines, each with amplitude 0.25. Increase the FFT window to separate their nearby peaks.")
    },
    {
      id: "reference-chirp", classId: "reference", kind: "generated", duration: 3,
      title: label("Өсөх давтамж · 150–2,000 Гц", "Rising chirp · 150–2,000 Hz"),
      description: label("Давтамж нь хугацаагаар шугаман өснө; фазыг интегралчилж тооцов. Шинжлэх заагчийг хөдөлгөж харьцуулаарай.",
        "Frequency rises linearly in time; phase is integrated. Move the inspection cursor to compare different moments.")
    },
    {
      id: "reference-white-noise", classId: "reference", kind: "generated", duration: 3,
      title: label("Цагаан шуугиан", "White noise"),
      description: label("Тогтмол үртэй санамсаргүй генераторын шуугиан. Хэсгийн дундаж спектр нь нэг цонхны спектрээс жигд байна.",
        "Seeded pseudorandom noise. The selection-average spectrum is smoother than a single window.")
    },
    {
      id: "model-guitar-a3", classId: "instruments", kind: "modeled", duration: 3.02,
      title: label("Гитар · A3 татах", "Guitar · A3 pluck"),
      description: label("Ая зохиох хэсгийн одоогийн гитарын загварыг WAV болгосон; бодит бичлэг биш. Эхлэл ба дээд гармоникуудын замхралыг ажиглаарай.",
        "The current Compose guitar model rendered through WAV export, not a recording. Inspect the attack and upper-partial decay.")
    },
    {
      id: "model-flute-a4", classId: "instruments", kind: "modeled", duration: 3.02,
      title: label("Лимбэ · A4 барих", "Flute · held A4"),
      description: label("Ая зохиох хэсгийн одоогийн хялбарчилсан лимбэний загвар; үлээх самбарын амьсгалын шуугиан ороогүй. Бодит бичлэг биш.",
        "The current simplified Compose/offline flute, without the Blow/Bow panel's breath-noise path. Not a recording.")
    },
    {
      id: "model-chime-c5", classId: "instruments", kind: "modeled", duration: 3.02,
      title: label("Хонхон саваа · C5", "Chime · C5"),
      description: label("Одоогийн хонхон савааны загварыг WAV болгосон; бодит бичлэг биш. Гармоник бус оргилууд ба удаан жингэнэлтийг ажиглаарай.",
        "The current chime model rendered through WAV export, not a recording. Inspect its inharmonic peaks and ringing tail.")
    }
  ].map(Object.freeze));

  class ExampleError extends Error {
    constructor(code, message) { super(message); this.name = "ExampleError"; this.code = code; }
  }

  function checkCancelled(isCancelled) {
    if (isCancelled()) throw new ExampleError("cancelled", "Example preparation was cancelled");
  }

  function modelSnapshot(id) {
    const recipes = {
      "model-guitar-a3": { instrument: "guitar", notes: "A, z5" },
      "model-flute-a4": { instrument: "flute", notes: "A5 z" },
      "model-chime-c5": { instrument: "chimes", notes: "c z5" }
    };
    const recipe = recipes[id];
    // One original note plus silence. A 3 s bar retains the full guitar/chime
    // tail and the flute's release; Export adds its normal final 20 ms pad.
    return { mode: "solo", content: {
      abc: "X:1\nT:Analysis example\nM:6/4\nL:1/4\nQ:1/4=120\nK:C\n" + recipe.notes + " |]",
      instrument: recipe.instrument, tuning: "equal", volume: 100,
      guitar: { mode: "pluck", spacingMs: 20 }
    } };
  }

  async function create(id, options = {}) {
    const entry = CATALOGUE.find(item => item.id === id);
    if (!entry) throw new ExampleError("invalid", "Unknown analysis example");
    const {
      isCancelled = () => false, onProgress = () => {}, yieldTask: pause = yieldTask
    } = options;
    if (typeof isCancelled !== "function" || typeof onProgress !== "function" || typeof pause !== "function") {
      throw new ExampleError("invalid", "Invalid example callbacks");
    }
    checkCancelled(isCancelled);
    onProgress(0);
    await pause();
    checkCancelled(isCancelled);

    if (entry.kind === "modeled") {
      if (!exporter || !reader) throw new ExampleError("unsupported", "The local instrument renderer is unavailable");
      // Reuse the score scheduler, voice recipes, release handling and export
      // encoder. These examples therefore analyze exactly the current exported
      // model audio, including its PCM16 quantization, not ideal recipe plots.
      const rendered = await exporter.render(modelSnapshot(id), {
        transientModel: options.transientModel ?? defaults.transientModel,
        sustainModel: options.sustainModel ?? defaults.sustainModel,
        temperamentModel: options.temperamentModel ?? defaults.temperamentModel,
        OfflineAudioContext: options.OfflineAudioContext ?? defaults.OfflineAudioContext
      });
      // Native offline rendering has no abort operation. A stale short render
      // may finish, but must never replace the active source or start playback.
      checkCancelled(isCancelled);
      onProgress(.75);
      const pcm = await reader.decode(rendered.bytes, {
        isCancelled, yieldTask: pause,
        onProgress: value => onProgress(.75 + .25 * value)
      });
      checkCancelled(isCancelled);
      return { ...pcm, exampleId: id, kind: entry.kind, modelPath: "compose-wav",
        renderingGain: rendered.gain };
    }

    const frames = Math.round(entry.duration * SAMPLE_RATE);
    const samples = new Float32Array(frames);
    let noiseState = 0x51a7cb1d, peak = 0;
    for (let start = 0; start < frames; start += CHUNK_FRAMES) {
      checkCancelled(isCancelled);
      const end = Math.min(frames, start + CHUNK_FRAMES);
      for (let i = start; i < end; i++) {
        const time = i / SAMPLE_RATE;
        let value;
        if (id === "reference-sine-440") value = .5 * Math.sin(2 * Math.PI * 440 * time);
        else if (id === "reference-beats-440-444") {
          value = .25 * (Math.sin(2 * Math.PI * 440 * time) + Math.sin(2 * Math.PI * 444 * time));
        } else if (id === "reference-chirp") {
          const cycles = 150 * time + .5 * (2000 - 150) / entry.duration * time * time;
          value = .5 * Math.sin(2 * Math.PI * cycles);
        } else {
          noiseState ^= noiseState << 13;
          noiseState ^= noiseState >>> 17;
          noiseState ^= noiseState << 5;
          value = (noiseState >>> 0) / 4294967296 - .5;
        }
        samples[i] = value;
        peak = Math.max(peak, Math.abs(samples[i]));
      }
      onProgress(end / frames);
      await pause();
    }
    checkCancelled(isCancelled);
    return { sampleRate: SAMPLE_RATE, channels: [samples], frames, duration: frames / SAMPLE_RATE,
      encoding: "generated-float32", peak, exampleId: id, kind: entry.kind };
  }

  return Object.freeze({ SAMPLE_RATE, CLASSES, CATALOGUE, ExampleError, create });
});
