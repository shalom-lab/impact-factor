import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { stripBom } from './encoding';
import type { CellValue, SheetData } from '../types';
import {
  assertFileSize,
  assertSheetCount,
  hasSpreadsheetExtension,
  limitRows,
  sanitizeFileName,
  validateFileName
} from './validation';

export type ParsedFile = {
  fileName: string;
  originalFileName?: string;
  title: string;
  sheets: SheetData[];
};

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(csv|xlsx|xls)$/i, '');
  return base.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function cellValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function maxRowLength(aoa: unknown[][]): number {
  let max = 0;
  for (const row of aoa) {
    if (Array.isArray(row) && row.length > max) max = row.length;
  }
  return max;
}

function gridFromAoA(aoa: unknown[][], fileName: string, sheetName: string): SheetData | null {
  if (!aoa.length) return null;

  const headerRow = aoa[0] ?? [];
  const colCount = Math.max(headerRow.length, maxRowLength(aoa), 1);

  const colHeaders = Array.from({ length: colCount }, (_, i) => {
    const raw = headerRow[i];
    const label = raw === null || raw === undefined || String(raw).trim() === '' ? `列 ${i + 1}` : String(raw).trim();
    return label.replace(/^\uFEFF/, '');
  });

  const body = aoa.slice(1).filter((row) => {
    if (!Array.isArray(row)) return false;
    return row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '');
  });

  if (!body.length && colHeaders.every((h) => h.startsWith('列 '))) {
    return null;
  }

  const limited = limitRows(body, `${fileName}:${sheetName}`);
  const data: CellValue[][] = limited.map((row) => {
    const cells = Array.isArray(row) ? row : [];
    return Array.from({ length: colCount }, (_, i) => cellValue(cells[i] ?? null));
  });

  return { name: sheetName, colHeaders, data };
}

export function parseCsvText(text: string, fileName: string): ParsedFile {
  const safeName = validateFileName(fileName);
  const cleaned = stripBom(text);
  const parsed = Papa.parse<unknown[]>(cleaned, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: true
  });

  if (parsed.errors.length) {
    throw new Error(`CSV 解析错误: ${parsed.errors[0].message}`);
  }

  const sheet = gridFromAoA(parsed.data, safeName, 'Sheet1');
  if (!sheet) {
    throw new Error('CSV 无有效数据');
  }

  return {
    fileName: safeName,
    title: titleFromFileName(safeName),
    sheets: [sheet]
  };
}

export function parseXlsxBuffer(buffer: ArrayBuffer, fileName: string): ParsedFile | null {
  const safeName = validateFileName(fileName);
  assertFileSize(buffer.byteLength, safeName);

  const workbook = XLSX.read(buffer, { type: 'array' });
  if (!workbook.SheetNames.length) return null;

  assertSheetCount(workbook.SheetNames.length, safeName);

  const sheets: SheetData[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false
    });

    const grid = gridFromAoA(aoa, safeName, sheetName);
    if (grid) sheets.push(grid);
  }

  if (!sheets.length) return null;

  return {
    fileName: safeName,
    title: titleFromFileName(safeName),
    sheets
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

export function totalRows(sheets: SheetData[]): number {
  return sheets.reduce((sum, s) => sum + s.data.length, 0);
}
