/*
 * Annonce de l'arrivée de Pierre — module autonome, sans dépendance.
 *
 * Une petite carte apparaît en bas à droite, une seule fois par navigateur :
 * dès qu'on la ferme (ou qu'on clique sur « Découvrir Pierre »), elle ne
 * revient plus. Elle cesse d'elle-même d'apparaître après la date de fin.
 * Ce fichier est identique dans Alix, Henri et Simone.
 */

const CLE = 'annonce-pierre-2026-vu';
const FIN = new Date('2027-01-31T23:59:59');
const URL_PIERRE = 'https://pierre.tagot.fr';

const LOGO = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="44" height="44" aria-hidden="true">
  <rect width="120" height="120" rx="26" fill="#F7F4EE"/>
  <defs><clipPath id="annonce-pierre-clip"><path d="M58 12 C34 13 19 30 20 52 C21 76 44 98 60 118 C76 98 100 76 100 51 C100 28 82 11 58 12 Z"/></clipPath></defs>
  <g clip-path="url(#annonce-pierre-clip)">
    <rect width="120" height="120" fill="#12355B"/>
    <polygon points="60,0 66,42 120,70 120,0" fill="#D0A325"/>
  </g>
</svg>`;

const STYLE = `
.annonce-pierre {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  width: min(360px, calc(100vw - 40px)); box-sizing: border-box;
  display: grid; grid-template-columns: auto 1fr; gap: 14px;
  padding: 18px 18px 16px; border-radius: 14px;
  background: #FFFFFF; color: #12355B;
  border: 1px solid #D2DADF; border-top: 3px solid #D0A325;
  box-shadow: 0 18px 40px -12px rgba(18, 53, 91, .35);
  font-family: "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  opacity: 0; transform: translateY(16px) scale(.98);
  transition: opacity .35s ease, transform .35s cubic-bezier(.2, .8, .2, 1);
}
.annonce-pierre.est-visible { opacity: 1; transform: none; }
.annonce-pierre__logo { display: block; border-radius: 12px; }
.annonce-pierre__surtitre {
  margin: 0 0 2px; font-size: 11px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: #3E5C6E;
}
.annonce-pierre__titre { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.03em; line-height: 1.2; }
.annonce-pierre__titre b { color: #D0A325; }
.annonce-pierre__texte { margin: 6px 0 12px; font-size: 14px; line-height: 1.45; color: #3E5C6E; }
.annonce-pierre__actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.annonce-pierre__bouton {
  display: inline-block; padding: 8px 14px; border-radius: 10px;
  background: #12355B; color: #FFFFFF !important; text-decoration: none !important;
  font-size: 14px; font-weight: 600; border: 0; cursor: pointer;
}
.annonce-pierre__bouton:hover { background: #1c4a7a; }
.annonce-pierre__plus-tard {
  padding: 8px 10px; border: 0; background: none; cursor: pointer;
  font: inherit; font-size: 14px; color: #3E5C6E;
}
.annonce-pierre__plus-tard:hover { color: #12355B; text-decoration: underline; }
.annonce-pierre__fermer {
  position: absolute; top: 8px; right: 8px; width: 28px; height: 28px;
  border: 0; border-radius: 8px; background: none; cursor: pointer;
  color: #3E5C6E; font-size: 20px; line-height: 1;
}
.annonce-pierre__fermer:hover { background: #E6EBEE; color: #12355B; }
@media (max-width: 520px) {
  .annonce-pierre { right: 12px; left: 12px; bottom: 12px; width: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .annonce-pierre { transition: none; }
}
`;

function lire() {
  try { return window.localStorage.getItem(CLE); } catch { return '1'; }
}

function marquerVu() {
  try { window.localStorage.setItem(CLE, new Date().toISOString()); } catch { /* rien */ }
}

function afficher() {
  if (document.querySelector('.annonce-pierre')) return;

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const carte = document.createElement('aside');
  carte.className = 'annonce-pierre';
  carte.setAttribute('role', 'dialog');
  carte.setAttribute('aria-label', 'Nouveauté : Pierre');
  carte.innerHTML = `
    <span class="annonce-pierre__logo">${LOGO}</span>
    <div>
      <p class="annonce-pierre__surtitre">Nouveau à l'Office</p>
      <p class="annonce-pierre__titre">Pierre est arrivé<b>.</b></p>
      <p class="annonce-pierre__texte">
        Une adresse ou une parcelle suffit : cadastre, urbanisme, risques, ventes alentour
        et pièces à annexer aux actes, réunis en un seul endroit.
      </p>
      <div class="annonce-pierre__actions">
        <a class="annonce-pierre__bouton" href="${URL_PIERRE}" target="_blank" rel="noopener">Découvrir Pierre</a>
        <button type="button" class="annonce-pierre__plus-tard">Plus tard</button>
      </div>
    </div>
    <button type="button" class="annonce-pierre__fermer" aria-label="Fermer">×</button>
  `;

  const fermer = (definitif: boolean) => {
    if (definitif) marquerVu();
    carte.classList.remove('est-visible');
    setTimeout(() => { carte.remove(); style.remove(); }, 400);
  };

  carte.querySelector('.annonce-pierre__bouton')!.addEventListener('click', () => fermer(true));
  carte.querySelector('.annonce-pierre__fermer')!.addEventListener('click', () => fermer(true));
  // « Plus tard » : la carte disparaît pour cette visite et reviendra à la prochaine.
  carte.querySelector('.annonce-pierre__plus-tard')!.addEventListener('click', () => fermer(false));
  document.addEventListener('keydown', function echap(e: KeyboardEvent) {
    if (e.key === 'Escape') { document.removeEventListener('keydown', echap); fermer(false); }
  });

  document.body.appendChild(carte);
  requestAnimationFrame(() => requestAnimationFrame(() => carte.classList.add('est-visible')));
}

export function annoncerPierre({ delai = 1500 } = {}) {
  if (typeof window === 'undefined') return;
  if (lire() || new Date() > FIN) return;

  const lancer = () => {
    // Si un écran de verrouillage est posé (Henri), on attend qu'il soit levé.
    if (document.documentElement.dataset.lock) {
      setTimeout(lancer, 1000);
      return;
    }
    afficher();
  };
  setTimeout(lancer, delai);
}
