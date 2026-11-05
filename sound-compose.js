/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * The Compose C1 user interface: one editable score and one instrument part.
 */
(function (root, factory) {
  const abc = typeof module === "object" && module.exports ? require("./sound-abc.js") : root.SoundLabABC;
  const scoreModel = typeof module === "object" && module.exports ? require("./sound-score.js") : root.SoundLabScore;
  const playerModel = typeof module === "object" && module.exports ?
    require("./sound-score-player.js") : root.SoundLabScorePlayer;
  const api = factory(abc, scoreModel, playerModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabCompose = api;
})(typeof window !== "undefined" ? window : null, function (abc, scoreModel, playerModel) {
  "use strict";

  const MELODIES = Object.freeze({
    first: "X:1\nT:First melody\nM:4/4\nL:1/4\nQ:1/4=96\nK:C\nC D E G | A2 G2 | E F G2 | C4 |]",
    rests: "X:2\nT:Listen to the rests\nM:4/4\nL:1/8\nQ:1/4=104\nK:C\nC2 z2 E2 G2 | A4 z G2 z | F2 E2 D2 C2 | C8 |]",
    waltz: "X:3\nT:Little waltz\nM:3/4\nL:1/4\nQ:1/4=108\nK:G\nG A B | d2 B | A G F | G3 |]",
    minor: "X:4\nT:Minor melody\nM:4/4\nL:1/4\nQ:1/4=88\nK:Am\nA B c d | e2 d2 | c B A G | A4 |]",
    ode: "X:5\nT:Ode to Joy - Beethoven\nM:4/4\nL:1/4\nQ:1/4=112\nK:G\n" +
      "B B c d | d c B A | G G A B | B3/2 A/2 A2 |\n" +
      "B B c d | d c B A | G G A B | A3/2 G/2 G2 |\n" +
      "A A B G | A B/2 c/2 B G | A B/2 c/2 B A | G A D2 |\n" +
      "B B c d | d c B A | G G A B | A3/2 G/2 G2 |]",
    minuetG: "X:6\nT:Minuet in G - Petzold (complete melody, octave lower)\nM:3/4\nL:1/4\nQ:1/4=112\nK:G\n" +
      "D G,/2 A,/2 B,/2 C/2 | D G, G, | E C/2 D/2 E/2 F/2 | G G, G, |\n" +
      "C D/2 C/2 B,/2 A,/2 | B, C/2 B,/2 A,/2 G,/2 | F, G,/2 A,/2 B,/2 G,/2 | A,3 |\n" +
      "D G,/2 A,/2 B,/2 C/2 | D G, G, | E C/2 D/2 E/2 F/2 | G G, G, |\n" +
      "C D/2 C/2 B,/2 A,/2 | B, C/2 B,/2 A,/2 G,/2 | A, B,/2 A,/2 G,/2 F,/2 | G,3 |\n" +
      "B G/2 A/2 B/2 G/2 | A D/2 E/2 F/2 D/2 | G E/2 F/2 G/2 D/2 | ^C B,/2 C/2 A, |\n" +
      "A,/2 B,/2 ^C/2 D/2 E/2 F/2 | G F E | F A, ^C | D3 |\n" +
      "D G,/2 F,/2 G, | E G,/2 F,/2 G, | D C B, | A,/2 G,/2 F,/2 G,/2 A, |\n" +
      "D,/2 E,/2 F,/2 G,/2 A,/2 B,/2 | C B, A, | B,/2 D/2 G, F, | G,3 |]",
    lightly: "X:7\nT:Lightly Row - traditional\nM:2/4\nL:1/8\nQ:1/4=96\nK:G\n" +
      "d B B2 | c A A2 | G A B c | d d d2 |\n" +
      "d B B2 | c A A2 | G B d d | B2 z2 |\n" +
      "A A A A | A B c2 | B B B B | B c d2 |\n" +
      "d B B2 | c A A2 | G B d d | B2 z2 |]",
    mozart40: "X:8\nT:Symphony No. 40 - Mozart (first subject, octave lower)\nM:2/2\nL:1/4\nQ:1/4=180\nK:Gm\n" +
      "z3 E/2 D/2 | D E/2 D/2 D E/2 D/2 | D B z B/2 A/2 |\n" +
      "G G/2 F/2 E E/2 D/2 | C C z D/2 C/2 | C D/2 C/2 C D/2 C/2 |\n" +
      "C A z A/2 G/2 | ^F ^F/2 E/2 D D/2 C/2 | B, B, z B/2 A/2 |\n" +
      "A c ^F A | G D z B/2 A/2 | A c ^F A | G B A/2 G/2 F/2 E/2 |\n" +
      "D4 | ^C4 | D2 z D,/2 D,/2 |\n" +
      "D,2 z D,/2 D,/2 | D,2 z D,/2 D,/2 |\n" +
      "D, D,/2 D,/2 D, D,/2 D,/2 | D,2 z2 |]",
    frere: "X:9\nT:Frere Jacques - traditional\nM:4/4\nL:1/4\nQ:1/4=112\nK:C\n" +
      "C D E C | C D E C | E F G2 | E F G2 |\n" +
      "G/2 A/2 G/2 F/2 E C | G/2 A/2 G/2 F/2 E C | C G, C2 | C G, C2 |]",
    twinkle: "X:10\nT:Twinkle, Twinkle - traditional\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\n" +
      "C C G G | A A G2 | F F E E | D D C2 |\n" +
      "G G F F | E E D2 | G G F F | E E D2 |\n" +
      "C C G G | A A G2 | F F E E | D D C2 |]",
    korobeiniki: "X:11\nT:Korobeiniki - Russian traditional melody\nM:2/4\nL:1/8\nQ:1/4=96\nK:Dm\n" +
      "A2 EF | G2 FE | D2 DF | A2 GF | E3 F | G2 A2 | F2 D2 | D2 z2 |\n" +
      "G2- G B | d2 c B | A3 F | A2 G F | E2 E F | G2 A2 | F2 D2 | D2 z2 |]",
    kalinka: "X:12\nT:Kalinka - Ivan Larionov (refrain and verse)\nM:2/4\nL:1/8\nQ:1/4=112\nK:Em\n" +
      "B2 | A2 FG | A2 FG | A2 GF | E2 BB | A3/2 G/2 FG | A2 FG | A2 GF | E4 |\n" +
      "e4 | d4 |\n" +
      "Bd cB/A/ | G2 D2 | Bd cB/A/ | G2 D2 | E2 EF | AG FE | D2 D2 | D2 d2 |\n" +
      "Bd AB | G2 D2 | Bd AB | G2 D2 | E2 EF | AG FE | d2 c2 | B4 |]",
    birch: "X:13\nT:Vo pole beryoza stoyala - Russian folk melody\nM:6/4\nL:1/8\nQ:1/4=120\nK:Am\n" +
      "E E E E D2 C C B,2 A,2 | E E G E D D C C B,2 A,2 |\n" +
      "B,3 C D2 C C B,2 A,2 | B, B, B, C D D C C B,2 A,2 |\n" +
      "E E E E D2 C C B,2 A,2 | E E G E D D C C B,2 A,2 |\n" +
      "B,3 C D2 C C B,2 A,2 | B, B, B, C D D C C B,2 A,2 |]"
  });

  const EXAMPLE_INFO = Object.freeze({
    ode: { instrument: "flute", composer: "Ludwig van Beethoven", originalKey: "D major",
      source: "https://abcnotation.com/tunePage?a=trillian.mit.edu%2F~jc%2Fmusic%2Fabc%2Fsong%2FOde_To_Joy%2F0000",
      en: "Choral theme, transposed from D to G major.",
      mn: "Найрал дууны сэдэв; Ре мажороос Соль мажорт шилжүүлсэн." },
    minuetG: { instrument: "piano", composer: "Christian Petzold", originalKey: "G major",
      source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=75",
      en: "Both sections of BWV Anh. 114, G major, one octave lower; repeats and ornaments omitted.",
      mn: "BWV Anh. 114 бүтээлийн хоёр хэсэг, Соль мажор; нэг октав доошлуулж, давталт ба чимэглэлийг орхисон." },
    lightly: { instrument: "violin", composer: "Traditional German melody", originalKey: "Traditional; G major version",
      source: "https://abcnotation.com/tunePage?a=trillian.mit.edu%2F~jc%2Fmusic%2Fbook%2FEverydaySongBook%2F097_Lightly_Row%2F0000",
      en: "Traditional tune from the 1927 Everyday Song Book; G major version.",
      mn: "1927 оны Everyday Song Book дахь ардын ая; Соль мажор хувилбар." },
    mozart40: { instrument: "violin", composer: "Wolfgang Amadeus Mozart", originalKey: "G minor",
      source: "https://github.com/musicologyman-teaching/mozart-k-550/blob/master/mozart-k-550-for-listening-i.ly",
      en: "First subject, violin line in G minor, one octave lower; the next phrase's pickup is omitted at the end.",
      mn: "Эхний сэдвийн хийлийн хоолой; Соль минор, нэг октав доошлуулсан. Төгсгөлд дараагийн өгүүлбэрийн угтвар нотуудыг орхисон." },
    frere: { instrument: "flute", composer: "Traditional French round", originalKey: "Traditional; C major version",
      source: "https://noctavepiano.com/en/sheet-music/trad-frere-jacques/",
      en: "Traditional French round, one voice in C major.",
      mn: "Франц ардын канон; До мажор, нэг хоолой." },
    twinkle: { instrument: "chimes", composer: "Traditional French melody", originalKey: "Traditional; C major version",
      source: "https://noctavepiano.com/en/sheet-music/trad-ah-vous-dirai-je-maman/",
      en: "The traditional tune in C major, without Suzuki's variations.",
      mn: "До мажор дахь ардын ая; Сүзүкийн хувилбарууд ороогүй." },
    korobeiniki: { instrument: "piano", composer: "Russian traditional tune (late 19th century)",
      originalKey: "Traditional; D minor version",
      source: "https://abcnotation.com/tunePage?a=trillian.mit.edu%2F~jc%2Fmusic%2Fabc%2Fmirror%2Fcampin.me.uk%2FChalumeau_55%2F0417",
      en: "A complete 16-bar folk melody in D minor, also known from Tetris. The ornamental turn is omitted.",
      mn: "Тетрис тоглоомоор ч танил болсон Ре минор ардын ая; 16 такт, чимэглэлийн нэг нугалааг орхисон." },
    kalinka: { instrument: "violin", composer: "Ivan Larionov (1860)",
      originalKey: "Original key unverified; E minor / G major source version",
      source: "https://abcnotation.com/tunePage?a=trillian.mit.edu%2F~jc%2Fmusic%2Fabc%2Fsong%2FKalinka_Em%2F0000",
      en: "Refrain and contrasting verse, E minor / G major; a steady tempo replaces fermatas and repeats.",
      mn: "Ми минор/Соль мажор дахь дахилт ба бадаг; фермат, давталтыг орхиж, нэг хурдаар тоглоно." },
    birch: { instrument: "morin", composer: "Traditional Russian folk song", originalKey: "Traditional; A minor version",
      source: "https://ru.wikisource.org/wiki/Справка:Ноты#Нотация_ABC",
      en: "A four-bar folk stanza played twice, in A minor one octave lower than the linked example.",
      mn: "Ля минор ардын дууны дөрвөн такттай бадгийг хоёр давтсан; эх нотны жишээнээс нэг октав доошлуулсан." }
  });

  // ABC comments keep provenance with the editable or privately collected score.
  const EXAMPLES = Object.freeze(Object.fromEntries(Object.entries(MELODIES).map(([id, notes]) => {
    const info = EXAMPLE_INFO[id];
    return [id, info ? notes + "\n\n% Composer/tradition: " + info.composer + "\n% Original key: " +
      info.originalKey + "\n% Version: " + info.en + "\n% Suggested instrument: " + info.instrument + "\n% Source: " +
      info.source : notes];
  })));

  const UI = Object.freeze({
    en: {
      mode: "Compose", phase: "07 · Write a melody", title: "Make a melody",
      intro: "Write a short ABC score, choose one instrument and hear it follow your notes. No sound plays until you press Play.",
      example: "Example score", exampleFirst: "First melody", exampleRests: "Notes and rests",
      exampleWaltz: "Waltz in G", exampleMinor: "Minor tune",
      exampleStudies: "Writing exercises", exampleMelodies: "Melodies and classical excerpts",
      exampleOde: "Beethoven · Ode to Joy (16 bars)",
      exampleMinuetG: "Petzold · Minuet in G (32 bars)",
      exampleLightly: "Lightly Row · folk (16 bars)",
      exampleMozart40: "Mozart · Symphony No. 40 (20-bar theme)",
      exampleFrere: "Frère Jacques · folk (8 bars)",
      exampleTwinkle: "Twinkle, Twinkle · folk (12 bars)",
      exampleKorobeiniki: "Korobeiniki · Russian folk (16 bars)",
      exampleKalinka: "Kalinka · Larionov (27-bar melody)",
      exampleBirch: "A Birch Stood in the Field · folk (8 bars)",
      instrument: "Instrument", instrumentAcoustic: "Acoustic models",
      instrumentElectronic: "Electronic sounds",
      flute: "Flute", violin: "Violin", morin: "Morin khuur",
      guitar: "Guitar", piano: "Piano", chimes: "Chimes",
      sine: "Sine wave", triangle: "Triangle wave", square: "Square wave",
      sawtooth: "Sawtooth wave", fmep: "FM electric piano · '80s style",
      tuning: "Tuning", equal: "Equal (12-TET)", pythagorean: "Pythagorean",
      just: "Just · C-centred", tuningHint: "The same written notes can sound different in another tuning. The just preset is centred on C; enharmonic spellings share a key in C1.",
      volume: "Volume", score: "ABC score", load: "Open .abc / .txt file",
      scoreHint: "C D E G = quarter notes when L:1/4. C2 lasts twice as long; z is a rest. Uppercase C is middle C; lowercase c is one octave higher.",
      limitsHint: "Up to 32 bars, 256 notes/rests and 90 seconds. A short first bar is a pickup; C2-C joins equal pitches into one held note, including across a barline.",
      source: "Score source", suggested: "Suggested instrument",
      play: "▶ Play", pause: "Ⅱ Pause", resume: "▶ Resume", stop: "■ Stop",
      staff: "Score and playhead", staffHint: "The highlighted note follows the modeled sound. A rest is shown as a small block; the note names remain visible below the staff.",
      ready: "Ready. Edit the melody or press Play.", starting: "Starting the instrument…",
      playing: "Playing the score.", paused: "Paused. Press Resume to continue.",
      stopped: "Stopped. Play starts from the beginning.", done: "The melody finished.",
      loadError: "Choose a small text score (.abc or .txt, up to 8 KB).",
      noAudio: "Sound could not start. Check the browser's audio settings.",
      parseError: "Score error", rangeError: "Note outside the selected instrument's range",
      bar: "Bar", rest: "Rest", notes: "notes", bars: "bars", seconds: "sec",
      empty: "No valid score yet", now: "Now", model: "Modeled instruments · one part · ABC subset",
      footer: "C1 plays one melody at a time. More instrument parts, chords and percussion rhythms will come in later passes; graphical note editing is optional."
    },
    mn: {
      mode: "Ая зохиох", phase: "07 · Ая зохиох", title: "Аялгуу зохиох",
      intro: "ABC тэмдэглэгээгээр богино ая бичиж, нэг хөгжмөөр тоглуулаарай. «Тоглуулах»-ыг дарахаас өмнө дуу гарахгүй.",
      example: "Жишээ ая", exampleFirst: "Энгийн аялгуу", exampleRests: "Нот ба завсарлага",
      exampleWaltz: "Соль мажор вальс", exampleMinor: "Минор аялгуу",
      exampleStudies: "Нот бичих дасгал", exampleMelodies: "Аялгуу ба сонгодог бүтээлийн хэсгүүд",
      exampleOde: "Бетховен · Баяр баясгалангийн магтуу (16 такт)",
      exampleMinuetG: "Петцольд · Соль мажор менуэт (32 такт)",
      exampleLightly: "Lightly Row · ардын дуу (16 такт)",
      exampleMozart40: "Моцарт · 40-р симфони (20 тактын сэдэв)",
      exampleFrere: "Фрэр Жак · ардын дуу (8 такт)",
      exampleTwinkle: "Гялалзах одод · ардын дуу (12 такт)",
      exampleKorobeiniki: "Коробейники · орос ардын дуу (16 такт)",
      exampleKalinka: "Калинка · Ларионов (27 такт)",
      exampleBirch: "Во поле берёза стояла · ардын дуу (8 такт)",
      instrument: "Хөгжмийн зэмсэг", instrumentAcoustic: "Акустик загварууд",
      instrumentElectronic: "Электрон авиа",
      flute: "Лимбэ", violin: "Хийл", morin: "Морин хуур",
      guitar: "Гитар", piano: "Төгөлдөр хуур", chimes: "Хоолойт хонх",
      sine: "Синус долгион", triangle: "Гурвалжин долгион",
      square: "Дөрвөлжин долгион", sawtooth: "Хөрөө долгион",
      fmep: "FM цахилгаан төгөлдөр хуур · 80-аад",
      tuning: "Хөг", equal: "Тэнцүү (12-TET)", pythagorean: "Пифагорын",
      just: "Цэвэр · До төвтэй", tuningHint: "Ижил нотыг өөр хөгөөр тоглуулахад өндөр нь бага зэрэг өөрчлөгдөнө. Цэвэр хувилбар нь До төвтэй; C1-д диез ба бемол ижил товчлуурт хамаарна.",
      volume: "Дууны хэмжээ", score: "ABC нотын бичиг", load: ".abc / .txt файл нээх",
      scoreHint: "L:1/4 үед C D E G нь дөрөвт нотууд; C2 нь хоёр дахин урт, z нь завсарлага. Том C нь До4, жижиг c нь До5.",
      limitsHint: "32 такт, 256 нот/завсарлага, 90 секунд хүртэл. Эхний такт дутуу байж болно; C2-C нь ижил өндөртэй нотуудыг залгуулна. Тактын зураасыг давуулан залгуулж болно.",
      source: "Нотын эх сурвалж", suggested: "Санал болгох зэмсэг",
      play: "▶ Тоглуулах", pause: "Ⅱ Түр зогсоох", resume: "▶ Үргэлжлүүлэх", stop: "■ Зогсоох",
      staff: "Нотын мөр ба тоглуулах тэмдэг", staffHint: "Тоглож буй нот тодорно. Завсарлагыг жижиг дөрвөлжнөөр, нотын нэрийг доор нь харуулна.",
      ready: "Бэлэн. Аяыг өөрчлөх эсвэл тоглуулаарай.", starting: "Зэмсгийг бэлдэж байна…",
      playing: "Аялгуу тоглож байна.", paused: "Түр зогслоо. Үргэлжлүүлж болно.",
      stopped: "Зогслоо. Дахин тоглуулахад эхнээсээ эхэлнэ.", done: "Аялгуу дууслаа.",
      loadError: "8 КБ-аас бага хэмжээтэй .abc эсвэл .txt файл сонгоно уу.",
      noAudio: "Дуу эхэлсэнгүй. Хөтчийн аудио тохиргоог шалгана уу.",
      parseError: "Нотын бичгийн алдаа", rangeError: "Нотын өндөр сонгосон зэмсгийн хүрээнээс хэтэрлээ",
      bar: "Такт", rest: "Завсарлага", notes: "нот", bars: "такт", seconds: "сек",
      empty: "Зөв аялгуу хараахан байхгүй", now: "Одоо", model: "Загварчилсан зэмсгүүд · нэг хоолой · ABC-ийн үндсэн тэмдэглэгээ",
      footer: "C1-д нэг аялгуу тоглоно. Дараа нь олон хөгжмийн хоолой, аккорд, цохивор хэмнэл нэмж болно; дүрсээр нот засах хэсгийг хойшлуулж болно."
    }
  });

  function localError(error, lang) {
    const label = UI[lang].parseError;
    const prefix = error.line ? (lang === "mn" ? "Мөр " : "Line ") + error.line + ": " : "";
    if (lang === "en") return label + ": " + prefix + error.message;
    const msg = error.message;
    let translated;
    if (/^Unsupported symbol/.test(msg)) translated = "Дэмжигдээгүй тэмдэг байна: " + msg.match(/'[^']+'/)?.[0];
    else if (/^Bar \d+ has/.test(msg)) translated = "Такт дахь нотын урт хэмжээтэйгээ таарахгүй байна (" + msg + ")";
    else if (/^Empty bar/.test(msg)) translated = "Хоосон такт байна";
    else if (/^Include M:/.test(msg)) translated = "M: (хэмжээ), L: (нотны урт), Q: (хурд) гэсэн мөрүүдийг бичээрэй";
    else if (/^A key is required|^Add K:/.test(msg)) translated = "Нотын өмнө K:C зэрэг хөгийн мөр бичээрэй";
    else if (/^Q:/.test(msg)) translated = "Q:1/4=96 гэх мэт хурдаа тэмдэглээрэй";
    else if (/^L:/.test(msg)) translated = "L:1/4 эсвэл L:1/8 гэх мэт нотын уртыг бичээрэй";
    else if (/^M:/.test(msg)) translated = "M:4/4 эсвэл M:3/4 гэх мэт хэмжээг бичээрэй";
    else if (/^K:/.test(msg)) translated = "K:C, K:G, K:Am зэрэг одоогоор дэмжигдсэн хөг сонгоно уу";
    else if (/^The score must contain/.test(msg)) translated = "Ая 1–256 нот/завсарлагаас бүрдэж, 90 секундээс хэтрэхгүй байх ёстой";
    else if (/32 bars|Maximum 32/.test(msg)) translated = "Ая 32 тактаас хэтрэхгүй байх ёстой";
    else if (/Maximum 256 notes/.test(msg)) translated = "Хамгийн ихдээ 256 нот/завсарлага байж болно";
    else if (/Maximum 256 quarter/.test(msg)) translated = "Ая 256 дөрөвт цохилтоос хэтрэхгүй байх ёстой";
    else if (/tie|Tie|Ties/.test(msg)) translated = "Холбоосоор зөвхөн ижил өндөртэй залгаа нотуудыг холбоно. Завсарлага эсвэл төгсгөлийн хоосон холбоос байж болохгүй";
    else translated = msg;
    return label + ": " + prefix + translated;
  }

  class Controller {
    constructor({ document, contextOwner, transientModel, sustainModel, temperamentModel }) {
      this.document = document;
      this.$ = id => document.getElementById(id);
      this.language = "mn";
      this.score = null;
      this.lastError = null;
      this.lastStatus = "ready";
      this.noteGroups = [];
      this.lastHighlighted = -2;
      this.parseTimer = null;
      this.player = new playerModel.Player({ contextOwner, transientModel, sustainModel,
        temperamentModel, onUpdate: info => this.onProgress(info) });
      this.$("composeText").value = EXAMPLES.first;
      this.$("composeInstrument").value = "flute";
      this.$("composeTuning").value = "equal";
      this.$("composeVolume").value = "38";
      this.$("composeExample").value = "first";
      this.$("composeText").addEventListener("input", () => {
        this.player.stop();
        if (this.parseTimer !== null) clearTimeout(this.parseTimer);
        this.parseTimer = setTimeout(() => { this.parseTimer = null; this.parseScore(); }, 180);
      });
      this.$("composeExample").addEventListener("change", () => {
        const id = this.$("composeExample").value;
        this.$("composeText").value = EXAMPLES[id] || EXAMPLES.first;
        if (EXAMPLE_INFO[id]) this.$("composeInstrument").value = EXAMPLE_INFO[id].instrument;
        this.parseScore();
      });
      this.$("composeInstrument").addEventListener("change", () => this.parseScore());
      this.$("composeTuning").addEventListener("change", () => this.parseScore());
      this.$("composeVolume").addEventListener("input", () => this.parseScore());
      this.$("composePlayPause").addEventListener("click", () => this.togglePlay());
      this.$("composeStop").addEventListener("click", () => this.stop());
      this.$("composeLoad").addEventListener("change", event => this.loadFile(event.target.files?.[0]));
      this.parseScore();
      this.renderLanguage("mn");
    }

    t(key) { return UI[this.language][key]; }
    renderLanguage(language) {
      if (!UI[language]) return;
      this.language = language;
      if (typeof this.document.querySelectorAll === "function") {
        this.document.querySelectorAll("[data-compose-i18n]").forEach(node => {
          node.textContent = this.t(node.getAttribute("data-compose-i18n"));
        });
        this.document.querySelectorAll("[data-compose-group-i18n]").forEach(node => {
          // Setting optgroup.textContent would delete all of its options.
          node.label = this.t(node.getAttribute("data-compose-group-i18n"));
        });
      }
      this.$("composePlayPause").textContent = this.t(this.player.status === "playing" ? "pause" :
        this.player.status === "paused" ? "resume" : "play");
      this.$("composeStop").textContent = this.t("stop");
      this.$("composeVolumeValue").textContent = this.$("composeVolume").value + "%";
      this.$("composeStatus").textContent = this.lastError ?
        this.errorText(this.lastError) : this.t(this.lastStatus) || this.t("ready");
      this.$("composeStatus").classList.toggle("error", Boolean(this.lastError));
      this.$("composeScoreSvg").setAttribute("aria-label", this.t("staff"));
      if (!this.score) this.$("composeNow").textContent = this.t("empty");
      this.renderMeta();
      this.lastHighlighted = -2;
      this.highlight(this.player.currentBeat);
    }

    errorText(error) {
      return error instanceof abc.ABCError || /^The score must contain/.test(error.message) ? localError(error, this.language) :
        this.t("rangeError") + ": " + error.message;
    }

    parseScore() {
      if (this.parseTimer !== null) { clearTimeout(this.parseTimer); this.parseTimer = null; }
      this.player.stop();
      try {
        const score = abc.parse(this.$("composeText").value);
        this.player.configure({ score, instrument: this.$("composeInstrument").value,
          tuning: this.$("composeTuning").value, volume: Number(this.$("composeVolume").value) });
        this.score = score;
        this.lastError = null;
        this.lastStatus = "ready";
        this.$("composeStatus").textContent = this.t("ready");
        this.$("composeStatus").classList.toggle("error", false);
        this.$("composePlayPause").disabled = false;
        this.renderStaff();
      } catch (error) {
        this.score = null;
        this.lastError = error;
        this.lastStatus = "ready";
        this.$("composeStatus").textContent = this.errorText(error);
        this.$("composeStatus").classList.toggle("error", true);
        this.$("composePlayPause").disabled = true;
        this.noteGroups = [];
        if (typeof this.$("composeScoreSvg").replaceChildren === "function") {
          this.$("composeScoreSvg").replaceChildren();
        }
        this.$("composeNow").textContent = this.t("empty");
      }
      this.renderMeta();
      this.$("composeVolumeValue").textContent = this.$("composeVolume").value + "%";
      this.$("composePlayPause").textContent = this.t("play");
    }

    renderMeta() {
      this.$("composeMeta").textContent = this.score ?
        this.score.title + " · " + this.score.bars.length + " " + this.t("bars") +
        " · " + this.score.key.name + " · " + this.score.meter.numerator + "/" + this.score.meter.denominator +
        " · ♩=" + this.score.tempoQuarter + " · " + (this.score.totalBeats * scoreModel.secondsPerBeat(this.score)).toFixed(1) +
        " " + this.t("seconds") : this.t("empty");
      const id = Object.keys(EXAMPLES).find(key => EXAMPLES[key] === this.$("composeText").value.trim());
      const info = EXAMPLE_INFO[id];
      this.$("composePresetInfo").hidden = !info;
      if (info) {
        this.$("composePresetDescription").textContent = info[this.language] + " " +
          this.t("suggested") + ": " + this.t(info.instrument) + ". ";
        this.$("composeSource").href = info.source;
        this.$("composeSource").textContent = this.t("source");
      }
    }

    async togglePlay() {
      this.parsePending();
      if (!this.score) return;
      if (this.player.status === "playing") { this.player.pause(); return; }
      try { await this.player.play(); }
      catch (error) {
        this.$("composeStatus").textContent = this.t("noAudio") + " (" + error.message + ")";
        this.$("composeStatus").classList.toggle("error", true);
      }
    }

    parsePending() { if (this.parseTimer !== null) this.parseScore(); }
    stop() { this.player.stop(); }
    hasSession() { return this.player.status !== "stopped"; }
    isPlaying() { return this.player.status === "playing" || this.player.status === "starting"; }

    async loadFile(file) {
      if (!file) return;
      this.player.stop();
      if (!/\.(abc|txt)$/i.test(file.name) || file.size > 8192 || file.size === 0) {
        this.$("composeStatus").textContent = this.t("loadError");
        this.$("composeStatus").classList.toggle("error", true);
        return;
      }
      try {
        const content = await file.text();
        if (content.length > 8192) throw new RangeError("Oversized score");
        this.$("composeText").value = content;
        this.parseScore();
      } catch (_) {
        this.$("composeStatus").textContent = this.t("loadError");
        this.$("composeStatus").classList.toggle("error", true);
      } finally { this.$("composeLoad").value = ""; }
    }

    onProgress({ status, beat }) {
      this.lastStatus = status === "starting" ? "starting" : status === "playing" ? "playing" :
        status === "paused" ? "paused" : "stopped";
      if (this.$("composeStatus")) {
        this.$("composeStatus").textContent = this.t(this.lastStatus);
        this.$("composeStatus").classList.toggle("error", false);
        this.$("composePlayPause").textContent = this.t(status === "playing" ? "pause" :
          status === "paused" ? "resume" : "play");
      }
      this.highlight(beat);
    }

    renderStaff() {
      const svg = this.$("composeScoreSvg");
      if (!this.score || typeof svg.appendChild !== "function" ||
          typeof this.document.createElementNS !== "function") return;
      svg.replaceChildren();
      this.noteGroups = [];
      this.lastHighlighted = -2;
      const ns = "http://www.w3.org/2000/svg", rowHeight = 190;
      const bars = this.score.bars;
      const rows = Math.ceil(bars.length / 4);
      svg.setAttribute("viewBox", "0 0 864 " + rows * rowHeight);
      svg.setAttribute("width", "864");
      svg.setAttribute("height", String(rows * rowHeight));
      const make = (tag, attrs, parent = svg, label = null) => {
        const node = this.document.createElementNS(ns, tag);
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
        if (label !== null) node.textContent = label;
        parent.appendChild(node);
        return node;
      };
      bars.forEach((bar, index) => {
        const row = Math.floor(index / 4), col = index % 4;
        const left = 16 + col * 210, y = row * rowHeight;
        make("text", { x: left + 6, y: y + 23, class: "compose-bar-number" }, svg,
          bar.pickup ? "0" : String(bar.number - (bars[0].pickup ? 1 : 0)));
        for (let line = 0; line < 5; line++) {
          make("line", { x1: left, x2: left + 210, y1: y + 43 + line * 10,
            y2: y + 43 + line * 10, class: "compose-staff-line" });
        }
        make("line", { x1: left + 210, x2: left + 210, y1: y + 43, y2: y + 83,
          class: "compose-bar-line" });
      });
      this.score.parts[0].events.forEach((event, index) => {
        const bar = bars[event.bar - 1];
        const row = Math.floor((event.bar - 1) / 4), col = (event.bar - 1) % 4;
        const lineY = row * rowHeight;
        const x = 22 + col * 210 + (event.startBeat - bar.startBeat) /
          Math.max(bar.durationBeats, this.score.meter.quarterBeats) * 181;
        const group = make("g", { class: "compose-note", "data-note-index": index });
        let y = lineY + 65;
        if (event.type === "note") {
          const letters = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
          const diatonic = (event.pitch.octave - 4) * 7 + letters[event.pitch.letter];
          y = lineY + 83 - (diatonic - 2) * 5;
          for (let ledger = lineY + 93; ledger <= y; ledger += 10) {
            make("line", { x1: x - 7, x2: x + 16, y1: ledger, y2: ledger,
              class: "compose-ledger-line" }, group);
          }
          for (let ledger = lineY + 33; ledger >= y; ledger -= 10) {
            make("line", { x1: x - 7, x2: x + 16, y1: ledger, y2: ledger,
              class: "compose-ledger-line" }, group);
          }
          make("ellipse", { cx: x + 4, cy: y, rx: 6.2, ry: 4.6,
            transform: `rotate(-22 ${x + 4} ${y})` }, group);
          make("line", { x1: x + 10, x2: x + 10, y1: y, y2: y - 27,
            class: "compose-stem" }, group);
          if (event.pitch.accidental !== 0) {
            const accident = event.pitch.accidental < 0 ? "♭" : "♯";
            make("text", { x: x - 17, y: y + 4, class: "compose-accidental" }, group, accident);
          }
        } else {
          make("rect", { x, y: y - 5, width: 12, height: 6, rx: 1.2,
            class: "compose-rest" }, group);
        }
        make("text", { x: x + 4, y: lineY + 166, class: "compose-note-name",
          "text-anchor": "middle" }, group,
        event.type === "rest" ? "z" : scoreModel.pitchName(event.pitch));
        this.noteGroups.push({ node: group, event, x, y, row });
      });
      const tieArc = (from, to, y, parent) => make("path", {
        d: `M ${from} ${y} Q ${(from + to) / 2} ${y + 14} ${to} ${y}`,
        class: "compose-tie"
      }, parent);
      this.noteGroups.forEach((group, index) => {
        if (!group.event.tieToNext) return;
        const next = this.noteGroups[index + 1];
        if (!next) return;
        if (group.row === next.row) tieArc(group.x + 9, next.x + 1, group.y + 9, group.node);
        else {
          tieArc(group.x + 9, 853, group.y + 9, group.node);
          tieArc(16, next.x + 1, next.y + 9, next.node);
        }
      });
      this.highlight(0);
    }

    highlight(beat) {
      if (!this.score) return;
      const events = this.score.parts[0].events;
      let index = events.findIndex(event => event.startBeat <= beat + 1e-6 &&
        beat < event.startBeat + event.durationBeats - 1e-6);
      if (beat >= this.score.totalBeats - 1e-6) index = -1;
      if (index === this.lastHighlighted) return;
      this.lastHighlighted = index;
      this.noteGroups.forEach(({ node }, i) => node.classList.toggle("active", i === index));
      const event = events[index];
      this.$("composeNow").textContent = event ?
        this.t("bar") + " " + (event.bar - (this.score.bars[0].pickup ? 1 : 0)) + " · " +
        (event.type === "rest" ? this.t("rest") : scoreModel.pitchName(event.pitch)) +
        " · " + (beat * scoreModel.secondsPerBeat(this.score)).toFixed(1) + " " +
        this.t("seconds") : this.t("ready");
      if (event && this.noteGroups[index]) {
        const view = this.$("composeScoreScroll");
        if (typeof view.scrollTo === "function" && typeof view.clientWidth === "number") {
          view.scrollTo({ left: Math.max(0, this.noteGroups[index].x - view.clientWidth * .5),
            top: Math.max(0, this.noteGroups[index].row * 190 - (view.clientHeight || 380) * .5 + 95),
            behavior: "auto" });
        }
      }
    }
  }

  return Object.freeze({ EXAMPLES, EXAMPLE_INFO, UI, Controller, localError });
});
