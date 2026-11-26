"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { PaginationBar } from "@/components/app/pagination-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

export type Option = { value: string; label: string };
export type Errors = Record<string, string>;

export function InlinePages({ items }: { items: ReactNode[] }) {
  const id = useId();
  const [requestedPage, setPage] = useState(1);
  const size = 10;
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(requestedPage, pageCount);
  const prefix = `#list-${id}-`;
  return (
    <>
      {items.slice((page - 1) * size, page * size)}
      {pageCount > 1 && (
        <div onClick={(event) => {
          const link = event.target instanceof Element ? event.target.closest("a") : null;
          const href = link?.getAttribute("href");
          if (!href?.startsWith(prefix)) return;
          event.preventDefault();
          setPage(Number(href.slice(prefix.length)));
        }}>
          <PaginationBar page={page} totalPages={pageCount} total={items.length} hrefFor={(value) => `${prefix}${value}`} />
        </div>
      )}
    </>
  );
}

export function EditorSelect({ name, label, options, value, onChange, error, required }: {
  name: string; label: string; options: Option[]; value: string;
  onChange: (value: string) => void; error?: string; required?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} name={name} required={required}>
      <FormField name={name} label={label} error={error} required={required}>
        <SelectTrigger className="w-full"><SelectValue placeholder={`Choose ${label.toLowerCase()}`} /></SelectTrigger>
      </FormField>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function EditorForm({ label, path, method, payload, children }: {
  label: string; path: string; method: "POST" | "PATCH";
  payload: () => Record<string, unknown>;
  children: (errors: Errors) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Errors>({});
  const [message, setMessage] = useState<string>();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const json = payload();
    setBusy(true);
    setFields({});
    setMessage(undefined);
    try {
      await apiFetch(path, { method, json });
      setOpen(false);
      toast.success(method === "POST" ? "Added" : "Changes saved");
      router.refresh();
    } catch (error) {
      setFields(error instanceof ApiError ? fieldErrorMap(error.body) : {});
      setMessage(error instanceof ApiError ? error.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (busy) return;
      setOpen(next);
      if (next) {
        setFields({});
        setMessage(undefined);
      }
    }}>
      <DialogTrigger asChild><Button variant="outline">{label}</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <FormErrorSummary errors={fields} message={message} />
          {children(fields)}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy}>Save</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteEntry({ label, description, remove }: {
  label: string; description: string; remove: () => Promise<unknown>;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost">{label}</Button>}
      title={`${label}?`}
      confirmLabel={label}
      description={description}
      onConfirm={async () => {
        try {
          await remove();
          router.refresh();
          toast.success("Removed");
        } catch (error) {
          toast.error(error instanceof ApiError ? error.message : "Could not remove this item.");
          throw error;
        }
      }}
    />
  );
}
