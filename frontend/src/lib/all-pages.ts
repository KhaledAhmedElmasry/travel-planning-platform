// Every item of a paginated backend list (GEN-05: 10 per page), e.g. all cities for the home page.
//   const cities = await allPages((page) => backendJson<Paginated<City>>(`/api/cities?page=${page}`));
// A page that comes back null (401/403/404) ends the list with what was read so far.
export async function allPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; totalPages: number } | null>,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const res = await fetchPage(page);
    items.push(...(res?.items ?? []));
    if (!res || page >= res.totalPages) return items;
  }
}
