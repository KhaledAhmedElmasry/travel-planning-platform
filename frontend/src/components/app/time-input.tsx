// A time of day "HH:mm" (hotel check-in / check-out times, HTL-09; activity time, ITN-10).
// <FormField label="Check-in time" name="checkInTime" required error={errors.checkInTime}>
//   <TimeInput value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
// </FormField>
// Uses the browser's own time field (keyboard and screen-reader friendly, 24-hour value).
import type { ComponentProps } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export function TimeInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  return <Input type="time" step={60} className={cn("tabular w-36", className)} {...props} />;
}
