import { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { SheetData } from '../types';
import { HotSheet } from './HotSheet';

type SheetViewerProps = {
  sheets: SheetData[];
  fileKey: string;
};

export function SheetViewer({ sheets, fileKey }: SheetViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0]));

  useEffect(() => {
    setActiveIndex(0);
    setMounted(new Set([0]));
  }, [fileKey]);

  useEffect(() => {
    if (!sheets.length) return;
    setActiveIndex((prev) => Math.min(prev, sheets.length - 1));
    setMounted((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < sheets.length) next.add(i);
      }
      if (!next.size) next.add(0);
      return next;
    });
  }, [sheets.length]);

  if (!sheets.length) {
    return <p className="empty-hint">选择左侧文件，或前往上传页面添加数据。</p>;
  }

  function selectSheet(index: number) {
    setActiveIndex(index);
    setMounted((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }

  const showTabs = sheets.length > 1;
  const safeIndex = Math.min(activeIndex, sheets.length - 1);
  const active = sheets[safeIndex];

  return (
    <div className="sheet-viewer">
      {showTabs ? (
        <div className="sheet-tabs" role="tablist" aria-label="工作表">
          {sheets.map((sheet, index) => (
            <button
              key={`${fileKey}-${sheet.name}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === safeIndex}
              className={clsx('sheet-tabs__item', { 'sheet-tabs__item--active': index === safeIndex })}
              onClick={() => selectSheet(index)}
              title={`${sheet.name} · ${sheet.data.length} 行`}
            >
              <span className="sheet-tabs__name">{sheet.name}</span>
              <span className="sheet-tabs__count">{sheet.data.length}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="sheet-viewer__body">
        {sheets.map((sheet, index) =>
          mounted.has(index) ? (
            <HotSheet
              key={`${fileKey}-${sheet.name}-${index}`}
              sheet={sheet}
              active={index === safeIndex}
            />
          ) : null
        )}
      </div>

      <div className="sheet-viewer__foot">
        <span>
          {active.name} · {active.data.length.toLocaleString()} 行 · {active.colHeaders.length} 列
        </span>
        {showTabs ? <span>{sheets.length} 个工作表</span> : null}
      </div>
    </div>
  );
}
