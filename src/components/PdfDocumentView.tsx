import { useEffect, useMemo, useState } from 'react';
import { PageView, type SelectionPayload, type PageHighlight } from './PageView';
import type { PdfDoc, Tool } from '../lib/types';
import type { Match } from '../lib/search';

interface Props {
  doc: PdfDoc;
  scale: number;
  tool: Tool;
  matches: Match[];
  current: number;
  selectMode: boolean;
  selectedPages: Set<number>;
  onTogglePage: (n: number) => void;
  onSelect: (p: SelectionPayload) => void;
}

const NO_HIGHLIGHT: PageHighlight[] = [];

export function PdfDocumentView({ doc, scale, tool, matches, current, selectMode, selectedPages, onTogglePage, onSelect }: Props) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  // Format de la 1re page : sert d'emplacement aux pages pas encore rendues,
  // pour que l'ascenseur ait d'emblée la bonne longueur.
  const [defaultSize, setDefaultSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDefaultSize(null);
    doc.pdf
      .getPage(1)
      .then((p) => {
        const v = p.getViewport({ scale: 1 });
        if (!cancelled) setDefaultSize({ w: v.width, h: v.height });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const byPage = useMemo(() => {
    const map = new Map<number, PageHighlight[]>();
    matches.forEach((m, i) => {
      const list = map.get(m.page) ?? [];
      list.push({ key: i, rects: m.rects, isCurrent: i === current });
      map.set(m.page, list);
    });
    return map;
  }, [matches, current]);

  const pages = useMemo(() => Array.from({ length: doc.numPages }, (_, i) => i + 1), [doc.numPages]);
  return (
    <div className="doc-scroll" ref={setRoot}>
      <div className="doc-pages">
        {pages.map((n) => (
          // key inclut le doc : repart de zéro quand on change d'onglet.
          <PageView
            key={`${doc.id}-${n}`}
            pdf={doc.pdf}
            pageNumber={n}
            scale={scale}
            tool={tool}
            highlights={byPage.get(n) ?? NO_HIGHLIGHT}
            selectMode={selectMode}
            selected={selectedPages.has(n)}
            onToggleSelect={onTogglePage}
            onSelect={onSelect}
            defaultSize={defaultSize}
            root={root}
          />
        ))}
      </div>
    </div>
  );
}
