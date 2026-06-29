/**
 * locales/de.json のウムラウト代用表記（ae/oe/ue）を正しい ä/ö/ü に直す。
 * 正当な綴り（Feuer, Dauer, Mauer, neue, manuell, value, Abenteuer 等）は触らない、
 * 手作業で精査した辞書のみを「単語境界つき」で置換する。
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/fixGermanUmlauts.ts          # 適用
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/fixGermanUmlauts.ts --dry    # 差分のみ表示
 */
import * as fs from 'fs';

const FILE = 'locales/de.json';
const DRY = process.argv.includes('--dry');

// wrong → correct（ウムラウト代用のみ。ß=ss は対象外）
const MAP: Record<string, string> = {
  Abgruendiger: 'Abgründiger', Aendere: 'Ändere', Aendern: 'Ändern', Agilitaet: 'Agilität',
  Anfaengerwiese: 'Anfängerwiese', Angriffsverstaerkung: 'Angriffsverstärkung', Anhaenger: 'Anhänger',
  Ausgeruestet: 'Ausgerüstet', Ausgewaehlt: 'Ausgewählt', Ausruesten: 'Ausrüsten', Ausruestung: 'Ausrüstung',
  Baerenfalle: 'Bärenfalle', Banditenfuehrer: 'Banditenführer', Banditenkoenig: 'Banditenkönig',
  Bogenschuetze: 'Bogenschütze', Chimaere: 'Chimäre', Chimaeren: 'Chimären',
  Daemon: 'Dämon', Daemonen: 'Dämonen', Daemonenherrscher: 'Dämonenherrscher', Daemonenhorn: 'Dämonenhorn',
  Daemonenklinge: 'Dämonenklinge', Daemonenkrone: 'Dämonenkrone', Daemonenschloss: 'Dämonenschloss',
  Daemonenstab: 'Dämonenstab', Drachentoeter: 'Drachentöter', Durchlaeufe: 'Durchläufe',
  Eisruestung: 'Eisrüstung', Endlaeufer: 'Endläufer', Enthaelt: 'Enthält',
  Entzuendung: 'Entzündung', Entzuendungs: 'Entzündungs', Entzuendungschance: 'Entzündungschance',
  Entzuendungsdauer: 'Entzündungsdauer', Entzuendungsraub: 'Entzündungsraub', Entzuendungsschaden: 'Entzündungsschaden',
  Erhoeht: 'Erhöht', ERHOEHT: 'ERHÖHT', Erholungsverstaerkung: 'Erholungsverstärkung', Ermoeglicht: 'Ermöglicht',
  Faehigkeiten: 'Fähigkeiten', Faehigkeitenbaum: 'Fähigkeitenbaum', Faeuste: 'Fäuste',
  Gebruell: 'Gebrüll', Gegenstaende: 'Gegenstände', Gegenstaenden: 'Gegenständen', Gewoehnliche: 'Gewöhnliche',
  Gifttraeger: 'Giftträger', Goblinkoenig: 'Goblinkönig', Goetter: 'Götter',
  Goettergeschwindigkeit: 'Göttergeschwindigkeit', Goettertoeter: 'Göttertöter', Goettliche: 'Göttliche',
  Goettlicher: 'Göttlicher', Guertel: 'Gürtel', Guetern: 'Gütern',
  Hoehere: 'Höhere', Hoeherer: 'Höherer', Hoehle: 'Höhle', Hoehlen: 'Höhlen',
  Hoellenfeuer: 'Höllenfeuer', Hoellenhund: 'Höllenhund', Hoellenlaeufer: 'Höllenläufer', Hoellenplatte: 'Höllenplatte',
  Hoellenritter: 'Höllenritter', Hoellenrubin: 'Höllenrubin', Hoellenruestung: 'Höllenrüstung',
  Hoellentor: 'Höllentor', Hoellische: 'Höllische', Kaeufe: 'Käufe', Klassenfaehigkeit: 'Klassenfähigkeit',
  Koenigskrone: 'Königskrone', Koerper: 'Körper', Kriegsfuerst: 'Kriegsfürst', Leerenruestung: 'Leerenrüstung',
  Loeschen: 'Löschen', Loest: 'Löst', Maechtige: 'Mächtige', Moechtest: 'Möchtest',
  Nachtueberfall: 'Nachtüberfall', Naechster: 'Nächster', Naechtliches: 'Nächtliches',
  Neuverteilungsgegenstaende: 'Neuverteilungsgegenstände', Praezisionsschlag: 'Präzisionsschlag',
  Qualitaet: 'Qualität', Qualitaets: 'Qualitäts', Raeuber: 'Räuber', Realitaet: 'Realität',
  Regulaere: 'Reguläre', Riesenguertel: 'Riesengürtel', Rueckzug: 'Rückzug', Ruestung: 'Rüstung',
  Schlaege: 'Schläge', Schluesselstein: 'Schlüsselstein', Schwertkaempfer: 'Schwertkämpfer',
  Stapelverstaerkung: 'Stapelverstärkung', Steinfluegel: 'Steinflügel', Tempelwaechter: 'Tempelwächter',
  Toedliche: 'Tödliche', Toedlicher: 'Tödlicher', Toedliches: 'Tödliches', Torwaechter: 'Torwächter',
  Unterwasserhoehle: 'Unterwasserhöhle', Verfuegbar: 'Verfügbar', Verstaerkung: 'Verstärkung',
  Vitalitaet: 'Vitalität', Vitalitaetsverstaerkung: 'Vitalitätsverstärkung', Vulkanruestung: 'Vulkanrüstung',
  Waechter: 'Wächter', Waehle: 'Wähle', Waldlaeufer: 'Waldläufer', Walkuere: 'Walküre',
  Widerstandsfaehiges: 'Widerstandsfähiges', Widerstandsverstaerkung: 'Widerstandsverstärkung',
  Windlaeufer: 'Windläufer', Wolkenruestung: 'Wolkenrüstung', Zerstoerung: 'Zerstörung',
  Zurueck: 'Zurück', Zuruecksetzen: 'Zurücksetzen', Zurueckziehen: 'Zurückziehen',
  abhaengig: 'abhängig', beschuetzt: 'beschützt', bestaetigen: 'bestätigen',
  entzuendet: 'entzündet', entzuendeter: 'entzündeter', erhoehen: 'erhöhen', erhoehte: 'erhöhte',
  fuehrt: 'führt', fuer: 'für', gefaehrlicher: 'gefährlicher', gluehend: 'glühend',
  haeufigsten: 'häufigsten', hoechste: 'höchste', koennen: 'können', legendaeres: 'legendäres',
  loeschen: 'löschen', loest: 'löst', maechtige: 'mächtige', maechtigen: 'mächtigen', maechtigsten: 'mächtigsten',
  mysterioese: 'mysteriöse', naechsten: 'nächsten', oeffnen: 'öffnen', rueckgaengig: 'rückgängig',
  spaeter: 'später', staerker: 'stärker', ueber: 'über', uebertraegt: 'überträgt',
  unerwuenschte: 'unerwünschte', verfuegbar: 'verfügbar', verstaerkte: 'verstärkte',
  waehlen: 'wählen', zurueck: 'zurück', zurueckziehen: 'zurückziehen',
};

// 正当な綴り（残存チェックでの除外）
const KEEP = new Set([
  'value', 'Abenteuer', 'Feuer', 'Feuerdisziplin', 'Feuerdrache', 'Feuerdrachen', 'Feuerkreaturen',
  'Feuerrubin', 'Feuertraining', 'Dauer', 'Branddauer', 'Frostdauer', 'Einfrierdauer', 'dauerhaft',
  'Mauer', 'Stahlmauer', 'Quelle', 'Neue', 'Neuen', 'Neues', 'neue', 'neuen', 'lauern', 'manuell',
  'Phoenix', 'Klaue', 'Drachenklauen', 'Aktuell', 'Aktueller', 'auszubauen',
]);

const entries = Object.entries(MAP).sort((a, b) => b[0].length - a[0].length);
const counts: Record<string, number> = {};

function fixStr(s: string): string {
  let out = s;
  for (const [wrong, right] of entries) {
    const re = new RegExp(`(?<![\\p{L}])${wrong}(?![\\p{L}])`, 'gu');
    out = out.replace(re, () => {
      counts[wrong] = (counts[wrong] || 0) + 1;
      return right;
    });
  }
  return out;
}

function walk(o: any): any {
  if (typeof o === 'string') return fixStr(o);
  if (Array.isArray(o)) return o.map(walk);
  if (o && typeof o === 'object') {
    const r: any = {};
    for (const k in o) r[k] = walk(o[k]);
    return r;
  }
  return o;
}

const raw = fs.readFileSync(FILE, 'utf8');
const fixed = walk(JSON.parse(raw));
const output = JSON.stringify(fixed, null, 2) + '\n';

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`置換 ${total}件 / ${Object.keys(counts).length}語\n`);
for (const [w, c] of Object.entries(counts).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(c).padStart(3)}  ${w} → ${MAP[w]}`);

// 残存チェック（KEEP以外で ae/oe/ue が残っている語を警告）
const vals: string[] = [];
const collect = (o: any) => { for (const k in o) { const v = o[k]; if (typeof v === 'string') vals.push(v); else if (v && typeof v === 'object') collect(v); } };
collect(fixed);
const remaining = new Set<string>();
for (const w of vals.join(' ').match(/[A-Za-zÄÖÜäöüß]+/g) || [])
  if (/(ae|oe|ue|Ae|Oe|Ue|AE|OE|UE)/.test(w) && !KEEP.has(w)) remaining.add(w);
if (remaining.size) {
  console.log(`\n⚠️ 未処理の候補（要確認・正当な綴りなら無視）:\n  ${[...remaining].sort().join(', ')}`);
}

if (DRY) { console.log('\n(--dry: ファイルは変更していません)'); }
else { fs.writeFileSync(FILE, output, 'utf8'); console.log(`\n✅ ${FILE} を更新`); }
