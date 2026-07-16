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

export function PdfDocumentView({ doc, scale, tool, matches, current, selectMode, selectedPages, onTogglePage, onSelect }: Props) {
  const pages = Array.from({ length: doc.numPages }, (_, i) => i + 1);
  return (
    <div className="doc-scroll">
      <div className="doc-pages">
        {pages.map((n) => {
          const highlights: PageHighlight[] = matches
            .map((m, i) => ({ m, i }))
            .filter(({ m }) => m.page === n)
            .map(({ m, i }) => ({ key: i, rects: m.rects, isCurrent: i === current }));
          return (
            // key inclut le doc : repart de zéro quand on change d'onglet.
            <PageView
              key={`${doc.id}-${n}`}
              pdf={doc.pdf}
              pageNumber={n}
              scale={scale}
              tool={tool}
              highlights={highlights}
              selectMode={selectMode}
              selected={selectedPages.has(n)}
              onToggleSelect={() => onTogglePage(n)}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
