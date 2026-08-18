// Contrôle des heuristiques de remise au fil du texte (src/lib/reflow.ts).
// Ces règles reposent sur des cas de langue : elles méritent un filet.
//   npm run check:reflow
import { reflow, reflowFlat } from '../src/lib/reflow.ts';

const CASES: [string, string][] = [
  // Le cas qui motive tout : un mot coupé en fin de ligne.
  ['esca-\nlier', 'escalier'],
  ['esca- lier', 'escalier'], // coupure recollée par l'OCR avec une espace
  ['esca-\n  lier de service', 'escalier de service'],
  ['un bel esca-\nlier menant au\npremier étage.', 'un bel escalier menant au premier étage.'],
  ['ESCA-\nLIER', 'ESCALIER'],
  // Préfixes qui sont aussi des syllabes : on recolle.
  ['co-\npropriété', 'copropriété'],
  ['auto-\nmobile', 'automobile'],
  ['entre-\nprise', 'entreprise'],
  // Traits d'union légitimes : on les garde.
  ['sous-\nsol', 'sous-sol'],
  ['rez-de-\nchaussée', 'rez-de-chaussée'],
  ['plus-\nvalue', 'plus-value'],
  ['procès-\nverbal', 'procès-verbal'],
  ['avant-\ncontrat', 'avant-contrat'],
  ['quatre-\nvingts', 'quatre-vingts'],
  ['celui-\nci', 'celui-ci'],
  ['là-\ndessus', 'là-dessus'],
  ['dit-\nil', 'dit-il'],
  ['Saint-\nDenis', 'Saint-Denis'],
  ['article L. 121-\n1 du code', 'article L. 121-1 du code'],
  // Élisions et ponctuation.
  ["l’\nappartement", 'l’appartement'],
  ["l' appartement", "l'appartement"],
  ['le prix\n, payé comptant', 'le prix, payé comptant'],
  ['montant de 340,00\neuros', 'montant de 340,00 euros'],
  // Ce qui relève du texte survit : alinéas et énumérations.
  ['fonds de\nroulement\n\nprovision\nspéciale', 'fonds de roulement\n\nprovision spéciale'],
  ['Les lots suivants :\n- lot un\n- lot deux', 'Les lots suivants :\n- lot un\n- lot deux'],
  // Divers.
  ['un texte\r\nsur deux lignes', 'un texte sur deux lignes'],
  ['mot­coupé', 'motcoupé'],
  ['   ', ''],
  ['', ''],
];

let failed = 0;
for (const [input, expected] of CASES) {
  const got = reflow(input);
  if (got !== expected) {
    failed++;
    console.error(
      `✗ ${JSON.stringify(input)}\n  obtenu  ${JSON.stringify(got)}\n  attendu ${JSON.stringify(expected)}`,
    );
  }
}

const flat = reflowFlat('premier alinéa\nsuite\n\nsecond alinéa');
if (flat !== 'premier alinéa suite second alinéa') {
  failed++;
  console.error(`✗ reflowFlat → ${JSON.stringify(flat)}`);
}

if (failed) {
  console.error(`${failed} cas en échec sur ${CASES.length + 1}.`);
  process.exit(1);
}
console.log(`✓ ${CASES.length + 1} cas vérifiés.`);
