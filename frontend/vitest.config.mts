// Unit / component tests (Vitest + React Testing Library), setup from the Next.js 16 testing guide.
// Vitest can't render async Server Components (most pages): test those with Playwright (e2e/).
// Run: npm test (once) or npm run test:watch.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
