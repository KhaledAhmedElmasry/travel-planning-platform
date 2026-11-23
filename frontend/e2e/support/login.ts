// Logs a demo account in through the real backend (POST /api/auth/login via the same-origin rewrite).
// The cookies land in the page's browser context, like a real login. Demo accounts: npm run seed:demo.
// The password is read from backend/.env (DEMO_PASSWORD), never written in the repo.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export function demoPassword(): string {
  const env = readFileSync(join(__dirname, "..", "..", "..", "backend", ".env"), "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("DEMO_PASSWORD="));
  if (!line) throw new Error("DEMO_PASSWORD missing in backend/.env (run npm run seed:demo)");
  return line.slice("DEMO_PASSWORD=".length).trim();
}

export async function loginAsDemo(page: Page, email: string): Promise<void> {
  const res = await page.request.post("/api/auth/login", { data: { email, password: demoPassword() } });
  expect(res.status(), `login ${email}`).toBe(200);
}
