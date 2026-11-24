// ReviewCard
// Part: Lead (foundation)
// Requirements: HTL-24, HTL-26, ACC-12
// Used by: P-18, P-23, hotel reviews
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// Built (24 Nov). <ReviewCard review={item} actions={<ReportButton contentType="review" contentId={item.id} />} />
// Rating, author ("Deleted user" comes from the backend, ACC-12), date, optional text, the hotel's
// reply (HTL-26), a "Hidden" badge (GEN-10). Pages add their own buttons (report, edit/delete, reply box) via `actions`.
import type { ReactNode } from "react";
import { StarRating } from "@/components/app/shared/star-rating";
import { StatusBadge } from "@/components/app/status-badge";
import { formatDate } from "@/lib/format";

/** backend reviews.service.ts ReviewResponse */
export type HotelReview = {
  id: string;
  rating: number;
  text: string | null;
  author: { name: string };
  date: string;
  reply: { text: string; date: string } | null;
};

type ReviewCardProps = { review: HotelReview; hidden?: boolean; actions?: ReactNode };

export function ReviewCard({ review: r, hidden = false, actions }: ReviewCardProps) {
  return (
    <article className="grid gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarRating value={r.rating} />
        <span className="font-semibold">{r.author.name}</span>
        <span className="text-[13px] text-subtle-foreground">{formatDate(r.date)}</span>
        {hidden && <StatusBadge kind="content" status="hidden" />}
      </div>
      {r.text && <p className="whitespace-pre-line">{r.text}</p>}
      {r.reply && (
        <div className="grid gap-1 rounded-lg border-l-2 border-primary bg-muted p-3">
          <span className="text-sm font-semibold">Reply from the hotel</span>
          <p className="text-sm whitespace-pre-line">{r.reply.text}</p>
          <span className="text-[13px] text-subtle-foreground">{formatDate(r.reply.date)}</span>
        </div>
      )}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}
