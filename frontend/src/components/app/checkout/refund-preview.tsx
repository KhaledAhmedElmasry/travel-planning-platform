// RefundPreview
// Part: Lead (foundation)
// Requirements: FLT-26, HTL-21
// Used by: P-21, P-23
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
//
// <RefundPreview kind="flight" preview={details.cancellation} />
// Before the user confirms a cancellation (FLT-26, HTL-21) they see what comes back: the booking
// details return `cancellation` (openapi CancellationPreview), computed exactly like the cancel
// itself, so the refund given equals the refund shown. Put it inside the ConfirmDialog description.
import { Price } from "@/components/app/price";

/** openapi CancellationPreview */
export type CancellationPreview = {
  cancellable: boolean;
  reason: string | null;
  daysBefore: number | null;
  refundPercentage: number;
  tierDaysBefore: number | null;
  refundAmount: number;
  currency: string;
};

type Props = { kind: "flight" | "hotel"; preview: CancellationPreview };

export function RefundPreview({ kind, preview }: Props) {
  const until = kind === "flight" ? "departure" : "check-in";
  return (
    <section aria-label="Refund" className="grid gap-1 rounded-lg border border-border bg-muted/40 p-4">
      {!preview.cancellable ? (
        <p>{preview.reason}</p>
      ) : preview.refundAmount > 0 ? (
        <>
          <p className="flex items-baseline gap-2">
            <span>Refund:</span>
            <Price cents={preview.refundAmount} currency={preview.currency} size="lg" />
            <span className="text-muted-foreground">({preview.refundPercentage}%)</span>
          </p>
          {preview.daysBefore !== null && (
            <p className="text-sm text-muted-foreground">
              {preview.daysBefore} days before {until}
            </p>
          )}
        </>
      ) : (
        <>
          <p>No refund (0%).</p>
          {preview.daysBefore !== null && (
            <p className="text-sm text-muted-foreground">
              {preview.daysBefore} days before {until}
            </p>
          )}
        </>
      )}
    </section>
  );
}
