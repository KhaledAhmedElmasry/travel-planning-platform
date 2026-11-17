// Area: Admin, Notifications & Platform Core
// Shared pagination query and response types (page size 10).
// Related: GEN-04, GEN-05.
//
// A list or search with no results returns an empty page (items: [], total: 0, totalPages: 0),
// not an error, so the frontend can show a friendly empty state (GEN-04).
// Every list longer than 10 rows is paginated with page size 10 (GEN-05).

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Default page size for all lists across the platform (GEN-05). */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Standard query DTO for paginated endpoints.
 * Validates `?page=n` where n >= 1 (default 1).
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}

/**
 * Standard envelope returned by every paginated list and search endpoint (GEN-05).
 * Matches the `PaginatedList` schema in docs/api/openapi.yaml.
 */
export interface PaginatedList<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Builds a standard PaginatedList envelope (GEN-05).
 * When no items match, returns an empty page with items: [] and totalPages: 0
 * instead of an error, enabling friendly empty states (GEN-04).
 *
 * @param items The items for the current page (defaults to []).
 * @param total The total count of matching items across all pages.
 * @param page The requested page number (>= 1, defaults to 1).
 * @param pageSize The number of items per page (defaults to 10).
 */
export function paginate<T>(
  items: T[] = [],
  total = 0,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): PaginatedList<T> {
  const safeItems = Array.isArray(items) ? items : [];
  const safeTotal =
    typeof total === 'number' && !Number.isNaN(total)
      ? Math.max(0, total)
      : safeItems.length;
  const safePage =
    typeof page === 'number' && !Number.isNaN(page)
      ? Math.max(1, Math.floor(page))
      : 1;
  const safePageSize =
    typeof pageSize === 'number' && !Number.isNaN(pageSize)
      ? Math.max(1, Math.floor(pageSize))
      : DEFAULT_PAGE_SIZE;

  const totalPages = safeTotal > 0 ? Math.ceil(safeTotal / safePageSize) : 0;

  return {
    items: safeItems,
    page: safePage,
    pageSize: safePageSize,
    total: safeTotal,
    totalPages,
  };
}

/**
 * Returns an empty paginated list response (GEN-04).
 * When a list or search has no results, this helper produces:
 *   { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }
 * which conforms to the PaginatedList schema and avoids errors.
 */
export function emptyPaginatedList<T = unknown>(
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): PaginatedList<T> {
  return paginate<T>([], 0, page, pageSize);
}

/**
 * Helper to compute MongoDB query offset (skip) and limit.
 */
export function getPaginationOffset(
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): { skip: number; limit: number } {
  const safePage =
    typeof page === 'number' && !Number.isNaN(page)
      ? Math.max(1, Math.floor(page))
      : 1;
  const safePageSize =
    typeof pageSize === 'number' && !Number.isNaN(pageSize)
      ? Math.max(1, Math.floor(pageSize))
      : DEFAULT_PAGE_SIZE;

  return {
    skip: (safePage - 1) * safePageSize,
    limit: safePageSize,
  };
}
