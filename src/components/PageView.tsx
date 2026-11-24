import { memo, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';
import type { Rect, Tool } from '../lib/types';

export interface SelectionPayload {
  page: number;
  pageProxy: PDFPageProxy;
  rect: Rect;
  canvas: HTMLCanvasElement;
  viewport: PageViewport;
  textContent: TextContent;
}

export interface PageHighlight {
  key: number;
  rects: { x: number; y: number; w: number; h: number }[];
  isCurrent: boolean;
}

interface Props {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  tool: Tool;
  highlights: PageHighlight[];
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (page: number) => void;
  onSelect: (p: SelectionPayload) => void;
  /** Format de la 1re page (échelle 1) : réserve la place avant le rendu. */
  defaultSize: { w: number; h: number } | null;
  /** Conteneur défilant : seules les pages proches de sa zone visible sont rendues. */
  root: HTMLElement | null;
}

// Largeur du trait de surligneur, en pixels du canvas rendu.
const BRUSH = 22;
// En dessous de ce déplacement, c'est un simple clic : on n'extrait rien.
const MIN_DRAG = 5;

export const PageView = memo(function PageView({
  pdf, pageNumber, scale, tool, highlights, selectMode, selected, onToggleSelect, onSelect, defaultSize, root,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<HTMLCanvasElement>(null);
  const currentHlRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<{ viewport: PageViewport; textContent: TextContent; pageProxy: PDFPageProxy } | null>(null);
  // Format réel de la page (échelle 1), connu une fois la page chargée.
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [near, setNear] = useState(false);
  const [rendered, setRendered] = useState(false);
  const size = base ?? defaultSize;
  const w = size ? Math.floor(size.w * scale) : 0;
  const h = size ? Math.floor(size.h * scale) : 0;
  const draggingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  // La page est-elle dans la zone visible, ou à moins d'un écran de celle-ci ?
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver((entries) => setNear(entries[entries.length - 1].isIntersecting), {
      root,
      rootMargin: '100% 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  // Rendu de la page — seulement si elle est proche de l'écran. Un document
  // lourd n'est donc jamais dessiné en entier : les pages éloignées ne sont
  // qu'un emplacement vide, et leur image est libérée dès qu'on s'en éloigne.
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    const canvas = canvasRef.current;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const unit = page.getViewport({ scale: 1 });
      setBase((b) => (b && b.w === unit.width && b.h === unit.height ? b : { w: unit.width, h: unit.height }));
      const viewport = page.getViewport({ scale });
      if (!canvas) return;
      // Dessin hors écran, puis recopie d'un seul coup : l'ancienne image
      // reste affichée pendant un changement de zoom, sans page blanche.
      const off = document.createElement('canvas');
      off.width = Math.floor(viewport.width);
      off.height = Math.floor(viewport.height);
      const task = page.render({ canvasContext: off.getContext('2d')!, viewport });
      renderTask = task;
      try {
        await task.promise;
      } catch {
        return; // annulé (re-render)
      }
      if (cancelled) return;
      canvas.width = off.width;
      canvas.height = off.height;
      canvas.getContext('2d')!.drawImage(off, 0, 0);
      off.width = off.height = 0;
      setRendered(true);
      const textContent = await page.getTextContent();
      if (cancelled) return;
      dataRef.current = { viewport, textContent, pageProxy: page };
    })().catch(() => {});

    return () => {
      cancelled = true;
      renderTask?.cancel();
      dataRef.current = null;
    };
  }, [pdf, pageNumber, scale, near]);

  // Page sortie de la zone : on rend la mémoire de son image.
  useEffect(() => {
    if (near) return;
    const canvas = canvasRef.current;
    if (canvas) canvas.width = canvas.height = 0;
    setRendered(false);
    pdf.getPage(pageNumber).then((p) => p.cleanup()).catch(() => {});
  }, [near, pdf, pageNumber]);

  // Le calque de peinture suit la taille de la page.
  useEffect(() => {
    const pc = paintRef.current;
    if (pc) {
      pc.width = w;
      pc.height = h;
    }
  }, [w, h]);

  const pointFromEvent = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  };

  // Redessine à chaque mouvement. Surligneur : trait d'encre à main levée
  // (une seule passe, opacité uniforme). Cadre : rectangle en pointillés entre
  // le point de départ et le point courant.
  const redraw = () => {
    const pc = paintRef.current;
    if (!pc) return;
    const ctx = pc.getContext('2d')!;
    ctx.clearRect(0, 0, pc.width, pc.height);
    const pts = pointsRef.current;
    if (!pts.length) return;

    if (tool === 'cadre') {
      const a = pts[0];
      const b = pts[pts.length - 1];
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(202, 138, 4, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x + 0.75, y + 0.75, w, h);
      ctx.setLineDash([]);
      return;
    }

    ctx.fillStyle = 'rgba(250, 204, 21, 0.5)';
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
    ctx.lineWidth = BRUSH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, BRUSH / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    if (paintRef.current) paintRef.current.style.opacity = '1';
    pointsRef.current = [pointFromEvent(e)];
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    pointsRef.current.push(pointFromEvent(e));
    redraw();
  };

  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const pts = pointsRef.current;

    // Le trait reste visible un instant puis s'estompe.
    const pc = paintRef.current;
    if (pc) {
      pc.style.opacity = '0';
      window.setTimeout(() => {
        pc.getContext('2d')?.clearRect(0, 0, pc.width, pc.height);
        pc.style.opacity = '1';
      }, 350);
    }

    if (!pts.length || !dataRef.current || !canvasRef.current) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    // Simple clic (pas de glissement) → on ignore.
    if (maxX - minX < MIN_DRAG && maxY - minY < MIN_DRAG) return;

    const cw = canvasRef.current.width;
    const ch = canvasRef.current.height;
    let rect: Rect;
    if (tool === 'cadre') {
      // Rectangle strict entre le point de départ et le point d'arrivée.
      const a = pts[0];
      const b = pts[pts.length - 1];
      const x = Math.max(0, Math.min(a.x, b.x));
      const y = Math.max(0, Math.min(a.y, b.y));
      rect = { x, y, w: Math.min(Math.abs(b.x - a.x), cw - x), h: Math.min(Math.abs(b.y - a.y), ch - y) };
    } else {
      // Surligneur : boîte englobante du trait, élargie du rayon du pinceau.
      const r = BRUSH / 2;
      const x = Math.max(0, minX - r);
      const y = Math.max(0, minY - r);
      rect = { x, y, w: Math.min(maxX - minX + BRUSH, cw - x), h: Math.min(maxY - minY + BRUSH, ch - y) };
    }

    onSelect({
      page: pageNumber,
      pageProxy: dataRef.current.pageProxy,
      rect,
      canvas: canvasRef.current,
      viewport: dataRef.current.viewport,
      textContent: dataRef.current.textContent,
    });
    pointsRef.current = [];
  };

  // Amène l'occurrence courante de la recherche dans la vue.
  const currentKey = highlights.find((h) => h.isCurrent)?.key ?? null;
  useEffect(() => {
    if (currentKey != null) currentHlRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentKey]);

  return (
    <div ref={wrapRef} className="page-wrap" style={size ? { width: w, height: h } : undefined}>
      <canvas ref={canvasRef} className="page-canvas" style={{ width: w, height: h }} />
      {near && !rendered && <div className="page-loading"><span className="spinner" /> Chargement de la page…</div>}
      {highlights.length > 0 && (
        <div className="hl-layer">
          {highlights.map((h) =>
            h.rects.map((r, ri) => (
              <div
                key={`${h.key}-${ri}`}
                ref={h.isCurrent && ri === 0 ? currentHlRef : undefined}
                className={`hl${h.isCurrent ? ' hl-current' : ''}`}
                style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }}
              />
            )),
          )}
        </div>
      )}
      <canvas
        ref={paintRef}
        className="paint-layer"
        style={selectMode ? { pointerEvents: 'none' } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      {selectMode && (
        <div className={`page-select${selected ? ' page-selected' : ''}`} onClick={() => onToggleSelect(pageNumber)}>
          <span className={`page-check${selected ? ' on' : ''}`}>{selected ? '✓' : ''}</span>
        </div>
      )}
      <div className="page-label">Page {pageNumber}</div>
    </div>
  );
});
