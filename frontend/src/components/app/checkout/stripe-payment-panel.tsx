"use client";

// StripePaymentPanel
// Part: Lead (foundation)
// Requirements: PAY-01
// Used by: P-16, P-21 change flight
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <StripePaymentPanel bookingType="flight" bookingId={id} amount={totalAmount} currency="USD"
//   holdExpiresAt={holdExpiresAt} onConfirmed={(paymentId) => router.push(`/checkout/flight/${id}/done`)} />
// PAY-01: Stripe Elements card form (test mode); card data goes straight to Stripe, never to our
// backend. Flow: POST /api/payments (or POST /api/payments/{id}/retry after a failure) gives the
// clientSecret, Stripe confirms the card, then we wait for the backend: the booking is confirmed
// only by the Stripe webhook, so GET /api/payments/{id} is checked every 2 s for up to 60 s
// (team leader, 23 Nov). Failures show the message and a Retry until the hold expires; when the
// hold expires the form is replaced by "Search again".
// Needs NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_...) in frontend/.env.local.
import Link from "next/link";
import { useState } from "react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { HoldCountdown } from "@/components/app/hold-countdown";
import { Price } from "@/components/app/price";
import { So3ad } from "@/components/app/so3ad";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
// Stripe draws the card field in its own frame, out of reach of our CSS: it needs the dark theme's
// text colors here (MASTER.md section 2: --foreground, --subtle-foreground), or typed text is unreadable.
export const CARD_OPTIONS = { style: { base: { color: "#E8E7EF", "::placeholder": { color: "#8D8BA0" } } } };
const stripePromise = loadStripe(publishableKey);

const POLL_EVERY_MS = 2000;
const POLL_FOR_MS = 60_000;

type Payment = { id: string; status: string; failureMessage: string | null; clientSecret: string | null };
type Phase = "ready" | "paying" | "waiting" | "failed" | "slow" | "expired";

type Props = {
  bookingType: "flight" | "hotel";
  bookingId: string;
  /** Integer cents of the platform currency (PAY-04). */
  amount: number;
  currency: string;
  holdExpiresAt: string;
  onConfirmed: (paymentId: string) => void;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function PaymentForm({ bookingType, bookingId, holdExpiresAt, onConfirmed }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(() =>
    new Date(holdExpiresAt).getTime() <= Date.now() ? "expired" : "ready",
  );
  const [error, setError] = useState<string | null>(null);

  async function waitForBackend(id: string) {
    setPhase("waiting");
    for (let waited = 0; waited < POLL_FOR_MS; waited += POLL_EVERY_MS) {
      await wait(POLL_EVERY_MS);
      const current = await apiFetch<Payment>(`/api/payments/${id}`);
      if (current.status === "succeeded") {
        onConfirmed(id);
        return;
      }
      if (current.status === "failed") {
        setError(current.failureMessage ?? "The payment failed.");
        setPhase("failed");
        return;
      }
    }
    setPhase("slow");
  }

  async function pay() {
    if (!stripe || !elements) return;
    setError(null);
    setPhase("paying");
    try {
      const started = paymentId
        ? await apiFetch<Payment>(`/api/payments/${paymentId}/retry`, { method: "POST" })
        : await apiFetch<Payment>("/api/payments", { method: "POST", json: { bookingType, bookingId } });
      setPaymentId(started.id ?? paymentId);
      const id = started.id ?? paymentId!;
      const card = elements.getElement(CardElement);
      if (!started.clientSecret || !card) throw new Error("The payment could not be started.");
      const result = await stripe.confirmCardPayment(started.clientSecret, { payment_method: { card } });
      if (result.error) {
        setError(result.error.message ?? "The payment failed.");
        setPhase("failed");
        return;
      }
      await waitForBackend(id);
    } catch (err) {
      if (!(err instanceof ApiError) && !(err instanceof Error)) throw err;
      setError(err.message);
      setPhase(paymentId ? "failed" : "ready");
    }
  }

  if (phase === "expired") {
    return (
      <div role="alert" className="grid gap-3">
        <div className="flex items-center gap-3">
          <So3ad pose="watch" size={72} />
          <p className="font-semibold">&ldquo;Time&rsquo;s up! The {bookingType === "hotel" ? "rooms" : "seats"} ran away.&rdquo;</p>
        </div>
        <p>Your hold has expired, so this booking can no longer be paid.</p>
        <Button asChild variant="secondary" className="justify-self-start">
          <Link href={bookingType === "flight" ? "/flights" : "/hotels"}>Search again</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <HoldCountdown bookingType={bookingType} expiresAt={holdExpiresAt} onExpire={() => setPhase("expired")} />
      <div className="rounded-lg border border-input bg-background p-3">
        <CardElement options={CARD_OPTIONS} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {phase === "waiting" && (
        <div className="flex items-center gap-3">
          <So3ad pose="tap" size={72} />
          <div className="grid gap-1">
            <p className="font-semibold">&ldquo;Don&rsquo;t blink, the bank is thinking.&rdquo;</p>
            <p role="status" className="text-sm text-muted-foreground">
              Waiting for confirmation…
            </p>
          </div>
        </div>
      )}
      {phase === "slow" && (
        <p role="status" className="text-sm">
          The confirmation is taking longer than usual. Your booking will show as confirmed in{" "}
          <Link href="/bookings" className="text-link underline underline-offset-4">
            My bookings
          </Link>
          .
        </p>
      )}
      {(phase === "ready" || phase === "paying" || phase === "failed") && (
        <Button
          className="justify-self-start"
          loading={phase === "paying"}
          disabled={!stripe}
          onClick={() => void pay()}
        >
          {phase === "failed" ? "Retry" : "Pay"}
        </Button>
      )}
    </div>
  );
}

export function StripePaymentPanel(props: Props) {
  return (
    <section aria-labelledby="payment-title" className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <h2 id="payment-title" className="flex flex-wrap items-baseline gap-2 text-lg font-semibold">
        Payment <Price cents={props.amount} currency={props.currency} size="lg" />
      </h2>
      <Elements stripe={stripePromise}>
        <PaymentForm {...props} />
      </Elements>
    </section>
  );
}
