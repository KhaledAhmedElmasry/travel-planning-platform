// Logs a demo account in through the real backend (POST /api/auth/login via the same-origin rewrite).
// The cookies land in the page's browser context, like a real login. Demo accounts: npm run seed:demo.
// The passwords are read from backend/.env (DEMO_PASSWORD, ADMIN_PASSWORD), never written in the repo.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** A value from backend/.env. */
function backendEnv(name: string, hint: string): string {
  const env = readFileSync(join(__dirname, "..", "..", "..", "backend", ".env"), "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} missing in backend/.env (${hint})`);
  return line.slice(name.length + 1).trim();
}

export function demoPassword(): string {
  return backendEnv("DEMO_PASSWORD", "run npm run seed:demo");
}

export async function loginAsDemo(page: Page, email: string): Promise<void> {
  const res = await page.request.post("/api/auth/login", { data: { email, password: demoPassword() } });
  expect(res.status(), `login ${email}`).toBe(200);
}

/** The seeded admin (ACC-18, npm run seed): ADMIN_EMAIL / ADMIN_PASSWORD from backend/.env. */
export async function loginAsAdmin(page: Page): Promise<void> {
  const email = backendEnv("ADMIN_EMAIL", "see the README, Environment Variables");
  const password = backendEnv("ADMIN_PASSWORD", "see the README, Environment Variables");
  const res = await page.request.post("/api/auth/login", { data: { email, password } });
  expect(res.status(), "login admin").toBe(200);
}
