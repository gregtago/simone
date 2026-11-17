import type { Capture } from './types';
import { saveFile } from './save';

export type ExportFormat = 'txt' | 'md';

export interface DocRef {
  id: string;
  name: string;
}

/** Nature des documents (« Titre de propriété »…), par identifiant de document. */
export type DocLabels = Record<string, string>;

/** Préambule à l'intention de l'IA qui lira le fichier. */
const LABEL_NOTE =
  'Les mentions « Nature du document » et « Étiquette » ont été posées par le notaire : ' +
  'elles qualifient l\'information extraite et priment sur toute déduction.';

const METHOD_LABEL: Record<string, string> = {
  texte: 'texte natif',
  ocr: 'OCR',
  erreur: 'erreur',
  'en-cours': 'en cours',
};

/**
 * Regroupe les extractions par document (ordre d'ouverture), puis par page.
 * Les documents fermés mais dont des extractions subsistent sont conservés,
 * placés après les documents encore ouverts.
 */
function grouped(captures: Capture[], docs: DocRef[], labels: DocLabels) {
  const order = new Map<string, number>();
  const names = new Map<string, string>();
  docs.forEach((d, i) => {
    order.set(d.id, i);
    names.set(d.id, d.name);
  });
  let extra = docs.length;
  for (const c of captures) {
    if (!order.has(c.docId)) {
      order.set(c.docId, extra++);
      names.set(c.docId, c.docName);
    }
  }

  const byDoc = new Map<string, Capture[]>();
  for (const c of captures) {
    if (!c.text) continue; // on n'exporte que les extractions abouties
    const arr = byDoc.get(c.docId) ?? [];
    arr.push(c);
    byDoc.set(c.docId, arr);
  }

  return [...byDoc.entries()]
    .sort((a, b) => (order.get(a[0])! - order.get(b[0])!))
    .map(([docId, caps]) => ({
      name: names.get(docId) ?? caps[0]?.docName ?? 'Document',
      label: labels[docId]?.trim() || '',
      caps: caps.sort((a, b) => a.page - b.page || a.createdAt - b.createdAt),
    }));
}

function stamp(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return fmt.format(now);
}

function hasLabels(captures: Capture[], labels: DocLabels): boolean {
  return captures.some((c) => c.text && c.label?.trim()) || Object.values(labels).some((l) => l.trim());
}

export function buildText(captures: Capture[], docs: DocRef[], labels: DocLabels = {}): string {
  const groups = grouped(captures, docs, labels);
  const out: string[] = [`Simone — Extractions`, `Généré le ${stamp()}`];
  if (hasLabels(captures, labels)) out.push(LABEL_NOTE);
  out.push('='.repeat(48), '');
  for (const g of groups) {
    out.push(`## ${g.name}`);
    if (g.label) out.push(`Nature du document : ${g.label}`);
    out.push('');
    for (const c of g.caps) {
      const conf = c.status === 'ocr' && c.confidence != null ? ` ${c.confidence}%` : '';
      out.push(`[Page ${c.page} · ${METHOD_LABEL[c.status] ?? c.status}${conf}]`);
      if (c.label?.trim()) out.push(`Étiquette : ${c.label.trim()}`);
      out.push(c.text, '');
    }
  }
  return out.join('\n').trimEnd() + '\n';
}

export function buildMarkdown(captures: Capture[], docs: DocRef[], labels: DocLabels = {}): string {
  const groups = grouped(captures, docs, labels);
  const out: string[] = [`# Simone — Extractions`, '', `*Généré le ${stamp()}*`, ''];
  if (hasLabels(captures, labels)) out.push(`> ${LABEL_NOTE}`, '');
  for (const g of groups) {
    out.push(`## ${g.name}`, '');
    if (g.label) out.push(`**Nature du document :** ${g.label}`, '');
    for (const c of g.caps) {
      const conf = c.status === 'ocr' && c.confidence != null ? ` (${c.confidence} %)` : '';
      out.push(`### Page ${c.page} — ${METHOD_LABEL[c.status] ?? c.status}${conf}`, '');
      if (c.label?.trim()) out.push(`**Étiquette :** ${c.label.trim()}`, '');
      // Le texte tel quel ; les sauts de ligne sont préservés.
      out.push(c.text, '');
    }
  }
  return out.join('\n').trimEnd() + '\n';
}

function fileStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export type ExportResult = 'saved' | 'downloaded' | 'cancelled' | 'empty';

/**
 * Génère le fichier d'export et l'enregistre (boîte « Enregistrer sous… » si
 * disponible, sinon téléchargement). Retourne 'empty' s'il n'y a rien à exporter.
 */
export async function exportCaptures(
  format: ExportFormat,
  captures: Capture[],
  docs: DocRef[],
  labels: DocLabels = {},
): Promise<ExportResult> {
  const hasContent = captures.some((c) => c.text);
  if (!hasContent) return 'empty';
  const base = `simone-extractions-${fileStamp()}`;
  if (format === 'md') {
    return saveFile(`${base}.md`, buildMarkdown(captures, docs, labels), 'text/markdown;charset=utf-8', {
      'text/markdown': ['.md'],
    });
  }
  return saveFile(`${base}.txt`, buildText(captures, docs, labels), 'text/plain;charset=utf-8', {
    'text/plain': ['.txt'],
  });
}
