// Étiquettes : la qualification que le notaire pose sur une extraction
// (« Immatriculation de la copropriété », « État civil — vendeur ») ou sur un
// document entier (« Titre de propriété »). Elles accompagnent le texte à
// l'export pour que l'IA qui le lira sache ce qu'elle reçoit.

/** Suggestions proposées pour qualifier une extraction. */
export const CAPTURE_LABELS: string[] = [
  'État civil — vendeur',
  'État civil — acquéreur',
  'État civil — donateur',
  'État civil — donataire',
  'État civil — défunt',
  'État civil — héritier',
  'État civil — emprunteur',
  'Domicile — vendeur',
  'Domicile — acquéreur',
  'Régime matrimonial — vendeur',
  'Régime matrimonial — acquéreur',
  'Société — dénomination, siège, RCS',
  'Représentant — pouvoirs',
  'Désignation du bien',
  'Adresse du bien',
  'Références cadastrales',
  'Lots de copropriété et tantièmes',
  'Superficie loi Carrez',
  'Immatriculation de la copropriété',
  'Syndic',
  'Fonds de roulement',
  'Avance de trésorerie',
  'Fonds de travaux',
  'Charges — budget prévisionnel',
  'Sommes dues par le vendeur',
  'Prix de vente',
  'Dépôt de garantie / séquestre',
  'Prêt — montant, taux, durée',
  'Condition suspensive',
  'Date — délai de réalisation',
  'Origine de propriété',
  'Servitude',
  'Hypothèque / privilège',
  'Diagnostic — DPE',
  'Urbanisme',
  'Clause particulière',
];

/** Suggestions proposées pour qualifier un document entier. */
export const DOC_LABELS: string[] = [
  'Titre de propriété',
  'Compromis / promesse de vente',
  'État daté',
  'Pré-état daté',
  'Règlement de copropriété / EDD',
  'Procès-verbal d\'assemblée générale',
  'Offre de prêt',
  'Pièce d\'identité — vendeur',
  'Pièce d\'identité — acquéreur',
  'Livret de famille',
  'Contrat de mariage / PACS',
  'Acte de décès',
  'Extrait Kbis / statuts',
  'Diagnostics techniques',
  'Note de renseignements d\'urbanisme',
  'État hypothécaire',
  'Relevé de propriété / cadastre',
  'Courrier reçu',
];

const STORE_KEY = 'simone-etiquettes';

/** Étiquettes saisies librement par le notaire, mémorisées sur le poste. */
export function loadCustomLabels(): string[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Mémorise une étiquette (la plus récente en tête, 60 au plus). */
export function rememberLabel(label: string): string[] {
  const l = label.trim();
  const current = loadCustomLabels();
  if (!l) return current;
  const builtIn = CAPTURE_LABELS.includes(l) || DOC_LABELS.includes(l);
  const next = builtIn ? current : [l, ...current.filter((x) => x !== l)].slice(0, 60);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
