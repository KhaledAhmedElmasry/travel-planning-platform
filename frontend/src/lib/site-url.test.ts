// The public address of the site, used to make canonical, Open Graph, robots and sitemap URLs absolute.
import { expect, test } from "vitest";
import { siteUrl } from "./site-url";

// source: team leader (24 Nov, Q2) - NEXT_PUBLIC_SITE_URL, default http://localhost:3001, not required
test("uses NEXT_PUBLIC_SITE_URL when it is set", () => {
  expect(siteUrl("https://yallaway.example").href).toBe("https://yallaway.example/");
});

// source: team leader (24 Nov, Q2) - default http://localhost:3001 (the frontend's dev/start port)
test("falls back to http://localhost:3001 when the variable is missing or empty", () => {
  expect(siteUrl(undefined).href).toBe("http://localhost:3001/");
  expect(siteUrl("").href).toBe("http://localhost:3001/");
});
