"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { loginPath, safeReturnTo } from "@/lib/return-to";

// If the page sends us back here right after a successful refresh, the browser is not keeping
// the cookie (for example Safari refuses Secure cookies on http://localhost). Stop the loop.
const GUARD_KEY = "yallaway-resume";
const GUARD_MS = 10_000;

function recentlyResumed(target: string): boolean {
  try {
    const raw = sessionStorage.getItem(GUARD_KEY);
    if (!raw) return false;
    const { to, at } = JSON.parse(raw) as { to: string; at: number };
    return to === target && Date.now() - at < GUARD_MS;
  } catch {
    return false;
  }
}

function remember(target: string) {
  try {
    sessionStorage.setItem(GUARD_KEY, JSON.stringify({ to: target, at: Date.now() }));
  } catch {
    // storage blocked: no loop guard, still works
  }
}

export function ResumeSession() {
  const router = useRouter();
  const params = useSearchParams();
  const target = safeReturnTo(params.get("returnTo")) ?? "/";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (recentlyResumed(target)) {
        const login = loginPath(target);
        router.replace(`${login}${login.includes("?") ? "&" : "?"}reason=cookies`);
        return;
      }
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include", cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          remember(target);
          router.replace(target);
          router.refresh();
        } else {
          router.replace(loginPath(target));
        }
      } catch {
        if (!cancelled) router.replace(loginPath(target));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, target]);

  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <p className="flex items-center gap-2 text-muted-foreground" role="status">
        <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
        Checking your session…
      </p>
    </main>
  );
}
