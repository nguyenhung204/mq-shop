export function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 1) return [];

  // When totalPages is small (<= 5), show all pages without ellipsis
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // When near the start: 1, 2, 3, "...", totalPages (5 items max)
  if (currentPage <= 3) {
    return [1, 2, 3, "...", totalPages];
  }

  // When near the end: 1, "...", totalPages - 2, totalPages - 1, totalPages (5 items max)
  if (currentPage >= totalPages - 2) {
    return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  }

  // When in the middle: 1, "...", currentPage, "...", totalPages (5 items max)
  return [1, "...", currentPage, "...", totalPages];
}

export function calculateRange(page: number, pageSize: number, total: number) {
  if (total <= 0) return { from: 0, to: 0 };
  const from = Math.max(1, Math.min((page - 1) * pageSize + 1, total));
  const to = Math.min(page * pageSize, total);
  return { from, to };
}

