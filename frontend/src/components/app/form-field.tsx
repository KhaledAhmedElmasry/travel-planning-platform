// Every form input goes inside a FormField (GEN-02): visible label, optional hint,
// and the error message right under the field, linked for screen readers.
// <FormField label="Email" name="email" required error={errors.email}>
//   <Input type="email" autoComplete="email" />
// </FormField>
// FormField gives the child its id, name, aria-invalid and aria-describedby,
// so the input itself needs no extra props for accessibility. The id is unique per field (useId),
// so the same form can be on a page twice (e.g. desktop and phone filter panels, GEN-16).
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { CircleAlertIcon } from "lucide-react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

type FieldChildProps = {
  id?: string;
  name?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
};

type FormFieldProps = {
  label: ReactNode;
  /** Form field name; also the key in the backend's fieldErrors (e.g. "email"). */
  name: string;
  /** Message from fieldErrorMap(error)[name] or from a frontend check. */
  error?: string;
  /** Short help under the input, e.g. "At least 8 characters, 1 letter and 1 digit". */
  hint?: ReactNode;
  required?: boolean;
  /** The input: <Input>, <Textarea>, <PasswordInput>, a select trigger... */
  children: ReactElement<FieldChildProps>;
  className?: string;
};

export function FormField({ label, name, error, hint, required, children, className }: FormFieldProps) {
  const id = `field-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })
    : children;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="text-error" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {control}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-[13px] text-error">
          <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-[13px] text-subtle-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
