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

function download(name: string, bytes: Uint8Array) {
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

/**
 * Assemble les pages choisies (numéros 1-indexés) en un nouveau PDF et le
 * télécharge. Texte et images sont copiés tels quels (aucune rasterisation).
 */
export async function extractPagesToPdf(doc: PdfDoc, pages: number[]): Promise<void> {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  if (sorted.length === 0) return;

  const bytes = new Uint8Array(await doc.file.arrayBuffer());
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, sorted.map((n) => n - 1));
  copied.forEach((p) => out.addPage(p));
  const outBytes = await out.save();

  const base = doc.name.replace(/\.pdf$/i, '');
  download(`${base}-pages-${pagesLabel(sorted)}.pdf`, outBytes);
}
