"use client";

// <FormErrorSummary errors={errors} labels={{ email: "Email", password: "Password" }} />
// After a failed submit with several errors, show this at the top of the form.
// It takes focus so keyboard and screen-reader users hear what to fix, and each
// item links to its field. The inline errors under each field stay (GEN-02).
import { useEffect, useRef } from "react";
import { CircleAlertIcon } from "lucide-react";
import { cn } from "cn";

type FormErrorSummaryProps = {
  /** field name -> message, e.g. from fieldErrorMap(apiError) */
  errors: Record<string, string>;
  /** field name -> human label shown in the list */
  labels?: Record<string, string>;
  /** General message (e.g. the backend's `message`) shown above the list. */
  message?: string;
  /** Move focus here when errors appear (default). Turn off only for static examples. */
  autoFocus?: boolean;
  className?: string;
};

export function FormErrorSummary({ errors, labels = {}, message, autoFocus = true, className }: FormErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = Object.entries(errors);
  const show = entries.length > 0 || Boolean(message);

  useEffect(() => {
    if (show && autoFocus) ref.current?.focus();
  }, [show, autoFocus, errors, message]);

  if (!show) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className={cn("rounded-lg border border-error/50 bg-error/10 p-4 outline-none", className)}
    >
      <p className="flex items-center gap-2 font-semibold text-error">
        <CircleAlertIcon className="size-4" aria-hidden="true" />
        {message ?? "Please fix the highlighted fields."}
      </p>
      {entries.length > 0 && (
        <ul className="mt-2 grid gap-1 pl-6 text-sm">
          {entries.map(([field, text]) => (
            <li key={field} className="list-disc">
              <a
                href={`#field-${field.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
                className="text-link underline underline-offset-4"
              >
                {labels[field] ?? field}
              </a>
              : {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
