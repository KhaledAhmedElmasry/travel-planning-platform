// ACC-02 / ACC-07 links reach the user by email; outside production the backend also prints them in
// its log ("[dev only] ... link for <email>: <url>"). These tests create accounts, so they run ONLY
// against a throwaway database: start the backend with its output in a file and set
// E2E_BACKEND_LOG=<that file> (frontend/README.md, "Email link tests"). Without it these tests fail
// at once, before creating anything (so the shared database is never touched).
import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";

const BACKEND_LOG = process.env.E2E_BACKEND_LOG;

/** Call first in a test that creates an account. */
export function requireThrowawayBackend(): void {
  if (!BACKEND_LOG) throw new Error("Set E2E_BACKEND_LOG to the log file of a backend that uses a throwaway database (see frontend/README.md, Email link tests).");
}

/** Waits for the newest emailed link of this kind for this email and returns its path + query. */
export async function linkFromLog(kind: "Verification" | "Password reset", email: string): Promise<string> {
  let found: string | undefined;
  await expect
    .poll(() => {
      // Nest colours its log: drop the ANSI colour codes first.
      const lines = readFileSync(BACKEND_LOG!, "utf8").replace(/\u001b\[[0-9;]*m/g, "").split(/\r?\n/);
      const prefix = `${kind} link for ${email}: `;
      const line = lines.reverse().find((l) => l.includes(prefix));
      found = line?.split(prefix)[1]?.split(" ")[0];
      return found;
    }, { timeout: 15_000 })
    .toBeTruthy();
  const url = new URL(found!);
  return url.pathname + url.search;
}

export function uniqueEmail(tag: string): string {
  return `e2e.${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@yallaway.local`;
}
