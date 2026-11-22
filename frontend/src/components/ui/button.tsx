// Button (shadcn, tuned to Yallaway, MASTER.md section 6.1).
// Use the props, never extra color classes:
//   <Button>Book now</Button>                         primary (one per screen)
//   <Button variant="secondary">View details</Button>
//   <Button variant="ghost">Cancel</Button>
//   <Button variant="destructive">Cancel booking</Button>   (with <ConfirmDialog>, GEN-03)
//   <Button variant="link">Forgot password?</Button>
//   <Button loading={isSaving}>Save</Button>         spinner + disabled, keeps its width
//   <Button size="icon" aria-label="Notifications"><BellIcon /></Button>
// Sizes: sm 36px, default 44px (touch target), lg 52px.
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { Loader2Icon } from "lucide-react"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-colors duration-150 outline-none select-none touch-manipulation focus-visible:ring-3 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:border-input aria-expanded:border-input",
        outline:
          "border-input bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        ghost:
          "text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[#a93d3d] focus-visible:ring-destructive/50",
        link: "h-auto px-1 text-link underline underline-offset-4 hover:no-underline",
      },
      size: {
        default: "h-11 gap-2 px-4 text-[15px]",
        sm: "h-9 gap-1.5 px-3 text-sm",
        lg: "h-13 gap-2 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner, disables the button and keeps its width (GEN-16). */
    loading?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            </span>
          )}
          {/* opacity-0 (not invisible) keeps the label for screen readers while the spinner shows */}
          <span className={cn("inline-flex items-center gap-[inherit]", loading && "opacity-0")}>
            {children}
          </span>
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
