/** 리더 오프라인 대기열 (IndexedDB, 최대 500건) */
const DB_NAME = 'chak-reader';
const STORE = 'queue';
export const QUEUE_MAX = 500;

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function queueCount() {
  const db = await openDb();
  return requestToPromise(db.transaction(STORE).objectStore(STORE).count());
}

/** 가득 차면 false (새 태그를 거절하고 화면에 안내) */
export async function enqueue(item) {
  if ((await queueCount()) >= QUEUE_MAX) return false;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).add({ code: item.code, chip_uid: item.chip_uid, tagged_at: item.tagged_at });
  await txDone(tx);
  return true;
}

export async function peekQueue(limit) {
  const db = await openDb();
  return requestToPromise(db.transaction(STORE).objectStore(STORE).getAll(undefined, limit));
}

export async function removeFromQueue(ids) {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  for (const id of ids) store.delete(id);
  await txDone(tx);
}

export async function clearQueue() {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await txDone(tx);
}
