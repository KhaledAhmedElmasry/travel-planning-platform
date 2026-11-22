// Text input (shadcn, tuned to Yallaway): 44px tall, 16px text (no iOS zoom),
// #706E88 outline (3:1+), cyan focus ring, red outline when aria-invalid.
// In pages, wrap it in <FormField> so it gets a label and the inline error (GEN-02).
import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 text-base transition-colors duration-150 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-error aria-invalid:ring-error/25",
        className
      )}
      {...props}
    />
  )
}

export { Input }
