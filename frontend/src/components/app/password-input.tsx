"use client";

// <FormField label="Password" name="password" required>
//   <PasswordInput autoComplete="new-password" showRules value={pw} onChange={...} />
// </FormField>
// Show/hide toggle, paste and password managers allowed (WCAG accessible authentication).
// `showRules` lists the backend's password rule live (ACC-01, ACC-07, ACC-08):
// at least 8 characters, at least 1 letter and at least 1 digit.
import { useState, type ComponentProps } from "react";
import { CheckIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

export const PASSWORD_RULES = [
  { id: "length", label: "8 characters or more", test: (v: string) => v.length >= 8 },
  { id: "letter", label: "At least 1 letter", test: (v: string) => /[A-Za-z]/.test(v) },
  { id: "digit", label: "At least 1 digit", test: (v: string) => /\d/.test(v) },
] as const;

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  showRules?: boolean;
};

export function PasswordInput({ showRules = false, className, value, defaultValue, onChange, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(String(value ?? defaultValue ?? ""));
  const text = value !== undefined ? String(value) : current;
  const rulesId = props.id ? `${props.id}-rules` : undefined;

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Input
          {...props}
          type={visible ? "text" : "password"}
          value={value}
          defaultValue={defaultValue}
          onChange={(event) => {
            setCurrent(event.target.value);
            onChange?.(event);
          }}
          aria-describedby={[props["aria-describedby"], showRules ? rulesId : undefined].filter(Boolean).join(" ") || undefined}
          className={cn("pr-12", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOffIcon className="size-5" aria-hidden="true" /> : <EyeIcon className="size-5" aria-hidden="true" />}
        </button>
      </div>
      {showRules && (
        <ul id={rulesId} className="grid gap-1 text-[13px]">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(text);
            return (
              <li key={rule.id} className={cn("flex items-center gap-1.5", ok ? "text-success" : "text-subtle-foreground")}>
                <CheckIcon className="size-3.5" aria-hidden="true" />
                {rule.label}
                <span className="sr-only">{ok ? "(done)" : "(not yet)"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
