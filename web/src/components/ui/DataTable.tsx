'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, MoreVertical } from 'lucide-react';

interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  rowActions?: Array<{
    label: string;
    onClick: (row: T) => void;
  }>;
  pagination?: boolean;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

export const DataTable = React.forwardRef<HTMLDivElement, DataTableProps<any>>(
  ({
    data,
    columns,
    keyField,
    onRowClick,
    rowActions,
    pagination = true,
    pageSize = 10,
    loading = false,
    emptyMessage = 'No data available',
    className,
  }, ref) => {
    const [sortKey, setSortKey] = useState<keyof any | null>(null);
    const [sortDir, setSortDir] = useState<SortDirection>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [activeMenu, setActiveMenu] = useState<any>(null);

    const handleSort = (key: keyof any) => {
      if (sortKey === key) {
        setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc');
        if (sortDir === 'desc') setSortKey(null);
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    };

    let sortedData = [...data];
    if (sortKey && sortDir) {
      sortedData.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const paginatedData = pagination
      ? sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
      : sortedData;

    const totalPages = Math.ceil(sortedData.length / pageSize);

    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin">
            <div className="w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full" />
          </div>
        </div>
      );
    }

    if (paginatedData.length === 0) {
      return (
        <div className="flex items-center justify-center py-8">
          <p className="text-neutral-600 dark:text-neutral-400">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div ref={ref} className={`w-full ${className || ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={`px-4 py-3 text-left text-sm font-semibold text-neutral-900 dark:text-neutral-50 ${
                      col.width || ''
                    }`}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        {col.header}
                        {sortKey === col.key && (
                          sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
                {rowActions && <th className="px-4 py-3 w-12" />}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, idx) => (
                <tr
                  key={String(row[keyField]) || idx}
                  className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300"
                    >
                      {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3 text-center relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === row ? null : row);
                        }}
                        className="hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded p-1"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {activeMenu === row && (
                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10">
                          {rowActions.map((action, i) => (
                            <button
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(row);
                                setActiveMenu(null);
                              }}
                              className="block w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 first:rounded-t last:rounded-b transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-4 py-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Page {currentPage + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 text-sm border border-neutral-200 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-3 py-1 text-sm border border-neutral-200 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

DataTable.displayName = 'DataTable';
