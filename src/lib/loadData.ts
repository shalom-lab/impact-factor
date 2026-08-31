import type { AppSettings, StoredFileEntry } from '../types';
import { writeCacheSnapshot, type CacheSnapshot } from './dataCache';
import { fetchRepoSpreadsheetContent, listRepoSpreadsheets } from './github';
import { parseCsvText, parseXlsxBuffer } from './parseData';
import { assertFileSize } from './validation';

export type LoadDataResult = {
  files: StoredFileEntry[];
  fileShas: Record<string, string>;
  hint?: string;
  loadErrors: string[];
  /** 相对缓存是否发生了实质变更（用于静默更新时决定是否打扰 UI） */
  changed: boolean;
};

type LoadOptions = {
  /** 已有缓存：SHA 未变则跳过远端内容拉取 */
  cached?: CacheSnapshot | null;
  /** 拉取完成后写入 IndexedDB */
  persist?: boolean;
};

async function parseRemoteFile(
  cfg: AppSettings,
  meta: { fileName: string; path: string; size: number; sha: string }
): Promise<StoredFileEntry> {
  if (meta.size > 0) {
    assertFileSize(meta.size, meta.fileName);
  }

  const raw = await fetchRepoSpreadsheetContent(
    cfg.token,
    cfg.repo,
    cfg.defaultBranch,
    meta.path
  );

  const parsed = raw.text
    ? parseCsvText(raw.text, raw.fileName)
    : raw.buffer
      ? parseXlsxBuffer(raw.buffer, raw.fileName)
      : null;

  if (!parsed) {
    const bytes = raw.buffer?.byteLength ?? 0;
    const reason =
      bytes === 0
        ? '文件内容为空（大文件可能未正确拉取）'
        : raw.buffer
          ? '工作表无数据或无法解析，已跳过'
          : '无法识别文件格式';
    throw new Error(reason);
  }

  return {
    fileName: parsed.fileName,
    title: parsed.title,
    uploadedAt: new Date().toISOString(),
    sheets: parsed.sheets
  };
}

/**
 * 从 GitHub 加载表格数据。
 * 若提供 cached，则仅对 SHA 变化/新增的文件拉内容，未变文件直接复用缓存。
 */
export async function loadDataFromGitHub(
  cfg: AppSettings,
  options: LoadOptions = {}
): Promise<LoadDataResult> {
  if (!cfg.token?.trim()) {
    return { files: [], fileShas: {}, loadErrors: [], changed: false };
  }

  const spreadsheets = await listRepoSpreadsheets(
    cfg.token,
    cfg.repo,
    cfg.defaultBranch,
    cfg.dataPath
  );

  if (!spreadsheets.length) {
    const empty: LoadDataResult = {
      files: [],
      fileShas: {},
      loadErrors: [],
      changed: Boolean(options.cached?.files.length),
      hint: `仓库 ${cfg.dataPath}/ 目录下暂无 CSV / XLSX 文件，请前往上传页添加。`
    };
    if (options.persist !== false) {
      await writeCacheSnapshot(cfg.repo, cfg.dataPath, { files: [], fileShas: {} });
    }
    return empty;
  }

  const cachedByName = new Map(
    (options.cached?.files ?? []).map((f) => [f.fileName, f] as const)
  );
  const cachedShas = options.cached?.fileShas ?? {};

  const files: StoredFileEntry[] = [];
  const fileShas: Record<string, string> = {};
  const loadErrors: string[] = [];
  let changed = false;

  // 远程文件集合变化也算变更
  const remoteNames = new Set(spreadsheets.map((m) => m.fileName));
  if (cachedByName.size !== remoteNames.size) changed = true;
  for (const name of cachedByName.keys()) {
    if (!remoteNames.has(name)) changed = true;
  }

  for (const meta of spreadsheets) {
    try {
      const cachedEntry = cachedByName.get(meta.fileName);
      const shaMatch = Boolean(meta.sha && cachedShas[meta.fileName] === meta.sha && cachedEntry);

      if (shaMatch && cachedEntry) {
        fileShas[meta.fileName] = meta.sha;
        files.push(cachedEntry);
        continue;
      }

      changed = true;
      const entry = await parseRemoteFile(cfg, meta);
      fileShas[entry.fileName] = meta.sha;
      files.push(entry);
    } catch (err) {
      changed = true;
      // SHA 变了但拉取失败时，尽量保留旧缓存，避免把可用数据冲掉
      const fallback = cachedByName.get(meta.fileName);
      if (fallback && cachedShas[meta.fileName]) {
        files.push(fallback);
        fileShas[meta.fileName] = cachedShas[meta.fileName];
      }
      loadErrors.push(`${meta.fileName}: ${(err as Error).message}`);
    }
  }

  files.sort((a, b) => a.fileName.localeCompare(b.fileName));

  if (options.persist !== false) {
    await writeCacheSnapshot(cfg.repo, cfg.dataPath, { files, fileShas });
  }

  return { files, fileShas, loadErrors, changed };
}
