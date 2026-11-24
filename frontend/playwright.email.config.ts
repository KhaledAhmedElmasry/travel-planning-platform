// Opt-in e2e tests that need the emailed links (ACC-02 verify email, ACC-07 reset password):
// they create accounts and read the links from the backend log, so run them ONLY against a
// backend with a throwaway database. How: frontend/README.md "Email link tests". Run: npm run test:e2e:email
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({ ...base, testDir: "./e2e/email", testIgnore: undefined });
