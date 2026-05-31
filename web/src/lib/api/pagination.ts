import type { PaginatedResponse } from '../types';

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 10;

type PageFetcher<T, P extends object> = (
  params: P & { page: number; limit: number },
) => Promise<PaginatedResponse<T> | T[]>;

export async function fetchAllPaginated<T, P extends object = object>(
  fetchPage: PageFetcher<T, P>,
  params?: P,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = DEFAULT_MAX_PAGES,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await fetchPage({
      ...(params ?? ({} as P)),
      page,
      limit: pageSize,
    });
    const data = Array.isArray(response) ? response : (response.data ?? []);
    all.push(...data);

    if (Array.isArray(response) || !response.meta) {
      return all;
    }

    totalPages = response.meta.totalPages ?? Math.ceil((response.meta.total ?? all.length) / pageSize);
    page += 1;
  } while (page <= totalPages && page <= maxPages);

  if (page <= totalPages) {
    throw new Error(`Paginated response exceeded the ${maxPages}-page safety cap`);
  }

  return all;
}

export function unwrapPaginatedData<T>(response: unknown): T[] {
  const body = response && typeof response === 'object' && 'success' in response && 'data' in response
    ? (response as { data?: unknown }).data
    : response;

  if (Array.isArray(body)) {
    return body as T[];
  }

  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: T[] }).data;
  }

  return [];
}
