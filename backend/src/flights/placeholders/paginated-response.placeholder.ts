// TODO(AREA-3): PLACEHOLDER until Area 3's pagination helper is merged. Replace this type with the shared PaginatedResponse and delete this file.
// Requirements: GEN-04, GEN-05.
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
