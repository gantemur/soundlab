/* SPDX-FileCopyrightText: 2026 Tsogtgerel Gantumur
 * SPDX-License-Identifier: MIT
 * Four exact generated signals, three Compose/offline models and eleven
 * provenance-reviewed local recordings. Recording WAVs load on selection only.
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
  const CC0 = "https://creativecommons.org/publicdomain/zero/1.0/";
  const BY3 = "https://creativecommons.org/licenses/by/3.0/";
  const BY4 = "https://creativecommons.org/licenses/by/4.0/";
  function recorded(id, classId, duration, mn, en, descriptionMn, descriptionEn, creator, sourceUrl, license, licenseUrl) {
    return {
      id, classId, kind: "recorded", duration, title: label(mn, en),
      description: label(descriptionMn, descriptionEn),
      path: `assets/analysis/${id}.wav`,
      credit: Object.freeze({ creator, sourceUrl, license, licenseUrl })
    };
  }
  const CLASSES = Object.freeze([
    Object.freeze({ id: "reference", title: label("Жишиг дохионууд", "Reference signals") }),
    Object.freeze({ id: "instruments", title: label("Хөгжмийн загварууд", "Modeled instruments") }),
    Object.freeze({ id: "nature", title: label("Байгаль, ус", "Nature and water") }),
    Object.freeze({ id: "wildlife", title: label("Амьтдын авиа", "Wildlife") }),
    Object.freeze({ id: "objects", title: label("Эд зүйлс, цохилт", "Objects and impacts") }),
    Object.freeze({ id: "footsteps", title: label("Алхах чимээ", "Footsteps") }),
    Object.freeze({ id: "mechanical", title: label("Механик хэмнэл", "Mechanical rhythms") })
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
      description: label("Үлээх, ая зохиох, WAV гаргах хэсгүүдийн ижил лимбэний загвар: үлээлт, амьсгалын шуугиан, эхлэл ба намдалт орсон. Бодит бичлэг биш.",
        "The shared Blow/Bow and Compose/offline flute, including breath noise, jet colour, attack and release. Not a recording.")
    },
    {
      id: "model-chime-c5", classId: "instruments", kind: "modeled", duration: 3.02,
      title: label("Хонхон саваа · C5", "Chime · C5"),
      description: label("Одоогийн хонхон савааны загварыг WAV болгосон; бодит бичлэг биш. Гармоник бус оргилууд ба удаан жингэнэлтийг ажиглаарай.",
        "The current chime model rendered through WAV export, not a recording. Inspect its inharmonic peaks and ringing tail.")
    },
    recorded("nature-rain", "nature", 8, "Бороо · цонхны цаана", "Rain · outside a window",
      "Бодит борооны бичлэг. Тогтвортой өргөн зурвасын шуугианыг ажиглаарай.",
      "A real rain recording. Look for sustained broadband noise.",
      "Anthousai", "https://freesound.org/people/Anthousai/sounds/398741/", "CC0 1.0", CC0),
    recorded("nature-stream", "nature", 6, "Ойн горхи", "Forest stream",
      "Бодит горхины бичлэг. Усны тасралтгүй шуугиан ба өөрчлөгдөх бүрэлдэхүүнийг харьцуулаарай.",
      "A real stream recording. Compare its continuous noise with fluctuating components.",
      "cher1101", "https://freesound.org/people/cher1101/sounds/671947/", "CC0 1.0", CC0),
    recorded("nature-drips", "nature", 4, "Усны дусал, намдалт", "Water drops and settling",
      "Бодит усны хөдөлгөөний богино бичлэгээс давтан эвлүүлсэн хэсэг; тасралтгүй хээрийн бичлэг биш.",
      "Repeated excerpts of real water settling and dripping; an assembled example, not uninterrupted ambience.",
      "felix.blume", "https://freesound.org/people/felix.blume/sounds/434978/", "CC0 1.0", CC0),
    recorded("wildlife-bird", "wildlife", 4, "Өглөөний шувууд", "Morning birds",
      "Бодит шувуудын жиргээний бичлэг. Нарийн давтамжийн судлуудыг хайгаарай.",
      "A recording of morning birds. Look for narrow time-varying frequency bands.",
      "Joseph Sardin", "https://commons.wikimedia.org/wiki/File:R%C3%A9veil_des_oiseaux.ogg", "CC0 1.0", CC0),
    recorded("wildlife-cricket", "wildlife", 5, "Хүрэлзгэнэ", "Crickets",
      "Шөнийн хүрэлзгэнийн бодит бичлэгийн хэсэг. Давтагдах өндөр давтамжийн зурвасуудыг ажиглаарай.",
      "Excerpt of recorded nighttime crickets. Inspect the repeating high-frequency bands.",
      "hdfreema", "https://freesound.org/people/hdfreema/sounds/333221/", "CC0 1.0", CC0),
    recorded("object-wood", "objects", 2, "Модон хаалга тогших", "Knocking on wood",
      "Бодит модон хаалга тогшсон бичлэгийн хэсэг. Цохилтын эхлэл ба богино цуурайг харьцуулаарай.",
      "Excerpt of knocks on a real wooden door. Compare the transients and short resonances.",
      "Ligidium", "https://freesound.org/people/Ligidium/sounds/193866/", "CC0 1.0", CC0),
    recorded("object-metal", "objects", 3, "Төмөр тавиур цохих", "Metal rack strike",
      "Бодит төмөр тавиурын цохилт. Богино бичлэгийн араас чимээгүй хугацаа залгасан.",
      "A recorded metal-rack strike with silence appended to inspect its decay.",
      "code4fukui", "https://github.com/code4fukui/sound-cc0/blob/main/metal1.wav", "CC0 1.0", CC0),
    recorded("object-latch", "objects", 2, "Хаалга хаах", "Closing a door",
      "Бодит хаалга хаах бичлэг; түгжээ, цохилт, замхралыг ялгаж хараарай. Төгсгөлд чимээгүй хугацаа залгасан.",
      "Recorded door closing; inspect the latch/impact and decay. Silence is appended.",
      "Gravity Sound", "https://commons.wikimedia.org/wiki/File:Close_door_(Gravity_Sound).wav", "CC BY 4.0", BY4),
    recorded("footsteps-wood", "footsteps", 6, "Модон дээр алхах", "Walking on wood",
      "Бодит модон дээрх таван алхмын хэсгийг давтан эвлүүлсэн зургаан секундийн жишээ.",
      "Six seconds assembled by repeating five recorded hollow-wood steps.",
      "florianreichelt", "https://freesound.org/people/florianreichelt/sounds/459970/", "CC0 1.0", CC0),
    recorded("footsteps-gravel", "footsteps", 6, "Хайрган дээр алхах", "Gravel-like footsteps",
      "Kenney-ийн бодит алхалтын арван өөр богино цохилтыг дараалан эвлүүлсэн. Нэг удаагийн тасралтгүй бичлэг биш.",
      "Ten distinct Kenney foley footstep samples arranged into a sequence, not a continuous field recording.",
      "Kenney", "https://kenney.nl/assets/rpg-audio", "CC0 1.0", CC0),
    recorded("mechanical-clock", "mechanical", 5, "Цагийн цохилт", "Clock ticks",
      "ESC-10 дахь жинхэнэ цагийн бичлэгийн таван секундийн хэсэг. Бичлэг CC BY 3.0 нөхцөлтэй.",
      "Five-second excerpt of a real clock from ESC-10, licensed CC BY 3.0.",
      "Bansemer / ESC-10 (Karol J. Piczak)", "https://github.com/karolpiczak/ESC-50", "CC BY 3.0", BY3)
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

  async function readBundledRecording(path) {
    // Only hard-coded same-origin assets can reach this loader. Local user WAVs
    // follow the separate file chooser and never go to a server.
    if (!/^assets\/analysis\/[a-z-]+\.wav$/.test(path)) {
      throw new ExampleError("invalid", "Invalid bundled recording path");
    }
    try {
      const response = await fetch(path, { credentials: "same-origin" });
      if (!response.ok) throw new ExampleError("unavailable", "Bundled recording could not be loaded");
      const length = Number(response.headers?.get("content-length") || 0);
      if (length > reader.MAX_INPUT_BYTES) throw new ExampleError("limit", "Recording too large");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > reader.MAX_INPUT_BYTES) throw new ExampleError("limit", "Recording too large");
      return bytes;
    } catch (error) {
      if (error instanceof ExampleError) throw error;
      throw new ExampleError("unavailable", "Bundled recording could not be loaded");
    }
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

    if (entry.kind === "recorded") {
      if (!reader) throw new ExampleError("unsupported", "The bundled WAV decoder is unavailable");
      const bytes = await (options.loadRecording || readBundledRecording)(entry.path);
      checkCancelled(isCancelled);
      onProgress(.35);
      const pcm = await reader.decode(bytes, {
        isCancelled, yieldTask: pause, onProgress: value => onProgress(.35 + .65 * value)
      });
      checkCancelled(isCancelled);
      return { ...pcm, exampleId: id, kind: entry.kind };
    }

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
