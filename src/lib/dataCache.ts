import { STORAGE_PREFIX } from '../constants';
import type { StoredFileEntry } from '../types';

const DB_NAME = `${STORAGE_PREFIX}-idb`;
const DB_VERSION = 1;
const STORE_FILES = 'files';

export type CachedFileRecord = {
  /** `${repo}|${dataPath}|${fileName}` */
  id: string;
  repo: string;
  dataPath: string;
  fileName: string;
  sha: string;
  title: string;
  uploadedAt: string;
  sheets: StoredFileEntry['sheets'];
  cachedAt: string;
};

export type CacheSnapshot = {
  files: StoredFileEntry[];
  fileShas: Record<string, string>;
};

function scopeId(repo: string, dataPath: string, fileName: string): string {
  return `${repo}|${dataPath}|${fileName}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/** 读取某仓库 dataPath 下的全部缓存文件 */
export async function readCacheSnapshot(repo: string, dataPath: string): Promise<CacheSnapshot | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const all = (await idbReq(tx.objectStore(STORE_FILES).getAll())) as CachedFileRecord[];
      const records = all.filter((r) => r.repo === repo && r.dataPath === dataPath);
      if (!records.length) return null;

      const files: StoredFileEntry[] = [];
      const fileShas: Record<string, string> = {};
      for (const r of records) {
        fileShas[r.fileName] = r.sha;
        files.push({
          fileName: r.fileName,
          title: r.title,
          uploadedAt: r.uploadedAt,
          sheets: r.sheets
        });
      }
      files.sort((a, b) => a.fileName.localeCompare(b.fileName));
      return { files, fileShas };
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** 用最新快照整体覆盖该 scope（增删改一次写完） */
export async function writeCacheSnapshot(
  repo: string,
  dataPath: string,
  snapshot: CacheSnapshot
): Promise<void> {
  try {
    const db = await openDb();
    try {
      // 先只读列出旧记录，避免在同一事务里 await 导致自动提交
      const readTx = db.transaction(STORE_FILES, 'readonly');
      const all = (await idbReq(readTx.objectStore(STORE_FILES).getAll())) as CachedFileRecord[];

      const keep = new Set(Object.keys(snapshot.fileShas));
      const toDelete = all
        .filter((old) => old.repo === repo && old.dataPath === dataPath && !keep.has(old.fileName))
        .map((old) => old.id);

      const now = new Date().toISOString();
      const records: CachedFileRecord[] = [];
      for (const entry of snapshot.files) {
        const sha = snapshot.fileShas[entry.fileName];
        if (!sha) continue;
        records.push({
          id: scopeId(repo, dataPath, entry.fileName),
          repo,
          dataPath,
          fileName: entry.fileName,
          sha,
          title: entry.title,
          uploadedAt: entry.uploadedAt,
          sheets: entry.sheets,
          cachedAt: now
        });
      }

      const writeTx = db.transaction(STORE_FILES, 'readwrite');
      const store = writeTx.objectStore(STORE_FILES);
      for (const id of toDelete) store.delete(id);
      for (const record of records) store.put(record);
      await idbTxDone(writeTx);
    } finally {
      db.close();
    }
  } catch {
    // 缓存失败不影响主流程
  }
}

/** 写入或更新单个文件缓存 */
export async function putCachedFile(
  repo: string,
  dataPath: string,
  entry: StoredFileEntry,
  sha: string
): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      tx.objectStore(STORE_FILES).put({
        id: scopeId(repo, dataPath, entry.fileName),
        repo,
        dataPath,
        fileName: entry.fileName,
        sha,
        title: entry.title,
        uploadedAt: entry.uploadedAt,
        sheets: entry.sheets,
        cachedAt: new Date().toISOString()
      } satisfies CachedFileRecord);
      await idbTxDone(tx);
    } finally {
      db.close();
    }
  } catch {
    // ignore
  }
}

/** 删除单个文件缓存 */
export async function removeCachedFile(repo: string, dataPath: string, fileName: string): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      tx.objectStore(STORE_FILES).delete(scopeId(repo, dataPath, fileName));
      await idbTxDone(tx);
    } finally {
      db.close();
    }
  } catch {
    // ignore
  }
}

/** 清空全部数据缓存（清除设置时调用） */
export async function clearAllDataCache(): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      tx.objectStore(STORE_FILES).clear();
      await idbTxDone(tx);
    } finally {
      db.close();
    }
  } catch {
    // ignore
  }
}
