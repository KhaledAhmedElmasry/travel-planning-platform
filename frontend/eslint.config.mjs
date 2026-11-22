import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Kit rule (GEN-17, design-system/yallaway/MASTER.md section 5): pages under src/app
// never pick their own colors or inline styles. Colors come from the theme tokens
// through the kit components (bg-card, text-muted-foreground, <StatusBadge>, ...).
// Blocked in src/app: style={{...}}, Tailwind palette colors (text-purple-500,
// bg-white, border-gray-200) and raw color values in brackets (bg-[#6E56B8], text-[rgb(...)]).
// Components in src/components may use them (that is where the look is defined).
const PALETTE =
  "(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}|black|white";
const UTILITY = "(?:bg|text|border|ring|fill|stroke|from|via|to|outline|shadow|divide|decoration|accent|caret|placeholder)";
const RAW_COLOR = `(?:^|[\\s:])${UTILITY}-(?:${PALETTE})(?:\\/\\d+)?(?=$|\\s)|\\[(?:#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\(|oklch\\()`;

const noStyleMessage =
  "Pages don't style things themselves: use a kit component or its props (see frontend/README.md). Inline style is not allowed in src/app.";
const noColorMessage =
  "Use theme tokens (bg-card, text-muted-foreground, text-link, ...) or a kit component (<StatusBadge>, <Price>, ...), not raw colors. See frontend/README.md.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='style']", message: noStyleMessage },
        {
          selector: `JSXAttribute[name.name='className'] Literal[value=/${RAW_COLOR}/]`,
          message: noColorMessage,
        },
        {
          selector: `JSXAttribute[name.name='className'] TemplateElement[value.raw=/${RAW_COLOR}/]`,
          message: noColorMessage,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
