// P-02 Log in against the real backend with the demo user (npm run seed:demo).
// The password is read from backend/.env (DEMO_PASSWORD), never written in the repo.
// Only the success path runs here: wrong passwords would count towards the demo user's lockout (ACC-05).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

function demoPassword(): string {
  const env = readFileSync(join(__dirname, "..", "..", "backend", ".env"), "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("DEMO_PASSWORD="));
  if (!line) throw new Error("DEMO_PASSWORD missing in backend/.env (run npm run seed:demo)");
  return line.slice("DEMO_PASSWORD=".length).trim();
}

// source: Excel ACC-04 - log in with email and password and land on the role's home page (user -> /home, team leader 23 Nov);
// Excel ACC-19 - tokens only in httpOnly cookies
test("the demo user logs in and lands on /home with httpOnly session cookies", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo.user@yallaway.local");
  await page.getByLabel("Password", { exact: false }).first().fill(demoPassword());
  await page.getByRole("button", { name: "Log in" }).click();

  // /home is Dynamic SSR with 6 backend calls (~2 s on Atlas); the 5 s default was flaky.
  await expect(page).toHaveURL(/\/home$/,{ timeout: 15_000 });
  const access = (await context.cookies()).find((c) => c.name === "access_token");
  expect(access?.httpOnly).toBe(true);
});
