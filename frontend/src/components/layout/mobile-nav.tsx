"use client";

// Hamburger button + slide-in menu for phones and tablets (GEN-16 responsive).
import { useState, type ReactNode } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SideNavLinks } from "@/components/layout/nav-links";
import { Wordmark } from "@/components/layout/wordmark";
import type { NavItem } from "@/lib/nav";

type MobileNavProps = {
  items: NavItem[];
  /** Extra content under the links, e.g. Log in / Sign up buttons for guests. */
  footer?: ReactNode;
  className?: string;
};

export function MobileNav({ items, footer, className }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className={className}>
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-6 bg-sidebar p-4">
        <SheetHeader className="p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Wordmark />
        </SheetHeader>
        <nav aria-label="Main">
          <SideNavLinks items={items} onNavigate={() => setOpen(false)} />
        </nav>
        {footer && <div className="mt-auto grid gap-2">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
