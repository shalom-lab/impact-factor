/** 单文件最大 30MB */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

/** 单表最大行数 */
export const MAX_ROWS = 100_000;

const DATA_PATH_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const ALLOWED_EXT = /\.(csv|xlsx|xls)$/i;

/** 上传时文件名主体允许保留的字符（其余会被去除） */
const STEM_SAFE = /[^\w\u4e00-\u9fff.+()\- ]+/gu;

export function hasSpreadsheetExtension(fileName: string): boolean {
  const base = fileName.replace(/^.*[/\\]/, '').trim();
  return ALLOWED_EXT.test(base);
}

/**
 * 上传前清理文件名：去掉路径、非法字符，统一扩展名小写。
 * 例如 `报告@2025#.xlsx` → `报告2025.xlsx`
 */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, '').trim();
  if (!base) throw new Error('文件名不能为空');

  const match = base.match(/^(.+?)\.(csv|xlsx|xls)$/i);
  if (!match) throw new Error('仅支持 csv/xlsx/xls');

  const ext = match[2].toLowerCase();
  let stem = match[1].replace(/\.\./g, '');

  stem = stem.replace(STEM_SAFE, '');
  stem = stem.replace(/\s+/g, ' ').trim();
  stem = stem.replace(/^[._\-\s]+|[._\-\s]+$/g, '');

  if (!stem) stem = 'upload';

  const normalizedExt = ext === 'csv' ? 'csv' : ext === 'xls' ? 'xls' : 'xlsx';
  let safe = `${stem}.${normalizedExt}`;

  if (safe.length > 255) {
    safe = `${stem.slice(0, 255 - normalizedExt.length - 1)}.${normalizedExt}`;
  }

  return safe;
}

export function validateDataPath(dataPath: string): string {
  const trimmed = dataPath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!trimmed) throw new Error('数据路径不能为空');

  const segments = trimmed.split('/');
  if (segments.some((s) => !s || s === '.' || s === '..')) {
    throw new Error('数据路径不合法，不能包含 ..');
  }
  if (!segments.every((s) => DATA_PATH_SEGMENT.test(s))) {
    throw new Error('数据路径仅允许字母、数字、._-');
  }
  return trimmed;
}

export function validateFileName(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, '');
  if (base !== fileName || base.includes('..') || base.includes('/') || base.includes('\\')) {
    throw new Error(`文件名不合法: ${fileName}`);
  }
  if (!base || base.length > 255 || !ALLOWED_EXT.test(base)) {
    throw new Error(`文件名不合法，仅支持 csv/xlsx/xls: ${fileName}`);
  }
  return base;
}

export function assertFileSize(bytes: number, label = '文件'): void {
  if (bytes > MAX_FILE_BYTES) {
    throw new Error(`${label}超过 ${MAX_FILE_BYTES / 1024 / 1024}MB 限制`);
  }
}

export function limitRows<T>(rows: T[], fileName: string): T[] {
  if (rows.length > MAX_ROWS) {
    throw new Error(`${fileName} 超过 ${MAX_ROWS.toLocaleString()} 行限制`);
  }
  return rows;
}

export function repoFilePath(dataPath: string, fileName: string): string {
  return `${validateDataPath(dataPath)}/${validateFileName(fileName)}`;
}
