import { useEffect, useState, type ReactNode } from 'react';

interface Step {
  visual: ReactNode;
  title: string;
  body: ReactNode;
}

const STEPS: Step[] = [
  {
    visual: <img className="tuto-logo" src="./logo-simone-3.png" alt="Simone" />,
    title: 'Bienvenue dans Simone',
    body: (
      <>
        La visionneuse PDF qui vous laisse <strong>voir</strong> le document, et n’extrait
        que ce que vous <strong>désignez</strong>. Voici l’essentiel en quelques écrans.
      </>
    ),
  },
  {
    visual: <div className="tuto-badge">🖍 ⬚</div>,
    title: 'Marquez ce qui vous intéresse',
    body: (
      <>
        Ouvrez un ou plusieurs PDF, puis passez le <span className="modal-tool">🖍 Surligneur</span>
        sur une ligne, ou tracez un <span className="modal-tool">⬚ Cadre</span> autour d’un bloc
        (touches <kbd>S</kbd> / <kbd>C</kbd>).
      </>
    ),
  },
  {
    visual: <div className="tuto-badge">📋</div>,
    title: 'Le texte arrive tout seul',
    body: (
      <>
        Simone lit le texte du PDF s’il existe, sinon le reconnaît par <strong>OCR</strong>.
        Chaque extrait s’ajoute au bloc-notes à droite et est <strong>copié automatiquement</strong>.
        Vous exportez le tout en <code>.txt</code> ou <code>.md</code>.
      </>
    ),
  },
  {
    visual: <div className="tuto-badge">⌕</div>,
    title: 'Cherchez dans le document',
    body: (
      <>
        <kbd>Ctrl/Cmd</kbd> + <kbd>F</kbd> (ou le bouton <span className="modal-tool">⌕</span>)
        surligne toutes les occurrences d’un mot — accents et casse ignorés.
      </>
    ),
  },
  {
    visual: <div className="tuto-badge">⧉</div>,
    title: 'Extrayez des pages',
    body: (
      <>
        Le bouton <span className="modal-tool">⧉ Pages</span> vous laisse cocher des pages et les
        enregistrer dans un <strong>nouveau PDF</strong> — avec une option pour en réduire le poids.
      </>
    ),
  },
  {
    visual: <div className="tuto-badge">🔒</div>,
    title: 'Tout reste sur votre poste',
    body: (
      <>
        Le rendu et l’OCR tournent entièrement dans votre navigateur.
        <strong> Aucun document n’est envoyé sur Internet</strong> — et Simone fonctionne même hors-ligne.
      </>
    ),
  },
];

interface Props {
  onClose: () => void;
}

export function Tutorial({ onClose }: Props) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;

  const next = () => (last ? onClose() : setI((v) => Math.min(STEPS.length - 1, v + 1)));
  const prev = () => setI((v) => Math.max(0, v - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, last]);

  const step = STEPS[i];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tuto" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="tuto-visual">{step.visual}</div>
        <div className="tuto-title">{step.title}</div>
        <div className="tuto-body">{step.body}</div>

        <div className="tuto-dots" aria-hidden="true">
          {STEPS.map((_, d) => (
            <button key={d} className={`tuto-dot${d === i ? ' on' : ''}`} onClick={() => setI(d)} tabIndex={-1} />
          ))}
        </div>

        <div className="tuto-nav">
          <button className="btn-ghost" onClick={onClose}>Passer</button>
          <div className="tuto-nav-right">
            {i > 0 && (
              <button className="btn-ghost" onClick={prev}>Précédent</button>
            )}
            <button className="btn-primary" onClick={next}>{last ? 'Commencer' : 'Suivant'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
