import { fetchRepoSpreadsheetContent, listRepoSpreadsheets } from './github';
import type { AppSettings, StoredFileEntry } from '../types';
import { parseCsvText, parseXlsxBuffer } from './parseData';

export type LoadDataResult = {
  files: StoredFileEntry[];
  fileShas: Record<string, string>;
  hint?: string;
};

export async function loadDataFromGitHub(cfg: AppSettings): Promise<LoadDataResult> {
  if (!cfg.token?.trim()) {
    return { files: [], fileShas: {} };
  }

  const spreadsheets = await listRepoSpreadsheets(
    cfg.token,
    cfg.repo,
    cfg.defaultBranch,
    cfg.dataPath
  );

  if (!spreadsheets.length) {
    return {
      files: [],
      fileShas: {},
      hint: `仓库 ${cfg.dataPath}/ 目录下暂无 CSV / XLSX 文件，请前往上传页添加。`
    };
  }

  const now = new Date().toISOString();
  const files: StoredFileEntry[] = [];
  const fileShas: Record<string, string> = {};

  for (const meta of spreadsheets) {
    fileShas[meta.fileName] = meta.sha;

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

    if (!parsed) continue;

    files.push({
      fileName: parsed.fileName,
      title: parsed.title,
      uploadedAt: now,
      rows: parsed.rows
    });
  }

  return { files, fileShas };
}
