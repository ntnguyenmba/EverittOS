export const SUMMARY_LIST_LIMIT = 3;
export const WORKING_LIST_PAGE_SIZE = 10;

export function pageCount(total: number, pageSize = WORKING_LIST_PAGE_SIZE) {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

export function clampPage(page: number, total: number, pageSize = WORKING_LIST_PAGE_SIZE) {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

export function pageSlice<T>(items: T[], page: number, pageSize = WORKING_LIST_PAGE_SIZE) {
  const safePage = clampPage(page, items.length, pageSize);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
