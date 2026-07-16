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
export function pagesFileName(doc: PdfDoc, pages: number[], compress = false): string {
  const base = doc.name.replace(/\.pdf$/i, '');
  const label = pagesLabel([...new Set(pages)].sort((a, b) => a - b));
  return `${base}-pages-${label}${compress ? '-reduit' : ''}.pdf`;
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

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab))) : reject(new Error('toBlob null'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Version allégée : chaque page est rendue en image (JPEG, ~150 DPI) puis
 * réintégrée. Le fichier est bien plus léger sur des scans, MAIS le texte
 * n'est plus sélectionnable (la page devient une image).
 */
export async function buildCompressedPdf(
  doc: PdfDoc,
  pages: number[],
  dpi = 150,
  quality = 0.72,
): Promise<Uint8Array> {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const out = await PDFDocument.create();
  const scale = dpi / 72;
  for (const n of sorted) {
    const page = await doc.pdf.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const jpg = await canvasToJpeg(canvas, quality);
    const img = await out.embedJpg(jpg);
    const p = out.addPage([vp1.width, vp1.height]);
    p.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
  }
  return out.save();
}

/** Assemble les pages, avec ou sans réduction de poids. */
export function buildExtractPdf(doc: PdfDoc, pages: number[], compress: boolean): Promise<Uint8Array> {
  return compress ? buildCompressedPdf(doc, pages) : buildPagesPdf(doc, pages);
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
