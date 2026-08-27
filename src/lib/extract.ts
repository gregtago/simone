import type { PageViewport } from 'pdfjs-dist';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';
import type { Rect } from './types';

/** Un fragment de texte replacé dans le repère du canvas rendu. */
interface Placed {
  /** Bord gauche et bord droit du fragment. */
  x: number;
  right: number;
  /** Ligne de base et corps de la police. */
  base: number;
  size: number;
  str: string;
}

/** En deçà de cette part de sa hauteur couverte, la ligne n'est qu'effleurée. */
const MIN_COVER_V = 0.35;
/** Idem horizontalement, mais mot par mot : on ne prend pas un mot frôlé. */
const MIN_COVER_H = 0.5;
/**
 * Écart, en cadratins, à partir duquel deux fragments voisins sont séparés par
 * une espace.
 *
 * pdf.js coupe un fragment à chaque changement de police, de graisse ou de
 * corps — un exposant, un mot en gras — SANS restituer l'espace : seul l'écart
 * mesuré dit s'il y en avait une. Recoller à l'aveugle avec une espace donne
 * « M e DUPONT », « 1 er mars » ; recoller sans en donner aucune souderait les
 * mots. Au-dessus de 0,102 cadratin pdf.js aurait inséré l'espace lui-même, en
 * dessous c'est du crénage : le seuil se place entre les deux.
 */
const SPACE_GAP = 0.16;

/**
 * Assemble le texte de la couche native du PDF qui tombe sous le rectangle.
 * Retourne '' si la zone ne contient aucun texte sélectionnable (PDF scanné) —
 * l'appelant bascule alors sur l'OCR.
 */
export function textLayerInRect(
  textContent: TextContent,
  viewport: PageViewport,
  rect: Rect,
): string {
  const scale = viewport.scale;
  const x0 = rect.x;
  const x1 = rect.x + rect.w;
  const y0 = rect.y;
  const y1 = rect.y + rect.h;
  const placed: Placed[] = [];

  for (const item of textContent.items) {
    // Les fragments vides (fins de ligne) et les espaces que pdf.js insère
    // entre deux mots écartés n'apportent rien : l'écart mesuré les remplace.
    if (!('str' in item) || !item.str.trim()) continue;

    // Position de l'item dans le repère du canvas rendu.
    const tx = transform(viewport.transform as number[], item.transform);
    const size = Math.hypot(tx[2], tx[3]);
    const base = tx[5]; // ligne de base
    const top = base - size;
    const x = tx[4];
    const right = x + item.width * scale;

    // On garde l'item si une part significative de sa hauteur est couverte
    // (évite d'attraper la ligne du dessus juste frôlée par le bord du trait).
    if ((Math.min(base, y1) - Math.max(top, y0)) / Math.max(size, 1) < MIN_COVER_V) continue;

    // Un fragment porte souvent la ligne imprimée entière : on ne retient que
    // les mots réellement sous le trait, sans quoi surligner trois mots au
    // milieu d'un alinéa justifié rendrait toute la ligne.
    const cut = clipToRect({ x, right, base, size, str: item.str }, x0, x1);
    if (cut) placed.push(cut);
  }

  if (placed.length === 0) return '';

  // Reconstruction de l'ordre de lecture : on regroupe par lignes puis on trie
  // chaque ligne de gauche à droite. Le regroupement se fait sur la LIGNE DE
  // BASE, seule commune à tous les corps d'une même ligne : un exposant
  // (« 1er », « Me ») ou un mot en gros caractères y reste rattaché.
  placed.sort((a, b) => a.base - b.base || a.x - b.x);
  const tol = medianSize(placed) * 0.5;

  const lines: Placed[][] = [];
  let current: Placed[] = [];
  let lineBase = placed[0].base;

  for (const p of placed) {
    if (current.length && Math.abs(p.base - lineBase) > tol) {
      lines.push(current);
      current = [];
    }
    if (!current.length) lineBase = p.base;
    current.push(p);
  }
  if (current.length) lines.push(current);

  return lines.map(joinLine).filter(Boolean).join('\n').trim();
}

/**
 * Recolle les fragments d'une ligne. L'espace entre deux fragments est déduite
 * de l'écart qui les sépare, jamais supposée.
 */
function joinLine(parts: Placed[]): string {
  parts.sort((a, b) => a.x - b.x);
  const frags = unspace(parts);

  let out = frags[0];
  for (let i = 1; i < parts.length; i++) {
    const gap = parts[i].x - parts[i - 1].right;
    const size = Math.max(parts[i].size, parts[i - 1].size) || 1;
    const spaced = /\s$/.test(out) || /^\s/.test(frags[i]) || gap >= size * SPACE_GAP;
    out += (spaced ? ' ' : '') + frags[i];
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Un fragment tout en lettres isolées : « L e », « p r é s e n t e ». */
const SPACED_OUT = /^[\p{L}\p{N}’'](?: [\p{L}\p{N}’'])+$/u;

/**
 * Certains documents justifient en écartant les LETTRES et non les mots ; la
 * couche texte rend alors « L e p r i x d e l a v e n t e ». On resserre les
 * fragments concernés, mais seulement si la ligne en porte la marque nette
 * (un fragment d'au moins quatre lettres isolées, ou deux fragments) — sans
 * quoi une colonne de « A B C » serait soudée à tort.
 */
function unspace(parts: Placed[]): string[] {
  // Seuls des MOTS ainsi éclatés font foi : une colonne de chiffres isolés
  // n'est pas de l'interlettrage. Le resserrement, lui, s'applique ensuite à
  // toute la ligne, chiffres compris.
  const hits = parts.filter((p) => SPACED_OUT.test(p.str) && /\p{L}/u.test(p.str));
  if (!hits.some((p) => p.str.length >= 7) && hits.length < 2) return parts.map((p) => p.str);
  return parts.map((p) => (SPACED_OUT.test(p.str) ? p.str.replace(/ /g, '') : p.str));
}

/**
 * Ne conserve du fragment que les mots couverts par la zone. pdf.js ne donne
 * pas la position de chaque lettre : on la répartit sur la largeur du fragment
 * en pondérant les caractères (un « i » n'occupe pas la place d'un « M »), puis
 * on arrondit au mot pour ne jamais couper un mot en deux.
 */
function clipToRect(p: Placed, x0: number, x1: number): Placed | null {
  if (p.right <= x0 || p.x >= x1) return null;
  if (p.x >= x0 && p.right <= x1) return p;

  const edges = charEdges(p.str, p.x, p.right, p.size);
  let first = -1;
  let last = -1;
  const word = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = word.exec(p.str))) {
    const a = m.index;
    const b = a + m[0].length;
    const width = edges[b] - edges[a];
    const covered = Math.min(edges[b], x1) - Math.max(edges[a], x0);
    if (width > 0 && covered / width < MIN_COVER_H) continue;
    if (first < 0) first = a;
    last = b;
  }
  if (first < 0) return null;

  return { ...p, x: edges[first], right: edges[last], str: p.str.slice(first, last) };
}

/**
 * Bord gauche de chaque caractère du fragment (et bord droit du dernier).
 *
 * On ne connaît que les deux bords du fragment : la place des lettres est
 * reconstituée à partir de leur chasse. Si le fragment est plus large que la
 * somme des chasses, c'est qu'il est justifié — et la justification écarte les
 * MOTS, pas les lettres : le surplus va sur les espaces. Sinon (police plus
 * étroite que le barème), on ajuste l'échelle sur toute la ligne.
 */
function charEdges(str: string, x: number, right: number, size: number): number[] {
  // Indexé comme la chaîne elle-même, pour que `edges[i]` réponde toujours à
  // `str[i]` — c'est sur ces indices que la découpe au mot travaille.
  const widths: number[] = [];
  let natural = 0;
  let spaces = 0;
  for (let i = 0; i < str.length; i++) {
    const w = (charWidth(str[i]) / 1000) * size;
    widths.push(w);
    natural += w;
    if (str[i] === ' ') spaces++;
  }

  const span = right - x;
  const extra = span > natural && spaces ? (span - natural) / spaces : 0;
  const factor = extra ? 1 : span / (natural || 1);

  const edges = [x];
  let acc = x;
  for (let i = 0; i < str.length; i++) {
    acc += widths[i] * factor + (str[i] === ' ' ? extra : 0);
    edges.push(acc);
  }
  return edges;
}

/**
 * Chasse approchée d'un caractère, en millièmes de cadratin : la moyenne des
 * chasses réelles du Times et de l'Helvetica, qui encadrent les polices d'un
 * acte. Un « i » n'occupe pas la place d'un « M » — répartir la largeur du
 * fragment à parts égales décalerait la coupe de plusieurs lettres.
 */
const WIDTHS: [number, string][] = [
  [250, "ijl'"],
  [280, ' ,.\u2019/:;\u2018îït'],
  [320, '![]fIr()-'],
  [380, '"'],
  [440, '*sJ'],
  [470, 'çcz'],
  [500, '?àâèéêëaekvxy'],
  [530, '0123456789#$_«»–ôùûübdghnopqu'],
  [580, '+FL'],
  [610, 'PSTZ'],
  [640, 'ÉE'],
  [670, 'B'],
  [690, 'ÀÇACKRVXY'],
  [720, '&wDHNU'],
  [750, 'GOQ'],
  [810, 'm'],
  [830, 'œ'],
  [860, '%M'],
  [940, 'W'],
  [970, '@'],
  [1000, '—…'],
];

const CHAR_WIDTH = new Map<string, number>();
for (const [w, chars] of WIDTHS) for (const c of chars) CHAR_WIDTH.set(c, w);

function charWidth(c: string): number {
  return CHAR_WIDTH.get(c) ?? (c === c.toUpperCase() && c !== c.toLowerCase() ? 690 : 530);
}

function medianSize(placed: Placed[]): number {
  const sizes = placed.map((p) => p.size).sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)] || 12;
}

/**
 * Produit de deux matrices affines `[a b c d e f]` — même calcul que
 * `pdfjsLib.Util.transform`, repris ici pour que ce module reste testable hors
 * navigateur (le module `./pdf` charge le worker pdf.js).
 */
function transform(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * Découpe la zone du canvas rendu vers un nouveau canvas, agrandi, prêt pour
 * l'OCR. L'agrandissement aide Tesseract sur les petits caractères.
 */
export function cropRegion(source: HTMLCanvasElement, rect: Rect, upscale = 2): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(rect.w * upscale));
  c.height = Math.max(1, Math.round(rect.h * upscale));
  const ctx = c.getContext('2d')!;
  // Fond blanc : certaines zones transparentes gêneraient l'OCR.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, c.width, c.height);
  return c;
}

/**
 * Vrai si le texte extrait vaut la peine : au moins un caractère alphanumérique,
 * et une couche texte exploitable. Sinon l'appelant passe à l'OCR de l'image.
 */
export function looksLikeText(s: string): boolean {
  return /[\p{L}\p{N}]/u.test(s) && !looksScrambled(s);
}

/**
 * Couche texte inexploitable : presque tous les « mots » ne font qu'une lettre.
 * Quelques PDF (police sans table d'espaces, interlettrage extrême) ne rendent
 * que des lettres isolées, que rien ne permet de regrouper — l'OCR de l'image
 * fera mieux.
 */
function looksScrambled(s: string): boolean {
  const words = s.match(/[\p{L}\p{N}’'-]+/gu) ?? [];
  if (words.length < 8) return false;
  return words.filter((w) => w.length === 1).length / words.length > 0.6;
}
