// Cabin names as the spec shows them (P-12: Economy, Premium Economy, Business, First). The search
// components keep the same map (search/flight-search-form.tsx CABIN_LABEL); this copy keeps the
// checkout components independent of an unmerged pull request. Merge the two later.
export const CABIN_LABEL_FALLBACK: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First",
};
