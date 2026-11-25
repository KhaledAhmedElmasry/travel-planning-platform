"use client";

// Shared parts of the booking details pages P-21 (flights) and P-23 (hotels):
// - <BookingStatusSection>: booking status (GEN-11), payment status (PAY-01), refund status (PAY-03)
// - <ContinuePayment>: a Pending Payment booking goes back to the payment while the hold lasts
//   (team leader, 24 Nov)
// - <CancelBooking>: shows the refund (RefundPreview = the backend's `cancellation`, computed like
//   the cancel itself) inside a ConfirmDialog, then POST /api/{type}-bookings/{id}/cancel
//   (FLT-26, HTL-21, GEN-03) and re-renders the page with the new status and refund.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Price } from "@/components/app/price";
import { StatusBadge } from "@/components/app/status-badge";
import { RefundPreview, type CancellationPreview } from "@/components/app/checkout/refund-preview";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";

type Kind = "flight" | "hotel";

/** Backend PaymentResponse / RefundResponse: the fields the details show. */
export type BookingPayment = { status: string } | null;
export type BookingRefund = { id: string; amount: number; currency: string; refundPercentage: number; status: string } | null;

export function BookingStatusSection({
  status,
  payment,
  refund,
}: {
  status: string;
  payment: BookingPayment;
  refund: BookingRefund;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <StatusBadge kind="booking" status={status as "confirmed"} />
        {payment && <StatusBadge kind="payment" status={payment.status as "succeeded"} />}
      </div>
      {refund && (
        <section aria-label="Refund status" className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="refund" status={refund.status as "refunded"} />
          <Price cents={refund.amount} currency={refund.currency} size="sm" />
          <span className="text-sm text-muted-foreground">({refund.refundPercentage}%)</span>
        </section>
      )}
    </div>
  );
}

export function ContinuePayment({
  kind,
  id,
  status,
  holdExpiresAt,
  now,
}: {
  kind: Kind;
  id: string;
  status: string;
  holdExpiresAt: string | null;
  now: Date;
}) {
  if (status !== "pending_payment" || !holdExpiresAt || new Date(holdExpiresAt) <= now) return null;
  return (
    <Button asChild>
      <Link href={`/checkout/${kind}/${id}`}>Continue payment</Link>
    </Button>
  );
}

export function CancelBooking({
  kind,
  id,
  status,
  cancellation,
}: {
  kind: Kind;
  id: string;
  status: string;
  cancellation: CancellationPreview;
}) {
  const router = useRouter();
  if (status !== "confirmed") return null;
  if (!cancellation.cancellable) return <p className="text-sm text-muted-foreground">{cancellation.reason}</p>;

  const noun = kind === "flight" ? "booking" : "reservation";
  async function cancel() {
    try {
      await apiFetch(`/api/${kind}-bookings/${id}/cancel`, { method: "POST" });
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      throw err; // keeps the dialog open
    }
    toast.success(kind === "flight" ? "Booking cancelled" : "Reservation cancelled");
    router.refresh();
  }

  // Dialog and toast texts accepted as built (team leader decision 24 Nov - wording).
  return (
    <ConfirmDialog
      trigger={<Button variant="destructive">Cancel {noun}</Button>}
      title={`Cancel this ${noun}?`}
      description={<RefundPreview kind={kind} preview={cancellation} />}
      confirmLabel={`Cancel ${noun}`}
      cancelLabel={`Keep ${noun}`}
      onConfirm={cancel}
    />
  );
}
