/* SPDX-FileCopyrightText: 2026 Tsogt Gantumur
 * SPDX-License-Identifier: MIT
 * Rights-cleared melodies from Compose C1 with newly written educational accompaniment.
 * These are playable arrangements, not transcriptions of historical orchestrations.
 */
(function (root, factory) {
  const compose = typeof module === "object" && module.exports ?
    require("./sound-compose.js") : root.SoundLabCompose;
  const api = factory(compose);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabEnsemblePresets = api;
})(typeof window !== "undefined" ? window : null, function (compose) {
  "use strict";

  const CATALOG = Object.freeze([
    { id: "starter", en: "First exercise · 4 bars", mn: "Эхний дасгал · 4 такт" },
    { id: "minuet", en: "Petzold · Minuet in G (32 bars)", mn: "Петцольд · Соль мажор менуэт (32 такт)" },
    { id: "korobeiniki", en: "Коробейники · folk (16 bars)", mn: "Коробейники · ардын дуу (16 такт)" },
    { id: "kalinka", en: "Калинка · Larionov (27 bars)", mn: "Калинка · Ларионов (27 такт)" }
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

  function create(id, language = "mn") {
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
