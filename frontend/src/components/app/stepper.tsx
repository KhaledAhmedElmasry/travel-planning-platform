// <Stepper steps={["Passengers", "Summary", "Policies", "Payment", "Done"]} current={2} />
// The booking wizard progress bar (P-14 flights, P-19 hotels). `current` is 0-based.
import { CheckIcon } from "lucide-react";
import { cn } from "cn";

type StepperProps = {
  steps: string[];
  current: number;
  className?: string;
};

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-x-2 gap-y-3", className)}>
      {steps.map((step, index) => {
        const done = index < current;
        const now = index === current;
        return (
          <li
            key={step}
            aria-current={now ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 text-sm font-medium",
              now ? "text-foreground" : done ? "text-muted-foreground" : "text-subtle-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full border text-[13px] font-semibold",
                now && "border-primary bg-primary text-primary-foreground",
                done && "border-muted bg-muted text-success",
                !now && !done && "border-input",
              )}
            >
              {done ? <CheckIcon className="size-3.5" aria-hidden="true" /> : index + 1}
            </span>
            {step}
            {done && <span className="sr-only">(completed)</span>}
            {index < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
