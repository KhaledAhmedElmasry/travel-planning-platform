// allPages: reads every page of a paginated backend list (GEN-05: 10 per page).
import { expect, test } from "vitest";
import { allPages } from "./all-pages";

// source: docs/api/openapi.yaml - Paginated {items, page, pageSize, total, totalPages}
test("collects the items of every page, in order, and stops after the last page", async () => {
  const asked: number[] = [];
  const items = await allPages(async (page) => {
    asked.push(page);
    return { items: [`p${page}a`, `p${page}b`], totalPages: 3 };
  });
  expect(items).toEqual(["p1a", "p1b", "p2a", "p2b", "p3a", "p3b"]);
  expect(asked).toEqual([1, 2, 3]);
});

// source: frontend/src/lib/server/backend.ts - backendJson returns null on 401/403/404
test("stops at a page the backend refused (null) and keeps what it has", async () => {
  const items = await allPages(async (page) => (page === 1 ? { items: ["a"], totalPages: 2 } : null));
  expect(items).toEqual(["a"]);
});
