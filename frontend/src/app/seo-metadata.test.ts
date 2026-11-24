// SEO metadata of the built pages (.md section 9: "Public pages should include appropriate metadata for SEO
// where applicable"; team leader 24 Nov, Q2: public = title, description, canonical, Open Graph; private = noindex).
import type { Metadata } from "next";
import { expect, test, vi } from "vitest";

vi.mock("next/font/google", () => ({ Plus_Jakarta_Sans: () => ({ variable: "font" }) }));

// source: team leader (24 Nov, Q2: metadataBase from NEXT_PUBLIC_SITE_URL). Without it the canonical is
// written as a relative "/" (seen in the next build output of 24 Nov), which search engines don't accept.
test("the root layout sets metadataBase, so canonical and Open Graph URLs are absolute", async () => {
  const { metadata } = await import("./layout");
  expect(String(metadata.metadataBase)).toBe("http://localhost:3001/");
});

function expectPublic(metadata: Metadata, canonical: string) {
  expect(typeof metadata.description).toBe("string");
  expect((metadata.description as string).length).toBeGreaterThan(20);
  expect(metadata.alternates?.canonical).toBe(canonical);
  const og = metadata.openGraph as { type?: string; title?: unknown; description?: unknown };
  expect(og?.type).toBe("website");
  expect(og?.title).toBeTruthy();
  expect(og?.description).toBe(metadata.description);
  expect(metadata.robots).toBeUndefined();
}

// source: team leader (24 Nov, Q7: /login and /signup are indexed, with description + canonical; Q2: + OG)
test("/login is a public page with full SEO metadata", async () => {
  const { metadata } = await import("./login/page");
  expect(metadata.title).toBe("Log in");
  expectPublic(metadata, "/login");
});

// source: team leader (24 Nov, Q7 + Q2)
test("/signup is a public page with full SEO metadata", async () => {
  const { metadata } = await import("./signup/page");
  expect(metadata.title).toBe("Sign up");
  expectPublic(metadata, "/signup");
});

// source: .md section 9 "Public Itinerary Search" (public page) + team leader (24 Nov, Q2: OG on public pages)
test("/itineraries has Open Graph too", async () => {
  const { metadata } = await import("./itineraries/page");
  expectPublic(metadata, "/itineraries");
});

// source: team leader (24 Nov, Q2: public pages get canonical + OG; /terms is public, merged in #300)
test("/terms is a public page with full SEO metadata", async () => {
  const { metadata } = await import("./terms/page");
  expect(metadata.title).toBe("Terms & Privacy");
  expectPublic(metadata, "/terms");
});

// source: team leader (24 Nov, Q2: private pages keep noindex; /account and /notifications get noindex)
test.each([
  ["./account/page", "Profile"],
  ["./account/password/page", "Change password"],
  ["./notifications/page", "Notifications"],
])("%s is private: not indexed", async (path, title) => {
  const { metadata } = (await import(/* @vite-ignore */ path)) as { metadata: Metadata };
  expect(metadata.title).toBe(title);
  expect(metadata.robots).toEqual({ index: false });
});
