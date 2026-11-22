"use client";

// Photos and logos (GEN-08): JPG or PNG only, at most 5 MB each, at most `max` images
// (5 per post / activity / hotel, 1 logo per airline). Files that break a rule are
// refused here with a clear message; the backend checks again (it reads the real file type).
// <FormField label="Photos" name="photos" hint="JPG or PNG, up to 5 MB each, up to 5 photos.">
//   <ImageUploader
//     max={5}
//     existing={hotel.photos.map((p) => ({ id: p.id, url: p.url }))}
//     onAdd={(files) => uploadPhotos(files)}          // POST multipart; refresh `existing`
//     onRemove={(id) => deletePhoto(id)}              // DELETE .../images/:imageId
//   />
// </FormField>
// For create forms that send the files together with the other fields, use `onAdd`
// to keep the File objects and send them in the same multipart request.
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { cn } from "cn";

export const IMAGE_RULES = {
  types: ["image/jpeg", "image/png"],
  maxBytes: 5 * 1024 * 1024,
};

export type ExistingImage = { id: string; url: string; alt?: string };

type ImageUploaderProps = Omit<ComponentProps<"button">, "onChange"> & {
  max: number;
  existing?: ExistingImage[];
  /** Called with the new valid files. May return a promise (shows a spinner). */
  onAdd: (files: File[]) => void | Promise<void>;
  /** Remove an already uploaded image (existing) by id. */
  onRemove?: (id: string) => void | Promise<void>;
  /** "Logo" or "Photo", used in labels and messages. */
  noun?: string;
};

type Preview = { key: string; url: string; name: string };

export function ImageUploader({
  max,
  existing = [],
  onAdd,
  onRemove,
  noun = "photo",
  className,
  id,
  ...buttonProps
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const [pending, setPending] = useState<Preview[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = existing.length + pending.length;
  const left = Math.max(0, max - count);

  // Free the temporary preview URLs when they are no longer shown.
  useEffect(() => () => pending.forEach((p) => URL.revokeObjectURL(p.url)), [pending]);

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list);
    const problems: string[] = [];
    const valid = files.filter((file) => {
      if (!IMAGE_RULES.types.includes(file.type)) {
        problems.push(`${file.name}: only JPG or PNG images are allowed.`);
        return false;
      }
      if (file.size > IMAGE_RULES.maxBytes) {
        problems.push(`${file.name}: larger than 5 MB.`);
        return false;
      }
      return true;
    });
    const accepted = valid.slice(0, left);
    if (valid.length > left) problems.push(`Only ${max} ${noun}${max === 1 ? "" : "s"} allowed; extra files were not added.`);
    setError(problems.length ? problems.join(" ") : null);
    if (inputRef.current) inputRef.current.value = "";
    if (accepted.length === 0) return;

    const previews = accepted.map((file, i) => ({ key: `${Date.now()}-${i}`, url: URL.createObjectURL(file), name: file.name }));
    setPending((p) => [...p, ...previews]);
    setBusy(true);
    try {
      await onAdd(accepted);
    } catch {
      setError(`We couldn't upload the ${noun}. Try again.`);
    } finally {
      setBusy(false);
      setPending([]);
    }
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
        {existing.map((image) => (
          <li key={image.id} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- uploads are served by the backend */}
            <img src={image.url} alt={image.alt ?? ""} className="size-full object-cover" loading="lazy" />
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(image.id)}
                aria-label={`Remove ${noun}`}
                className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-background/90 text-foreground hover:bg-background"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
        {pending.map((preview) => (
          <li key={preview.key} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
            <img src={preview.url} alt="" className="size-full object-cover opacity-50" />
            <span className="absolute inset-0 grid place-items-center">
              <Loader2Icon className="size-6 animate-spin" aria-hidden="true" />
              <span className="sr-only">Uploading {preview.name}</span>
            </span>
          </li>
        ))}
        {left > 0 && (
          <li>
            <button
              type="button"
              id={id ?? autoId}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="grid aspect-square w-full place-items-center rounded-lg border border-dashed border-input bg-background text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:opacity-45"
              {...buttonProps}
            >
              <span className="grid justify-items-center gap-1">
                <ImagePlusIcon className="size-6" aria-hidden="true" />
                Add {noun}
              </span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        multiple={max - count > 1}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="tabular text-[13px] text-subtle-foreground">
        {count} of {max} · JPG or PNG, up to 5 MB each
      </p>
      {error && (
        <p role="alert" className="text-[13px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
