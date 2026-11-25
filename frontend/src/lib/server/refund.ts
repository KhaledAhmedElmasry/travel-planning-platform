// SERVER ONLY. The booking details pages P-21 / P-23 read the refund with GET /api/refunds/{id}
// (PAY-03). When that call gives no data (401/403/404) the refund from the details reply is shown
// (team leader, 25 Nov); other errors throw, so the page shows its error screen.
import { backendJson } from "./backend";

export async function latestRefund<R extends { id: string }>(refund: R | null): Promise<R | null> {
  if (!refund) return null;
  return (await backendJson<R>(`/api/refunds/${encodeURIComponent(refund.id)}`)) ?? refund;
}
