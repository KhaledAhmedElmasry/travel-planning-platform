// /robots.txt (.md section 9: "Public pages should include appropriate metadata for SEO").
import { expect, test } from "vitest";
import robots from "./robots";

const PUBLIC_ROUTES = ["/", "/flights", "/hotels", "/itineraries", "/itineraries/abc", "/blog", "/login", "/signup"];

// source: .md section 9 (SEO) + team leader (24 Nov, Q2: robots.ts)
test("lets crawlers in and points them to the absolute sitemap URL", () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  expect(rules[0].userAgent).toBe("*");
  expect(rules[0].allow).toBe("/");
  expect(r.sitemap).toBe("http://localhost:3001/sitemap.xml");
});

// source: .md section 9 (public pages need SEO). Disallow is a prefix match, so "/hotel" would also hide "/hotels";
// private pages are kept out with their own noindex instead.
test("no disallow rule hides a public page", () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  const disallowed = rules.flatMap((rule) => [rule.disallow ?? []].flat());
  for (const route of PUBLIC_ROUTES) {
    for (const prefix of disallowed) expect(route.startsWith(prefix), `${prefix} hides ${route}`).toBe(false);
  }
});
