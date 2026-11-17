import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Validation (Entrée ou sortie du champ) : l'étiquette est mémorisée. */
  onCommit: (v: string) => void;
  listId: string;
  placeholder: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Champ d'étiquette avec suggestions (datalist : on tape « vend » et l'on
 * choisit « État civil — vendeur »). Entrée ou Échap rendent la main au
 * document, pour enchaîner les surlignages.
 */
export function LabelInput({ value, onChange, onCommit, listId, placeholder, autoFocus, className }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: false });
  }, [autoFocus]);

  return (
    <input
      ref={ref}
      className={className ?? 'label-input'}
      type="text"
      list={listId}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
      }}
    />
  );
}

export function LabelOptions({ id, labels }: { id: string; labels: string[] }) {
  return (
    <datalist id={id}>
      {labels.map((l) => (
        <option key={l} value={l} />
      ))}
    </datalist>
  );
}
