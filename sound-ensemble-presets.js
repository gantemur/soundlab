/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * Original studies and rights-cleared melodies with newly written educational accompaniment.
 * These are playable arrangements, not transcriptions of historical orchestrations.
 */
(function (root, factory) {
  const compose = typeof module === "object" && module.exports ?
    require("./sound-compose.js") : root.SoundLabCompose;
  const drumPatterns = typeof module === "object" && module.exports ?
    require("./sound-drum-patterns.js") : root.SoundLabDrumPatterns;
  const api = factory(compose, drumPatterns);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabEnsemblePresets = api;
})(typeof window !== "undefined" ? window : null, function (compose, drumPatterns) {
  "use strict";

  const CATALOG = Object.freeze([
    { id: "starter", en: "First exercise · 4 bars", mn: "Эхний дасгал · 4 такт" },
    { id: "guitarStrum", category: "studies", en: "Guitar · Pick and strum (8 bars)",
      mn: "Гитар · Цохих/татах (8 такт)",
      description: Object.freeze({
        en: "An original C–Am–F–G study: pick the opening notes, then alternate down/up chord strokes with single notes between them.",
        mn: "Шинээр зохиосон C–Am–F–G дасгал: эхний нотуудыг нэг нэгээр нь татаж, дараа нь аккордыг доош, дээш ээлжлүүлэн цохино. Дунд нь дан нот орно."
      }) },
    { id: "minuet", en: "Petzold · Minuet in G (32 bars)", mn: "Петцольд · Соль мажор менуэт (32 такт)" },
    { id: "korobeiniki", en: "Коробейники · folk (16 bars)", mn: "Коробейники · ардын дуу (16 такт)" },
    { id: "kalinka", en: "Калинка · Larionov (27 bars)", mn: "Калинка · Ларионов (27 такт)" },
    { id: "bella", en: "Bella Ciao · folk · with drums", mn: "Bella Ciao · бөмбөртэй найруулга" },
    { id: "chopin7", en: "Chopin · Prelude Op. 28 No. 7 (complete, 16 bars)",
      mn: "Шопен · Прелюд Op. 28 №7 (бүтэн, 16 такт)" },
    { id: "chopin20", en: "Chopin · Prelude Op. 28 No. 20 (complete, 13 bars)",
      mn: "Шопен · Прелюд Op. 28 №20 (бүтэн, 13 такт)" }
  ]);

  const STRUM_STUDY = Object.freeze({
    guitar: Object.freeze({ mode: "alternate", spacingMs: 20 }),
    // Written open-position voicings; the part moves from picking to strumming
    // without changing instrument or inventing pitches beyond the ABC chord.
    notes: Object.freeze([
      "C, E, G, C E C G, E,", "A,, E, A, C E C A, E,",
      "F,2 [F,A,CF]2 [F,A,CF]2 [F,A,CF]2",
      "G,,2 [G,,B,,D,G,B,G]2 [G,,B,,D,G,B,G]2 [G,,B,,D,G,B,G]2",
      "[C,E,G,CE]2 [C,E,G,CE]2 C E [C,E,G,CE]2",
      "[A,,E,A,CE]2 [A,,E,A,CE]2 C E [A,,E,A,CE]2",
      "F, A, C F [F,A,CF]2 [F,A,CF]2",
      "[G,,B,,D,G,B,G]2 B, D [C,E,G,CE]4"
    ]),
    bass: Object.freeze([
      "C,4 G,4", "A,4 E,4", "F,4 C4", "G,4 D4",
      "C,4 G,4", "A,4 E,4", "F,4 C4", "G,4 C,4"
    ])
  });

  const CHOPIN_SOURCE = Object.freeze({
    chopin7: "https://github.com/MutopiaProject/MutopiaProject/blob/master/ftp/ChopinFF/O28/Chop-28-7/Chop-28-7-lys/chopin_prelude_op28_no7.ly",
    chopin20: "https://github.com/MutopiaProject/MutopiaProject/blob/master/ftp/ChopinFF/O28/Chop-28-20/Chop-28-20.ly"
  });

  // These are complete-form, two-hand educational reductions. The original
  // scores have independent inner voices, pedal, ornaments and expressive tempo;
  // only simultaneous single-duration chords fit our current ABC subset.
  const CHOPIN = Object.freeze({
    chopin7: Object.freeze({
      tempo: 96, meter: "3/4", key: "A", unit: "1/16",
      rh: [
        "E4", "c3 d [DGB]4 [DGB]4", "[DGB]8 [df]4",
        "[^B^d]3 [ce] [ca]4 [ca]4", "[ca]8 [Ec]4",
        "[Ec]4 [^Ac]3 [Bd] [df]4", "[df]8 [Dg]4",
        "[Dg]3 [ca] [cc']4 [cc']4", "[cc']8 [Eg]4",
        "c3 d [EGB]4 [EGB]4", "[EGB]8 [df]4",
        "[^B^d]3 [ce] [ac']4 [ac']4", "[ac']8 [^ac']4",
        "[^ac]3 [bd] [bf]4 [af]4", "[gf]8 [Dg]4",
        "[Db]3 [ca] [ca]4 [ca]4", "[ca]8 z4"
      ],
      lh: [
        "z4", "E,,4 [E,E]4 [E,E]4", "[E,E]8 z4",
        "A,,4 [A,E]4 [A,E]4", "[A,E]8 z4",
        "E,,4 [E,B,]4 [E,B,]4", "[E,B,]8 z4",
        "A,,,4 [E,AE]4 [E,AE]4", "[E,AE]8 z4",
        "E,,4 [E,E]4 [E,E]4", "[E,E]8 z4",
        "A,,4 [A,Ea]4 [A,Ea]4", "[F,^ce]8 z4",
        "B,,,4 [F,d]4 [F,B,d]4", "[E,B,d]8 z4",
        "A,,,4 [E,Ae]4 [Ae]4", "[Ae]8 z4"
      ]
    }),
    chopin20: Object.freeze({
      tempo: 42, meter: "4/4", key: "Cm", unit: "1/16",
      rh: [
        "[G,C_EG]4 [_A,C_E_A]4 [_eg]3 [df] [_EGc_e]4",
        "[_E_Ac_e]4 [F_Adf]4 [c_e]3 [_bd] [_Ec_e]4",
        "[DF_Bd]4 [EG_Bce]4 g3 f [Gc_e]4",
        "[^Fcd]4 [GBdg]4 =b3 a [bdg]4",
        "[_eg_e']4 [_e_a_e']4 [dd']4 [dgd']4",
        "[cgc']4 [cd^fd']4 [dg=b]3 [ca] [bdg]4",
        "[cgc']4 [_ac_a']4 [gd']4 [gc_e]4",
        "[_E_Ac_e]4 [F_Adf]4 [_eg]3 d [_EGc]4",
        "[_eg_e']4 [_e_a_e']4 [dd']4 [dgd']4",
        "[cgc']4 [cd^fd']4 [dg=b]3 [ca] [bdg]4",
        "[cgc']4 [_ac_a']4 [gd']4 [gc_e]4",
        "[_E_Ac_e]4 [F_Adf]4 [_eg]3 d [_EGc]4",
        "[c_egc']16"
      ],
      lh: [
        "[C,,C,]4 [F,,,F,,]4 [G,,,G,,]4 [C,,G,,C,]4",
        "[_A,,_A,]4 [_D,,_D,]4 [_E,,_E,]4 [_A,,_A,]4",
        "[G,,G,]4 [C,,,C,,]4 [F,,F,]4 [C,,C,]4",
        "[D,,A,D]4 [G,,,G,,]4 [D,,D,]4 [G,,,G,,]4",
        "[C,,C,]4 [C,C]4 [B,,B,]4 [_B,,_B,]4",
        "[A,,A,]4 [_A,,_A,]4 [G,,G,]4 [F,,F,]4",
        "[_E,,_E,]4 [F,,F,]4 [B,,,B,,]4 [C,,C,]4",
        "[_A,,_A,]4 [_D,,_D,]4 [G,,G,]4 [C,,,C,,]4",
        "[C,,C,]4 [C,C]4 [B,,B,]4 [_B,,_B,]4",
        "[A,,A,]4 [_A,,_A,]4 [G,,G,]4 [F,,F,]4",
        "[_E,,_E,]4 [F,,F,]4 [B,,,B,,]4 [C,,C,]4",
        "[_A,,_A,]4 [_D,,_D,]4 [G,,G,]4 [C,,,C,,]4",
        "[C,C]16"
      ]
    })
  });

  const BELLA_BARS = Object.freeze([
    "z2", "A, E A c E c A E", "A, E A c E c A E",
    "G, D G B D B G D", "A, E A c E c A E",
    "D, A, D F A F D A,", "E, B, E ^G B ^G E B,",
    "E, B, E ^G B ^G E B,", "A, E A c E c A E",
    "A, E A c E c A E", "A, E A c E c A E",
    "G, D G B D B G D", "A, E A c E c A E",
    "D, A, D F A F D A,", "E, B, E ^G B ^G E B,",
    "E, B, E ^G B ^G E B,", "A,2 E2 A2"
  ]);
  const BELLA_BASS = Object.freeze([
    "z2", "A,4 E,4", "A,4 E,4", "G,4 D,4", "A,4 E,4",
    "D,4 A,4", "E,4 B,4", "E,4 B,4", "A,4 E,4",
    "A,4 E,4", "A,4 E,4", "G,4 D,4", "A,4 E,4",
    "D,4 A,4", "E,4 B,4", "E,4 B,4", "A,6"
  ]);
  const BELLA_DRUMS = Object.freeze([
    "z2", "[CE]2 E2 [DE]2 E2", "[CE]2 E2 [DE]2 E2",
    "[CE]2 E2 [DE]2 [DE]2", "[CE]2 E2 [DE]2 E2",
    "[CE]2 E2 [DE]2 E2", "[CE]2 E2 [DE]2 E2",
    "[CE]2 E D [DE]2 [DF]2", "[CE]2 E2 [DE]2 E2",
    "[CE]2 E2 [DE]2 E2", "[CE]2 E2 [DE]2 E2",
    "[CE]2 E2 [DE]2 [DE]2", "[CE]2 E2 [DE]2 E2",
    "[CE]2 E2 [DE]2 E2", "[CE]2 E2 [DE]2 E2",
    "[CE]2 E D [DE]2 [DF]2", "[CE]2 E2 [DE]2"
  ]);

  const CHORDS = Object.freeze({
    minuet: Object.freeze({
      G: ["G B d", "G,2 D,"], D: ["A d f", "D,2 A,"], C: ["G c e", "C,2 G,"],
      Em: ["G B e", "E,2 B,"], Am: ["A c e", "A,2 E,"],
      A7: ["A ^c e", "A,2 E,"], D7: ["A c f", "D,2 A,"]
    }),
    korobeiniki: Object.freeze({
      Dm: ["F A d A", "D,2 A,2"], C: ["E G c G", "C,2 G,2"],
      Bb: ["F B d B", "B,2 F,2"], A: ["E A ^c A", "A,2 E,2"],
      Gm: ["D G B G", "G,2 D,2"]
    }),
    kalinka: Object.freeze({
      Em: ["G B e B", "E,2 B,2"], D: ["F A d A", "D,2 A,2"],
      G: ["G B d B", "G,2 D,2"], Am: ["A c e c", "A,2 E,2"]
    })
  });

  const PIECES = Object.freeze({
    minuet: Object.freeze({
      melody: "minuetG", meter: "3/4", unit: "1/4", tempo: 112, key: "G",
      lead: "piano", leadVolume: 59, middle: "violin", middleVolume: 25,
      bass: "triangle", bassVolume: 30,
      progression: Object.freeze([
        "G", "G", "C", "G", "Am", "G", "D", "D",
        "G", "G", "C", "G", "Am", "D", "D7", "G",
        "G", "D", "Em", "A7", "D", "G", "A7", "D",
        "G", "C", "G", "D", "G", "C", "D7", "G"
      ])
    }),
    korobeiniki: Object.freeze({
      melody: "korobeiniki", meter: "2/4", unit: "1/8", tempo: 96, key: "Dm",
      lead: "fmep", leadVolume: 55, middle: "guitar", middleVolume: 29,
      bass: "triangle", bassVolume: 27,
      progression: Object.freeze([
        "Dm", "C", "Bb", "A", "Dm", "C", "Bb", "Dm",
        "Gm", "Gm", "Dm", "A", "Dm", "A", "Dm", "Dm"
      ])
    }),
    kalinka: Object.freeze({
      melody: "kalinka", meter: "2/4", unit: "1/8", tempo: 112, key: "Em",
      lead: "violin", leadVolume: 47, middle: "fmep", middleVolume: 26,
      bass: "triangle", bassVolume: 28, pickup: "z2",
      progression: Object.freeze([
        "D", "D", "D", "Em", "D", "D", "D", "Em",
        "G", "D", "G", "G", "G", "G", "Em", "D", "D", "D",
        "G", "G", "G", "G", "Em", "Em", "D", "Em"
      ])
    })
  });

  function makeABC(piece, part, patternIndex) {
    const chords = CHORDS[part];
    const bars = piece.progression.map(chord => {
      if (!chords[chord]) throw new Error("Missing accompaniment chord " + chord);
      return chords[chord][patternIndex];
    });
    const title = (patternIndex === 0 ? "Arpeggio" : "Bass") + " - original accompaniment";
    const header = "X:" + (patternIndex === 0 ? 2 : 3) + "\nT:" + title +
      "\nM:" + piece.meter + "\nL:" + piece.unit + "\nQ:1/4=" + piece.tempo +
      "\nK:" + piece.key + "\n";
    const body = (piece.pickup ? piece.pickup + " |\n" : "") +
      bars.reduce((lines, bar, i) => {
        if (i % 4 === 0) lines.push([]);
        lines[lines.length - 1].push(bar);
        return lines;
      }, []).map(line => line.join(" | ")).join(" |\n") + " |]";
    return header + body + "\n% Original educational accompaniment for Sound Lab; edit freely.";
  }

  function barsABC(number, title, meter, unit, tempo, key, bars, comment) {
    return "X:" + number + "\nT:" + title + "\nM:" + meter + "\nL:" + unit +
      "\nQ:1/4=" + tempo + "\nK:" + key + "\n" +
      bars.reduce((lines, bar, index) => {
        if (index % 4 === 0) lines.push([]);
        lines.at(-1).push(bar);
        return lines;
      }, []).map(line => line.join(" | ")).join(" |\n") + " |]\n% " + comment;
  }

  function createGuitarStrum(language) {
    const names = language === "en" ? ["Guitar · pick and strum", "Quiet bass", "Quiet drums"] :
      ["Гитар · Цохих/татах", "Зөөлөн басс", "Зөөлөн бөмбөр"];
    const note = "Original educational study written for Sound Lab; edit freely.";
    const guitarABC = barsABC(1, "Picking and strumming - original guitar study", "4/4", "1/8",
      100, "C", STRUM_STUDY.notes, note);
    const bassABC = barsABC(2, "Picking and strumming - original bass", "4/4", "1/8",
      100, "C", STRUM_STUDY.bass, note);
    const drumABC = barsABC(3, "Picking and strumming - original quiet groove", "4/4", "1/8",
      100, "C clef=perc", Array(8).fill("[CE]2 E2 [DE]2 E2"), note);
    const patterns = drumPatterns.fromABC(drumABC);
    return [
      { id: 1, name: names[0], instrument: "guitar", volume: 62, mute: false, solo: false,
        abc: guitarABC, guitar: { ...STRUM_STUDY.guitar } },
      { id: 2, name: names[1], instrument: "triangle", volume: 18, mute: false, solo: false,
        abc: bassABC },
      { id: 3, name: names[2], instrument: "drums", volume: 18, mute: false, solo: false,
        abc: drumPatterns.toABC(patterns), patterns, patternBar: 1,
        patternId: drumPatterns.atBar(patterns, 1).pattern.id,
        textMode: "pattern", patternDraft: null }
    ];
  }

  function createBella(language) {
    const names = language === "en" ? ["Melody", "Guitar accompaniment", "Bass", "Drums"] :
      ["Аялгуу", "Гитар дагалдах", "Басс", "Бөмбөр"];
    const guitar = barsABC(2, "Bella Ciao - original guitar arpeggios", "4/4", "1/8", 104, "Am",
      BELLA_BARS, "New educational guitar part; not copied from a published arrangement.");
    const bass = barsABC(3, "Bella Ciao - original bass", "4/4", "1/8", 104, "Am",
      BELLA_BASS, "New educational bass part; not copied from a published arrangement.");
    const drumABC = barsABC(4, "Bella Ciao - original drum groove", "4/4", "1/8", 104,
      "C clef=perc", BELLA_DRUMS, "Original quiet percussion part; editable linked patterns.");
    const patternProject = drumPatterns.fromABC(drumABC);
    return [
      { id: 1, name: names[0], instrument: "violin", volume: 50, mute: false,
        solo: false, abc: compose.EXAMPLES.bella },
      { id: 2, name: names[1], instrument: "guitar", volume: 28, mute: false, solo: false,
        abc: guitar },
      { id: 3, name: names[2], instrument: "triangle", volume: 20, mute: false, solo: false,
        abc: bass },
      { id: 4, name: names[3], instrument: "drums", volume: 25, mute: false, solo: false,
        abc: drumPatterns.toABC(patternProject), patterns: patternProject,
        patternBar: 1, patternId: drumPatterns.atBar(patternProject, 1).pattern.id,
        textMode: "pattern", patternDraft: null }
    ];
  }

  function createChopin(id, language) {
    const piece = CHOPIN[id];
    const title = "Chopin Prelude Op. 28 No. " + (id === "chopin7" ? "7" : "20");
    const note = "Complete-form educational two-hand reduction (not a facsimile); independent inner " +
      "voices, dynamics, ornaments, pedalling and rubato simplified. Public-domain source: " +
      CHOPIN_SOURCE[id];
    return [piece.rh, piece.lh].map((bars, index) => ({
      id: index + 1,
      name: language === "en" ? (index ? "Left hand" : "Right hand") :
        (index ? "Зүүн гар" : "Баруун гар"),
      instrument: "piano", volume: index ? 42 : 58, mute: false, solo: false,
      abc: barsABC(index + 1, title + (index ? " - left hand" : " - right hand"),
        piece.meter, piece.unit, piece.tempo, piece.key, bars, note)
    }));
  }

  function create(id, language = "mn") {
    if (id === "guitarStrum") return createGuitarStrum(language);
    if (id === "bella") return createBella(language);
    if (Object.hasOwn(CHOPIN, id)) return createChopin(id, language);
    const piece = PIECES[id];
    if (!piece) throw new RangeError("Unknown ensemble preset " + id);
    const names = language === "en" ? ["Melody", "Accompaniment", "Bass"] :
      ["Аялгуу", "Дагалдах хоолой", "Басс"];
    const track = (number, instrument, volume, score) => ({
      id: number, name: names[number - 1], instrument, volume,
      mute: false, solo: false, abc: score
    });
    return [
      track(1, piece.lead, piece.leadVolume, compose.EXAMPLES[piece.melody]),
      track(2, piece.middle, piece.middleVolume, makeABC(piece, id, 0)),
      track(3, piece.bass, piece.bassVolume, makeABC(piece, id, 1))
    ];
  }

  return Object.freeze({ CATALOG, PIECES, create });
});
