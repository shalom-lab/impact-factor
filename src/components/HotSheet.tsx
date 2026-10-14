import { useCallback, useEffect, useMemo, useRef } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import type { HotTableRef } from '@handsontable/react-wrapper';
import type { CellValue, SheetData } from '../types';

type HotSheetProps = {
  sheet: SheetData;
  active: boolean;
  searchQuery: string;
};

type ColumnScale = { min: number; max: number; ranks?: Map<number, number> } | null;
type ColAlign = 'htCenter' | 'htLeft';

const NUMERIC_DOMINANCE = 0.7;
const VALUE_FILTER_ROW_LIMIT = 1500;
const SCALE_SAMPLE_CAP = 4000;
const ALIGN_SAMPLE_CAP = 800;

function parseNumeric(value: CellValue): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').replace(/%$/, '').replace(/^[¥$€£]\s?/, '');
  if (!cleaned || /[a-zA-Z\u4e00-\u9fff]/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function cellText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Per-sheet, per-column alignment guess from cell values only (no header/schema).
 * Multi-sheet workbooks: each HotSheet instance samples its own sheet.data.
 * Short / uniform / compact numeric → center; long or uneven text → left.
 */
function guessColumnAligns(data: CellValue[][], colCount: number): ColAlign[] {
  const sample = data.length > ALIGN_SAMPLE_CAP ? data.slice(0, ALIGN_SAMPLE_CAP) : data;
  const aligns: ColAlign[] = [];

  for (let c = 0; c < colCount; c++) {
    const texts: string[] = [];
    let numeric = 0;
    let min = Infinity;
    let max = -Infinity;

    for (const row of sample) {
      const t = cellText(row[c]);
      if (!t) continue;
      texts.push(t);
      const n = parseNumeric(row[c]);
      if (n !== null) {
        numeric++;
        if (n < min) min = n;
        if (n > max) max = n;
      }
    }

    if (!texts.length) {
      aligns.push('htLeft');
      continue;
    }

    const lengths = texts.map((t) => t.length);
    const maxLen = Math.max(...lengths);
    const minLen = Math.min(...lengths);
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const unique = new Set(texts);
    const uniqueRatio = unique.size / texts.length;
    const mostlyNumeric = numeric / texts.length >= NUMERIC_DOMINANCE;
    const smallNumericRange = mostlyNumeric && Number.isFinite(min) && Number.isFinite(max) && max - min <= 100;

    // short / low-cardinality / compact text → center
    const shortUniform =
      maxLen <= 4 ||
      (maxLen <= 8 && unique.size <= 24 && avgLen <= 4) ||
      (unique.size <= 12 && maxLen <= 6 && uniqueRatio < 0.35);

    // long or highly variable length → left
    const titleLike = avgLen >= 10 || maxLen >= 18 || (maxLen - minLen >= 12 && avgLen >= 6);

    if (titleLike && !mostlyNumeric) {
      aligns.push('htLeft');
    } else if (shortUniform || smallNumericRange || mostlyNumeric) {
      aligns.push('htCenter');
    } else {
      aligns.push('htLeft');
    }
  }

  return aligns;
}

function buildColumnScales(data: CellValue[][], colCount: number): ColumnScale[] {
  const scales: ColumnScale[] = [];
  const sample = data.length > SCALE_SAMPLE_CAP ? data.slice(0, SCALE_SAMPLE_CAP) : data;
  for (let c = 0; c < colCount; c++) {
    let numeric = 0;
    let nonEmpty = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const row of sample) {
      const cell = row[c];
      if (cell === null || cell === undefined || cell === '') continue;
      nonEmpty++;
      const n = parseNumeric(cell);
      if (n === null) continue;
      numeric++;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    if (nonEmpty > 0 && numeric / nonEmpty >= NUMERIC_DOMINANCE && Number.isFinite(min) && Number.isFinite(max)) {
      // Collect numeric values again for discrete ranking when cardinality is small
      const nums: number[] = [];
      for (const row of sample) {
        const n = parseNumeric(row[c]);
        if (n !== null) nums.push(n);
      }
      const uniq = [...new Set(nums)].sort((a, b) => a - b);
      let ranks: Map<number, number> | undefined;
      if (uniq.length >= 2 && uniq.length <= 16) {
        ranks = new Map(uniq.map((v, i) => [v, i]));
      }
      scales.push({ min, max, ranks });
    } else {
      scales.push(null);
    }
  }
  return scales;
}

/** Continuous scale: light red → deep red (readable dark text on light end). */
function heatBackground(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const h = 6 - x * 4; // soft rose → crimson
  const s = 72 + x * 18;
  const l = 94 - x * 46; // ~94% → ~48%
  return `hsl(${h} ${s}% ${l}%)`;
}

/** Few distinct numbers (e.g. 分区 1–4): evenly spaced, clearly different fills. */
function discreteHeatBackground(index: number, count: number): string {
  if (count <= 1) return heatBackground(0.45);
  const t = count === 1 ? 0.5 : index / (count - 1);
  return heatBackground(t);
}

export function HotSheet({ sheet, active, searchQuery }: HotSheetProps) {
  const hotRef = useRef<HotTableRef>(null);
  const scalesRef = useRef<ColumnScale[]>([]);
  const alignsRef = useRef<ColAlign[]>([]);

  const data = useMemo(() => sheet.data.map((row) => row.slice()), [sheet.data]);
  const colHeaders = useMemo(() => [...sheet.colHeaders], [sheet.colHeaders]);

  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      row.some((cell) => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  const colCount = colHeaders.length || (filteredData[0]?.length ?? 0);

  const columnScales = useMemo(() => buildColumnScales(filteredData, colCount), [filteredData, colCount]);
  const columnAligns = useMemo(() => guessColumnAligns(filteredData, colCount), [filteredData, colCount]);

  scalesRef.current = columnScales;
  alignsRef.current = columnAligns;
  const hasAnyScale = useMemo(() => columnScales.some(Boolean), [columnScales]);

  const columns = useMemo(
    () =>
      Array.from({ length: colCount }, (_, i) => ({
        className: columnAligns[i] ?? 'htLeft'
      })),
    [colCount, columnAligns]
  );

  const afterRenderer = useCallback(
    (td: HTMLTableCellElement, _row: number, col: number, _prop: string | number, value: CellValue) => {
      const align = alignsRef.current[col];
      td.style.textAlign = align === 'htCenter' ? 'center' : 'left';

      if (!hasAnyScale) return;
      const scale = scalesRef.current[col];
      if (!scale) return;
      const n = parseNumeric(value);
      if (n === null) return;

      let color: string;
      if (scale.ranks && scale.ranks.has(n)) {
        color = discreteHeatBackground(scale.ranks.get(n)!, scale.ranks.size);
      } else if (scale.max === scale.min) {
        color = heatBackground(0.45);
      } else {
        color = heatBackground((n - scale.min) / (scale.max - scale.min));
      }
      // Beat Handsontable selection / theme backgrounds
      td.style.setProperty('background-color', color, 'important');
      td.style.setProperty('color', '#0f172a', 'important');
    },
    [hasAnyScale]
  );

  const afterGetColHeader = useCallback((col: number, TH: HTMLTableCellElement) => {
    if (col < 0) return;
    const align = alignsRef.current[col] ?? 'htLeft';
    TH.style.textAlign = align === 'htCenter' ? 'center' : 'left';
  }, []);

  const dropdownMenu = useMemo(() => {
    if (filteredData.length > VALUE_FILTER_ROW_LIMIT) {
      return ['filter_by_condition', 'filter_action_bar'];
    }
    return ['filter_by_condition', 'filter_by_value', 'filter_action_bar'];
  }, [filteredData.length]);

  useEffect(() => {
    if (!active) return;
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    const id = requestAnimationFrame(() => {
      hot.refreshDimensions();
    });
    return () => cancelAnimationFrame(id);
  }, [active, sheet.name, filteredData.length, searchQuery]);

  return (
    <div className={active ? 'hot-sheet hot-sheet--active' : 'hot-sheet'} aria-hidden={!active}>
      <HotTable
        ref={hotRef}
        data={filteredData}
        colHeaders={colHeaders}
        columns={columns}
        rowHeaders
        readOnly
        licenseKey="non-commercial-and-evaluation"
        stretchH="all"
        width="100%"
        height="100%"
        rowHeights={17}
        columnHeaderHeight={18}
        rowHeaderWidth={26}
        autoWrapRow={false}
        autoWrapCol={false}
        manualColumnResize
        columnSorting
        filters
        dropdownMenu={dropdownMenu}
        contextMenu={['copy']}
        themeName="ht-theme-main"
        afterRenderer={afterRenderer}
        afterGetColHeader={afterGetColHeader}
        viewportRowRenderingOffset={20}
        viewportColumnRenderingOffset={6}
      />
    </div>
  );
}
