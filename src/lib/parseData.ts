import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { normalizeHeaderKey, stripBom } from './encoding';
import { assertFileSize, hasSpreadsheetExtension, limitRows, sanitizeFileName, validateFileName } from './validation';

export type ParsedFile = {
  fileName: string;
  originalFileName?: string;
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
  const safeName = sanitizeFileName(file.name);
  assertFileSize(file.size, safeName);
  const lower = safeName.toLowerCase();

  let parsed: ParsedFile;
  if (lower.endsWith('.csv')) {
    parsed = parseCsvText(await file.text(), safeName);
  } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const result = parseXlsxBuffer(await file.arrayBuffer(), safeName);
    if (!result) throw new Error('XLSX 工作表为空');
    parsed = result;
  } else {
    throw new Error('仅支持 CSV、XLSX、XLS 格式');
  }

  const original = file.name.replace(/^.*[/\\]/, '').trim();
  if (original !== safeName) {
    parsed.originalFileName = original;
  }
  return parsed;
}

export function isSupportedFile(file: File): boolean {
  return hasSpreadsheetExtension(file.name);
}
