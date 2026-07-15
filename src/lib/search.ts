import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjsLib } from './pdf';

// Repli 1:1 (préserve la longueur, donc les positions) : minuscules + accents.
const FOLD: Record<string, string> = {
  à: 'a', â: 'a', ä: 'a', á: 'a', ã: 'a',
  ç: 'c',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', î: 'i', ï: 'i', ì: 'i',
  ñ: 'n',
  ó: 'o', ô: 'o', ö: 'o', ò: 'o', õ: 'o',
  ú: 'u', û: 'u', ü: 'u', ù: 'u',
  ý: 'y', ÿ: 'y',
};

/** Minuscules + accents repliés, sans changer la longueur de la chaîne. */
export function fold(s: string): string {
  let out = '';
  for (const ch of s.toLowerCase()) out += FOLD[ch] ?? ch;
  return out;
}

interface Box {
  start: number;
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageIndex {
  text: string; // texte replié de la page (items séparés par une espace)
  boxes: Box[]; // géométrie des items en coordonnées scale=1
}

/** Construit l'index de recherche d'un document (une passe sur toutes les pages). */
export async function buildDocIndex(pdf: PDFDocumentProxy): Promise<PageIndex[]> {
  const pages: PageIndex[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    let text = '';
    const boxes: Box[] = [];
    for (const item of tc.items) {
      if (!('str' in item) || !item.str) continue;
      const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
      const fh = Math.hypot(tx[2], tx[3]);
      const x = tx[4];
      const y = tx[5] - fh; // haut
      const w = item.width; // vp.scale = 1
      const folded = fold(item.str);
      const start = text.length;
      text += folded + ' ';
      boxes.push({ start, end: start + folded.length, x, y, w, h: fh });
    }
    pages.push({ text, boxes });
  }
  return pages;
}

export interface MatchRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Match {
  page: number;
  rects: MatchRect[]; // en coordonnées scale=1
}

/** Cherche toutes les occurrences de `rawQuery` dans l'index. */
export function search(pages: PageIndex[], rawQuery: string): Match[] {
  const q = fold(rawQuery.trim());
  if (!q) return [];
  const matches: Match[] = [];
  pages.forEach((pg, i) => {
    let from = 0;
    for (;;) {
      const idx = pg.text.indexOf(q, from);
      if (idx < 0) break;
      const mEnd = idx + q.length;
      const rects: MatchRect[] = [];
      for (const b of pg.boxes) {
        if (b.start < mEnd && b.end > idx) {
          const len = b.end - b.start || 1;
          const a = Math.max(b.start, idx) - b.start;
          const c = Math.min(b.end, mEnd) - b.start;
          rects.push({ x: b.x + (a / len) * b.w, y: b.y, w: ((c - a) / len) * b.w, h: b.h });
        }
      }
      if (rects.length) matches.push({ page: i + 1, rects });
      from = idx + q.length;
    }
  });
  return matches;
}
