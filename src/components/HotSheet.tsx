import { useEffect, useMemo, useRef } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import type { HotTableRef } from '@handsontable/react-wrapper';
import type { SheetData } from '../types';

type HotSheetProps = {
  sheet: SheetData;
  active: boolean;
  searchQuery: string;
};

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

  useEffect(() => {
    if (!active) return;
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    requestAnimationFrame(() => {
      hot.render();
      hot.refreshDimensions();
    });
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
      />
    </div>
  );
}
