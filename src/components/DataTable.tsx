import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';

type DataTableProps = {
  rows: Record<string, unknown>[];
};

export function DataTable({ rows }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]).map((key) => ({
      header: key,
      accessorKey: key
    }));
  }, [rows]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString'
  });

  if (!rows.length) {
    return <p>请选择任意 CSV 文件以查看数据。</p>;
  }

  return (
    <div className="data-table">
      <div className="toolbar">
        <input
          type="search"
          placeholder="搜索…"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
        />
        <span>
          共 {rows.length} 行 · 第 {table.getState().pagination.pageIndex + 1} 页 /{' '}
          {table.getPageCount() || 1}
        </span>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={canSort ? 'sortable' : undefined}
                    >
                      <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                      {sorted ? (
                        <span className="sort-indicator">{sorted === 'asc' ? '↑' : '↓'}</span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button type="button" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
          «
        </button>
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          上一页
        </button>
        <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          下一页
        </button>
        <button
          type="button"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          »
        </button>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(event) => table.setPageSize(Number(event.target.value))}
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              每页 {size} 行
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

