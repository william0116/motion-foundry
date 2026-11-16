// Local project storage backed by IndexedDB. Projects keep the editable
// settings plus an optional image Blob; nothing leaves the browser.
// The renderer needs a decoded HTMLImageElement, so images are restored
// from their Blob on load.
const DB_NAME = 'motion-foundry';
const DB_VERSION = 1;
const STORE = 'projects';
export const MAX_PROJECTS = 50;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Serialize settings for structured clone: the decoded HTMLImageElement is
// replaced by the original upload Blob kept alongside it.
function serialize(settings) {
  const { image, imageFile, ...rest } = settings;
  return { settings: rest, imageFile: imageFile || null };
}

export async function listProjects() {
  const db = await openDB();
  const all = await req(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
  return all
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ id, name, effectId, updatedAt, hasImage }) => ({
      id,
      name,
      effectId,
      updatedAt,
      hasImage: !!hasImage,
    }));
}

export async function saveProject({ id, name, effectId, settings }) {
  const db = await openDB();
  const existing = await req(db.transaction(STORE, 'readonly').objectStore(STORE).count());
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  const currentId = id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (!id && existing >= MAX_PROJECTS)
    throw new Error(`最多保存 ${MAX_PROJECTS} 个工程，请先删除不用的工程。`);
  const { settings: clean, imageFile } = serialize(settings);
  const record = {
    id: currentId,
    name: String(name || '未命名工程').slice(0, 40),
    effectId,
    settings: clean,
    imageFile: imageFile || null,
    hasImage: !!imageFile,
    updatedAt: Date.now(),
  };
  await req(store.put(record));
  return currentId;
}

// Returns { id, name, effectId, settings } with settings.image restored to a
// decoded HTMLImageElement when an image Blob was saved.
export async function loadProject(id) {
  const db = await openDB();
  const record = await req(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
  if (!record) throw new Error('工程不存在或已被删除');
  const settings = { ...record.settings, image: null, imageFile: null };
  if (record.imageFile) {
    const url = URL.createObjectURL(record.imageFile);
    try {
      const im = new Image();
      im.src = url;
      await im.decode();
      settings.image = im;
      settings.imageFile = record.imageFile;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return { id: record.id, name: record.name, effectId: record.effectId, settings };
}

export async function renameProject(id, name) {
  const db = await openDB();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  const record = await req(store.get(id));
  if (!record) throw new Error('工程不存在或已被删除');
  record.name = String(name || '未命名工程').slice(0, 40);
  record.updatedAt = Date.now();
  await req(store.put(record));
}

export async function deleteProject(id) {
  const db = await openDB();
  await req(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
}

// Keep the original File/Blob alongside the decoded image so projects can be
// persisted without re-encoding. Called from the upload handler.
export function attachImageFile(settings, file) {
  settings.imageFile = file;
}
