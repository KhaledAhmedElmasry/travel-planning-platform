import { formatMoney } from './format-money';
import type { RefundResponse } from './refunds.service';
import { RefundStatus } from './schemas/refund.schema';

// GEN-01: an in-app notification, passed to NotificationsService.notify(userId, title, message).
export interface NotificationText {
  title: string;
  message: string;
}

// The refund part of a cancellation message (PAY-03); null = 0% tier, nothing refunded.
export function refundSentence(refund: RefundResponse | null): string {
  if (!refund) return 'No refund is due under the cancellation policy.';
  const amount = formatMoney(refund.amount, refund.currency);
  return refund.status === RefundStatus.Refunded
    ? `${amount} has been refunded.`
    : `A refund of ${amount} is being processed.`;
}
