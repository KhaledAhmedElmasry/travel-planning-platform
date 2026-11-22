// <StatusBadge kind="booking" status={booking.status} />
// One pill for every status in the app, with an icon AND a word, never color alone.
// Pass the backend's value as it comes from the API; `kind` says which list it is from,
// because the same word can mean different things (a cancelled flight vs a cancelled booking).
//   booking  GEN-11  pending_payment | confirmed | completed | expired | cancelled
//   payment  PAY-01  pending | succeeded | failed | cancelled
//   refund   PAY-03  pending | refunded | failed
//   flight   FLT-30  scheduled | departed | cancelled
//   night    HTL-08  available | booked | blocked     (detail = reservation reference)
//   account  ACC-15  active | suspended | deactivated
//   provider ACC-15  active | inactive               (airline / hotel)
//   post     BLG-03  draft | published
//   content  GEN-10  hidden
// MASTER.md section 6.3. Badge text on its 15% tint passes 4.5:1 for every tone.
import {
  BanIcon,
  BedDoubleIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  CreditCardIcon,
  EyeOffIcon,
  FlagIcon,
  GlobeIcon,
  HourglassIcon,
  LockIcon,
  PencilLineIcon,
  PlaneLandingIcon,
  PlaneTakeoffIcon,
  TimerOffIcon,
  TriangleAlertIcon,
  UserCheckIcon,
  UserXIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";

type Tone = "success" | "warning" | "error" | "info" | "neutral";
type Look = { label: string; tone: Tone; icon: LucideIcon };

const STATUSES = {
  booking: {
    pending_payment: { label: "Pending payment", tone: "warning", icon: ClockIcon },
    confirmed: { label: "Confirmed", tone: "success", icon: CircleCheckIcon },
    completed: { label: "Completed", tone: "info", icon: FlagIcon },
    expired: { label: "Expired", tone: "error", icon: TimerOffIcon },
    cancelled: { label: "Cancelled", tone: "neutral", icon: CircleXIcon },
  },
  payment: {
    pending: { label: "Payment pending", tone: "warning", icon: ClockIcon },
    succeeded: { label: "Paid", tone: "success", icon: CreditCardIcon },
    failed: { label: "Payment failed", tone: "error", icon: TriangleAlertIcon },
    cancelled: { label: "Payment cancelled", tone: "neutral", icon: CircleXIcon },
  },
  refund: {
    pending: { label: "Refund pending", tone: "warning", icon: HourglassIcon },
    refunded: { label: "Refunded", tone: "success", icon: CheckIcon },
    failed: { label: "Refund failed", tone: "error", icon: TriangleAlertIcon },
  },
  flight: {
    scheduled: { label: "Scheduled", tone: "info", icon: PlaneTakeoffIcon },
    departed: { label: "Departed", tone: "neutral", icon: PlaneLandingIcon },
    cancelled: { label: "Cancelled", tone: "error", icon: BanIcon },
  },
  night: {
    available: { label: "Available", tone: "success", icon: CheckIcon },
    booked: { label: "Booked", tone: "info", icon: BedDoubleIcon },
    blocked: { label: "Blocked", tone: "neutral", icon: LockIcon },
  },
  account: {
    active: { label: "Active", tone: "success", icon: UserCheckIcon },
    suspended: { label: "Suspended", tone: "error", icon: UserXIcon },
    deactivated: { label: "Deactivated", tone: "neutral", icon: BanIcon },
  },
  provider: {
    active: { label: "Active", tone: "success", icon: CheckIcon },
    inactive: { label: "Deactivated", tone: "neutral", icon: BanIcon },
  },
  post: {
    draft: { label: "Draft", tone: "neutral", icon: PencilLineIcon },
    published: { label: "Published", tone: "info", icon: GlobeIcon },
  },
  content: {
    hidden: { label: "Hidden", tone: "warning", icon: EyeOffIcon },
  },
} satisfies Record<string, Record<string, Look>>;

type Statuses = typeof STATUSES;
export type StatusKind = keyof Statuses;

const tones: Record<Tone, string> = {
  success: "text-success bg-success/15",
  warning: "text-warning bg-warning/15",
  error: "text-error bg-error/15",
  info: "text-info bg-info/15",
  neutral: "text-muted-foreground bg-muted-foreground/15",
};

type StatusBadgeProps<K extends StatusKind> = {
  kind: K;
  status: keyof Statuses[K];
  /** Extra text after the label, e.g. a reservation reference: "Booked · YW4K9P" */
  detail?: string;
  className?: string;
};

export function StatusBadge<K extends StatusKind>({
  kind,
  status,
  detail,
  className,
}: StatusBadgeProps<K>) {
  const look = STATUSES[kind][status] as Look | undefined;
  // Unknown value from the API: show it as a neutral pill instead of crashing the page.
  const { label, tone, icon: Icon } = look ?? {
    label: String(status),
    tone: "neutral" as const,
    icon: CircleXIcon,
  };
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
      {detail && <span className="font-medium opacity-90">· {detail}</span>}
    </span>
  );
}
