// Étiquettes : la qualification que le notaire pose sur une extraction
// (« Immatriculation de la copropriété », « État civil — vendeur ») ou sur un
// document entier (« Titre de propriété »). Elles accompagnent le texte à
// l'export pour que l'IA qui le lira sache ce qu'elle reçoit.

/** Qualités des parties, croisées avec les rubriques personnelles. */
const ROLES = [
  'vendeur', 'acquéreur', 'donateur', 'donataire', 'défunt', 'héritier', 'légataire',
  'conjoint survivant', 'emprunteur', 'prêteur', 'caution', 'bailleur', 'preneur', 'mandataire',
];
const PERSON_FIELDS = [
  'État civil', 'Domicile', 'Régime matrimonial', 'Profession', 'Nationalité',
  'Représentation / pouvoirs', 'Société — dénomination, siège, RCS',
];

const PROPERTY = [
  'Désignation du bien', 'Adresse du bien', 'Références cadastrales', 'Contenance cadastrale',
  'Lots de copropriété', 'Tantièmes / quotes-parts', 'Superficie loi Carrez', 'Surface habitable',
  'Usage du bien', 'Situation locative', 'Origine de propriété', 'Effet relatif (publication)',
  'Servitude', 'Hypothèque / privilège', 'Mitoyenneté',
];
const COPRO = [
  'Immatriculation de la copropriété', 'Syndic', 'Règlement de copropriété — date et publication',
  'État descriptif de division', 'Modificatif à l\'EDD', 'Fonds de roulement', 'Avance de trésorerie',
  'Fonds de travaux', 'Charges — budget prévisionnel', 'Charges — exercice clos', 'Appels de fonds travaux',
  'Sommes dues par le vendeur', 'Sommes dues par l\'acquéreur', 'Procédures en cours', 'Travaux votés',
  'Date de l\'assemblée générale',
];
const PRICE = [
  'Prix de vente', 'Prix — partie mobilière', 'Honoraires de négociation', 'Dépôt de garantie / séquestre',
  'Indemnité d\'immobilisation', 'Frais d\'acquisition', 'Valeur déclarée', 'Soulte',
  'Prêt — organisme', 'Prêt — montant', 'Prêt — taux', 'Prêt — durée', 'Prêt — garantie',
  'Capital restant dû',
];
const DATES = [
  'Date de signature', 'Date — délai de réalisation', 'Date — condition suspensive de prêt',
  'Date d\'entrée en jouissance', 'Date du décès', 'Date de naissance', 'Date du mariage',
];
const CLAUSES = [
  'Condition suspensive', 'Clause particulière', 'Clause pénale', 'Droit de préemption',
  'Urbanisme — zonage', 'Urbanisme — autorisation', 'Diagnostic — DPE', 'Diagnostic — amiante',
  'Diagnostic — plomb', 'Diagnostic — termites', 'Diagnostic — électricité / gaz', 'Assainissement',
  'Risques (ERP)', 'Assurance dommages-ouvrage',
];
const ESTATE = [
  'Dévolution successorale', 'Testament / donation entre époux', 'Actif — compte bancaire',
  'Actif — assurance-vie', 'Passif — dette', 'Donation antérieure (rapport)',
];

/** Les plus courantes : proposées d'emblée, avant toute frappe. */
export const FREQUENT_CAPTURE_LABELS = [
  'État civil — vendeur', 'État civil — acquéreur', 'Désignation du bien', 'Références cadastrales',
  'Lots de copropriété', 'Immatriculation de la copropriété', 'Prix de vente', 'Superficie loi Carrez',
];

/** Toutes les suggestions proposées pour qualifier une extraction. */
export const CAPTURE_LABELS: string[] = unique([
  ...FREQUENT_CAPTURE_LABELS,
  ...PERSON_FIELDS.flatMap((f) => ROLES.map((r) => `${f} — ${r}`)),
  ...PROPERTY, ...COPRO, ...PRICE, ...DATES, ...CLAUSES, ...ESTATE,
]);

/** Suggestions proposées pour qualifier un document entier. */
export const DOC_LABELS: string[] = [
  'Titre de propriété', 'Compromis de vente', 'Promesse unilatérale de vente', 'Avenant',
  'État daté', 'Pré-état daté', 'Règlement de copropriété / EDD', 'Procès-verbal d\'assemblée générale',
  'Fiche synthétique de copropriété', 'Carnet d\'entretien', 'Offre de prêt',
  'Pièce d\'identité — vendeur', 'Pièce d\'identité — acquéreur', 'Acte de naissance', 'Livret de famille',
  'Contrat de mariage', 'Convention de PACS', 'Jugement de divorce', 'Acte de décès', 'Testament',
  'Acte de notoriété', 'Donation antérieure', 'Extrait Kbis', 'Statuts', 'Procès-verbal de décision (pouvoirs)',
  'Diagnostics techniques', 'Note de renseignements d\'urbanisme', 'Certificat d\'urbanisme',
  'Permis de construire / DAACT', 'État hypothécaire', 'Relevé de propriété / cadastre', 'Plan cadastral',
  'Bail', 'Relevé bancaire', 'Courrier reçu',
];

export const FREQUENT_DOC_LABELS = [
  'Titre de propriété', 'Compromis de vente', 'État daté', 'Règlement de copropriété / EDD',
  'Pièce d\'identité — vendeur', 'Pièce d\'identité — acquéreur', 'Offre de prêt', 'Diagnostics techniques',
];

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}

/** Minuscules, sans accents ni ponctuation : « État » se trouve en tapant « etat ». */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Suggestions pour une saisie : chaque mot tapé doit commencer un mot de
 * l'étiquette (« etat vend » → « État civil — vendeur »). Les étiquettes qui
 * commencent par la saisie passent devant ; l'ordre de la liste départage.
 * Saisie vide : les étiquettes récentes, puis les plus courantes.
 */
export function suggest(query: string, all: string[], frequent: string[], recent: string[], max = 8): string[] {
  const q = normalize(query);
  if (!q) return unique([...recent.slice(0, 4), ...frequent]).slice(0, max);
  const words = q.split(' ');
  const pool = unique([...recent, ...all]);
  const scored: { l: string; score: number; i: number }[] = [];
  pool.forEach((l, i) => {
    const n = normalize(l);
    const lw = n.split(' ');
    if (!words.every((w) => lw.some((x) => x.startsWith(w)))) return;
    const score = n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2;
    scored.push({ l, score, i });
  });
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).slice(0, max).map((s) => s.l);
}

export type LabelKind = 'extraction' | 'document';
const STORE_KEY: Record<LabelKind, string> = {
  extraction: 'simone-etiquettes',
  document: 'simone-etiquettes-documents',
};

/** Étiquettes saisies par le notaire, mémorisées sur le poste (récentes en tête). */
export function loadCustomLabels(kind: LabelKind): string[] {
  try {
    const raw = localStorage.getItem(STORE_KEY[kind]);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Mémorise une étiquette employée (la plus récente en tête, 60 au plus). */
export function rememberLabel(kind: LabelKind, label: string): string[] {
  const l = label.trim();
  const current = loadCustomLabels(kind);
  if (!l) return current;
  const next = [l, ...current.filter((x) => x !== l)].slice(0, 60);
  try {
    localStorage.setItem(STORE_KEY[kind], JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
