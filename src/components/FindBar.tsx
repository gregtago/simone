import { useEffect, useRef } from 'react';

interface Props {
  query: string;
  onQuery: (q: string) => void;
  total: number;
  current: number;
  searching: boolean;
  noText: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function FindBar({ query, onQuery, total, current, searching, noText, onPrev, onNext, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const status = searching
    ? 'Recherche…'
    : noText && query.trim()
      ? 'Document sans texte'
      : query.trim()
        ? total > 0
          ? `${current + 1} / ${total}`
          : 'Aucun résultat'
        : '';

  return (
    <div className="findbar" role="search">
      <span className="findbar-glyph">⌕</span>
      <input
        ref={inputRef}
        className="findbar-input"
        type="text"
        placeholder="Rechercher dans le document…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) onPrev();
            else onNext();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <span className="findbar-count">{status}</span>
      <button className="findbar-btn" onClick={onPrev} disabled={total === 0} aria-label="Précédent" title="Précédent (Maj+Entrée)">‹</button>
      <button className="findbar-btn" onClick={onNext} disabled={total === 0} aria-label="Suivant" title="Suivant (Entrée)">›</button>
      <button className="findbar-btn" onClick={onClose} aria-label="Fermer" title="Fermer (Échap)">✕</button>
    </div>
  );
}
