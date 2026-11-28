// P-29 Blog: /blog
// Part: T4 Blog
// Requirements: BLG-02, BLG-09
// Endpoints: GET /api/posts
// Rendering: Dynamic SSR. Source: .md section 9 "Blog Listing / Search".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-29). Use a shell and kit components (frontend/README.md).
// Built (28 Nov): published posts, newest first (BLG-02); keyword search on title, tags or author name, ordered by
// likes + comments (BLG-09, the backend orders); tag filter (BLG-02); criteria and page in the URL, 10 per page
// (GEN-05); "No results" / "No posts yet" empty states (GEN-04); loading skeleton (loading.tsx); a failed load
// shows the app error page with "Try again" (src/app/error.tsx, GEN-16). Guests and every role can open it.
import type { Metadata } from "next";
import Link from "next/link";
import { blogHref, type BlogSearch } from "@/components/app/blog/blog-links";
import { BlogSearchBar } from "@/components/app/blog/blog-search-bar";
import { PostCard, type PostSummaryPage } from "@/components/app/blog/post-card";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { backendJson } from "@/lib/server/backend";
import { getSessionUser, getUnreadCount } from "@/lib/server/session";

const DESCRIPTION = "Travel stories, tips and guides from the Yallaway community. Search by title, tag or author.";

export const metadata: Metadata = {
  title: "Blog",
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", siteName: "Yallaway", title: "Blog", description: DESCRIPTION },
};

type Params = Record<string, string | string[] | undefined>;

const text = (value: Params[string]) => (typeof value === "string" ? value.trim() : "");

/** The criteria from the URL: keyword, tag (without a leading #) and page (a whole number >= 1, else 1). */
function parseSearch(params: Params): { search: BlogSearch; page: number } {
  const search: BlogSearch = {};
  const keyword = text(params.keyword);
  const tag = text(params.tag).replace(/^#/, "");
  if (keyword) search.keyword = keyword;
  if (tag) search.tag = tag;
  const page = Number(text(params.page));
  return { search, page: Number.isInteger(page) && page >= 1 ? page : 1 };
}

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const { search, page } = parseSearch(await searchParams);
  const query = new URLSearchParams();
  if (search.keyword) query.set("keyword", search.keyword);
  if (search.tag) query.set("tag", search.tag);
  query.set("page", String(page));

  const [user, data] = await Promise.all([getSessionUser(), backendJson<PostSummaryPage>(`/api/posts?${query}`)]);
  if (!data) throw new Error("Could not load the blog posts");
  const unread = user ? await getUnreadCount() : 0;
  const searching = Boolean(search.keyword || search.tag);

  return (
    <PublicShell user={user} unreadNotifications={unread}>
      <PageHeader title="Blog" description={DESCRIPTION} />
      <div className="grid gap-6">
        {/* key: the form starts again from the URL after each search (back button too). */}
        <BlogSearchBar key={blogHref(search)} initial={search} />
        {data.items.length === 0 ? (
          data.total > 0 ? (
            // Past the last page (e.g. ?page=99).
            <EmptyState
              title="This page is empty"
              action={
                <Button asChild>
                  <Link href={blogHref(search)}>Go to page 1</Link>
                </Button>
              }
            />
          ) : searching ? (
            <EmptyState
              title="No results"
              line="Nothing here… try another word?"
              description="No published post matches your search. Try a different keyword or tag."
              action={
                <Button asChild variant="secondary">
                  <Link href="/blog">Show all posts</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState title="No posts yet" line="So empty! Let's plan something." />
          )
        ) : (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {searching && `${data.total} ${data.total === 1 ? "post matches" : "posts match"} your search. `}
              {search.keyword ? "Most liked and commented first." : "Newest first."}
            </p>
            <div className="grid gap-4">
              {data.items.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
            <PaginationBar
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              hrefFor={(p) => blogHref(search, p)}
            />
          </>
        )}
      </div>
    </PublicShell>
  );
}
