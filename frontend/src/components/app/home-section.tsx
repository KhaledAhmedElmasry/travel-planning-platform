// <HomeSection title="Open reports" seeAll="/admin/reports">...rows...</HomeSection>
// One block of a role home page (ACC-04): a titled region, with a "See all" link to the full page.
// Lists on the homes show HOME_LIST_SIZE items (team leader, 24 Nov).
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export const HOME_LIST_SIZE = 5;

type HomeSectionProps = {
  title: string;
  seeAll?: string;
  children: ReactNode;
  className?: string;
};

export function HomeSection({ title, seeAll, children, className }: HomeSectionProps) {
  const id = `home-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cn("grid content-start gap-3", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {seeAll && (
          <Link href={seeAll} className="text-sm font-medium text-link hover:underline">
            See all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** A bordered list of rows (each row usually a link). */
export function HomeList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border rounded-xl border border-border bg-card">{children}</ul>;
}

/** One row of a HomeList; with `href` the whole row is a link. */
export function HomeListRow({ href, children }: { href?: string; children: ReactNode }) {
  const body = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3";
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(body, "transition-colors hover:bg-muted")}>
          {children}
        </Link>
      ) : (
        <div className={body}>{children}</div>
      )}
    </li>
  );
}

/** The "Quick actions" block of a dashboard home: one button-link per action. */
export function QuickActions({ actions }: { actions: { label: string; href: string; icon?: LucideIcon }[] }) {
  return (
    <HomeSection title="Quick actions">
      <div className="flex flex-wrap gap-3">
        {actions.map(({ label, href, icon: Icon }) => (
          <Button key={label} asChild variant="secondary">
            <Link href={href}>
              {Icon && <Icon aria-hidden="true" />}
              {label}
            </Link>
          </Button>
        ))}
      </div>
    </HomeSection>
  );
}
