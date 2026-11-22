// <LocalTime iso={flight.departureAt} timeZone={airport.timeZone} airport="CAI" />
// Shows a flight time in the airport's own time zone (GEN-06, FLT-03, FLT-17).
// The backend stores UTC; the airport's IANA zone comes from GET /api/airports.
import { cn } from "cn";
import { formatLocal } from "@/lib/format";

type LocalTimeProps = {
  /** UTC timestamp from the backend, e.g. "2027-03-01T06:40:00Z" */
  iso: string;
  /** IANA zone of the airport, e.g. "Africa/Cairo" */
  timeZone: string;
  /** IATA code shown under the time, e.g. "CAI" */
  airport?: string;
  showDate?: boolean;
  /** "lg" for flight cards, "sm" for tables */
  size?: "sm" | "lg";
  align?: "start" | "end";
  className?: string;
};

export function LocalTime({
  iso,
  timeZone,
  airport,
  showDate = false,
  size = "lg",
  align = "start",
  className,
}: LocalTimeProps) {
  const local = formatLocal(iso, timeZone);
  return (
    <span
      className={cn(
        "inline-flex flex-col",
        align === "end" ? "items-end text-right" : "items-start",
        className,
      )}
    >
      <time
        dateTime={iso}
        className={cn("tabular font-bold leading-tight", size === "lg" ? "text-2xl" : "text-sm")}
      >
        {local.time}
      </time>
      {(airport || showDate) && (
        <span className="text-sm text-muted-foreground">
          {[airport, showDate ? local.date : null].filter(Boolean).join(" · ")}
        </span>
      )}
      <span className="text-xs text-subtle-foreground">Local time ({local.zone})</span>
    </span>
  );
}
