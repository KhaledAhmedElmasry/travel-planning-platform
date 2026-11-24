"use client";

// RoundTripSelector
// Part: Lead (foundation)
// Requirements: FLT-12
// Used by: P-12, P-26
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <RoundTripSelector outbound={res.outbound.items} returns={res.return.items} onContinue={({ outbound, return: back }) => ...} />
// FLT-12 (a): a round-trip search returns outbound and return options; the user picks one flight
// and cabin of each (spec P-12), and they become one booking with two segments. Each list is the
// current page of its paginated result; the page puts a PaginationBar under each list if needed.
import { useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import type { CabinClass } from "./flight-search-form";
import { FlightResultCard, type FlightSearchItem } from "./flight-result-card";

export type FlightChoice = { flight: FlightSearchItem; cabinClass: CabinClass };

type Props = {
  outbound: FlightSearchItem[];
  returns: FlightSearchItem[];
  onContinue: (choice: { outbound: FlightChoice; return: FlightChoice }) => void;
};

function Group({
  title,
  flights,
  choice,
  onChoose,
}: {
  title: string;
  flights: FlightSearchItem[];
  choice: FlightChoice | undefined;
  onChoose: (choice: FlightChoice) => void;
}) {
  const headingId = `round-trip-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <h2 id={headingId} className="text-xl font-semibold">
        {title}
      </h2>
      {flights.length === 0 ? (
        <EmptyState title="no flights found" />
      ) : (
        flights.map((flight) => (
          <FlightResultCard
            key={flight.id}
            flight={flight}
            selectedCabin={choice?.flight.id === flight.id ? choice.cabinClass : undefined}
            onSelect={(f, cabinClass) => onChoose({ flight: f, cabinClass })}
          />
        ))
      )}
    </section>
  );
}

export function RoundTripSelector({ outbound, returns, onContinue }: Props) {
  const [out, setOut] = useState<FlightChoice>();
  const [back, setBack] = useState<FlightChoice>();

  return (
    <div className="grid gap-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <Group title="Outbound" flights={outbound} choice={out} onChoose={setOut} />
        <Group title="Return" flights={returns} choice={back} onChoose={setBack} />
      </div>
      <Button
        className="justify-self-end"
        disabled={!out || !back}
        onClick={() => out && back && onContinue({ outbound: out, return: back })}
      >
        Continue
      </Button>
    </div>
  );
}
