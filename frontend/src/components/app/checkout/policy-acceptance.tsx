"use client";

// PolicyAcceptance
// Part: Lead (foundation)
// Requirements: PAY-02
// Used by: P-14, P-19
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// const data = await apiFetch<BookingPolicies>(`/api/bookings/${type}/${id}/policies`);
// <PolicyAcceptance data={data} onAccepted={(acceptedAt) => setCanPay(true)} />
// PAY-02: before payment show the provider's policies (airline: cancellation tiers and baggage;
// hotel: cancellation tiers and check-in/check-out times) and require the acceptance checkbox
// (label from the team leader, 23 Nov). Ticking it saves the acceptance with POST
// accept-policies; payment stays blocked until then (the backend refuses it too). An accepted
// booking shows the box ticked and locked. A refusal (e.g. hold expired) shows the backend's message.
import { useState } from "react";
import { Price } from "@/components/app/price";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError, apiFetch } from "@/lib/api";
import { So3adTip } from "@/components/app/so3ad";

type Tier = { daysBefore: number; refundPercentage: number };
type FlightPolicies = {
  bookingType: "flight";
  airline?: { id: string; name: string };
  cancellationTiers?: Tier[];
  baggage?: {
    cabins?: { flightId: string; flightNumber: string; cabinClass: string; freeBags: number; maxBagWeightKg: number }[];
    extraBagPrice?: number | null;
    maxExtraBagsPerPassenger?: number;
  };
};
type HotelPolicies = {
  bookingType: "hotel";
  hotel?: { id: string; name: string };
  cancellationTiers?: Tier[];
  checkInTime?: string;
  checkOutTime?: string;
};

/** GET /api/bookings/{type}/{id}/policies (openapi BookingPoliciesResponse). */
export type BookingPolicies = {
  bookingType: "flight" | "hotel";
  bookingId: string;
  currency: string;
  acceptedAt: string | null;
  policies: FlightPolicies | HotelPolicies;
};

type Props = { data: BookingPolicies; onAccepted: (acceptedAt: string) => void };

function Tiers({ tiers, until }: { tiers: Tier[]; until: string }) {
  if (tiers.length === 0) return <p>No refund on cancellation.</p>;
  return (
    <ul className="grid gap-1">
      {tiers.map((t) => (
        <li key={t.daysBefore}>
          {t.daysBefore} or more days before {until}: {t.refundPercentage}% refund
        </li>
      ))}
    </ul>
  );
}

export function PolicyAcceptance({ data, onAccepted }: Props) {
  const [acceptedAt, setAcceptedAt] = useState(data.acceptedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { policies } = data;

  async function accept() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ acceptedAt: string }>(
        `/api/bookings/${data.bookingType}/${data.bookingId}/accept-policies`,
        { method: "POST", json: { accepted: true } },
      );
      setAcceptedAt(res.acceptedAt);
      onAccepted(res.acceptedAt);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="policies-title" className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 id="policies-title" className="text-lg font-semibold">
        {policies.bookingType === "flight" ? policies.airline?.name : policies.hotel?.name} policies
      </h2>
      <So3adTip>Read the refund tiers first, habibi.</So3adTip>
      <div className="grid gap-2">
        <h3 className="font-medium">Cancellation</h3>
        <Tiers tiers={policies.cancellationTiers ?? []} until={policies.bookingType === "flight" ? "departure" : "check-in"} />
      </div>
      {policies.bookingType === "flight" ? (
        <div className="grid gap-2">
          <h3 className="font-medium">Baggage</h3>
          <ul className="grid gap-1">
            {(policies.baggage?.cabins ?? []).map((c) => (
              <li key={`${c.flightId}-${c.cabinClass}`}>
                {c.flightNumber}: {c.freeBags} free bag{c.freeBags === 1 ? "" : "s"}, up to {c.maxBagWeightKg} kg each
              </li>
            ))}
          </ul>
          {policies.baggage?.extraBagPrice != null && (
            <p>
              Extra bag: <Price cents={policies.baggage.extraBagPrice} currency={data.currency} size="sm" /> each, up to{" "}
              {policies.baggage.maxExtraBagsPerPassenger} per passenger
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          <h3 className="font-medium">Check-in and check-out</h3>
          <p>
            Check-in from {policies.checkInTime}, check-out until {policies.checkOutTime}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <div className="flex items-start gap-3">
        <Checkbox
          id="accept-policies"
          checked={acceptedAt !== null}
          disabled={acceptedAt !== null || saving}
          onCheckedChange={(checked) => {
            if (checked === true) void accept();
          }}
        />
        <label htmlFor="accept-policies" className="text-sm">
          I have read and accept these policies
        </label>
      </div>
    </section>
  );
}
