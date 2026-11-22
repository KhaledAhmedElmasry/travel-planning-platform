"use client";

// Profile menu in the header (ACC-09 profile, ACC-08 password, ACC-06 logout).
// Log out sits at the bottom, separated from the other items.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACCOUNT_NAV } from "@/lib/nav";
import { initials, ROLE_LABEL, type SessionUser } from "@/lib/session";

export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logOut() {
    setLeaving(true);
    try {
      // POST /api/auth/logout revokes the session and clears both cookies (ACC-06).
      // Same-origin call: works once the same-origin setup (separate branch) makes
      // Next.js forward /api to the backend.
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (!res.ok && res.status !== 401) throw new Error();
      router.push("/");
      router.refresh();
    } catch {
      toast.error("We couldn't log you out. Try again.");
      setLeaving(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        className="grid size-11 place-items-center rounded-full"
      >
        <Avatar className="size-9 border border-border">
          <AvatarFallback className="bg-muted text-[13px] font-semibold text-link">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5">
          <span className="truncate font-semibold text-foreground">{user.name}</span>
          <span className="truncate text-xs font-normal text-subtle-foreground">
            {ROLE_LABEL[user.role]} · {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACCOUNT_NAV.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logOut} disabled={leaving} className="text-error focus:text-error">
          <LogOutIcon className="size-4" aria-hidden="true" />
          {leaving ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
