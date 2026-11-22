// <PageHeader title="My bookings" description="Your flights and hotel stays."
//             actions={<Button>New itinerary</Button>} back={{ href: "/bookings", label: "All bookings" }} />
// The top of every page: one h1 (accessibility), optional description, actions on
// the right, and a back link on detail pages (GEN-14: users can always go back).
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "cn";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  className?: string;
};

export function PageHeader({ title, description, actions, back, className }: PageHeaderProps) {
  return (
    <div className={cn("grid gap-3 pb-6", className)}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-link hover:underline"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-h1 font-bold tracking-tight">{title}</h1>
          {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
