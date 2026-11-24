// StarRating
// Part: Lead (foundation)
// Requirements: HTL-12, HTL-23, HTL-24
// Used by: P-15, P-18, P-23
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// Built (24 Nov). Display: <StarRating value={hotel.averageRating} />  (average, read "Rated 4.3 out of 5")
//                 Input:   <StarRating value={rating} onChange={setRating} label="Rating" />  (radios 1-5, HTL-23)
import { StarIcon } from "lucide-react";
import { cn } from "cn";

type StarRatingProps = {
  /** 0-5; decimals allowed for averages (the stars show the rounded value). */
  value: number;
  /** Given -> the user picks 1-5 (review form). */
  onChange?: (value: number) => void;
  /** Accessible name of the input group (input mode). */
  label?: string;
  /** Radio group name (input mode). */
  name?: string;
  className?: string;
};

const STARS = [1, 2, 3, 4, 5];

function Star({ filled }: { filled: boolean }) {
  return (
    <StarIcon
      data-filled={filled ? "true" : "false"}
      aria-hidden="true"
      className={cn("size-4", filled ? "fill-warning text-warning" : "text-subtle-foreground")}
    />
  );
}

export function StarRating({ value, onChange, label = "Rating", name = "rating", className }: StarRatingProps) {
  if (!onChange) {
    const rounded = Math.round(value);
    return (
      <span role="img" aria-label={`Rated ${Math.round(value * 10) / 10} out of 5`} className={cn("inline-flex gap-0.5", className)}>
        {STARS.map((n) => (
          <Star key={n} filled={n <= rounded} />
        ))}
      </span>
    );
  }
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex gap-1", className)}>
      {STARS.map((n) => (
        <label key={n} className="grid size-9 cursor-pointer place-items-center rounded-md has-focus-visible:ring-3 has-focus-visible:ring-ring/60">
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            aria-label={n === 1 ? "1 star" : `${n} stars`}
            className="sr-only"
          />
          <Star filled={n <= value} />
        </label>
      ))}
    </div>
  );
}
