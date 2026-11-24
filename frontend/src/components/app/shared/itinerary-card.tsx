// ItineraryCard
// Part: Lead (foundation)
// Requirements: ITN-03, ITN-21, BLG-12, BLG-13
// Used by: P-24, P-27, P-32, P-30, home
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// Built (24 Nov). <ItineraryCard itinerary={summary} href={`/my/itineraries/${summary.id}`} showVisibility />
// Shows title (link), countries, start date, number of days; visibility only in the owner's list (ITN-03);
// "Hidden" badge for content an admin hid (GEN-10, author and admins only). `actions` for extra buttons.
// TODO(ask team leader): countries are shown as their codes ("EG, AE"), as the list endpoints return them.
// Show full country names instead (the page would map them from GET /api/countries)?
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarIcon, MapPinIcon } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDay } from "@/lib/dates";

/** backend itineraries.service.ts ItinerarySummary */
export type ItinerarySummary = {
  id: string;
  title: string;
  countryCodes: string[];
  startDate: string;
  numberOfDays: number;
  visibility: "private" | "public";
};

type ItineraryCardProps = {
  itinerary: ItinerarySummary;
  href: string;
  showVisibility?: boolean;
  hidden?: boolean;
  actions?: ReactNode;
};

export function ItineraryCard({ itinerary: it, href, showVisibility = false, hidden = false, actions }: ItineraryCardProps) {
  return (
    <article className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 text-base font-semibold">
          <Link href={href} className="hover:underline">
            {it.title}
          </Link>
        </h3>
        <div className="flex flex-wrap gap-2">
          {hidden && <StatusBadge kind="content" status="hidden" />}
          {showVisibility && <StatusBadge kind="itinerary" status={it.visibility} />}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <li className="inline-flex items-center gap-1.5">
          <MapPinIcon className="size-4" aria-hidden="true" />
          {it.countryCodes.join(", ")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <CalendarIcon className="size-4" aria-hidden="true" />
          {formatDay(it.startDate)}
        </li>
        <li>{it.numberOfDays === 1 ? "1 day" : `${it.numberOfDays} days`}</li>
      </ul>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}
