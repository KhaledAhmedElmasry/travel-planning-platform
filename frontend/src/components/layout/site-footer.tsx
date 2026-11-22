// Footer for public and traveler pages.
import Link from "next/link";
import { Wordmark } from "@/components/layout/wordmark";

const LINKS = [
  { label: "Flights", href: "/flights" },
  { label: "Hotels", href: "/hotels" },
  { label: "Itineraries", href: "/itineraries" },
  { label: "Blog", href: "/blog" },
  { label: "Terms & Privacy", href: "/terms" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Wordmark />
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-muted-foreground hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="w-full text-[13px] text-subtle-foreground">
          Yallaway is a student project (GIU Software Project I, 2026). Payments run in Stripe test mode.
        </p>
      </div>
    </footer>
  );
}
