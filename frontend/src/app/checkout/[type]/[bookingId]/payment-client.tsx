"use client";

// P-16 client part: Stripe must run in the browser (PAY-01). After the backend confirms the
// payment, go to the confirmation page (P-17).
import { useRouter } from "next/navigation";
import { StripePaymentPanel } from "@/components/app/checkout/stripe-payment-panel";

type Props = {
  bookingType: "flight" | "hotel";
  bookingId: string;
  amount: number;
  currency: string;
  holdExpiresAt: string;
};

export function PaymentClient(props: Props) {
  const router = useRouter();
  return (
    <StripePaymentPanel
      {...props}
      onConfirmed={() => router.push(`/checkout/${props.bookingType}/${props.bookingId}/done`)}
    />
  );
}
