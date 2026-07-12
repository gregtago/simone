import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPdf } from './lib/pdf';
import { ocr } from './lib/ocr';
import { looksLikeText, textLayerInRect } from './lib/extract';
import { preprocessForOcr, renderRegionForOcr, thumbnail } from './lib/ocr-image';
import { exportCaptures, type ExportFormat } from './lib/exporter';
import type { Capture, PdfDoc, Tool } from './lib/types';
import { PdfDocumentView } from './components/PdfDocumentView';
import type { SelectionPayload } from './components/PageView';
import { CapturesPanel } from './components/CapturesPanel';

const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5];

export default function App() {
  const [docs, setDocs] = useState<PdfDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [tool, setTool] = useState<Tool>('cadre');
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try {
      return localStorage.getItem('simone-intro-vue') !== '1';
    } catch {
      return true;
    }
  });
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const active = docs.find((d) => d.id === activeId) ?? null;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Copie automatique de chaque texte extrait. La copie après OCR (asynchrone)
  // peut être refusée par le navigateur si l'activation utilisateur a expiré :
  // on le signale doucement, le bouton « Copier » reste disponible.
  const copyToClipboard = useCallback(
    async (text: string) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        showToast('Copié');
      } catch {
        showToast('Texte extrait (copie auto indisponible)');
      }
    },
    [showToast],
  );

  const dismissIntro = () => {
    try {
      localStorage.setItem('simone-intro-vue', '1');
    } catch {
      /* ignore */
    }
    setShowIntro(false);
  };

  // Raccourcis : S = surligneur, C = cadre.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 's' || e.key === 'S') setTool('surligneur');
      else if (e.key === 'c' || e.key === 'C') setTool('cadre');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      const added: PdfDoc[] = [];
      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') continue;
        try {
          const buf = await file.arrayBuffer();
          const pdf = await loadPdf(buf);
          added.push({ id: crypto.randomUUID(), name: file.name, pdf, numPages: pdf.numPages });
        } catch {
          showToast(`⚠ Échec d'ouverture : ${file.name}`);
        }
      }
      if (added.length) {
        setDocs((d) => [...d, ...added]);
        setActiveId(added[added.length - 1].id);
        showToast(added.length > 1 ? `${added.length} PDF ouverts` : 'PDF ouvert');
      }
      setBusy(false);
    },
    [showToast],
  );

  const closeDoc = useCallback(
    (id: string) => {
      setDocs((prev) => {
        const next = prev.filter((d) => d.id !== id);
        setActiveId((cur) => (cur === id ? next[next.length - 1]?.id ?? null : cur));
        return next;
      });
    },
    [],
  );

  // Ferme tous les PDF. On conserve le bloc-notes (extractions) : il peut encore
  // servir à copier ou exporter après fermeture des documents.
  const closeAll = useCallback(() => {
    setDocs([]);
    setActiveId(null);
  }, []);

  const handleSelect = useCallback(
    async (p: SelectionPayload) => {
      if (!active) return;
      const native = textLayerInRect(p.textContent, p.viewport, p.rect);

      if (looksLikeText(native)) {
        setCaptures((c) => [
          {
            id: crypto.randomUUID(),
            docId: active.id,
            docName: active.name,
            page: p.page,
            status: 'texte',
            text: native,
            createdAt: Date.now(),
          },
          ...c,
        ]);
        copyToClipboard(native);
        return;
      }

      // Pas de texte natif → OCR sur l'image de la zone.
      const id = crypto.randomUUID();
      setCaptures((c) => [
        {
          id,
          docId: active.id,
          docName: active.name,
          page: p.page,
          status: 'en-cours',
          text: '',
          createdAt: Date.now(),
        },
        ...c,
      ]);
      try {
        // Re-rendu haute résolution de la seule zone, puis prétraitement.
        const hi = await renderRegionForOcr(p.pageProxy, p.viewport, p.rect);
        const thumb = thumbnail(hi);
        preprocessForOcr(hi);
        // Une zone nettement plus large que haute est probablement une ligne unique.
        const mode = p.rect.w / p.rect.h > 8 ? 'ligne' : 'bloc';
        const res = await ocr(hi, mode);
        setCaptures((c) =>
          c.map((x) =>
            x.id === id
              ? { ...x, status: res.text ? 'ocr' : 'erreur', text: res.text, confidence: res.confidence, thumb }
              : x,
          ),
        );
        if (res.text) copyToClipboard(res.text);
      } catch {
        setCaptures((c) => c.map((x) => (x.id === id ? { ...x, status: 'erreur' } : x)));
        showToast('⚠ Échec de l’OCR');
      }
    },
    [active, showToast, copyToClipboard],
  );

  const removeCapture = (id: string) => setCaptures((c) => c.filter((x) => x.id !== id));
  const clearCaptures = () => setCaptures([]);

  const handleExport = (format: ExportFormat) => {
    const docRefs = docs.map((d) => ({ id: d.id, name: d.name }));
    const ok = exportCaptures(format, captures, docRefs);
    showToast(ok ? `Export ${format === 'md' ? '.md' : '.txt'} généré` : 'Rien à exporter');
  };

  const zoomStep = (dir: 1 | -1) => {
    setScale((s) => {
      const i = ZOOMS.findIndex((z) => z >= s);
      const idx = Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? ZOOMS.length - 1 : i) + dir));
      return ZOOMS[idx];
    });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="./logo-simone-3.png" alt="Simone — OCR sélectif" />
        </div>
        <div className="topbar-actions">
          {active && (
            <div className="tool-switch" role="group" aria-label="Outil de sélection">
              <button
                className={`tool-btn${tool === 'surligneur' ? ' tool-active' : ''}`}
                onClick={() => setTool('surligneur')}
                title="Surligneur — trait à main levée (S)"
              >
                <span className="tool-glyph">🖍</span> Surligneur
              </button>
              <button
                className={`tool-btn${tool === 'cadre' ? ' tool-active' : ''}`}
                onClick={() => setTool('cadre')}
                title="Cadre — rectangle précis (C)"
              >
                <span className="tool-glyph">⬚</span> Cadre
              </button>
            </div>
          )}
          {active && (
            <div className="zoom">
              <button className="btn-ghost" onClick={() => zoomStep(-1)} aria-label="Dézoomer">−</button>
              <span className="zoom-val">{Math.round(scale * 100)}%</span>
              <button className="btn-ghost" onClick={() => zoomStep(1)} aria-label="Zoomer">+</button>
            </div>
          )}
          <button className="btn-help" onClick={() => setShowIntro(true)} title="Aide / à propos" aria-label="Aide">?</button>
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Ouverture…' : 'Ouvrir des PDF'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => {
              openFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <main className="workspace">
        {docs.length > 0 && (
          <aside className="doc-sidebar">
            <div className="doc-sidebar-head">
              <span className="section-label">Documents</span>
              <button className="btn-ghost" onClick={closeAll} title="Fermer tous les PDF">Fermer tous</button>
            </div>
            <ul className="doc-list">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className={`doc-item${d.id === activeId ? ' doc-item-active' : ''}`}
                  onClick={() => setActiveId(d.id)}
                >
                  <span className="doc-item-name" title={d.name}>{d.name}</span>
                  <button
                    className="doc-item-close"
                    aria-label="Fermer"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeDoc(d.id);
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
        <section className="viewer">
          {active ? (
            <PdfDocumentView doc={active} scale={scale} tool={tool} onSelect={handleSelect} />
          ) : (
            <div className="welcome">
              <div className="welcome-card">
                <div className="welcome-title">Ouvrez un ou plusieurs PDF</div>
                <button className="btn-primary" onClick={() => fileRef.current?.click()}>Ouvrir des PDF</button>
              </div>
            </div>
          )}
        </section>
        <CapturesPanel
          captures={captures}
          onRemove={removeCapture}
          onClear={clearCaptures}
          onToast={showToast}
          onExport={handleExport}
        />
      </main>

      {showIntro && (
        <div className="modal-overlay" onClick={dismissIntro}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <img className="modal-logo" src="./logo-simone-3.png" alt="Simone" />
            <p className="modal-lead">
              Visionneuse PDF avec extraction sélective : vous voyez le document, et vous ne faites
              extraire <strong>que</strong> les passages que vous désignez.
            </p>
            <ol className="modal-steps">
              <li><strong>Ouvrez</strong> un ou plusieurs PDF (onglets en haut).</li>
              <li>
                <strong>Marquez</strong> le passage à extraire :
                <span className="modal-tool">🖍 Surligneur</span> pour une ligne,
                <span className="modal-tool">⬚ Cadre</span> pour un bloc (touches <kbd>S</kbd> / <kbd>C</kbd>).
              </li>
              <li>
                Le texte est lu directement s’il existe dans le PDF, sinon reconnu par <strong>OCR</strong>.
                Il s’ajoute au bloc-notes à droite <strong>et est copié automatiquement</strong>.
              </li>
              <li><strong>Exportez</strong> le tout en <code>.txt</code> ou <code>.md</code>.</li>
            </ol>
            <p className="modal-priv">🔒 Tout se passe sur votre poste — aucun document n’est envoyé sur Internet.</p>
            <button className="btn-primary modal-btn" onClick={dismissIntro}>Commencer</button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
