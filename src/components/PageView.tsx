import { useEffect, useRef, useState } from 'react';
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

interface Props {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  tool: Tool;
  onSelect: (p: SelectionPayload) => void;
}

// Largeur du trait de surligneur, en pixels du canvas rendu.
const BRUSH = 22;
// En dessous de ce déplacement, c'est un simple clic : on n'extrait rien.
const MIN_DRAG = 5;

export function PageView({ pdf, pageNumber, scale, tool, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<{ viewport: PageViewport; textContent: TextContent; pageProxy: PDFPageProxy } | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const draggingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  // Rendu de la page.
  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      setDims({ w: canvas.width, h: canvas.height });
      const ctx = canvas.getContext('2d')!;
      const task = page.render({ canvasContext: ctx, viewport });
      renderTask = task;
      try {
        await task.promise;
      } catch {
        return; // annulé (re-render)
      }
      if (cancelled) return;
      const textContent = await page.getTextContent();
      if (cancelled) return;
      dataRef.current = { viewport, textContent, pageProxy: page };
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, scale]);

  // Le calque de peinture suit la taille de la page.
  useEffect(() => {
    const pc = paintRef.current;
    if (pc && dims) {
      pc.width = dims.w;
      pc.height = dims.h;
    }
  }, [dims]);

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

  return (
    <div className="page-wrap" style={dims ? { width: dims.w, height: dims.h } : undefined}>
      <canvas ref={canvasRef} className="page-canvas" />
      <canvas
        ref={paintRef}
        className="paint-layer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="page-label">Page {pageNumber}</div>
    </div>
  );
}
