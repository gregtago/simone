/**
 * Remise du texte « au fil ».
 *
 * L'OCR comme la couche texte des PDF restituent la MISE EN PAGE : une ligne de
 * sortie par ligne imprimée. Or seul le texte nous intéresse. Un mot coupé en
 * fin de ligne doit être recollé (« esca- » + « lier » → « escalier ») et les
 * retours à la ligne de justification doivent redevenir de simples espaces.
 *
 * Ce module ne conserve que ce qui relève du texte et non de la page :
 * les alinéas (lignes vides) et les puces / numéros d'énumération.
 */

/** Traits d'union susceptibles de couper un mot en fin de ligne. */
const HYPHEN = '\\u002D\\u2010-\\u2013';
const HYPHEN_RE = new RegExp(`[${HYPHEN}]`, 'u');
/** Caractères qui composent un mot (apostrophes et traits d'union inclus). */
const WORD_CHARS = `\\p{L}\\p{N}\\u2019'${HYPHEN}`;
const WORD_RE = new RegExp(`[${WORD_CHARS}]`, 'u');
/** Fin de ligne coupée : « …esca- » */
const CUT_RE = new RegExp(`([${WORD_CHARS}]*[\\p{L}\\p{N}])[${HYPHEN}]$`, 'u');
/** Même coupure, mais recollée par l'OCR avec une espace : « esca- lier » */
const CUT_INLINE_RE = new RegExp(
  `([${WORD_CHARS}]*[\\p{L}\\p{N}])([${HYPHEN}])[ \\t]+(?=([\\p{Ll}\\p{N}][\\p{L}\\p{N}\\u2019']*))`,
  'gu',
);

/**
 * Mots qui, placés AVANT le trait d'union, le gardent : ce sont des composés,
 * pas des coupures (« sous- » + « sol » → « sous-sol »).
 *
 * Liste volontairement courte : on n'y met que les cas où le trait d'union est
 * quasi certain. Un préfixe qui est aussi une syllabe courante (co-, au-,
 * entre-, auto-…) n'y figure PAS — « co- » + « propriété » doit bien donner
 * « copropriété ». Dans le doute, on recolle : la coupure typographique est de
 * loin le cas le plus fréquent dans un acte scanné.
 */
const KEEP_BEFORE = new Set([
  'sous', 'sus', 'avant', 'apres', 'arriere', 'contre', 'demi', 'semi', 'quasi',
  'vice', 'grand', 'grands', 'petit', 'petits', 'belle', 'beau', 'porte', 'garde',
  'chef', 'rez', 'lieu', 'proces', 'compte', 'tout', 'nord', 'sud',
  'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'vingt', 'vingts', 'trente', 'quarante', 'cinquante', 'soixante',
  'cent', 'cents', 'mille',
]);

/**
 * Mots qui, placés APRÈS le trait d'union, le gardent : pronoms enclitiques et
 * seconds éléments de composés fréquents (« celui- » + « ci », « plus- » +
 * « value », « procès- » + « verbal »).
 */
const KEEP_AFTER = new Set([
  'ci', 'la', 'il', 'ils', 'elle', 'elles', 'on', 'je', 'tu', 'nous', 'vous',
  'moi', 'toi', 'lui', 'leur', 'leurs', 'le', 'les', 'y', 'en', 'ce', 't',
  'meme', 'memes', 'dessus', 'dessous', 'dela', 'deca', 'dedans', 'dehors',
  'bas', 'value', 'values', 'verbal', 'verbaux', 'dit', 'dite', 'dits', 'dites',
  'lieu', 'major', 'jacent', 'jacente', 'chaussee',
]);

/** Minuscules sans accents, pour comparer aux listes ci-dessus. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Puce ou numéro d'énumération : c'est du texte, pas de la mise en page. */
function isListItem(line: string): boolean {
  return /^([•‣▪●·*]|[-‐-―][ \t]|\d{1,3}[.)°][ \t]|[a-z][.)][ \t])/u.test(line);
}

/** Le mot (éventuellement composé) qui précède la coupure, ou null. */
function tokenBefore(line: string): string | null {
  return line.match(CUT_RE)?.[1] ?? null;
}

/** Le premier mot de ce qui suit la coupure. */
function wordAfter(s: string): string {
  return s.match(/^[\p{L}\p{N}’']+/u)?.[0] ?? '';
}

/** Faut-il conserver le trait d'union entre `token` et ce qui suit ? */
function keepsHyphen(token: string, next: string): boolean {
  const head = wordAfter(next);
  if (!head) return true; // rien d'exploitable après : on ne touche à rien
  // Article L. 121-1, lot n° 3-2… : jamais une coupure de mot.
  if (/\p{N}$/u.test(token) || /^\p{N}/u.test(head)) return true;
  // Composé déjà entamé : « rez-de- » + « chaussée ».
  if (HYPHEN_RE.test(token)) return true;
  // Nom propre composé : « Saint- » + « Denis ». Sans effet dans un passage
  // tout en capitales, où la majuscule ne signifie plus rien.
  const allCaps = /\p{L}/u.test(token) && token === token.toUpperCase();
  if (!allCaps && /^\p{Lu}/u.test(head)) return true;
  const tail = fold(token.split(HYPHEN_RE).pop() ?? '');
  return KEEP_BEFORE.has(tail) || KEEP_AFTER.has(fold(head));
}

/** Recolle deux lignes successives d'un même paragraphe. */
function joinLines(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;

  const token = tokenBefore(left);
  if (token) {
    // Le trait d'union disparaît si c'était une coupure de fin de ligne.
    return keepsHyphen(token, right) ? left + right : left.slice(0, -1) + right;
  }

  // Élision coupée par la ligne : « l’ » + « appartement ».
  if (/[’']$/.test(left) && WORD_RE.test(right[0])) return left + right;
  // Ponctuation qui ne prend pas d'espace devant. L'usage français en met une
  // devant « ; : ! ? » et les guillemets : on les laisse au traitement normal.
  if (/^[,.…)\]}]/.test(right)) return left + right;
  if (/[«([{]$/.test(left)) return left + right;
  return `${left} ${right}`;
}

/** Nettoyages de fin : espaces parasites laissés par l'OCR. */
function polish(text: string): string {
  return text
    .replace(CUT_INLINE_RE, (_m, token: string, hyphen: string, next: string) =>
      keepsHyphen(token, next) ? `${token}${hyphen}` : token,
    )
    .replace(/[ \t]{2,}/g, ' ')
    // « l' appartement », « d' un » : l'élision ne prend pas d'espace.
    .replace(/\b(l|d|n|s|c|j|m|t|qu)([’'])[ \t]+(?=\p{L})/giu, '$1$2')
    .replace(/[ \t]+([,.…)\]}])/g, '$1')
    .replace(/([«([{])[ \t]+/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/** Un paragraphe : ses lignes redeviennent du texte continu. */
function reflowParagraph(block: string): string {
  const lines = block
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return '';

  let out = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Une énumération reste une énumération : on ne la fond pas dans le flux.
    if (isListItem(line)) out += `\n${line}`;
    else out = joinLines(out, line);
  }
  return polish(out);
}

/**
 * Restitue `raw` sans la mise en page : mots coupés recollés, lignes fondues en
 * texte continu. Seuls les alinéas (lignes vides) survivent, sous forme de
 * paragraphes séparés par une ligne blanche.
 */
export function reflow(raw: string): string {
  if (!raw) return '';
  const clean = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00AD/g, '') // trait d'union conditionnel : bruit pur
    .replace(/[\u00A0\u202F\u2007]/g, ' ') // espaces insécables
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // caractères de largeur nulle

  return clean
    .split(/\n[ \t]*\n+/)
    .map(reflowParagraph)
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Variante sans aucun retour à la ligne : tout le passage sur une seule ligne.
 * Utile quand le texte est destiné à un champ qui n'en accepte pas (fiche
 * répertoire, clause d'un acte).
 */
export function reflowFlat(raw: string): string {
  return reflow(raw).replace(/\s*\n+\s*/g, ' ').trim();
}
