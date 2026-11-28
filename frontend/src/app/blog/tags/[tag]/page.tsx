// P-31 Posts by tag: /blog/tags/[tag]
// Part: T4 Blog
// Requirements: BLG-08
// Endpoints: GET /api/tags/{tag}/posts
// Rendering: Dynamic SSR. Source: .md section 9 "Blog Listing / Search" (a tag page is the listing filtered by one tag).
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-31). Use a shell and kit components (frontend/README.md).
// Built (28 Nov): the published posts with this tag, newest first (BLG-08, the backend matches the tag
// case-insensitively); 10 per page in the URL (GEN-05); an unknown tag is an empty list, not an error (GEN-04);
// loading skeleton (src/app/blog/loading.tsx). Opened by clicking a tag on a post card or post. Every role and guests.
import type { Metadata } from "next";
import Link from "next/link";
import { TAG_MAX_LENGTH, tagHref } from "@/components/app/blog/blog-links";
import { PostCard, type PostSummaryPage } from "@/components/app/blog/post-card";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PaginationBar } from "@/components/app/pagination-bar";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { backendJson } from "@/lib/server/backend";
import { getSessionUser, getUnreadCount } from "@/lib/server/session";

type Props = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** The tag from the URL, decoded and trimmed (the backend trims too). */
async function readTag(params: Props["params"]): Promise<string> {
  const { tag: raw } = await params;
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = await readTag(params);
  const title = `Posts tagged #${tag}`;
  const description = `Travel stories and tips tagged #${tag} on the Yallaway blog.`;
  return {
    title,
    description,
    alternates: { canonical: tagHref(tag) },
    openGraph: { type: "website", siteName: "Yallaway", title, description },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const tag = await readTag(params);
  const rawPage = (await searchParams).page;
  const pageNumber = Number(typeof rawPage === "string" ? rawPage : "");
  const page = Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1;

  // openapi: tag is 1-30 characters (BLG-08); a longer one can't match any post, so it isn't sent.
  const valid = tag.length >= 1 && tag.length <= TAG_MAX_LENGTH;
  const [user, data] = await Promise.all([
    getSessionUser(),
    valid ? backendJson<PostSummaryPage>(`/api/tags/${encodeURIComponent(tag)}/posts?page=${page}`) : null,
  ]);
  if (valid && !data) throw new Error("Could not load the posts with this tag");
  const unread = user ? await getUnreadCount() : 0;
  const items = data?.items ?? [];

  return (
    <PublicShell user={user} unreadNotifications={unread}>
      <PageHeader
        title={`#${tag}`}
        description="Published posts with this tag, newest first."
        back={{ href: "/blog", label: "Blog" }}
      />
      {items.length === 0 ? (
        data && data.total > 0 ? (
          // Past the last page (e.g. ?page=99).
          <EmptyState
            title="This page is empty"
            action={
              <Button asChild>
                <Link href={tagHref(tag)}>Go to page 1</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No posts with this tag"
            line="Nothing here… try another tag?"
            action={
              <Button asChild variant="secondary">
                <Link href="/blog">Browse all posts</Link>
              </Button>
            }
          />
        )
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4">
            {items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          {data && (
            <PaginationBar
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              hrefFor={(p) => (p > 1 ? `${tagHref(tag)}?page=${p}` : tagHref(tag))}
            />
          )}
        </div>
      )}
    </PublicShell>
  );
}
