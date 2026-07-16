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

/** Écrit les données dans l'emplacement choisi. */
export async function writeToHandle(handle: FileSystemFileHandle, data: SaveData) {
  const writable = await handle.createWritable();
  await writable.write(data as FileSystemWriteChunkType);
  await writable.close();
}

/** Téléchargement classique (dossier Téléchargements). */
export function downloadFile(name: string, data: SaveData, mime: string) {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
    await writeToHandle(handle, data);
    return 'saved';
  }
  downloadFile(name, data, mime);
  return 'downloaded';
}
