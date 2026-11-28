// Links and limits shared by the T4 Blog pages and components (server and browser).
// Plain module (no "use client"), so Server Components can call these too.

/** Tags have at most 30 characters (BLG-08, openapi). */
export const TAG_MAX_LENGTH = 30;

/** The criteria of P-29, the two query parameters of GET /api/posts (BLG-02, BLG-09). */
export type BlogSearch = { keyword?: string; tag?: string };

/** "/blog?keyword=nile&tag=egypt&page=2" (empty criteria and page 1 are left out). */
export function blogHref({ keyword, tag }: BlogSearch, page = 1): string {
  const query = new URLSearchParams();
  if (keyword) query.set("keyword", keyword);
  if (tag) query.set("tag", tag);
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

/** "/blog/tags/new%20york": the tag page (P-31, BLG-08). */
export const tagHref = (tag: string) => `/blog/tags/${encodeURIComponent(tag)}`;

/** "/blog/<id>": the post page (P-30). */
export const postHref = (id: string) => `/blog/${encodeURIComponent(id)}`;

/** "/authors/<id>": the public author page (P-32, BLG-12). */
export const authorHref = (id: string) => `/authors/${encodeURIComponent(id)}`;
