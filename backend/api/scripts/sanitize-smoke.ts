// Vérification manuelle de `src/lib/sanitizeHtml.ts` : `npx tsx scripts/sanitize-smoke.ts`
// Sort en code 1 si une attente n'est pas respectée.
import {
  LISTING_ARRIVAL_TEXT_RULES,
  LISTING_CORE_TEXT_RULES,
  sanitizePlainText,
  sanitizeRichText,
  sanitizeTextFields,
} from '../src/lib/sanitizeHtml.js';

type Case = { label: string; input: string; expect: string; mode?: 'rich' | 'plain' | 'plain-multiline' };

const cases: Case[] = [
  {
    label: 'img onerror retiré',
    input: '<p>Bonjour<img src="x" onerror="alert(1)"></p>',
    expect: '<p>Bonjour</p>',
  },
  {
    label: 'lien javascript: → href retiré, texte gardé',
    input: '<p><a href="javascript:alert(1)">clic</a></p>',
    expect: '<p><a>clic</a></p>',
  },
  {
    label: 'lien https avec target → _blank + rel',
    input: '<a href="https://indiehost.fr" target="_self" rel="x">site</a>',
    expect: '<a href="https://indiehost.fr" target="_blank" rel="noopener noreferrer">site</a>',
  },
  {
    label: 'lien relatif retiré, mailto gardé',
    input: '<a href="/admin">rel</a> <a href="mailto:a@b.fr">mail</a>',
    expect: '<a>rel</a> <a href="mailto:a@b.fr">mail</a>',
  },
  {
    label: 'liste Quill 2 conservée (data-list)',
    input: '<ol><li data-list="bullet">Un</li><li data-list="ordered">Deux</li></ol>',
    expect: '<ol><li data-list="bullet">Un</li><li data-list="ordered">Deux</li></ol>',
  },
  {
    label: 'classe ql-align-center gardée, class="evil" retirée',
    input: '<p class="ql-align-center evil">Centré</p><p class="evil">Plain</p>',
    expect: '<p class="ql-align-center">Centré</p><p>Plain</p>',
  },
  {
    label: 'style / id / on* retirés',
    input: '<p style="color:red" id="x" onclick="alert(1)"><strong data-foo="1">Gras</strong></p>',
    expect: '<p><strong>Gras</strong></p>',
  },
  {
    label: 'script et iframe supprimés avec leur contenu',
    input: '<p>Avant</p><script>alert(1)</script><iframe src="https://x"></iframe><p>Après</p>',
    expect: '<p>Avant</p><p>Après</p>',
  },
  {
    label: 'balise inconnue : contenu gardé, balise retirée',
    input: '<div><table><tr><td>cellule</td></tr></table><h2>Titre</h2></div>',
    expect: 'cellule<h2>Titre</h2>',
  },
  {
    label: 'texte brut : balises retirées, entités décodées, blancs normalisés',
    input: '  Caf&eacute; &amp; <b>th&#233;</b>\n\n <script>x</script> fin  ',
    expect: 'Café & thé fin',
    mode: 'plain',
  },
  {
    label: 'texte brut multiligne : blocs séparés, 2 sauts max',
    input: '<p>Un</p><p>Deux</p><br><br><br>Trois\u0000\u0007',
    expect: 'Un\nDeux\n\nTrois',
    mode: 'plain-multiline',
  },
  {
    label: 'texte brut : < littéral conservé, pas ré-échappé',
    input: 'a &lt; b &gt; c "d"',
    expect: 'a < b > c "d"',
    mode: 'plain',
  },
];

let failures = 0;
for (const testCase of cases) {
  const actual = testCase.mode === 'plain'
    ? sanitizePlainText(testCase.input)
    : testCase.mode === 'plain-multiline'
      ? sanitizePlainText(testCase.input, { multiline: true })
      : sanitizeRichText(testCase.input);
  const ok = actual === testCase.expect;
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${testCase.label}`);
  console.log(`      in : ${JSON.stringify(testCase.input)}`);
  console.log(`      out: ${JSON.stringify(actual)}`);
  if (!ok) console.log(`      exp: ${JSON.stringify(testCase.expect)}`);
}

// Règles par chemin sur une section d'annonce.
const core = sanitizeTextFields({
  title: '<b>Gîte</b> <script>x</script>du lac',
  description: '<p class="ql-align-right x">Texte</p><img src=x onerror=alert(1)>',
  rooms: [{ name: 'Chambre <i>1</i>', beds: 2 }],
  amenities: [{ id: 'wifi', name: 'Wi-Fi<svg onload=alert(1)>', description: null }],
  guest_capacity: 4,
}, LISTING_CORE_TEXT_RULES);
const coreOk = core.title === 'Gîte du lac'
  && core.description === '<p class="ql-align-right">Texte</p>'
  && core.rooms[0]?.name === 'Chambre 1'
  && core.amenities[0]?.name === 'Wi-Fi'
  && core.amenities[0]?.description === null
  && core.guest_capacity === 4;
if (!coreOk) failures += 1;
console.log(`${coreOk ? 'OK  ' : 'FAIL'} règles core (title/description/rooms.*.name/amenities.*.name)`);
console.log(`      out: ${JSON.stringify(core)}`);

const arrival = sanitizeTextFields({
  intro: { title: 'Bienvenue <u>chez nous</u>' },
  practical: {
    access: { wifi: 'code <b>1234</b>', checkIn: '16h' },
    rules: '<ul><li data-list="bullet">Pas de <em>fête</em></li></ul><style>p{}</style>',
  },
  guide: { content: '<h2 onclick="x()">Guide</h2>' },
}, LISTING_ARRIVAL_TEXT_RULES);
const arrivalOk = arrival.intro.title === 'Bienvenue chez nous'
  && arrival.practical.access.wifi === 'code 1234'
  && arrival.practical.rules === '<ul><li data-list="bullet">Pas de <em>fête</em></li></ul>'
  && arrival.guide.content === '<h2>Guide</h2>';
if (!arrivalOk) failures += 1;
console.log(`${arrivalOk ? 'OK  ' : 'FAIL'} règles arrival (intro plain, access.* plain, rules/guide rich)`);
console.log(`      out: ${JSON.stringify(arrival)}`);

// L'entrée n'est pas modifiée.
const original = { title: '<b>x</b>' };
sanitizeTextFields(original, LISTING_CORE_TEXT_RULES);
const pureOk = original.title === '<b>x</b>';
if (!pureOk) failures += 1;
console.log(`${pureOk ? 'OK  ' : 'FAIL'} sanitizeTextFields ne modifie pas l'entrée`);

console.log(failures ? `\n${failures} échec(s)` : '\nTout est conforme.');
process.exit(failures ? 1 : 0);
