// /robots.txt (.md section 9 SEO). Everything may be crawled: private pages are kept out of search
// results by their own `robots: { index: false }` metadata (a Disallow rule would hide that tag from
// crawlers, and Disallow "/hotel" would also block "/hotels").
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
