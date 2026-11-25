// Public home, popular destinations (GEN-12 seeded cities and attractions; GEN-16 responsive).
// Every icon beside a country or attraction name keeps its size and sits on the FIRST line of the
// text, also when a long name wraps to two lines (e.g. "Kingdom Centre Tower (Sky Bridge)" at 1024 px).
// Needs the seeded reference data (npm run seed).
import { expect, test } from "@playwright/test";

const ICON_PX = 16; // size-4 (design-system/yallaway/MASTER.md: Lucide icons, 16 px beside text-sm)

// source: MASTER.md section 3 "Design checks at" 375 / 768 / 1024 / 1440
for (const width of [375, 768, 1024, 1440]) {
  test(`destination icons keep 16 px and line up with the first line at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const rows = page.locator("section[aria-labelledby=destinations-heading] li p:has(svg)");
    await expect(rows.first()).toBeVisible();

    const measured = await rows.evaluateAll((ps) =>
      ps.map((p) => {
        const icon = p.querySelector("svg")!.getBoundingClientRect();
        const row = p.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(p).lineHeight);
        const firstLineMiddle = row.top + lineHeight / 2;
        return {
          text: p.textContent,
          width: icon.width,
          height: icon.height,
          offFirstLine: Math.round(Math.abs(icon.top + icon.height / 2 - firstLineMiddle)),
        };
      }),
    );

    expect(measured.length).toBeGreaterThan(0);
    expect(measured.filter((m) => m.width !== ICON_PX || m.height !== ICON_PX || m.offFirstLine > 1)).toEqual([]);
  });
}
