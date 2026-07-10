import type { PDFPageProxy, PageViewport } from 'pdfjs-dist';
import type { Rect } from './types';

// L'OCR gagne surtout à travailler sur de vrais pixels nets. Plutôt que de
// recadrer le canvas d'affichage (déjà pixelisé) et de l'agrandir, on re-rend
// UNIQUEMENT la zone sélectionnée directement depuis le PDF, à haute résolution.

const TARGET_DPI = 300; // le point d'équilibre recommandé pour Tesseract
const MAX_DIM = 3500; // garde-fou mémoire pour les très grandes sélections

/**
 * Re-rend la zone `rect` (exprimée dans le repère du canvas d'affichage) à
 * ~300 DPI, dans un canvas hors-écran de la taille de la zone.
 */
export async function renderRegionForOcr(
  page: PDFPageProxy,
  displayViewport: PageViewport,
  rect: Rect,
): Promise<HTMLCanvasElement> {
  const displayScale = displayViewport.scale;
  let hiScale = TARGET_DPI / 72; // le PDF a une base de 72 points/pouce

  // Si la zone rendue dépasse le garde-fou, on réduit l'échelle.
  const predMax = (Math.max(rect.w, rect.h) / displayScale) * hiScale;
  if (predMax > MAX_DIM) hiScale *= MAX_DIM / predMax;

  const factor = hiScale / displayScale;
  const rx = rect.x * factor;
  const ry = rect.y * factor;
  const rw = Math.max(1, Math.round(rect.w * factor));
  const rh = Math.max(1, Math.round(rect.h * factor));

  const viewport = page.getViewport({ scale: hiScale });
  const canvas = document.createElement('canvas');
  canvas.width = rw;
  canvas.height = rh;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rw, rh);

  // On rend la page entière mais translatée : seule la zone tombe dans le canvas.
  await page.render({
    canvasContext: ctx,
    viewport,
    transform: [1, 0, 0, 1, -rx, -ry],
  }).promise;

  return canvas;
}

/**
 * Prétraitement doux : passage en niveaux de gris + étirement de contraste
 * (normalisation min/max avec un léger écrêtage des extrêmes). On laisse
 * volontairement Tesseract faire sa propre binarisation adaptative — une
 * binarisation dure ici amincirait les jambages fins des scans.
 */
export function preprocessForOcr(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;

  const gray = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    gray[p] = g;
    hist[g]++;
  }

  // Bornes à ~0,5 % / 99,5 % pour ignorer quelques pixels aberrants.
  const clip = Math.max(1, Math.floor(n * 0.005));
  let lo = 0;
  let hi = 255;
  for (let acc = 0, t = 0; t < 256; t++) {
    acc += hist[t];
    if (acc > clip) { lo = t; break; }
  }
  for (let acc = 0, t = 255; t >= 0; t--) {
    acc += hist[t];
    if (acc > clip) { hi = t; break; }
  }
  const range = Math.max(1, hi - lo);

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let v = ((gray[p] - lo) * 255) / range;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Petite vignette (data URL) de la zone, pour vérification visuelle. */
export function thumbnail(canvas: HTMLCanvasElement, maxW = 180): string {
  const ratio = canvas.width > maxW ? maxW / canvas.width : 1;
  const w = Math.max(1, Math.round(canvas.width * ratio));
  const h = Math.max(1, Math.round(canvas.height * ratio));
  const t = document.createElement('canvas');
  t.width = w;
  t.height = h;
  const ctx = t.getContext('2d')!;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(canvas, 0, 0, w, h);
  return t.toDataURL('image/png');
}
