import { PDFDocument } from 'pdf-lib';
import type { PdfDoc } from './types';

/** Formatte une liste de pages triées en libellé compact : [1,2,3,5] → "1-3,5". */
export function pagesLabel(pages: number[]): string {
  const s = [...pages].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < s.length) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(i === j ? `${s[i]}` : `${s[i]}-${s[j]}`);
    i = j + 1;
  }
  return parts.join(',');
}

/** Taille lisible : « 1,2 Mo », « 340 Ko », « 512 o ». */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' Ko';
  return bytes + ' o';
}

/** Nom du fichier produit, ex. « dossier-pages-1,3.pdf ». */
export function pagesFileName(doc: PdfDoc, pages: number[]): string {
  const base = doc.name.replace(/\.pdf$/i, '');
  return `${base}-pages-${pagesLabel([...new Set(pages)].sort((a, b) => a - b))}.pdf`;
}

/**
 * Assemble les pages choisies (numéros 1-indexés) en un nouveau PDF et renvoie
 * ses octets. Texte et images sont copiés tels quels (aucune rasterisation).
 */
export async function buildPagesPdf(doc: PdfDoc, pages: number[]): Promise<Uint8Array> {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const bytes = new Uint8Array(await doc.file.arrayBuffer());
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, sorted.map((n) => n - 1));
  copied.forEach((p) => out.addPage(p));
  return out.save();
}

/** Déclenche le téléchargement d'octets PDF sous un nom donné. */
export function downloadPdf(name: string, bytes: Uint8Array) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
