"use client";

// Free-text tags for blog posts (BLG-01, BLG-08): up to 5 tags, each up to 30
// characters. Type a tag and press Enter (or comma) to add it; duplicates are ignored.
// <FormField label="Tags" name="tags" hint="Up to 5 tags, 30 characters each." error={errors.tags}>
//   <TagInput value={tags} onChange={setTags} />
// </FormField>
import { useState, type ComponentProps, type KeyboardEvent } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/app/multi-select";

type TagInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  maxLength?: number;
};

export function TagInput({ value, onChange, max = 5, maxLength = 30, className, ...inputProps }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const full = value.length >= max;

  function add() {
    const tag = draft.trim().replace(/,$/, "").trim();
    if (!tag || full) return;
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Input
        {...inputProps}
        value={draft}
        maxLength={maxLength}
        disabled={full || inputProps.disabled}
        placeholder={full ? `Maximum ${max} tags` : (inputProps.placeholder ?? "Type a tag and press Enter")}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
      />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tags">
          {value.map((tag) => (
            <li key={tag}>
              <Chip label={tag} onRemove={() => onChange(value.filter((t) => t !== tag))} />
            </li>
          ))}
        </ul>
      )}
      <p className="tabular text-[13px] text-subtle-foreground" aria-live="polite">
        {value.length} of {max} tags
      </p>
    </div>
  );
}
