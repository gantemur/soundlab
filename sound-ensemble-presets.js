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
  const drums = typeof module === "object" && module.exports ?
    require("./sound-drum-abc.js") : root.SoundLabDrumABC;
  const classical = typeof module === "object" && module.exports ?
    require("./sound-classical-scores.js") : root.SoundLabClassicalScores;
  const joplin = typeof module === "object" && module.exports ?
    require("./sound-joplin-scores.js") : root.SoundLabJoplinScores;
  const beethoven = typeof module === "object" && module.exports ?
    require("./sound-beethoven-scores.js") : root.SoundLabBeethovenScores;
  const chopin = typeof module === "object" && module.exports ?
    require("./sound-chopin-scores.js") : root.SoundLabChopinScores;
  const bach = typeof module === "object" && module.exports ?
    require("./sound-bach-scores.js") : root.SoundLabBachScores;
  const api = factory(compose, drumPatterns, drums, classical, joplin, beethoven, chopin, bach);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SoundLabEnsemblePresets = api;
})(typeof window !== "undefined" ? window : null, function (compose, drumPatterns, drums, classical, joplin, beethoven, chopin, bach) {
  "use strict";

  const CATALOG = Object.freeze([
    { id: "starter", en: "First exercise · 4 bars", mn: "Эхний дасгал · 4 такт" },
    { id: "guitarStrum", category: "studies", en: "Guitar · Pick and strum (8 bars)",
      mn: "Гитар · Цохих/татах (8 такт)",
      description: Object.freeze({
        en: "An original C–Am–F–G study: pick the opening notes, then alternate down/up chord strokes with single notes between them.",
        mn: "Шинээр зохиосон C–Am–F–G дасгал: эхний нотуудыг нэг нэгээр нь татаж, дараа нь аккордыг доош, дээш ээлжлүүлэн цохино. Дунд нь дан нот орно."
      }) },
    { id: "drumKitSolo", category: "drumSolo", en: "Drum kit · Eight-bar solo",
      mn: "Бөмбөрийн иж бүрдэл · 8 тактын гоцлол" },
    { id: "snareStudy", category: "drumSolo", en: "Snare · Accent and stroke study",
      mn: "Жижиг бөмбөр · Өргөлт, цохилтын дасгал" },
    { id: "snareRudiments", category: "drumSolo", en: "Snare · Flams, rolls and ghost notes",
      mn: "Жижиг бөмбөр · Флам, ролл, сул цохилт" },
    { id: "swingHats", category: "drumSolo", en: "Hi-hat · Swing and choking (8 bars)",
      mn: "Цан · Свинг, дуу дарах дасгал (8 такт)" },
    { id: "hatPedal", category: "drumSolo", en: "Hi-hat · Half-open pedal study (8 bars)",
      mn: "Цан · Хагас нээж, хаах дасгал (8 такт)",
      description: Object.freeze({
        en: "An original kit study contrasting closed, half-open and open hi-hats, including an open-to-half pedal motion on a ringing cymbal.",
        mn: "Хаалттай, хагас болон бүрэн нээлттэй цангийн өнгө, дуугарч буй цанг хагас хаах, бүрэн дарахыг харьцуулах шинэ дасгал."
      }) },
    { id: "stickingRudiments", category: "drumSolo", en: "Snare · Paradiddles and sticking (8 bars)",
      mn: "Жижиг бөмбөр · Парадидл, гарын ээлж (8 такт)" },
    { id: "drumDialogue", category: "drumSolo", en: "Percussion · Call and response",
      mn: "Цохивор · Асуулт, хариулт" },
    { id: "tomCymbalStudy", category: "drumSolo", en: "Toms and cymbals · Eight-bar fills",
      mn: "Том бөмбөр ба цан · 8 тактын шилжилт" },
    { id: "minuet", en: "Petzold · Minuet in G (32 bars)", mn: "Петцольд · Соль мажор менуэт (32 такт)" },
    { id: "turkishMarch", category: "classics", en: "Mozart · Turkish March (complete movement)",
      mn: "Моцарт · Турк марш (III анги бүтнээр)",
      description: Object.freeze({
        en: "The complete finale of Sonata K.331, including repeats and second ending. One piano track holds four independently timed, editable ABC V: voice blocks, leaving room for added instruments. All CC0-edition note pitches are retained; rapid grace groups and two trills are simplified. Phrase dynamics are an interpretive layer.",
        mn: "K.331 сонатын төгсгөлийн ангийг давталт, хоёрдугаар төгсгөлтэй нь тоглоно. Нэг төгөлдөр хуурын мөрөнд тусдаа хэмнэлтэй, засварлаж болох ABC V: дөрвөн хоолой бий; өөр хөгжим нэмж болно. CC0 эхийн нотыг хадгалж, угтвар чимэглэл, хоёр триллийг хялбаршуулсан. Хэсгийн динамик нь тайлбарын шинжтэй."
      }) },
    { id: "entertainer", category: "classics", en: "Joplin · The Entertainer (complete rag)",
      mn: "Жоплин · The Entertainer (бүтэн рэгтайм)",
      description: Object.freeze({
        en: "Scott Joplin's complete 1902 piano rag: 152 played 2/4 bars with four repeated strains and their first/second endings. Both hands become eight independently editable piano voices. Original straight syncopation; modest section tempo changes (72/76/74) are Sound Lab's interpretation. Nine printed articulations are not yet mapped in this converted score.",
        mn: "Скотт Жоплины 1902 оны бүтэн төгөлдөр хуурын рэгтайм: давталт, хоёр өөр төгсгөлтэй 152 такт. Хоёр гарын нотыг 8 тусдаа засварлах хоолой болгон хөрвүүлэв. Бичсэн синкоп хэмнэлийг свинг нэмэлгүй хадгалсан; 72/76/74 хурдны өөрчлөлт нь Sound Lab-ын тайлбар юм. Эх нотны 9 артикуляцийн тэмдэг энэ хөрвүүлсэн хувилбарт хараахан ороогүй."
      }) },
    { id: "furElise", category: "classics", en: "Beethoven · Für Elise (complete)",
      mn: "Бетховен · Für Elise (бүтнээр)",
      description: Object.freeze({
        en: "Complete WoO 59 bagatelle: both hands, both repeated sections, contrasting F-major and darker episodes, and the closing reprise. Seven editable voices preserve all 1,038 pitched attacks, plus three written grace notes. The slurs are retained; sectional dynamics, pulse changes, a few staccatos and short pedal passages are explicitly editorial.",
        mn: "WoO 59 бүтэн багатель: хоёр гарын нот, хоёр давталт, фа мажор болон бараан дунд хэсэг, төгсгөлийн дахилт. Засварлах 7 хоолойд 1038 үндсэн цохилт, 3 угтвар нот бий. Эхийн лигийг хадгалсан; хурд, динамик, зарим богино нот болон педаль нь Sound Lab-ын тайлбар юм."
      }) },
    { id: "minuteWaltz", category: "classics", en: "Chopin · Minute Waltz, Op. 64 No. 1 (complete)",
      mn: "Шопен · Минутын вальс, Op. 64 №1 (бүтнээр)",
      description: Object.freeze({
        en: "Complete D-flat major waltz with first/second endings: 140 played bars, both hands and four editable piano voices. Ten grace notes, two trilled notes and eight upper mordents are separately realized. Printed dynamics are retained; gradual tempo ramps and selected hairpin endpoints are Sound Lab's interpretive choices. About 2 minutes 11 seconds.",
        mn: "Ре-бемоль мажорын бүтэн вальс: хоёр өөр төгсгөлтэй, нийт 140 такт, хоёр гарын засварлах 4 хоолой. 10 угтвар нот, 2 трилль, 8 дээд мордентийг тус тусад нь тоглуулна. Эхийн динамикийг хадгалсан; хурдыг аажмаар өөрчлөх болон зарим чанга-сулын шилжилтийг Sound Lab тайлбарлан нэмсэн. Ойролцоогоор 2 минут 11 секунд."
      }) },
    { id: "bachPrelude", category: "classics", en: "Bach · Prelude in C, BWV 846 (complete)",
      mn: "Бах · До мажор прелюд, BWV 846 (бүтнээр)",
      description: Object.freeze({
        en: "The complete 35-bar Prelude from The Well-Tempered Clavier I, in three independently editable piano voices. All 549 sounding pitches, tied bass sustains, and the final chord follow a CC0 score. The source specifies quarter=66 and has no printed dynamics or pedal; this version adds none. About 2 minutes 7 seconds.",
        mn: "Сайн хөглөгдсөн клавир I дэвтрийн 35 такттай бүтэн прелюд. Гурван засварлах төгөлдөр хуурын хоолойд CC0 эхийн 549 цохилт, удаан үргэлжлэх басс, төгсгөлийн аккордыг хадгалав. Эхэд дөрөвтийн нот=66 хурдтай, нэмэлт динамик буюу педалийн тэмдэггүй; энд ч нэмж оруулаагүй. Ойролцоогоор 2 минут 7 секунд."
      }) },
    { id: "korobeiniki", en: "Коробейники · folk (16 bars)", mn: "Коробейники · ардын дуу (16 такт)" },
    { id: "kalinka", en: "Калинка · Larionov (27 bars)", mn: "Калинка · Ларионов (27 такт)" },
    { id: "bella", en: "Bella Ciao · folk · with drums", mn: "Bella Ciao · бөмбөртэй найруулга" },
    { id: "greensleeves", category: "western", en: "Greensleeves · folk (verse and refrain)",
      mn: "Greensleeves · бадаг ба дахилт" },
    { id: "daisy", category: "popular", en: "Daisy Bell · Dacre (32-bar chorus)",
      mn: "Daisy Bell · Дейкр (32 такттай дахилт)" },
    { id: "paloma", category: "popular", en: "La Paloma · Iradier (opening melody)",
      mn: "La Paloma · Ирадиер (эхний аялгуу)" },
    { id: "charleston", category: "popular", en: "Charleston · Johnson (complete dance)",
      mn: "Charleston · Жонсон (бүтэн бүжгийн аялгуу)",
      description: Object.freeze({
        en: "A complete-form 1923 Charleston: instrumental opening, verse and twice-played 32-bar refrain, with original piano, walking bass and lively drums. About 2 minutes 12 seconds.",
        mn: "1923 оны Чарльстон: оршил, бадаг, 32 такттай дахилтыг хоёр удаа тоглоно. Шинэ төгөлдөр хуур, басс, бөмбөрийн найруулгатай; ойролцоогоор 2 минут 12 секунд."
      }) },
    { id: "elChoclo", category: "popular", en: "El Choclo · Villoldo (complete tango)",
      mn: "El Choclo · Вильольдо (бүтэн танго)",
      description: Object.freeze({
        en: "Villoldo's early tango, with its contrasting minor and major sections. Original tango-style piano, bass and restrained percussion accompany a reed melody; about two minutes.",
        mn: "Вильольдогийн эртний танго: минор, мажор хэсгүүд ээлжилнэ. Үлээвэр зэмсгийн аялгуунд шинээр бичсэн төгөлдөр хуур, басс, зөөлөн цохилуур дагалдана; ойролцоогоор хоёр минут."
      }) },
    { id: "chopin7", en: "Chopin · Prelude Op. 28 No. 7 (complete, 16 bars)",
      mn: "Шопен · Прелюд Op. 28 №7 (бүтэн, 16 такт)" },
    { id: "chopin20", en: "Chopin · Prelude Op. 28 No. 20 (complete, 13 bars)",
      mn: "Шопен · Прелюд Op. 28 №20 (бүтэн, 13 такт)" }
  ]);

  const SONGS = Object.freeze({
    paloma: Object.freeze({
      mode: "alternate",
      guitar: "X:2\n" +
        "T:La Paloma - original guitar habanera\n" +
        "M:2/4\n" +
        "L:1/16\n" +
        "Q:1/4=96\n" +
        "K:C\n" +
        "z6 [B,DFG]2 | C,3 [G,CEG] [G,CEG]2 [G,CEG]2 | C,3 [G,CEG] [G,CEG]2 [G,CEG]2 | C,3 [G,CEG] [G,CEG]2 [G,CEG]2 |\n" +
        "G,3 [B,DFG] [B,DFG]2 [B,DFG]2 | G,3 [B,DFG] [B,DFG]2 [B,DFG]2 | G,3 [B,DFG] [B,DFG]2 [B,DFG]2 | G,3 [B,DFG] [B,DFG]2 [B,DFG]2 |\n" +
        "G,3 [B,DFG] [B,DFG]2 [B,DFG]2 | C,3 [G,CEG] [G,CEG]2 [G,CEG]2 | C,3 [G,CEG] [G,CEG]2 [G,CEG]2 | C,3 [G,CEG] [G,CEG]2 [G,CEG]2 |\n" +
        "C,3 [G,CEG] [G,CEG]2 [G,CEG]2 | C,3 [G,CEG] [G,CEG]2 [G,CEG]2 | G,3 [B,DFG] [B,DFG]2 [B,DFG]2 | G,3 [B,DFG] [B,DFG]2 [B,DFG]2 |\n" +
        "G,3 [B,DFG] [B,DFG]2 [B,DFG]2 | G,3 [B,DFG] [B,DFG]2 [B,DFG]2 | G,3 [B,DFG] [B,DFG]2 [B,DFG]2 | [C,G,CEG]8 |]\n" +
        "% Original Sound Lab habanera accompaniment; not copied from the historical piano part.\n" +
        "% Melody source: https://tile.loc.gov/storage-services/public/music/mussm-sm1885-10603/mussm-sm1885-10603.pdf",
      bass: "X:3\n" +
        "T:La Paloma - original bass habanera\n" +
        "M:2/4\n" +
        "L:1/16\n" +
        "Q:1/4=96\n" +
        "K:C\n" +
        "z6 G,2 | C,3 G, C,2 G,2 | C,3 G, C,2 G,2 | C,3 G, C,2 G,2 |\n" +
        "G,3 D, G,2 D,2 | G,3 D, G,2 D,2 | G,3 D, G,2 D,2 | G,3 D, G,2 D,2 |\n" +
        "G,3 D, G,2 D,2 | C,3 G, C,2 G,2 | C,3 G, C,2 G,2 | C,3 G, C,2 G,2 |\n" +
        "C,3 G, C,2 G,2 | C,3 G, C,2 G,2 | G,3 D, G,2 D,2 | G,3 D, G,2 D,2 |\n" +
        "G,3 D, G,2 D,2 | G,3 D, G,2 D,2 | G,3 D, G,2 D,2 | C,8 |]\n" +
        "% Original Sound Lab habanera accompaniment; not copied from the historical piano part.\n" +
        "% Melody source: https://tile.loc.gov/storage-services/public/music/mussm-sm1885-10603/mussm-sm1885-10603.pdf",
      drums: "X:4\n" +
        "T:La Paloma - original quiet habanera\n" +
        "M:2/4\n" +
        "L:1/16\n" +
        "Q:1/4=96\n" +
        "K:C clef=perc\n" +
        "z6 E2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | C3 G D2 G2 | [CE]2 z6 |]\n" +
        "% Original quiet percussion: pickup, 3+1+2+2 sixteenth-note habanera, and ending patterns."
    }),
    greensleeves: Object.freeze({
      mode: "down",
      guitar: "X:2\n" +
        "T:Greensleeves - original guitar accompaniment\n" +
        "M:6/8\n" +
        "L:1/8\n" +
        "Q:1/4=90\n" +
        "K:Em\n" +
        "z |\n" +
        "[E,,B,,E,G,B,E]3 [E,,B,,E,G,B,E]3 | [D,A,DF]3 [D,A,DF]3 | [C,E,G,CE]3 [C,E,G,CE]3 | [B,,^D,A,B,F]3 [B,,^D,A,B,F]3 |\n" +
        "[E,,B,,E,G,B,E]3 [E,,B,,E,G,B,E]3 | [D,A,DF]3 [D,A,DF]3 | [E,,B,,E,G,B,E]3 [B,,^D,A,B,F]3 | [E,,B,,E,G,B,E]3 [E,,B,,E,G,B,E]3 |\n" +
        "[G,,B,,D,G,B,G]3 [G,,B,,D,G,B,G]3 | [D,A,DF]3 [D,A,DF]3 | [C,E,G,CE]3 [C,E,G,CE]3 | [B,,^D,A,B,F]3 [B,,^D,A,B,F]3 |\n" +
        "[G,,B,,D,G,B,G]3 [G,,B,,D,G,B,G]3 | [D,A,DF]3 [D,A,DF]3 | [E,,B,,E,G,B,E]3 [B,,^D,A,B,F]3 | [E,,B,,E,G,B,E]5 |]\n" +
        "% New Sound Lab accompaniment; not a copy of the source harmonization. Explicit open-position chords; gentle downstrokes at 20 ms between written pitches.\n" +
        "% Melody source: https://www.hymnsandcarolsofchristmas.com/Hymns_and_Carols/what_child_is_this_version_1.htm",
      bass: "X:3\n" +
        "T:Greensleeves - original bass accompaniment\n" +
        "M:6/8\n" +
        "L:1/8\n" +
        "Q:1/4=90\n" +
        "K:Em\n" +
        "z |\n" +
        "E,3 B,,3 | D,3 A,3 | C,3 G,3 | B,,3 F,3 |\n" +
        "E,3 B,,3 | D,3 A,3 | E,3 B,,3 | E,3 B,,3 |\n" +
        "G,3 D,3 | D,3 A,3 | C,3 G,3 | B,,3 F,3 |\n" +
        "G,3 D,3 | D,3 A,3 | E,3 B,,3 | E,5 |]\n" +
        "% New Sound Lab root/fifth bass part; no source arrangement copied. All triangle-bass notes are B2 or higher.\n" +
        "% Melody source: https://www.hymnsandcarolsofchristmas.com/Hymns_and_Carols/what_child_is_this_version_1.htm"
    }),
    daisy: Object.freeze({
      mode: "alternate",
      guitar: "X:2\n" +
        "T:Daisy Bell - original guitar waltz\n" +
        "M:3/4\n" +
        "L:1/4\n" +
        "Q:1/4=144\n" +
        "K:G\n" +
        "G,, [D,G,B,G] [D,G,B,G] | G,, [D,G,B,G] [D,G,B,G] | G,, [D,G,B,G] [D,G,B,G] | G,, [D,G,B,G] [D,G,B,G] | C, [E,G,CE] [E,G,CE] | C, [E,G,CE] [E,G,CE] | G,, [D,G,B,G] [D,G,B,G] | G,, [D,G,B,G] [D,G,B,G] |\n" +
        "D, [D,A,CF] [D,A,CF] | D, [D,A,CF] [D,A,CF] | G,, [D,G,B,G] [D,G,B,G] | G,, [D,G,B,G] [D,G,B,G] | C, [E,G,CE] [E,G,CE] | D, [D,A,CF] [D,A,CF] | D, [D,A,CF] [D,A,CF] | D, [D,A,CF] [D,A,CF] |\n" +
        "C, [E,G,CE] [E,G,CE] | G,, [D,G,B,G] [D,G,B,G] | G,, [D,G,B,G] [D,G,B,G] | G,, [D,G,B,G] [D,G,B,G] | G,, [D,G,B,G] [D,G,B,G] | C, [E,G,CE] [E,G,CE] | D, [D,A,CF] [D,A,CF] | D, [D,A,CF] [D,A,CF] |\n" +
        "G,, [D,G,B,G] [D,G,B,G] | D, [D,A,CF] [D,A,CF] | G,, [D,G,B,G] [D,G,B,G] | D, [D,A,CF] [D,A,CF] | G,, [D,G,B,G] [D,G,B,G] | D, [D,A,CF] [D,A,CF] | G,, [D,G,B,G] [D,G,B,G] | [G,,B,,D,G,B,G] z2 |]\n" +
        "% Original Sound Lab accompaniment, not copied from the historical piano part.\n" +
        "% Melody source: https://old-digitalcollections.nypl.org/items/5e66b3e8-94d1-d471-e040-e00a180654d7",
      bass: "X:3\n" +
        "T:Daisy Bell - original bass waltz\n" +
        "M:3/4\n" +
        "L:1/4\n" +
        "Q:1/4=144\n" +
        "K:G\n" +
        "G,3 | G,3 | G,3 | G,3 | C,3 | C,3 | G,3 | G,3 |\n" +
        "D,3 | D,3 | G,3 | G,3 | C,3 | D,3 | D,3 | D,3 |\n" +
        "C,3 | G,3 | G,3 | G,3 | G,3 | C,3 | D,3 | D,3 |\n" +
        "G,3 | D,3 | G,3 | D,3 | G,3 | D,3 | G,3 | G, z2 |]\n" +
        "% Original Sound Lab accompaniment, not copied from the historical piano part.\n" +
        "% Melody source: https://old-digitalcollections.nypl.org/items/5e66b3e8-94d1-d471-e040-e00a180654d7",
      drums: "X:4\n" +
        "T:Daisy Bell - original quiet waltz\n" +
        "M:3/4\n" +
        "L:1/8\n" +
        "Q:1/4=144\n" +
        "K:C clef=perc\n" +
        "[CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 G2 G2 | [CE]2 z4 |]\n" +
        "% Original quiet percussion; linked repeating waltz and ending patterns."
    })
  });

  function createTurkishMarch(language) {
    return [{ id: 1,
      name: language === "en" ? "Piano · 4 voices" : "Төгөлдөр хуур · 4 хоолой",
      instrument: "piano", volume: 54, mute: false, solo: false,
      abc: classical.TURKISH_MARCH_ABC }];
  }

  function createEntertainer(language) {
    return [{ id: 1,
      name: language === "en" ? "Ragtime piano · 8 voices" : "Рэгтайм төгөлдөр хуур · 8 хоолой",
      instrument: "piano", volume: 54, mute: false, solo: false,
      abc: joplin.ENTERTAINER_ABC }];
  }

  function createFurElise(language) {
    return [{ id: 1,
      name: language === "en" ? "Piano · 7 voices" : "Төгөлдөр хуур · 7 хоолой",
      instrument: "piano", volume: 54, mute: false, solo: false,
      abc: beethoven.FUR_ELISE_ABC }];
  }

  function createMinuteWaltz(language) {
    return [{ id: 1,
      name: language === "en" ? "Waltz piano · 4 voices" : "Вальсын төгөлдөр хуур · 4 хоолой",
      instrument: "piano", volume: 54, mute: false, solo: false,
      abc: chopin.MINUTE_WALTZ_ABC }];
  }

  function createBachPrelude(language) {
    return [{ id: 1,
      name: language === "en" ? "Piano · 3 voices" : "Төгөлдөр хуур · 3 хоолой",
      instrument: "piano", volume: 54, mute: false, solo: false,
      abc: bach.PRELUDE_C_MAJOR_ABC }];
  }

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

  // Complete-form instrumental reduction based directly on the 1923 sheet
  // music (including its refrain and repeat).  Ornamentation and the vocal
  // verse are simplified for Sound Lab's one-voice ABC parser.  The opening,
  // piano comping, walking bass, and percussion are our own arrangements.
  // Source: https://s9.imslp.org/files/imglnks/usimg/9/90/IMSLP880807-PMLP1385673-mack-johnson_charleston.pdf
  const CHARLESTON = Object.freeze({
    tempo: 160, meter: "2/2", unit: "1/8", key: "Bb",
    intro: Object.freeze([
      "z2 G2 B2 d2", "z G B d2 B2 G", "z2 B2 A2 G2", "z G B d B G F2",
      "G2 z G2 B3", "B A G F G A B2", "c2 B2 A2 G2", "^F2 A2 c2 d2"
    ]),
    verse: Object.freeze([
      "G G2 G G2 F2", "d c d d2 G2 G", "c3 d c3 d", "G6 z2",
      "G G2 G G2 F2", "d d2 d2 G3", "z A G ^F F G A B", "A4 A z c2",
      "c2 A2 A2 c2", "d A2 d d4", "c2 c2 A3 B", "B2 G2 B2 A2",
      "c2 c2 A2 d2", "c2 c2 d2 A2", "c2 B2 A2 G2", "A B2 c3 z2"
    ]),
    refrain: Object.freeze([
      "G2 z G G4", "^G2 z ^G ^G4", "B2 z B2 ^G B2", "d2 z B B4",
      "G2 z d d4", "G2 z d d4", "G2 z B B4", "A c A G G A G _G",
      "A2 z A A4", "^A2 z ^A ^A4", "G2 z G G ^G G2", "d2 z d d4",
      "z A A A A G F2", "z G G G G A ^F2", "z A A A A G ^F2", "z A A A A G =F2",
      "A2 z A A4", "^A2 z ^A ^A4", "G2 z G G ^F G2", "d2 z G G z G G",
      "G2 z d2 ^c d2", "G2 z d d4", "G2 z B B2 B2", "A A A G G2 F2",
      "d2 z d d4", "z c2 c2 B c2", "d2 z d d4", "z B c B c4",
      "G2 z G G4", "z F G A A G F2", "B8", "B2 z2 z4"
    ]),
    introChords: Object.freeze(["Bb", "Bb", "F7", "F7", "Eb", "F7", "Bb", "D7"]),
    verseChords: Object.freeze(["Gm", "Gm6", "Cm", "D7", "Gm", "Gm7", "Gm6", "Gm6",
      "A7", "D", "F7", "Bb", "D7", "Gm", "C7", "F7"]),
    refrainChords: Object.freeze(["Bb", "D7", "G7", "F7", "C7", "F7", "Gm7", "Gdim",
      "Bb", "D7", "G7", "C9", "F", "A7", "D7", "F7", "Bb", "D7", "G7", "G7",
      "C7", "F7", "Gm7", "F7", "Gm", "Bb", "Eb", "C7", "Gm7", "F7", "Bb7", "Bb"]),
    harmony: Object.freeze({
      Bb: { chord: "[B,DF]", bass: "B,", fifth: "F," },
      Bb7: { chord: "[B,DF_A]", bass: "B,", fifth: "F," },
      D7: { chord: "[D,^FAc]", bass: "D,", fifth: "A," },
      G7: { chord: "[G,=BDF]", bass: "G,", fifth: "D," },
      F7: { chord: "[F,AC_E]", bass: "F,", fifth: "C" },
      C7: { chord: "[C,EGB]", bass: "C,", fifth: "G," },
      Gm7: { chord: "[G,BDF]", bass: "G,", fifth: "D," },
      Gm: { chord: "[G,BD]", bass: "G,", fifth: "D," },
      Gm6: { chord: "[G,B=E]", bass: "G,", fifth: "D," },
      Gdim: { chord: "[G,B_D_E]", bass: "G,", fifth: "D," },
      C9: { chord: "[C,EGBd]", bass: "C,", fifth: "G," },
      F: { chord: "[F,AC]", bass: "F,", fifth: "C" },
      A7: { chord: "[A,^CEG]", bass: "A,", fifth: "E," },
      D: { chord: "[D,^FA]", bass: "D,", fifth: "A," },
      Cm: { chord: "[C,_EG]", bass: "C,", fifth: "G," },
      Eb: { chord: "[_E,GB]", bass: "E,", fifth: "B," }
    })
  });

  function createCharleston(language) {
    const piece = CHARLESTON;
    const melodyBars = [...piece.intro, ...piece.verse, ...piece.refrain,
      ...piece.refrain.slice(0, -1), "d2 z2 B4"];
    const progression = [...piece.introChords, ...piece.verseChords,
      ...piece.refrainChords, ...piece.refrainChords];
    if (melodyBars.length !== 88 || progression.length !== 88) {
      throw new Error("Charleston arrangement must contain 88 synchronized measures");
    }
    const pianoBars = progression.map((name, index) => {
      const chord = piece.harmony[name].chord;
      return index === progression.length - 1 ? chord + "8" :
        "z " + chord + "2 z " + chord + " z " + chord + "2";
    });
    const bassBars = progression.map((name, index) => {
      const { bass, fifth } = piece.harmony[name];
      return index === progression.length - 1 ? bass + "8" :
        index % 4 === 3 ? `${bass}2 ${fifth}2 ${bass} ${fifth} ${bass}2` :
          `${bass}2 ${fifth}2 ${bass}2 ${fifth}2`;
    });
    const drumBars = progression.map((name, index) => {
      if (index === progression.length - 1) return "[Ce]2 z6";
      if (index < 8) return index % 4 === 3 ? "[CE] E [DE] E [CE] E [DF] E" :
        "[CE] E [DE] E [CE] E [DE] E";
      if (index % 8 === 7) return "[CE] E [DE] E [CE] A [Dc] [De]";
      if (index % 4 === 3) return "[CE] E [DE] E [CE] E [DF] E";
      return "[CE] E [DE] E [CE] E [DE] E";
    });
    const provenance = "Melody reduction from Cecil Mack and James P. Johnson, Charleston " +
      "(1923 public-domain score); the instrumental introduction, piano comping, bass and drums " +
      "are new Sound Lab parts. Verse and 32-bar refrain (twice) with a final cadence. Source: " +
      "https://s9.imslp.org/files/imglnks/usimg/9/90/IMSLP880807-PMLP1385673-mack-johnson_charleston.pdf";
    const melody = barsABC(1, "Charleston - melodic reduction (1923)", piece.meter,
      piece.unit, piece.tempo, piece.key, melodyBars, provenance);
    const piano = barsABC(2, "Charleston - original syncopated piano accompaniment",
      piece.meter, piece.unit, piece.tempo, piece.key, pianoBars, provenance);
    const bass = barsABC(3, "Charleston - original walking bass", piece.meter,
      piece.unit, piece.tempo, piece.key, bassBars, provenance);
    const percussion = barsABC(4, "Charleston - original drum kit", piece.meter,
      piece.unit, piece.tempo, "C clef=perc", drumBars, provenance);
    const patterns = drumPatterns.fromABC(percussion);
    const names = language === "en" ? ["Charleston melody", "Syncopated piano", "Walking bass", "Dance drums"] :
      ["Чарльстоны аялгуу", "Төгөлдөр хуурын хэмнэл", "Алхах басс", "Бүжгийн бөмбөр"];
    return [
      { id: 1, name: names[0], instrument: "clarinet", volume: 58, mute: false, solo: false, abc: melody },
      { id: 2, name: names[1], instrument: "piano", volume: 38, mute: false, solo: false, abc: piano },
      { id: 3, name: names[2], instrument: "triangle", volume: 30, mute: false, solo: false, abc: bass },
      { id: 4, name: names[3], instrument: "drums", volume: 28, mute: false, solo: false,
        abc: drumPatterns.toABC(patterns), patterns, patternBar: 1,
        patternId: drumPatterns.atBar(patterns, 1).pattern.id, textMode: "pattern", patternDraft: null,
        drumFeel: "light", drumTouch: "expressive" }
    ];
  }

  // Villoldo's public-domain El Choclo (1903). The principal motifs and
  // contrasting A-minor/A-major trio follow the early score; the melody is
  // transposed and grace notes are omitted for our single-voice ABC subset.
  // Historical score (1913): https://www.loc.gov/resource/music.musm1508-10019140/
  // Cross-check: John Chambers, El Choclo ABC (2005), from the public-domain tune.
  // https://abcnotation.com/tunePage?a=trillian.mit.edu/~jc/music/abc/Finland/program/20100626/20100626Tang/0000
  // Repeats are written out explicitly. Our four-bar intro, piano, bass,
  // percussion and eight-bar closing are new, not copied from a recording.
  const EL_CHOCLO = Object.freeze({
    tempo: 112, meter: "2/4", unit: "1/16", key: "Am",
    intro: Object.freeze([
      "A,2 E2 A2 c2", "E2 ^G2 B2 d2", "A2 c2 e2 f2", "E2 B2 z E E F"
    ]),
    introChords: Object.freeze(["Am", "E7", "Am", "E7"]),
    a: Object.freeze({
      bars: Object.freeze([
        "F E E A A c c f", "f2 e2 z e e a", "a e e c c d d c", "c2 B2 z E E F",
        "F E E ^G G B B f", "f2 e2 z e ^d e", "b ^g g e e =d d c", "B2 A2 z E E F",
        "F E E A A c c f", "f2 e2 z e e a", "a e e ^c c e e g", "g2 f2 z F F f",
        "f e e d d c c B", "B2 A A A c B A", "A2 ^G B B d c B", "A2 z3"
      ]),
      chords: Object.freeze(["Am", "Am", "Am", "E7", "E7", "E7", "E7", "Am",
        "Am", "Am", "A7", "Dm", "Dm", "Am", "E7", "Am"])
    }),
    b: Object.freeze({
      bars: Object.freeze([
        "f f2 f g f e ^d", "f e2 B =d c B A", "c B2 F B A G ^F", "A2 G2 z E ^D E",
        "d d2 d e d c B", "d2 c2 z c d c", "B A ^G A B c d ^d", "e2 z3"
      ]),
      chords: Object.freeze(["G7", "C", "G7", "C", "E7", "Am", "Dm", "E7"])
    }),
    c: Object.freeze({
      // Explicit accidentals retain the historical A-major trio while the
      // editor uses one K:Am header for all three sections.
      bars: Object.freeze([
        "A E z ^c A E A ^c", "d2 B2 z E d B", "^G E z ^G E ^G B d", "^c2 A2 z E ^c B",
        "^A ^F ^E ^F ^G A B ^c", "e2 d2 z B ^A B", "^c2 B2 z A B A", "A2 ^G2 z E e ^c",
        "A E z ^c A E A ^c", "d2 B2 z E d B", "^G E z ^G E ^G B d", "^c2 A2 z E ^c B",
        "^A ^F ^E ^F ^G A B ^c", "e2 d2 z ^F d ^c", "^c B ^A B ^F =A ^G B", "A2 z3"
      ]),
      chords: Object.freeze(["A", "E7", "E7", "A", "F#7", "Bm", "B7", "E7",
        "A", "E7", "E7", "A", "F#7", "Bm", ["B7", "E7"], "A"])
    }),
    coda: Object.freeze([
      "F E E A A c c f", "f2 e2 z e e a", "a e e c c d d c", "c2 B2 z E E F",
      "F E E ^G G B B f", "f2 e2 z e ^d e", "B2 A2 z ^G B B", "[A^ce]8"
    ]),
    codaChords: Object.freeze(["Am", "Am", "Am", "E7", "Am", "E7", "E7", "A"]),
    harmony: Object.freeze({
      Am: { chord: "[A,CE]", bass: "A,,", fifth: "E," },
      E7: { chord: "[E,^G,B,D]", bass: "E,", fifth: "B," },
      A7: { chord: "[A,^CEG]", bass: "A,,", fifth: "E," },
      Dm: { chord: "[D,FA]", bass: "D,", fifth: "A," },
      G7: { chord: "[G,BDF]", bass: "G,", fifth: "D," },
      C: { chord: "[C,EG]", bass: "C,", fifth: "G," },
      A: { chord: "[A,^CE]", bass: "A,,", fifth: "E," },
      "F#7": { chord: "[^F,^A,^CE]", bass: "^F,", fifth: "^C," },
      Bm: { chord: "[B,D^F]", bass: "B,,", fifth: "^F," },
      B7: { chord: "[B,^D^FA]", bass: "B,,", fifth: "^F," }
    })
  });

  function createElChoclo(language) {
    const piece = EL_CHOCLO;
    const melodyBars = [...piece.intro], progression = [...piece.introChords];
    const sections = [
      ["a", "E E F"], ["a", "G ^F G"], ["b", "G ^F G"],
      ["b", "E e ^c"], ["c", "E e ^c"], ["c", "E E F"], ["a", "E E F"]
    ];
    for (const [sectionId, nextPickup] of sections) {
      const section = piece[sectionId];
      melodyBars.push(...section.bars.slice(0, -1), section.bars.at(-1) + " " + nextPickup);
      progression.push(...section.chords);
    }
    melodyBars.push(...piece.coda);
    progression.push(...piece.codaChords);
    if (melodyBars.length !== 108 || progression.length !== 108) {
      throw new Error("El Choclo arrangement must have 108 synchronized measures");
    }
    const names = language === "en" ?
      ["El Choclo melody", "Tango piano", "Tango bass", "Light percussion"] :
      ["El Choclo аялгуу", "Танго төгөлдөр хуур", "Танго басс", "Зөөлөн цохилуур"];
    const pianoBars = progression.map((chordName, index) => {
      const first = piece.harmony[Array.isArray(chordName) ? chordName[0] : chordName].chord;
      const second = piece.harmony[Array.isArray(chordName) ? chordName[1] : chordName].chord;
      if (index === progression.length - 1) return second + "8";
      return index % 8 === 7 ? first + "2 z2 " + second + "2 z2" :
        "z2 " + first + "2 z2 " + second + "2";
    });
    const bassBars = progression.map((chordName, index) => {
      const chord = piece.harmony[Array.isArray(chordName) ? chordName[0] : chordName];
      if (index === progression.length - 1) return chord.bass + "8";
      if (Array.isArray(chordName)) return chord.bass + "4 " + piece.harmony[chordName[1]].bass + "4";
      return index % 8 === 7 ? `${chord.bass}3 ${chord.fifth} ${chord.bass}2 ${chord.fifth}2` :
        index % 4 === 2 ? `${chord.bass}4 ${chord.fifth}4` :
          `${chord.bass}2 ${chord.fifth}2 ${chord.bass}2 ${chord.fifth}2`;
    });
    const drumBars = progression.map((_, index) => {
      if (index === progression.length - 1) return "[Ce]2 z6";
      if (index < 4) return "[CG]2 z2 [DE]2 G2";
      if (index % 8 === 7) return "C2 G D [DE]2 G2";
      if (index % 4 === 3) return "[CE]3 G [DE]2 G2";
      return index % 2 ? "C2 G2 [DE]2 G2" : "[CG]2 z2 [DE]2 G2";
    });
    const provenance = "Instrumental reduction of Angel Gregorio Villoldo's public-domain " +
      "El Choclo (1903); principal melodies and A-minor/A-major sections checked against " +
      "the 1913 score. Ornamentation simplified, repeats expanded. The instrumental " +
      "introduction, closing and all accompaniment parts are new Sound Lab work. Score: " +
      "https://www.loc.gov/resource/music.musm1508-10019140/";
    const melody = barsABC(1, "El Choclo - Villoldo melody (reduction)", piece.meter,
      piece.unit, piece.tempo, piece.key, melodyBars, provenance);
    const piano = barsABC(2, "El Choclo - original offbeat tango piano", piece.meter,
      piece.unit, piece.tempo, piece.key, pianoBars, provenance);
    const bass = barsABC(3, "El Choclo - original marcato and habanera bass", piece.meter,
      piece.unit, piece.tempo, piece.key, bassBars, provenance);
    const drumABC = barsABC(4, "El Choclo - original restrained tango percussion", piece.meter,
      piece.unit, piece.tempo, "C clef=perc", drumBars, provenance);
    const patterns = drumPatterns.fromABC(drumABC);
    return [
      { id: 1, name: names[0], instrument: "bayan", volume: 58,
        mute: false, solo: false, abc: melody },
      { id: 2, name: names[1], instrument: "piano", volume: 35,
        mute: false, solo: false, abc: piano },
      { id: 3, name: names[2], instrument: "triangle", volume: 27,
        mute: false, solo: false, abc: bass },
      { id: 4, name: names[3], instrument: "drums", volume: 18, mute: false, solo: false,
        abc: drumPatterns.toABC(patterns), patterns, patternBar: 1,
        patternId: drumPatterns.atBar(patterns, 1).pattern.id,
        textMode: "pattern", patternDraft: null,
        drumFeel: "straight", drumTouch: "expressive" }
    ];
  }

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

  function createSong(id, language) {
    const piece = SONGS[id];
    const names = language === "en" ? ["Melody", "Guitar accompaniment", "Bass", "Quiet drums"] :
      ["Аялгуу", "Гитар дагалдах", "Басс", "Зөөлөн бөмбөр"];
    const track = (index, instrument, volume, notes) => ({
      id: index + 1, name: names[index], instrument, volume,
      mute: false, solo: false, abc: notes
    });
    const tracks = [
      track(0, compose.EXAMPLE_INFO[id].instrument, 46, compose.EXAMPLES[id]),
      { ...track(1, "guitar", 38, piece.guitar),
        guitar: { mode: piece.mode, spacingMs: 20 } },
      track(2, "triangle", 16, piece.bass)
    ];
    if (piece.drums) {
      const patterns = drumPatterns.fromABC(piece.drums);
      tracks.push({ ...track(3, "drums", 12, drumPatterns.toABC(patterns)), patterns,
        patternBar: 1, patternId: drumPatterns.atBar(patterns, 1).pattern.id,
        textMode: "pattern", patternDraft: null });
    }
    return tracks;
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

  // D1/D2: original, entirely percussion-based scores. Each pattern is one 4/4
  // bar with four groups of four sixteenth-note cells. x = normal, o = soft,
  // X = accent, g = ghost, f/F = flam, r/R = measured four-stroke roll, . = rest.
  // Repeated pattern letters become editable, linked
  // patterns in the existing drum grid; no special playback format is added.
  const DRUM_SOLOS = Object.freeze({
    drumKitSolo: {
      tempo: 108,
      parts: [{ names: { en: "Drum kit", mn: "Бөмбөрийн иж бүрдэл" }, volume: 65,
        sequence: "AABACCDE", patterns: {
          A: { kick: "X... .... x... ....", snare: ".... X... .... X...", hat: "x.x. x.x. x.x. x.x." },
          B: { kick: "X... ..x. x... ..x.", snare: ".... X... ..o. X...", hat: "x.x. x.x. x.x. x...", openHat: ".... .... .... ..X." },
          C: { kick: "X... .... x... .x..", snare: ".... X... .... X.x.", hat: "x.x. x.x. x.x. x.x.", woodblock: ".... .... ..o. ...." },
          D: { kick: "X... .... x... ....", snare: ".... x... x.xX xXxX", hat: "x.x. x.x. .... ...." },
          E: { kick: "X... .... x... X...", snare: ".... x... xxxx X...", hat: "x.x. x.x. .... ....", openHat: ".... .... .... X..." }
        } }]
    },
    snareStudy: {
      tempo: 96,
      parts: [{ names: { en: "Snare accents", mn: "Жижиг бөмбөрийн өргөлт" }, volume: 60,
        sequence: "AABBCDBE", patterns: {
          A: { snare: "X.x. X.x. X.x. X.x." },
          B: { snare: "Xooo Xooo Xooo Xooo" },
          C: { snare: "Xoxo Xoxo Xoxo Xoxo" },
          D: { snare: "Xoox oXoo xoXo oxoX" },
          E: { snare: "X... x.x. xxxx X..." }
        } }]
    },
    snareRudiments: {
      tempo: 92,
      parts: [{ names: { en: "Snare rudiments", mn: "Жижиг бөмбөрийн техник" }, volume: 62,
        sequence: "AABBCDEE", patterns: {
          A: { snare: "X... f... x... f..." },
          B: { snare: "X... r... g... r..." },
          C: { snare: "Xgfg Xgfg Xgfg Xgfg" },
          D: { snare: "F... .... R... ...." },
          E: { snare: "X... f... g.r. R..." }
        } }]
    },
    swingHats: {
      tempo: 104,
      parts: [{ names: { en: "Swing kit · hi-hat", mn: "Свинг иж бүрдэл · цан" }, volume: 64,
        feel: "swing", sequence: "AABCABDE", patterns: {
          A: { kick: "X... .... x... ....", snare: ".... X... .... X...", hat: "x.x. x.x. x.x. x.x." },
          B: { kick: "X... .... x... ....", snare: ".... X... .... X...", hat: "x.x. x.x. x.x. x...",
            openHat: ".... .... .... ..X." },
          C: { kick: "X... .... x... ....", snare: ".... X... .... X...", hat: "X.x. x.x. x.x. x.x." },
          D: { kick: "X... .... x... ....", snare: ".... X... ..g. R...", hat: "X.x. x.x. .... ....",
            crash: "X... .... .... ...." },
          E: { kick: "X... .... X... ....", snare: ".... X... .... F...", hat: "x.x. x.x. x.x. ....",
            openHat: ".... .... .... X..." }
        } }]
    },
    hatPedal: {
      tempo: 108,
      parts: [{ names: { en: "Hi-hat pedal · three openings", mn: "Цан · гурван нээлт" },
        volume: 63, sequence: "AABCABDE", patterns: {
          A: { kick: "X... .... x... ....", snare: ".... X... .... X...", hat: "X.x. x.x. X.x. x.x." },
          B: { kick: "X... .... x... ....", snare: ".... X... .... X...", hat: "x.x. x.x. x.x. ....",
            halfHat: ".... .... .... x..." },
          C: { kick: "X... .... x... ....", snare: ".... X... .... X...", hat: "x.x. .... x.x. ....",
            halfHat: ".... x... .... x..." },
          D: { kick: "X... .... x... ....", snare: ".... X... .... X...", hat: "x.x. x.x. .... ....",
            openHat: ".... .... ..X. ....", halfHat: ".... .... .... x..." },
          E: { kick: "X... .... X... ....", snare: ".... X... ..g. X...", hat: "X.x. x.x. X.x. x.x.",
            crash: "X... .... .... ...." }
        } }]
    },
    stickingRudiments: {
      tempo: 100,
      parts: [{ names: { en: "Snare · R/L sticking", mn: "Жижиг бөмбөр · Баруун/зүүн гар" },
        volume: 63, touch: "expressive", sequence: "AABBCDEE", patterns: {
          A: { snare: "X.o.x.x. X.o.x.x." },
          B: { snare: "X.g.x.g. X.g.x.g." },
          C: { snare: "X.x.x.X. x.x.X.x." },
          D: { snare: "F... r... F... r..." },
          E: { snare: "X.g. F... R... X..." }
        }, sticking: {
          A: { snare: "R.L.R.R. L.R.L.L." },
          B: { snare: "L.R.L.L. R.L.R.R." },
          C: { snare: "R.L.R.R. L.R.L.L." },
          D: { snare: "R... L... L... R..." },
          E: { snare: "R.L. R... L... R..." }
        } }]
    },
    drumDialogue: {
      tempo: 112,
      parts: [
        { names: { en: "Low drums · call", mn: "Нам цохилуур · асуулт" }, volume: 65,
          sequence: "ABRRCCDE", patterns: {
            R: {},
            A: { kick: "X... .... .... x...", woodblock: ".... ..x. .... ...." },
            B: { kick: "X... ..x. .... ....", woodblock: ".... ..x. x... ...." },
            C: { kick: "X... .... X... ....", woodblock: "..x. ..x. ..x. ..x." },
            D: { kick: "X... ...x X... .x..", woodblock: ".... .... ..x. ..X." },
            E: { kick: "X... .... X... X...", woodblock: ".... ..x. .... X..." }
          } },
        { names: { en: "High drums · answer", mn: "Өндөр цохилуур · хариулт" }, volume: 56,
          sequence: "RRABCCDE", patterns: {
            R: {},
            A: { snare: ".... X... ..x. X...", hat: "x.x. x.x. x.x. x.x." },
            B: { snare: ".... X.xx .... X.xx", hat: "x.x. x.x. x.x. x.x." },
            C: { snare: ".... X... .... X...", hat: "x.x. x.x. x.x. x.x." },
            D: { snare: ".... X... ..xX xXxX", hat: "x.x. x.x. .... ...." },
            E: { snare: ".... X... x.x. X...", hat: "x.x. x.x. .... ....", openHat: ".... .... .... X..." }
          } }
      ]
    },
    tomCymbalStudy: {
      tempo: 104,
      parts: [{ names: { en: "Kit · tom fills", mn: "Иж бүрдэл · томын шилжилт" }, volume: 66,
        sequence: "AABACBDE", patterns: {
          A: { kick: "X... .... x... ....", snare: ".... X... .... X...",
            ride: "x.x. x.x. x.x. x.x." },
          B: { kick: "X... .... x... ....", rimshot: ".... X... .... ....",
            snare: ".... .... .... X...", ride: "x.x. x.x. x.x. ....",
            highTom: ".... .... .... ..ox" },
          C: { kick: "X... .... .... ....", crash: "X... .... .... ....",
            floorTom: ".... X... .... ....", midTom: ".... .... X... ...x",
            highTom: ".... .... .... xXx." },
          D: { kick: "X... .... .... ....", floorTom: "X... .... .... X...",
            midTom: ".... X... .... .x..", highTom: ".... .... X... ..x.",
            ride: "x... x... x... ....", rimshot: ".... .... .... ...X" },
          E: { kick: "X... .... X... ....", crash: "X... .... .... X...",
            snare: ".... X... .... ....", floorTom: ".... .... .... xX..",
            midTom: ".... .... ..xx ....", highTom: ".... .... xx.. ....",
            rimshot: ".... .... .... ...X" }
        } }]
    }
  });

  function createDrumSolo(id, language) {
    const solo = DRUM_SOLOS[id], meter = { numerator: 4, denominator: 4, quarterBeats: 4 };
    return solo.parts.map((part, index) => {
      const bars = [...part.sequence].map((symbol, barIndex) => {
        const pattern = part.patterns[symbol];
        if (!pattern) throw new Error("Unknown drum pattern " + symbol);
        const cells = Array.from({ length: 16 }, () => ({}));
        for (const [voice, notation] of Object.entries(pattern)) {
          const marks = notation.replace(/\s+/g, "");
          if (marks.length !== 16) throw new Error("Drum pattern needs 16 subdivisions");
          const handMarks = part.sticking?.[symbol]?.[voice]?.replace(/\s+/g, "");
          if (handMarks && handMarks.length !== 16) throw new Error("Drum sticking needs 16 subdivisions");
          for (let step = 0; step < marks.length; step++) {
            const mark = marks[step];
            const hand = handMarks?.[step];
            if (hand && !".RL".includes(hand)) throw new Error("Unknown drum hand mark");
            if (mark === "." && hand && hand !== ".") throw new Error("Sticking cannot mark an empty step");
            if (mark === ".") continue;
            const velocity = { o: drums.VELOCITIES.p, g: drums.VELOCITIES.ghost,
              x: drums.VELOCITIES.normal, f: drums.VELOCITIES.normal, r: drums.VELOCITIES.normal,
              X: drums.VELOCITIES.accent, F: drums.VELOCITIES.accent, R: drums.VELOCITIES.accent }[mark];
            if (velocity === undefined) throw new Error("Unknown drum strength or technique mark");
            const articulation = mark === "f" || mark === "F" ? "flam" :
              mark === "r" || mark === "R" ? "roll" : "plain";
            cells[step][voice] = articulation === "plain" && (!hand || hand === ".") ? velocity :
              { velocity, ...(articulation === "plain" ? {} : { articulation }),
                ...(!hand || hand === "." ? {} : { hand }) };
          }
        }
        return { number: barIndex + 1, cells };
      });
      const title = part.names[language === "en" ? "en" : "mn"];
      const abc = drums.fromGrid({ title, meter, tempoQuarter: solo.tempo }, bars)
        .replace(/^X:1$/m, "X:" + (index + 1));
      const patterns = drumPatterns.fromABC(abc);
      return { id: index + 1, name: title, instrument: "drums", volume: part.volume,
        drumFeel: part.feel || "straight", drumTouch: part.touch || "even",
        mute: false, solo: false, abc: drumPatterns.toABC(patterns), patterns,
        patternBar: 1, patternId: drumPatterns.atBar(patterns, 1).pattern.id,
        textMode: "pattern", patternDraft: null };
    });
  }

  function create(id, language = "mn") {
    if (Object.hasOwn(DRUM_SOLOS, id)) return createDrumSolo(id, language);
    if (id === "turkishMarch") return createTurkishMarch(language);
    if (id === "entertainer") return createEntertainer(language);
    if (id === "furElise") return createFurElise(language);
    if (id === "minuteWaltz") return createMinuteWaltz(language);
    if (id === "bachPrelude") return createBachPrelude(language);
    if (id === "charleston") return createCharleston(language);
    if (id === "elChoclo") return createElChoclo(language);
    if (id === "guitarStrum") return createGuitarStrum(language);
    if (id === "bella") return createBella(language);
    if (Object.hasOwn(SONGS, id)) return createSong(id, language);
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
