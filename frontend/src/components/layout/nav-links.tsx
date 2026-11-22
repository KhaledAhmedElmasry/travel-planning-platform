"use client";

// Navigation links that highlight the current page (GEN-14). Used by the shells;
// pages never render these themselves.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { isActive, type NavItem } from "@/lib/nav";

/** Horizontal links in the top navbar (desktop). */
export function TopNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "text-link shadow-[inset_0_-2px_0_var(--accent-cyan)] rounded-none"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Vertical links: dashboard sidebar and the mobile menu. */
export function SideNavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--accent-cyan)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {Icon && <Icon className="size-5" aria-hidden="true" />}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
