// Enregistrement de fichier : boîte « Enregistrer sous… » (Chrome/Edge) via
// l'API File System Access, avec repli sur le téléchargement classique.

export type SaveResult = 'saved' | 'downloaded' | 'cancelled';

type Accept = Record<string, string[]>;
type SaveData = ArrayBufferView | ArrayBuffer | Blob | string;

/**
 * Ouvre le sélecteur d'emplacement. Retourne un handle, 'cancelled' si annulé,
 * ou null si l'API n'est pas disponible. DOIT être appelée pendant le geste
 * utilisateur (avant tout traitement long).
 */
export async function pickSaveLocation(
  name: string,
  mime: string,
  accept: Accept,
): Promise<FileSystemFileHandle | 'cancelled' | null> {
  const picker = (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> })
    .showSaveFilePicker;
  if (!picker) return null;
  try {
    return await picker({ suggestedName: name, types: [{ description: mime, accept }] });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    return null; // autre erreur → repli
  }
}

function toBlob(data: SaveData, mime: string): Blob {
  return data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
}

/**
 * Écrit les données dans l'emplacement choisi, puis relit la taille du
 * fichier : la boîte « Enregistrer sous » crée le fichier vide d'emblée, et
 * une écriture interrompue le laisserait vide sans rien dire. Lève une erreur
 * si le fichier n'a pas reçu ses données.
 */
export async function writeToHandle(handle: FileSystemFileHandle, data: SaveData, mime = 'application/octet-stream') {
  const blob = toBlob(data, mime);
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (e) {
    try {
      await writable.abort();
    } catch {
      /* ignore */
    }
    throw e;
  }
  const written = await handle.getFile().then((f) => f.size).catch(() => blob.size);
  if (written !== blob.size) throw new Error(`Écriture incomplète (${written} / ${blob.size} octets)`);
}

/** Téléchargement classique (dossier Téléchargements). */
export function downloadFile(name: string, data: SaveData, mime: string) {
  // application/octet-stream : Safari télécharge au lieu d'ouvrir le texte
  // dans un onglet ; le nom du fichier garde l'extension voulue.
  const blob = new Blob([toBlob(data, mime)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Ne PAS libérer l'adresse tout de suite : Safari, Firefox et les
  // applications installées lisent le contenu après le clic, et une adresse
  // libérée trop tôt donne un fichier vide.
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

/**
 * Enregistre des données déjà prêtes (construction synchrone) : ouvre le
 * sélecteur si dispo, sinon télécharge. Pour des données longues à construire,
 * préférer pickSaveLocation (pendant le clic) puis writeToHandle.
 */
export async function saveFile(name: string, data: SaveData, mime: string, accept: Accept): Promise<SaveResult> {
  const handle = await pickSaveLocation(name, mime, accept);
  if (handle === 'cancelled') return 'cancelled';
  if (handle) {
    try {
      await writeToHandle(handle, data, mime);
      return 'saved';
    } catch {
      // Écriture refusée ou incomplète : on retombe sur le téléchargement.
      downloadFile(name, data, mime);
      return 'downloaded';
    }
  }
  downloadFile(name, data, mime);
  return 'downloaded';
}
