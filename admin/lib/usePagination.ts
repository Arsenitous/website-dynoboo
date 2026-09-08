import { useState, useMemo } from "react";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function usePagination<T>(items: T[], defaultPageSize: PageSize = 10) {
  const [pageSize, setPageSize] = useState<PageSize>(defaultPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever items or pageSize changes
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp current page if out of range
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Reset page to 1 if safePage !== currentPage (data shrunk)
  if (safePage !== currentPage) {
    setCurrentPage(safePage);
  }

  return {
    paginatedItems,
    currentPage: safePage,
    totalPages,
    totalItems,
    pageSize,
    handlePageSizeChange,
    handlePageChange,
    startIndex: totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1,
    endIndex: Math.min(safePage * pageSize, totalItems),
  };
}
