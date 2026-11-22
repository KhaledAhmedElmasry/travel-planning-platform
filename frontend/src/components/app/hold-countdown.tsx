"use client";

// <HoldCountdown expiresAt={booking.holdExpiresAt} onExpire={() => setExpired(true)} />
// The 10-minute seat/room hold timer (FLT-22, HTL-18, PAY-01). Turns amber under
// 2 minutes with So3ad's warning line. Screen readers hear it only at 5, 2 and 1
// minutes and when it ends (not every second). The backend is still the judge:
// when the hold has ended, payment is refused even if a clock is wrong.
import { useEffect, useRef, useState } from "react";
import { ClockIcon } from "lucide-react";
import { cn } from "cn";
import { formatCountdown } from "@/lib/format";

type HoldCountdownProps = {
  /** ISO timestamp from the booking (holdExpiresAt). */
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
};

const ANNOUNCE_AT = new Set([300, 120, 60, 0]);

export function HoldCountdown({ expiresAt, onExpire, className }: HoldCountdownProps) {
  const end = new Date(expiresAt).getTime();
  const [left, setLeft] = useState(() => Math.max(0, Math.round((end - Date.now()) / 1000)));
  const [announcement, setAnnouncement] = useState("");
  const expiredRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const seconds = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(seconds);
      if (ANNOUNCE_AT.has(seconds)) {
        setAnnouncement(
          seconds === 0
            ? "Your hold has ended."
            : `${Math.round(seconds / 60)} minute${seconds === 60 ? "" : "s"} left to pay.`,
        );
      }
      if (seconds === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [end, onExpire]);

  const warn = left > 0 && left < 120;
  const over = left === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        over && "border-error/60 bg-error/10",
        warn && "border-warning bg-warning/10",
        !over && !warn && "border-border bg-muted",
        className,
      )}
    >
      <ClockIcon className={cn("size-5", over ? "text-error" : warn ? "text-warning" : "text-muted-foreground")} aria-hidden="true" />
      <div className="grid">
        <span className="text-[13px] text-muted-foreground">
          {over ? "Hold ended" : "Seats held for you"}
        </span>
        <span
          className={cn("tabular text-2xl font-bold leading-tight", over ? "text-error" : warn && "text-warning")}
          role="timer"
          aria-label="Time left to pay"
        >
          {formatCountdown(left)}
        </span>
        {warn && <span className="text-[13px] font-medium text-warning">So3ad: &ldquo;Hurry, habibi! The seats won&rsquo;t wait.&rdquo;</span>}
      </div>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
