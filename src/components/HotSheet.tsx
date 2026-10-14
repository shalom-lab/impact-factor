import { useCallback, useEffect, useMemo, useRef } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import type { HotTableRef } from '@handsontable/react-wrapper';
import type { CellValue, SheetData } from '../types';

type HotSheetProps = {
  sheet: SheetData;
  active: boolean;
  searchQuery: string;
};

type ColumnScale = { min: number; max: number } | null;

const NUMERIC_DOMINANCE = 0.7;

/** Parse a cell into a finite number; skip empty / non-numeric / textual values. */
function parseNumeric(value: CellValue): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  // Strip common thousand separators / percent / currency wrappers
  const cleaned = raw.replace(/,/g, '').replace(/%$/, '').replace(/^[¥$€£]\s?/, '');
  if (!cleaned || /[a-zA-Z\u4e00-\u9fff]/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Build per-column min/max for numeric-dominant columns on the current filtered rows. */
function buildColumnScales(data: CellValue[][], colCount: number): ColumnScale[] {
  const scales: ColumnScale[] = [];
  for (let c = 0; c < colCount; c++) {
    let numeric = 0;
    let nonEmpty = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const row of data) {
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
      scales.push({ min, max });
    } else {
      scales.push(null);
    }
  }
  return scales;
}

/** Continuous heatmap: pale blue (low) → stronger blue (high); luminance stays high for dark text. */
function heatBackground(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const h = 212 - x * 18; // blue → indigo-blue
  const s = 72 + x * 12;
  const l = 94 - x * 24; // 94% → 70%
  return `hsl(${h} ${s}% ${l}%)`;
}

export function HotSheet({ sheet, active, searchQuery }: HotSheetProps) {
  const hotRef = useRef<HotTableRef>(null);

  // Handsontable 排序/筛选可能原地改写 data，隔离一份副本避免污染全局 state
  const data = useMemo(() => sheet.data.map((row) => row.slice()), [sheet.data]);
  const colHeaders = useMemo(() => [...sheet.colHeaders], [sheet.colHeaders]);

  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      row.some((cell) => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  const columnScales = useMemo(() => {
    const colCount = colHeaders.length || (filteredData[0]?.length ?? 0);
    return buildColumnScales(filteredData, colCount);
  }, [filteredData, colHeaders]);

  const afterRenderer = useCallback(
    (td: HTMLTableCellElement, _row: number, col: number, _prop: string | number, value: CellValue) => {
      const scale = columnScales[col];
      if (!scale) return;
      const n = parseNumeric(value);
      if (n === null) return;
      const t = scale.max === scale.min ? 0.5 : (n - scale.min) / (scale.max - scale.min);
      td.style.backgroundColor = heatBackground(t);
      td.style.color = '#0f172a';
    },
    [columnScales]
  );

  useEffect(() => {
    if (!active) return;
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    requestAnimationFrame(() => {
      hot.render();
      hot.refreshDimensions();
    });
  }, [active, sheet.name, filteredData.length, searchQuery, columnScales]);

  return (
    <div className={active ? 'hot-sheet hot-sheet--active' : 'hot-sheet'} aria-hidden={!active}>
      <HotTable
        ref={hotRef}
        data={filteredData}
        colHeaders={colHeaders}
        rowHeaders
        readOnly
        licenseKey="non-commercial-and-evaluation"
        stretchH="all"
        width="100%"
        height="100%"
        rowHeights={20}
        columnHeaderHeight={24}
        rowHeaderWidth={36}
        autoWrapRow={false}
        autoWrapCol={false}
        manualColumnResize
        manualRowResize
        columnSorting
        filters
        search
        dropdownMenu={['filter_by_condition', 'filter_by_value', 'filter_action_bar']}
        contextMenu={['copy']}
        themeName="ht-theme-main"
        afterRenderer={afterRenderer}
      />
    </div>
  );
}
