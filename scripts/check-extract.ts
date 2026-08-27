// Contrôle de l'assemblage du texte natif (src/lib/extract.ts).
//   npm run check:extract
//
// Les jeux d'essai sont de VRAIES couches texte, relevées telles que pdf.js les
// rend : un alinéa justifié et un alinéa au fer produits par Chromium, une
// ligne justifiée en écartant les lettres, une autre en écartant les mots.
// Aucun PDF à lire ici : seuls comptent les fragments et leur position.
import { looksLikeText, textLayerInRect } from '../src/lib/extract.ts';

interface Item {
  str: string;
  width: number;
  transform: number[];
}

const SCALE = 1.5;
const HEIGHT = 842; // A4, en points

/** Alinéa justifié, puis un second, puis le même alinéa au fer à gauche. */
const justifie: Item[] = [
  { str: "Le prix de la présente vente est de DEUX CENT MILLE EUROS (200.000,00 EUR), payable", width: 441.74, transform: [10.99, 0, 0, 10.99, 76.5, 755.67] },
  { str: "comptant ce jour, ainsi que les parties le reconnaissent, à la comptabilité de l'office notarial", width: 441.74, transform: [10.99, 0, 0, 10.99, 76.5, 742.92] },
  { str: "soussigné, quittance en étant donnée par le vendeur à l'acquéreur qui l'accepte.", width: 344.88, transform: [10.99, 0, 0, 10.99, 76.5, 730.17] },
  { str: "L'immeuble est un appartement situé au rez-de-chaussée de l'escalier B, comprenant une entrée, un", width: 441.75, transform: [10.99, 0, 0, 10.99, 76.5, 706.17] },
  { str: "séjour, deux chambres, une cuisine, une salle de bains et des water-closets, avec les lots numéros 42", width: 441.74, transform: [10.99, 0, 0, 10.99, 76.5, 693.42] },
  { str: "et 118 de l'état descriptif de division.", width: 161.83, transform: [10.99, 0, 0, 10.99, 76.5, 680.67] },
];

/** Exposants (« Me », « 1er ») et mot en gras : pdf.js coupe le fil du texte. */
const exposants: Item[] = [
  { str: "Aux termes d'un acte reçu par M", width: 145.78, transform: [10.99, 0, 0, 10.99, 76.5, 752.75] },
  { str: "e", width: 4.07, transform: [9.16, 0, 0, 9.16, 222.28, 757.17] },
  { str: "DUPONT le 1", width: 64.03, transform: [10.99, 0, 0, 10.99, 229.47, 752.75] },
  { str: "er", width: 7.12, transform: [9.16, 0, 0, 9.16, 293.51, 757.17] },
  { str: "mars 2019, le vendeur a acquis le lot numéro 42", width: 214.51, transform: [10.99, 0, 0, 10.99, 303.74, 752.75] },
  { str: "moyennant le prix de", width: 93.1, transform: [10.99, 0, 0, 10.99, 76.5, 739.92] },
  { str: "CENT MILLE EUROS", width: 110.36, transform: [10.99, 0, 0, 10.99, 172.36, 739.92] },
  { str: "payé comptant.", width: 67.15, transform: [10.99, 0, 0, 10.99, 285.47, 739.92] },
];

/** Ligne justifiée en écartant les LETTRES : pdf.js ne rend que des lettres. */
const interlettrage: Item[] = [
  { str: "L e", width: 15.34, transform: [12, 0, 0, 12, 60, 700] },
  { str: "p r i x", width: 25.33, transform: [12, 0, 0, 12, 82.68, 700] },
  { str: "d e", width: 15.34, transform: [12, 0, 0, 12, 115.35, 700] },
  { str: "l a", width: 11.34, transform: [12, 0, 0, 12, 138.03, 700] },
  { str: "p r e s e n t e", width: 60.69, transform: [12, 0, 0, 12, 156.7, 700] },
  { str: "v e n t e", width: 37.35, transform: [12, 0, 0, 12, 224.73, 700] },
];

/** Ligne justifiée en écartant les MOTS : un fragment par mot, sans espace. */
const motsEcartes: Item[] = [
  { str: "Le", width: 13.34, transform: [12, 0, 0, 12, 60, 700] },
  { str: "prix", width: 19.33, transform: [12, 0, 0, 12, 90.14, 700] },
  { str: "de", width: 13.34, transform: [12, 0, 0, 12, 126.28, 700] },
  { str: "la", width: 9.34, transform: [12, 0, 0, 12, 156.42, 700] },
  { str: "presente", width: 46.69, transform: [12, 0, 0, 12, 182.56, 700] },
  { str: "vente", width: 29.35, transform: [12, 0, 0, 12, 246.05, 700] },
];

const viewport = {
  scale: SCALE,
  transform: [SCALE, 0, 0, -SCALE, 0, HEIGHT * SCALE],
};

/** Boîte englobant les fragments choisis, élargie du rayon du surligneur. */
function box(items: Item[], keep: (i: Item) => boolean = () => true) {
  const r = 11; // BRUSH / 2, cf. PageView
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of items.filter(keep)) {
    const size = it.transform[3] * SCALE;
    const base = (HEIGHT - it.transform[5]) * SCALE;
    x0 = Math.min(x0, it.transform[4] * SCALE);
    x1 = Math.max(x1, (it.transform[4] + it.width) * SCALE);
    y0 = Math.min(y0, base - size);
    y1 = Math.max(y1, base);
  }
  return { x: x0 - r, y: y0 - 2, w: x1 - x0 + 2 * r, h: y1 - y0 + 2 };
}

/** Trait passé sur une portion de la première ligne, entre deux abscisses. */
function stroke(items: Item[], xa: number, xb: number) {
  const size = items[0].transform[3] * SCALE;
  const base = (HEIGHT - items[0].transform[5]) * SCALE;
  return { x: xa - 11, y: base - size * 0.8, w: xb - xa + 22, h: size };
}

const run = (items: Item[], rect: { x: number; y: number; w: number; h: number }) =>
  textLayerInRect({ items } as never, viewport as never, rect);

const alinea1 = (i: Item) => i.transform[5] > 720;

const CASES: [string, string, string][] = [
  // Le fil du texte, coupé par pdf.js à chaque exposant ou passage en gras,
  // doit se recoller sans semer d'espaces : « M e » , « 1 er ».
  ['exposants et gras', run(exposants, box(exposants)),
    "Aux termes d'un acte reçu par Me DUPONT le 1er mars 2019, le vendeur a acquis le lot numéro 42\nmoyennant le prix de CENT MILLE EUROS payé comptant."],

  // Alinéa justifié pris en entier : une ligne de sortie par ligne imprimée.
  ['alinéa justifié entier', run(justifie, box(justifie, alinea1)),
    "Le prix de la présente vente est de DEUX CENT MILLE EUROS (200.000,00 EUR), payable\ncomptant ce jour, ainsi que les parties le reconnaissent, à la comptabilité de l'office notarial\nsoussigné, quittance en étant donnée par le vendeur à l'acquéreur qui l'accepte."],

  // Quelques mots surlignés au milieu d'une ligne justifiée : pdf.js rend la
  // ligne entière en un seul fragment, il faut n'en garder que ces mots-là.
  // Les abscisses viennent de la position réelle des glyphes dans le PDF.
  ['portion de ligne justifiée', run(justifie, stroke(justifie, 367.7, 581.9)),
    'DEUX CENT MILLE EUROS'],
  ['portion, autre passage', run(justifie, stroke(justifie, 214.7, 312.4)),
    'présente vente'],

  // Justification par écartement des lettres, puis des mots.
  ['justifié par les lettres', run(interlettrage, box(interlettrage)),
    'Le prix de la presente vente'],
  ['justifié par les mots', run(motsEcartes, box(motsEcartes)),
    'Le prix de la presente vente'],
];

let failed = 0;
for (const [name, got, expected] of CASES) {
  if (got !== expected) {
    failed++;
    console.error(`✗ ${name}\n  obtenu  ${JSON.stringify(got)}\n  attendu ${JSON.stringify(expected)}`);
  }
}

// La couche texte irrécupérable doit renvoyer à l'OCR de l'image.
const verdicts: [string, boolean][] = [
  ['Le prix de la présente vente est de deux cent mille euros', true],
  ['lot numéro 42', true],
  ['L e p r i x d e l a p r e s e n t e v e n t e', false],
  ['', false],
];
for (const [text, expected] of verdicts) {
  if (looksLikeText(text) !== expected) {
    failed++;
    console.error(`✗ looksLikeText(${JSON.stringify(text)}) → ${!expected}`);
  }
}

if (failed) {
  console.error(`\n${failed} cas en échec.`);
  process.exit(1);
}
console.log(`✓ ${CASES.length + verdicts.length} cas d'assemblage vérifiés.`);
