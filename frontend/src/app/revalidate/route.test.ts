// @vitest-environment node
// B5 on-demand revalidation (team leader, 23 Nov): the backend posts { tags } with the shared
// secret header; the ISR pages tagged with them are refreshed. Only next/cache is faked.
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag }));

import { POST } from "./route";

const SECRET = "test-secret-123";

beforeEach(() => {
  vi.stubEnv("REVALIDATE_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  revalidateTag.mockReset();
});

function call(body: unknown, secret: string | null = SECRET) {
  const headers = new Headers({ "content-type": "application/json" });
  if (secret !== null) headers.set("x-revalidate-secret", secret);
  return POST(new Request("http://localhost:3001/revalidate", { method: "POST", headers, body: JSON.stringify(body) }));
}

// source: team leader in chat (23 Nov) - cache tags; hidden/private content must not be served stale
test("refreshes every tag it is sent, without serving the old page again", async () => {
  const res = await call({ tags: ["post:665f1c2a9b1e8a00123400a1", "author:665f1c2a9b1e8a00123400b2"] });

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ revalidated: ["post:665f1c2a9b1e8a00123400a1", "author:665f1c2a9b1e8a00123400b2"] });
  expect(revalidateTag.mock.calls).toEqual([
    ["post:665f1c2a9b1e8a00123400a1", { expire: 0 }],
    ["author:665f1c2a9b1e8a00123400b2", { expire: 0 }],
  ]);
});

// source: team leader in chat (23 Nov) - shared secret header; wrong or missing -> 401
test.each([
  ["missing", null],
  ["wrong", "nope"],
])("a %s secret is refused with 401 and nothing is refreshed", async (_label, secret) => {
  const res = await call({ tags: ["post:665f1c2a9b1e8a00123400a1"] }, secret);

  expect(res.status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});

// source: team leader in chat (23 Nov) - shared secret: without one configured nobody can flush the cache
test("refuses every call when the frontend has no secret configured", async () => {
  vi.stubEnv("REVALIDATE_SECRET", "");

  const res = await call({ tags: ["post:665f1c2a9b1e8a00123400a1"] }, "");

  expect(res.status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});

// source: tags are post:<id>, itinerary:<id>, author:<id> (team leader, 23 Nov: cache tags for P-28, P-30, P-32)
test.each([
  ["no tags field", {}],
  ["an empty list", { tags: [] }],
  ["an unknown kind", { tags: ["review:665f1c2a9b1e8a00123400a1"] }],
  ["a bad id", { tags: ["post:abc"] }],
])("%s is refused with 400 and nothing is refreshed", async (_label, body) => {
  const res = await call(body);

  expect(res.status).toBe(400);
  expect(revalidateTag).not.toHaveBeenCalled();
});
