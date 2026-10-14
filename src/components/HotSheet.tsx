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
/** Above this, skip Handsontable "filter by value" (builds a huge unique-value grid → lag). */
const VALUE_FILTER_ROW_LIMIT = 1500;
/** Cap rows scanned when computing heatmap scales. */
const SCALE_SAMPLE_CAP = 4000;

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
      scales.push({ min, max });
    } else {
      scales.push(null);
    }
  }
  return scales;
}

function heatBackground(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const h = 212 - x * 18;
  const s = 72 + x * 12;
  const l = 94 - x * 24;
  return `hsl(${h} ${s}% ${l}%)`;
}

export function HotSheet({ sheet, active, searchQuery }: HotSheetProps) {
  const hotRef = useRef<HotTableRef>(null);
  const scalesRef = useRef<ColumnScale[]>([]);

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

  scalesRef.current = columnScales;
  const hasAnyScale = useMemo(() => columnScales.some(Boolean), [columnScales]);

  const afterRenderer = useCallback(
    (td: HTMLTableCellElement, _row: number, col: number, _prop: string | number, value: CellValue) => {
      if (!hasAnyScale) return;
      const scale = scalesRef.current[col];
      if (!scale) return;
      const n = parseNumeric(value);
      if (n === null) return;
      const t = scale.max === scale.min ? 0.5 : (n - scale.min) / (scale.max - scale.min);
      td.style.backgroundColor = heatBackground(t);
      td.style.color = '#0f172a';
    },
    [hasAnyScale]
  );

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
        rowHeaders
        readOnly
        licenseKey="non-commercial-and-evaluation"
        stretchH="all"
        width="100%"
        height="100%"
        rowHeights={18}
        columnHeaderHeight={22}
        rowHeaderWidth={34}
        autoWrapRow={false}
        autoWrapCol={false}
        manualColumnResize
        columnSorting
        filters
        dropdownMenu={dropdownMenu}
        contextMenu={['copy']}
        themeName="ht-theme-main"
        afterRenderer={hasAnyScale ? afterRenderer : undefined}
        viewportRowRenderingOffset={20}
        viewportColumnRenderingOffset={6}
      />
    </div>
  );
}
