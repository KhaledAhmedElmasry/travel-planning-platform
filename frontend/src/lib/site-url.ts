// The public address of the site (.md section 9 SEO). Next.js joins it with relative canonical and
// Open Graph URLs (metadataBase in src/app/layout.tsx); robots.ts and sitemap.ts use it too.
// Set NEXT_PUBLIC_SITE_URL in frontend/.env.local when the site runs elsewhere (e.g. a cloud deployment).
export function siteUrl(value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): URL {
  return new URL(value || "http://localhost:3001");
}

/** Absolute URL of a path on this site, e.g. absoluteUrl("/login") = "http://localhost:3001/login". */
export const absoluteUrl = (path: string) => new URL(path, siteUrl()).href.replace(/\/$/, "");
