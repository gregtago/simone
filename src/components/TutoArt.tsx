// Illustrations vectorielles du tutoriel. Couleurs alignées sur l'app.
const INK = '#1c2127';
const INKSOFT = '#8a8f98';
const LINE = '#d7d7d3';
const BG = '#f4f4f2';
const BORDER = '#e2e2de';
const ACCENT = '#2f6eff';
const YELLOW = '#fbbf24';
const GREEN = '#16a34a';
const ORANGE = '#ea580c';

const box = { className: 'tuto-illus' };
const vb = '0 0 200 120';

/** Écran « marquer » : surligneur (ligne jaune) + cadre (rectangle pointillé). */
export function MarkArt() {
  return (
    <svg {...box} viewBox={vb} role="img" aria-label="Surligneur et cadre sur un document">
      <rect x="58" y="14" width="84" height="94" rx="7" fill="#fff" stroke={BORDER} strokeWidth="2" />
      <rect x="70" y="33" width="52" height="12" rx="2.5" fill={YELLOW} opacity="0.55" />
      <rect x="72" y="37" width="46" height="5" rx="2.5" fill={INK} />
      <rect x="72" y="53" width="40" height="5" rx="2.5" fill={LINE} />
      <rect x="64" y="66" width="72" height="34" rx="4" fill="none" stroke={ACCENT} strokeWidth="2" strokeDasharray="5 4" />
      <rect x="72" y="75" width="52" height="5" rx="2.5" fill={LINE} />
      <rect x="72" y="87" width="44" height="5" rx="2.5" fill={LINE} />
    </svg>
  );
}

/** Écran « extraction » : le texte passe du document au bloc-notes (copié). */
export function ExtractArt() {
  return (
    <svg {...box} viewBox={vb} role="img" aria-label="Le texte extrait rejoint le bloc-notes">
      <rect x="24" y="24" width="60" height="74" rx="6" fill="#fff" stroke={BORDER} strokeWidth="2" />
      <rect x="34" y="36" width="40" height="5" rx="2.5" fill={LINE} />
      <rect x="34" y="48" width="34" height="5" rx="2.5" fill={LINE} />
      <rect x="32" y="59" width="46" height="10" rx="2" fill={YELLOW} opacity="0.55" />
      <rect x="34" y="62" width="38" height="5" rx="2.5" fill={INK} />
      <rect x="34" y="77" width="30" height="5" rx="2.5" fill={LINE} />
      <path d="M92 61 h20" fill="none" stroke={INKSOFT} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M107 55 l7 6 -7 6" fill="none" stroke={INKSOFT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="122" y="28" width="56" height="66" rx="6" fill={BG} stroke={BORDER} strokeWidth="2" />
      <rect x="132" y="40" width="36" height="5" rx="2.5" fill={INK} />
      <rect x="132" y="51" width="30" height="5" rx="2.5" fill={LINE} />
      <rect x="132" y="62" width="34" height="5" rx="2.5" fill={LINE} />
      <circle cx="169" cy="83" r="10" fill={GREEN} />
      <path d="M164 83 l3.5 3.5 L173 79" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Écran « rechercher » : barre de recherche + occurrences surlignées. */
export function SearchArt() {
  return (
    <svg {...box} viewBox={vb} role="img" aria-label="Recherche et occurrences surlignées">
      <rect x="50" y="24" width="100" height="84" rx="7" fill="#fff" stroke={BORDER} strokeWidth="2" />
      <rect x="62" y="48" width="28" height="6" rx="3" fill={LINE} />
      <rect x="94" y="46" width="30" height="10" rx="2" fill={YELLOW} opacity="0.6" />
      <rect x="62" y="63" width="76" height="6" rx="3" fill={LINE} />
      <rect x="62" y="76" width="26" height="11" rx="2" fill="none" stroke={ORANGE} strokeWidth="2" />
      <rect x="66" y="79" width="18" height="5" rx="2.5" fill={INK} />
      <rect x="94" y="78" width="44" height="6" rx="3" fill={LINE} />
      <rect x="62" y="93" width="42" height="10" rx="2" fill={YELLOW} opacity="0.6" />
      <g>
        <rect x="92" y="8" width="76" height="24" rx="12" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="106" cy="20" r="5" fill="none" stroke={INKSOFT} strokeWidth="2" />
        <line x1="110" y1="24" x2="114" y2="28" stroke={INKSOFT} strokeWidth="2" strokeLinecap="round" />
        <rect x="120" y="17" width="38" height="6" rx="3" fill={LINE} />
      </g>
    </svg>
  );
}

/** Écran « pages » : miniatures cochées → nouveau PDF. */
export function PagesArt() {
  return (
    <svg {...box} viewBox={vb} role="img" aria-label="Sélection de pages vers un nouveau PDF">
      {[
        { x: 16, sel: true },
        { x: 48, sel: false },
        { x: 80, sel: true },
      ].map((p, i) => (
        <g key={i}>
          <rect
            x={p.x}
            y="34"
            width="30"
            height="52"
            rx="4"
            fill="#fff"
            stroke={p.sel ? ACCENT : BORDER}
            strokeWidth={p.sel ? 2.5 : 2}
          />
          <rect x={p.x + 6} y="42" width="18" height="4" rx="2" fill={LINE} />
          <rect x={p.x + 6} y="50" width="14" height="4" rx="2" fill={LINE} />
          {p.sel && (
            <>
              <circle cx={p.x + 24} cy="38" r="7" fill={ACCENT} />
              <path
                d={`M${p.x + 20.5} 38 l2.5 2.5 L${p.x + 28} 35`}
                fill="none"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
        </g>
      ))}
      <path d="M118 60 h16" fill="none" stroke={INKSOFT} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M129 54 l7 6 -7 6" fill="none" stroke={INKSOFT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="146" y="30" width="40" height="60" rx="5" fill="#fff" stroke={INK} strokeWidth="2" />
      <rect x="154" y="40" width="24" height="4" rx="2" fill={LINE} />
      <rect x="154" y="48" width="20" height="4" rx="2" fill={LINE} />
      <text x="166" y="76" textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} fontFamily="Inter, sans-serif">
        PDF
      </text>
    </svg>
  );
}

/** Écran « confidentialité » : document sur le poste, protégé (cadenas). */
export function PrivacyArt() {
  return (
    <svg {...box} viewBox={vb} role="img" aria-label="Tout reste sur votre poste, protégé">
      <rect x="42" y="16" width="116" height="74" rx="8" fill={BG} stroke={BORDER} strokeWidth="2" />
      <rect x="92" y="90" width="16" height="8" fill={BORDER} />
      <rect x="76" y="98" width="48" height="6" rx="3" fill={BORDER} />
      <rect x="62" y="28" width="50" height="50" rx="4" fill="#fff" stroke={BORDER} strokeWidth="1.5" />
      <rect x="70" y="38" width="34" height="4" rx="2" fill={LINE} />
      <rect x="70" y="47" width="28" height="4" rx="2" fill={LINE} />
      <rect x="70" y="56" width="32" height="4" rx="2" fill={LINE} />
      <g transform="translate(116,44)">
        <path d="M7 16 v-5 a8 8 0 0 1 16 0 v5" fill="none" stroke={INK} strokeWidth="3" />
        <rect x="2" y="16" width="26" height="22" rx="5" fill={INK} />
        <circle cx="15" cy="25" r="2.6" fill="#fff" />
        <rect x="13.7" y="26" width="2.6" height="6" rx="1.3" fill="#fff" />
      </g>
    </svg>
  );
}
