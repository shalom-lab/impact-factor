/** 单文件最大 10MB */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** 单表最大行数 */
export const MAX_ROWS = 100_000;

const DATA_PATH_SEGMENT = /^[a-zA-Z0-9._-]+$/;
const SAFE_FILENAME = /^[a-zA-Z0-9._\-\u4e00-\u9fff()]+\.(csv|xlsx|xls)$/i;

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
  if (!SAFE_FILENAME.test(base)) {
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
