import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { suggest } from '../lib/labels';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Validation (Entrée, choix d'une suggestion, sortie du champ) : l'étiquette est mémorisée. */
  onCommit: (v: string) => void;
  /** Toutes les étiquettes toutes faites. */
  labels: string[];
  /** Les plus courantes, proposées avant toute frappe. */
  frequent: string[];
  /** Étiquettes employées récemment sur ce poste. */
  recent: string[];
  placeholder: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Champ d'étiquette à suggestions. Les étiquettes courantes s'affichent dès le
 * focus ; la frappe filtre sans tenir compte des accents (« etat vend » →
 * « État civil — vendeur »). Entrée valide le texte tel qu'il est saisi ; Tab
 * reprend la suggestion (la première, ou celle choisie avec ↑ ↓) dans le
 * champ, et Entrée la valide alors. Échap ferme la liste : la main revient au
 * document, pour enchaîner les surlignages.
 */
export function LabelInput({ value, onChange, onCommit, labels, frequent, recent, placeholder, autoFocus, className }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const items = open ? suggest(value, labels, frequent, recent) : [];
  // Suggestion que Tab reprendrait : celle choisie aux flèches, sinon la
  // première qui diffère du texte saisi.
  const tabIdx = hi >= 0 ? hi : value.trim() ? items.findIndex((l) => l !== value) : -1;

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  // La liste est en position fixe, pour ne pas être rognée par les panneaux
  // défilants ; elle se ferme si la page défile.
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 2, width: Math.max(r.width, 240) });
  }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.target instanceof Node && e.target.parentElement?.closest('.label-suggest')) return;
      setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open]);

  const choose = (l: string) => {
    onChange(l);
    onCommit(l);
    setOpen(false);
    ref.current?.blur();
  };

  return (
    <>
      <input
        ref={ref}
        className={className ?? 'label-input'}
        type="text"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-autocomplete="list"
        onFocus={() => {
          setOpen(true);
          setHi(-1);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHi(-1);
        }}
        onBlur={(e) => {
          setOpen(false);
          onCommit(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHi((h) => Math.min(items.length - 1, h + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => Math.max(-1, h - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (hi >= 0 && items[hi]) choose(items[hi]);
            else e.currentTarget.blur();
          } else if (e.key === 'Tab' && !e.shiftKey) {
            // Reprend la suggestion dans le champ, sans quitter celui-ci :
            // Entrée la valide ensuite.
            const l = items[tabIdx];
            if (l && l !== value) {
              e.preventDefault();
              onChange(l);
              setOpen(false);
              setHi(-1);
            }
          } else if (e.key === 'Escape') {
            if (open && items.length) setOpen(false);
            else e.currentTarget.blur();
          }
        }}
      />
      {open && pos && items.length > 0 && (
        <ul
          className="label-suggest"
          role="listbox"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
          // Garder le focus dans le champ pendant le clic sur une suggestion.
          onMouseDown={(e) => e.preventDefault()}
        >
          {items.map((l, i) => (
            <li
              key={l}
              role="option"
              aria-selected={i === hi}
              className={i === hi ? 'label-suggest-hi' : undefined}
              onClick={() => choose(l)}
            >
              {l}
              <span className="label-suggest-recent">
                {recent.includes(l) && 'récente'}
                {i === tabIdx && <kbd className="label-suggest-tab">Tab</kbd>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
