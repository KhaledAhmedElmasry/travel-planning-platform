"use client";

// P-16 client part: Stripe must run in the browser (PAY-01). After the backend confirms the
// payment, go to the confirmation page (P-17).
// PAY-02: a booking whose policies are not accepted yet ("Continue payment" after leaving the booking
// wizard before the policy step) shows PolicyAcceptance first; the card form appears after acceptance,
// since the backend refuses payment until then (team leader decision 26 Nov).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PolicyAcceptance, type BookingPolicies } from "@/components/app/checkout/policy-acceptance";
import { StatusBadge } from "@/components/app/status-badge";
import { StripePaymentPanel } from "@/components/app/checkout/stripe-payment-panel";
import { Button } from "@/components/ui/button";

type Props = {
  bookingType: "flight" | "hotel";
  bookingId: string;
  amount: number;
  currency: string;
  holdExpiresAt: string;
  /** GET /api/bookings/{type}/{id}/policies; null when it could not be read (the panel then shows the backend's refusal). */
  policies: BookingPolicies | null;
};

export function PaymentClient({ policies, ...props }: Props) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(policies === null || policies.acceptedAt !== null);
  return (
    <>
      {policies && policies.acceptedAt === null && <PolicyAcceptance data={policies} onAccepted={() => setAccepted(true)} />}
      {accepted && (
        <StripePaymentPanel
          {...props}
          onConfirmed={() => router.push(`/checkout/${props.bookingType}/${props.bookingId}/done`)}
        />
      )}
    </>
  );
}

/** A cancelled or completed booking opened by URL (GEN-11 final states): nothing to pay. */
export function NoLongerPayable({
  bookingType,
  bookingId,
  status,
}: {
  bookingType: "flight" | "hotel";
  bookingId: string;
  status: "cancelled" | "completed";
}) {
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:p-6">
      <p className="font-semibold">This booking is no longer waiting for payment.</p>
      <StatusBadge kind="booking" status={status} />
      <div>
        <Button asChild variant="secondary">
          <Link href={`/bookings/${bookingType}s/${bookingId}`}>View booking details</Link>
        </Button>
      </div>
    </section>
  );
}
