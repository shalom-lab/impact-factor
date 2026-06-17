import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { normalizeHeaderKey, stripBom } from './encoding';

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
  const cleaned = stripBom(text);
  const parsed = Papa.parse<Record<string, unknown>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });

  if (parsed.errors.length) {
    throw new Error(`CSV 解析错误: ${parsed.errors[0].message}`);
  }

  return {
    fileName,
    title: titleFromFileName(fileName),
    rows: normalizeRows(parsed.data)
  };
}

export function parseXlsxBuffer(buffer: ArrayBuffer, fileName: string): ParsedFile {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('XLSX 文件中没有工作表');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false
  });

  if (!rows.length) throw new Error('XLSX 工作表为空');

  return {
    fileName,
    title: titleFromFileName(fileName),
    rows: normalizeRows(rows)
  };
}

export async function parseUploadedFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv')) {
    const text = await file.text();
    return parseCsvText(text, file.name);
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return parseXlsxBuffer(buffer, file.name);
  }

  throw new Error('仅支持 CSV、XLSX、XLS 格式');
}

export function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
}
