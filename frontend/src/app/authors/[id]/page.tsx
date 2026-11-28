// P-32 Author: /authors/[id]
// Part: T4 Blog
// Requirements: BLG-12
// Endpoints: GET /api/authors/{id}; GET /api/countries (country names for ItineraryCard)
// Rendering: ISR / Static. Source: .md section 9 "Public Author Page"; add SEO metadata.
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-32). Use a shell and kit components (frontend/README.md).
// Built (28 Nov): name, join date (AuthorHeader), published posts and public itineraries, each paginated on its
// own (BLG-12, GEN-05), empty states (GEN-04). The backend is called WITHOUT cookies and cached with the tag
// author:<id>, which the backend refreshes when the author's posts or itineraries change or the author is
// deactivated (B5); page 1 of both lists is cached, later pages are read in the browser (AuthorListsView).
// Unknown or deactivated author (ACC-12): 404 -> not-found page. Country names from GET /api/countries, also
// WITHOUT cookies (a code is shown when the list can't be read).
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorHeader, type PublicAuthor } from "@/components/app/blog/author-header";
import { PublicShell } from "@/components/layout/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { allPages } from "@/lib/all-pages";
import { ISR_REVALIDATE_SECONDS, authorTag } from "@/lib/cache-tags";
import { BACKEND_URL } from "@/lib/server/backend";
import { AuthorListsView, type AuthorLists } from "./author-lists";

export const revalidate = 60; // = ISR_REVALIDATE_SECONDS (Next.js needs a literal here)

// No author page is built ahead; each one is rendered on its first visit and then cached (Next.js 16 ISR).
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };
type AuthorPage = AuthorLists & { author: PublicAuthor };
type Country = { code: string; name: string };

/** The author page (page 1 of both lists), or null (404). Shared by the page and its metadata (React cache). */
const loadAuthor = cache(async (id: string): Promise<AuthorPage | null> => {
  const res = await fetch(`${BACKEND_URL}/api/authors/${encodeURIComponent(id)}`, {
    next: { revalidate: ISR_REVALIDATE_SECONDS, tags: [authorTag(id)] },
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Could not load the author (${res.status})`);
  return (await res.json()) as AuthorPage;
});

/** Every country (code -> name) for the itinerary cards; empty on error (codes are shown then). */
async function loadCountryNames(): Promise<Record<string, string>> {
  const countries = await allPages(async (page) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/countries?page=${page}`, { next: { revalidate: ISR_REVALIDATE_SECONDS } });
      return res.ok ? ((await res.json()) as { items: Country[]; totalPages: number }) : null;
    } catch {
      return null;
    }
  });
  return Object.fromEntries(countries.map((c) => [c.code, c.name]));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await loadAuthor(id);
  if (!data) return { title: "Author not found", robots: { index: false } };
  const { author } = data;
  const description = `Travel posts and public itineraries by ${author.name} on Yallaway.`;
  return {
    title: author.name,
    description,
    alternates: { canonical: `/authors/${author.id}` },
    openGraph: { type: "profile", siteName: "Yallaway", title: author.name, description },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const [data, countryNames] = await Promise.all([loadAuthor(id), loadCountryNames()]);
  if (!data) notFound();

  return (
    <PublicShell>
      <AuthorHeader author={data.author} postCount={data.posts.total} itineraryCount={data.itineraries.total} />
      {/* The lists read ?postsPage / ?itinerariesPage in the browser (useSearchParams needs a Suspense boundary). */}
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <AuthorListsView
          authorId={data.author.id}
          initial={{ posts: data.posts, itineraries: data.itineraries }}
          countryNames={countryNames}
        />
      </Suspense>
    </PublicShell>
  );
}
