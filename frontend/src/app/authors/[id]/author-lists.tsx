"use client";

// P-32 lists (BLG-12): the author's published posts and public itineraries, each paginated on its own
// (GEN-05, GET /api/authors/{id}?postsPage=&itinerariesPage=). The page is cached (ISR) with page 1 of both
// lists; another page is in the URL (?postsPage=2) and is read here, in the browser, so the cached page
// stays the same for every visitor. Empty lists show an empty state (GEN-04); a failed load shows an
// error with "Try again" (GEN-16).
import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PostCard, type PostSummary } from "@/components/app/blog/post-card";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { PaginationBar } from "@/components/app/pagination-bar";
import { ItineraryCard, type ItinerarySummary } from "@/components/app/shared/itinerary-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api";

type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };
export type AuthorLists = { posts: Paginated<PostSummary>; itineraries: Paginated<ItinerarySummary> };

/** A whole number >= 1 from the URL, else 1. */
function pageFrom(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

type Props = {
  authorId: string;
  /** Page 1 of both lists, from the cached page. */
  initial: AuthorLists;
  countryNames: Record<string, string>;
};

export function AuthorListsView({ authorId, initial, countryNames }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const postsPage = pageFrom(searchParams.get("postsPage"));
  const itinerariesPage = pageFrom(searchParams.get("itinerariesPage"));
  const onFirstPages = postsPage === 1 && itinerariesPage === 1;

  const [loaded, setLoaded] = useState<{ key: string; data: AuthorLists } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${postsPage}-${itinerariesPage}-${attempt}`;

  useEffect(() => {
    if (onFirstPages) return;
    let cancelled = false;
    apiFetch<AuthorLists>(
      `/api/authors/${encodeURIComponent(authorId)}?postsPage=${postsPage}&itinerariesPage=${itinerariesPage}`,
      { redirectOnAuthFail: false },
    )
      .then((data) => !cancelled && setLoaded({ key, data }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setFailed({ key, message: error instanceof ApiError ? error.message : "We couldn't load this page. Check your connection and try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [authorId, postsPage, itinerariesPage, onFirstPages, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!onFirstPages && failed?.key === key) {
    return <ErrorState message={failed.message} onRetry={retry} />;
  }
  const data = onFirstPages ? initial : loaded?.key === key ? loaded.data : null;
  if (!data) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }

  const href = (posts: number, itineraries: number) => {
    const query = new URLSearchParams();
    if (posts > 1) query.set("postsPage", String(posts));
    if (itineraries > 1) query.set("itinerariesPage", String(itineraries));
    const qs = query.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="grid gap-10">
      <section aria-labelledby="author-posts" className="grid gap-4">
        <h2 id="author-posts" className="text-xl font-semibold">
          Posts
        </h2>
        {data.posts.items.length === 0 ? (
          <EmptyState compact title={data.posts.total > 0 ? "This page is empty" : "No published posts yet"} />
        ) : (
          <>
            <div className="grid gap-4">
              {data.posts.items.map((post) => (
                <PostCard key={post.id} post={post} showAuthor={false} />
              ))}
            </div>
            <PaginationBar
              page={data.posts.page}
              totalPages={data.posts.totalPages}
              total={data.posts.total}
              pageSize={data.posts.pageSize}
              hrefFor={(p) => href(p, itinerariesPage)}
            />
          </>
        )}
      </section>

      <section aria-labelledby="author-itineraries" className="grid gap-4">
        <h2 id="author-itineraries" className="text-xl font-semibold">
          Public itineraries
        </h2>
        {data.itineraries.items.length === 0 ? (
          <EmptyState compact title={data.itineraries.total > 0 ? "This page is empty" : "No public itineraries yet"} />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {data.itineraries.items.map((it) => (
                <ItineraryCard key={it.id} itinerary={it} countryNames={countryNames} href={`/itineraries/${encodeURIComponent(it.id)}`} />
              ))}
            </div>
            <PaginationBar
              page={data.itineraries.page}
              totalPages={data.itineraries.totalPages}
              total={data.itineraries.total}
              pageSize={data.itineraries.pageSize}
              hrefFor={(p) => href(postsPage, p)}
            />
          </>
        )}
      </section>
    </div>
  );
}
