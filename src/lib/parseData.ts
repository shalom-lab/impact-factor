import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { normalizeHeaderKey, stripBom } from './encoding';
import { assertFileSize, limitRows, validateFileName } from './validation';

export type ParsedFile = {
  fileName: string;
  title: string;
  rows: Record<string, unknown>[];
};

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(csv|xlsx|xls)$/i, '');
  return base.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      next[normalizeHeaderKey(key)] = value;
    }
    return next;
  });
}

export function parseCsvText(text: string, fileName: string): ParsedFile {
  const safeName = validateFileName(fileName);
  const cleaned = stripBom(text);
  const parsed = Papa.parse<Record<string, unknown>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });

  if (parsed.errors.length) {
    throw new Error(`CSV 解析错误: ${parsed.errors[0].message}`);
  }

  const rows = limitRows(normalizeRows(parsed.data), safeName);

  return {
    fileName: safeName,
    title: titleFromFileName(safeName),
    rows
  };
}

export function parseXlsxBuffer(buffer: ArrayBuffer, fileName: string): ParsedFile | null {
  const safeName = validateFileName(fileName);
  assertFileSize(buffer.byteLength, safeName);

  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return null;

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false
  });

  if (!rows.length) return null;

  const limited = limitRows(normalizeRows(rows), safeName);

  return {
    fileName: safeName,
    title: titleFromFileName(safeName),
    rows: limited
  };
}

export async function parseUploadedFile(file: File): Promise<ParsedFile> {
  assertFileSize(file.size, file.name);
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv')) {
    return parseCsvText(await file.text(), file.name);
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const parsed = parseXlsxBuffer(await file.arrayBuffer(), file.name);
    if (!parsed) throw new Error('XLSX 工作表为空');
    return parsed;
  }

  throw new Error('仅支持 CSV、XLSX、XLS 格式');
}

export function isSupportedFile(file: File): boolean {
  try {
    validateFileName(file.name);
    return true;
  } catch {
    return false;
  }
}
