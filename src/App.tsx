import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPdf } from './lib/pdf';
import { ocr } from './lib/ocr';
import { looksLikeText, textLayerInRect } from './lib/extract';
import { preprocessForOcr, renderRegionForOcr, thumbnail } from './lib/ocr-image';
import { exportCaptures, type ExportFormat } from './lib/exporter';
import { buildDocIndex, search, type Match, type PageIndex } from './lib/search';
import { buildExtractPdf, downloadPdf, pagesFileName, formatSize } from './lib/extractPages';
import type { Capture, PdfDoc, Tool } from './lib/types';
import { PdfDocumentView } from './components/PdfDocumentView';
import type { SelectionPayload } from './components/PageView';
import { CapturesPanel } from './components/CapturesPanel';
import { FindBar } from './components/FindBar';

// Multiplicateurs appliqués par-dessus l'ajustement à la largeur (1 = ajusté).
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export default function App() {
  const [docs, setDocs] = useState<PdfDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>('cadre');
  const [showDocs, setShowDocs] = useState(true);
  const [showExtractions, setShowExtractions] = useState(true);
  const viewerRef = useRef<HTMLElement>(null);
  const [viewerW, setViewerW] = useState(0);
  const [pageW, setPageW] = useState<number | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [current, setCurrent] = useState(0);
  const [searching, setSearching] = useState(false);
  const [noText, setNoText] = useState(false);
  const indexCache = useRef<Map<string, PageIndex[]>>(new Map());
  const [pageSelect, setPageSelect] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [estSize, setEstSize] = useState<number | null>(null);
  const [sizing, setSizing] = useState(false);
  const [compress, setCompress] = useState(false);
  const builtRef = useRef<{ sig: string; bytes: Uint8Array } | null>(null);
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

  // Largeur disponible de la visionneuse : suivie en continu, donc masquer un
  // panneau la met à jour et le PDF se réajuste tout seul.
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const update = () => setViewerW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Largeur native (en points) de la 1re page du document actif.
  useEffect(() => {
    let cancelled = false;
    if (!active) {
      setPageW(null);
      return;
    }
    active.pdf
      .getPage(1)
      .then((p) => {
        if (!cancelled) setPageW(p.getViewport({ scale: 1 }).width);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);

  // Échelle de rendu = ajustement à la largeur × multiplicateur de zoom.
  const PAGE_PAD = 56; // marges internes + gouttière de scrollbar
  const fitScale = pageW && viewerW ? Math.max(0.2, (viewerW - PAGE_PAD) / pageW) : 1.2;
  const scale = Math.min(6, Math.round(fitScale * zoom * 100) / 100);

  // Recherche dans le document actif (débounce ; index construit à la demande).
  useEffect(() => {
    if (!findOpen || !active) return;
    const q = query;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (!q.trim()) {
        setMatches([]);
        setCurrent(0);
        setNoText(false);
        return;
      }
      let idx = indexCache.current.get(active.id);
      if (!idx) {
        setSearching(true);
        try {
          idx = await buildDocIndex(active.pdf);
        } catch {
          idx = [];
        }
        if (cancelled) return;
        indexCache.current.set(active.id, idx);
        setSearching(false);
      }
      if (cancelled) return;
      setNoText(idx.every((p) => !p.text.trim()));
      setMatches(search(idx, q));
      setCurrent(0);
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, findOpen, active]);

  // On repart propre quand on change de document.
  useEffect(() => {
    setMatches([]);
    setCurrent(0);
    setNoText(false);
    setSelectedPages(new Set());
  }, [activeId]);

  const gotoMatch = useCallback(
    (dir: 1 | -1) => setCurrent((c) => (matches.length ? (c + dir + matches.length) % matches.length : 0)),
    [matches.length],
  );

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

  // Ctrl/Cmd+F ouvre la recherche ; Échap la ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setFindOpen(true);
      } else if (e.key === 'Escape') {
        setFindOpen(false);
      }
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
          added.push({ id: crypto.randomUUID(), name: file.name, pdf, numPages: pdf.numPages, file });
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

  const togglePage = useCallback((n: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }, []);

  const extractPages = useCallback(async () => {
    if (!active || selectedPages.size === 0) return;
    const pages = [...selectedPages];
    const sig = `${active.id}:${compress ? 'c' : ''}:${[...pages].sort((a, b) => a - b).join(',')}`;
    setExtracting(true);
    try {
      // Réutilise les octets déjà calculés pour l'estimation de taille.
      const bytes = builtRef.current?.sig === sig ? builtRef.current.bytes : await buildExtractPdf(active, pages, compress);
      downloadPdf(pagesFileName(active, pages, compress), bytes);
      showToast(`PDF de ${pages.length} page(s) généré`);
    } catch {
      showToast('⚠ Échec de l’extraction');
    } finally {
      setExtracting(false);
    }
  }, [active, selectedPages, compress, showToast]);

  // Poids estimé du PDF à extraire : on construit réellement le fichier (débounce)
  // et on garde ses octets pour le téléchargement.
  useEffect(() => {
    if (!pageSelect || !active || selectedPages.size === 0) {
      setEstSize(null);
      setSizing(false);
      return;
    }
    const pages = [...selectedPages];
    const sig = `${active.id}:${compress ? 'c' : ''}:${[...pages].sort((a, b) => a - b).join(',')}`;
    if (builtRef.current?.sig === sig) {
      setEstSize(builtRef.current.bytes.length);
      return;
    }
    let cancelled = false;
    setSizing(true);
    const t = window.setTimeout(async () => {
      try {
        const bytes = await buildExtractPdf(active, pages, compress);
        if (cancelled) return;
        builtRef.current = { sig, bytes };
        setEstSize(bytes.length);
      } catch {
        if (!cancelled) setEstSize(null);
      } finally {
        if (!cancelled) setSizing(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [pageSelect, active, selectedPages, compress]);

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
    setZoom((z) => {
      const i = ZOOM_STEPS.findIndex((s) => s >= z - 1e-6);
      const idx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, (i < 0 ? ZOOM_STEPS.length - 1 : i) + dir));
      return ZOOM_STEPS[idx];
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
              <span className="zoom-val" title="100 % = ajusté à la largeur">{Math.round(zoom * 100)}%</span>
              <button className="btn-ghost" onClick={() => zoomStep(1)} aria-label="Zoomer">+</button>
            </div>
          )}
          {active && (
            <button
              className={`btn-ghost btn-mode${pageSelect ? ' mode-on' : ''}`}
              onClick={() => setPageSelect((v) => !v)}
              title="Sélectionner des pages et les extraire en PDF"
            >
              ⧉ Pages
            </button>
          )}
          {active && (
            <button
              className={`btn-toggle btn-search${findOpen ? ' toggle-on' : ''}`}
              onClick={() => setFindOpen((v) => !v)}
              title="Rechercher dans le document (Ctrl/Cmd + F)"
              aria-label="Rechercher"
            >
              ⌕
            </button>
          )}
          <div className="panel-toggles">
            {docs.length > 0 && (
              <button
                className={`btn-toggle${showDocs ? ' toggle-on' : ''}`}
                onClick={() => setShowDocs((v) => !v)}
                title="Afficher / masquer les documents"
                aria-pressed={showDocs}
              >
                ◧
              </button>
            )}
            <button
              className={`btn-toggle${showExtractions ? ' toggle-on' : ''}`}
              onClick={() => setShowExtractions((v) => !v)}
              title="Afficher / masquer les extractions"
              aria-pressed={showExtractions}
            >
              ◨
            </button>
          </div>
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
        {docs.length > 0 && showDocs && (
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
        <section className="viewer" ref={viewerRef}>
          {active && findOpen && (
            <FindBar
              query={query}
              onQuery={setQuery}
              total={matches.length}
              current={current}
              searching={searching}
              noText={noText}
              onPrev={() => gotoMatch(-1)}
              onNext={() => gotoMatch(1)}
              onClose={() => setFindOpen(false)}
            />
          )}
          {active && pageSelect && (
            <div className="pagebar">
              <span className="pagebar-count">
                {selectedPages.size > 0 ? (
                  <>
                    {selectedPages.size} page(s)
                    <span className="pagebar-size">
                      {sizing ? ' · calcul…' : estSize != null ? ` · ~${formatSize(estSize)}` : ''}
                    </span>
                  </>
                ) : (
                  'Cliquez les pages à extraire'
                )}
              </span>
              <button
                className="btn-ghost"
                onClick={() => setSelectedPages(new Set(Array.from({ length: active.numPages }, (_, i) => i + 1)))}
              >
                Tout
              </button>
              <button className="btn-ghost" onClick={() => setSelectedPages(new Set())} disabled={selectedPages.size === 0}>
                Aucune
              </button>
              <button
                className={`btn-ghost${compress ? ' toggle-on' : ''}`}
                onClick={() => setCompress((v) => !v)}
                title="Réduit le poids en ré-encodant les pages en images (le texte n'est alors plus sélectionnable)"
              >
                {compress ? '☑' : '☐'} Réduire le poids
              </button>
              <button className="btn-primary" onClick={extractPages} disabled={selectedPages.size === 0 || extracting}>
                {extracting ? 'Extraction…' : 'Extraire en PDF'}
              </button>
              <button className="btn-ghost" onClick={() => setPageSelect(false)} aria-label="Fermer">✕</button>
            </div>
          )}
          {active ? (
            <PdfDocumentView
              doc={active}
              scale={scale}
              tool={tool}
              matches={matches}
              current={current}
              selectMode={pageSelect}
              selectedPages={selectedPages}
              onTogglePage={togglePage}
              onSelect={handleSelect}
            />
          ) : (
            <div className="welcome">
              <div className="welcome-card">
                <div className="welcome-title">Ouvrez un ou plusieurs PDF</div>
                <button className="btn-primary" onClick={() => fileRef.current?.click()}>Ouvrir des PDF</button>
              </div>
            </div>
          )}
        </section>
        {showExtractions && (
          <CapturesPanel
            captures={captures}
            onRemove={removeCapture}
            onClear={clearCaptures}
            onToast={showToast}
            onExport={handleExport}
          />
        )}
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
