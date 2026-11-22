// <StatCard label="Open reports" value={7} icon={FlagIcon} tone="warning" href="/admin/reports" />
// The number tiles on the role home pages (admin, airline and hotel dashboards).
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

type StatCardProps = {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  /** Color the number only when it needs attention. */
  tone?: "default" | "warning" | "error" | "success";
  href?: string;
  className?: string;
};

const toneText = {
  default: "text-foreground",
  warning: "text-warning",
  error: "text-error",
  success: "text-success",
};

export function StatCard({ label, value, icon: Icon, tone = "default", href, className }: StatCardProps) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        {Icon && <Icon className="size-4" aria-hidden="true" />}
        {label}
      </span>
      <span className={cn("tabular mt-1 block text-[28px] font-bold leading-tight", toneText[tone])}>
        {typeof value === "number" ? value.toLocaleString("en-US") : value}
      </span>
    </>
  );
  const base = "block rounded-xl border border-border bg-card p-4";
  return href ? (
    <Link href={href} className={cn(base, "transition-colors hover:border-input", className)}>
      {body}
    </Link>
  ) : (
    <div className={cn(base, className)}>{body}</div>
  );
}
