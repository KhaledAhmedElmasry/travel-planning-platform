// End-to-end tests (Playwright): whole pages in a real browser, against the real backend.
// Start the backend first (cd backend && npm run start:dev); Playwright starts the frontend
// itself on port 3001, or reuses the one you already run. Run: npm run test:e2e
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // e2e/email/ creates accounts and needs the emailed links: opt-in only (npm run test:e2e:email).
  testIgnore: "email/**",
  use: { baseURL: "http://localhost:3001" },
  // Desktop and phone (GEN-16: responsive on desktop and mobile).
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
