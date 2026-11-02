// TODO(AREA-3): PLACEHOLDER until Area 3 shared pagination response is merged. Replace this type and delete this file.
// Requirement: FLT-12, GEN-05.
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
