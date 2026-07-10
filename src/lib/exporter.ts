import type { Capture } from './types';

export type ExportFormat = 'txt' | 'md';

export interface DocRef {
  id: string;
  name: string;
}

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
function grouped(captures: Capture[], docs: DocRef[]) {
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

export function buildText(captures: Capture[], docs: DocRef[]): string {
  const groups = grouped(captures, docs);
  const out: string[] = [`Simone — Extractions`, `Généré le ${stamp()}`, '='.repeat(48), ''];
  for (const g of groups) {
    out.push(`## ${g.name}`, '');
    for (const c of g.caps) {
      const conf = c.status === 'ocr' && c.confidence != null ? ` ${c.confidence}%` : '';
      out.push(`[Page ${c.page} · ${METHOD_LABEL[c.status] ?? c.status}${conf}]`);
      out.push(c.text, '');
    }
  }
  return out.join('\n').trimEnd() + '\n';
}

export function buildMarkdown(captures: Capture[], docs: DocRef[]): string {
  const groups = grouped(captures, docs);
  const out: string[] = [`# Simone — Extractions`, '', `*Généré le ${stamp()}*`, ''];
  for (const g of groups) {
    out.push(`## ${g.name}`, '');
    for (const c of g.caps) {
      const conf = c.status === 'ocr' && c.confidence != null ? ` (${c.confidence} %)` : '';
      out.push(`### Page ${c.page} — ${METHOD_LABEL[c.status] ?? c.status}${conf}`, '');
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

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Génère et télécharge le fichier d'export. Retourne false s'il n'y a rien à exporter. */
export function exportCaptures(format: ExportFormat, captures: Capture[], docs: DocRef[]): boolean {
  const hasContent = captures.some((c) => c.text);
  if (!hasContent) return false;
  const base = `simone-extractions-${fileStamp()}`;
  if (format === 'md') {
    download(`${base}.md`, buildMarkdown(captures, docs), 'text/markdown');
  } else {
    download(`${base}.txt`, buildText(captures, docs), 'text/plain');
  }
  return true;
}
