"use client";

// PostEditor
// Part: T4 Blog
// Requirements: BLG-01, BLG-04, BLG-08, BLG-10
// Used by: P-34
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// New post:  <PostEditor itineraries={mine} />
// Edit post: <PostEditor post={post} itineraries={mine} />
// Title (required, max 200), body (required), up to 5 tags of max 30 characters (BLG-08), up to 5 JPG/PNG
// images of max 5 MB (BLG-10, GEN-08), and (Bonus BLG-13) an attached itinerary. Buttons: Publish, Save as
// draft, Cancel, and Delete with a confirmation when editing (BLG-04, GEN-03).
// - New: POST /api/posts, then the chosen images (POST /api/posts/{id}/images, one per request: the API adds
//   images to an existing post) and the itinerary (PATCH /api/posts/{id}/itinerary).
// - Edit: PATCH /api/posts/{id}; images are added and removed at once (POST / DELETE .../images), removing
//   one asks first (GEN-03).
// Field errors from the frontend checks and from the backend are shown under each field (GEN-02), with a
// summary at the top; every action shows a spinner and a success or error toast (GEN-16).
// After saving: Publish opens the post (/blog/{id}); Save as draft stays in the editor (a new post moves to
// its edit page, so a second click doesn't create a second post).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SendIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { AttachItineraryPicker, KEEP_ITINERARY, NO_ITINERARY } from "@/components/app/blog/attach-itinerary-picker";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { FormErrorSummary } from "@/components/app/form-error-summary";
import { FormField } from "@/components/app/form-field";
import { ImageUploader, type ExistingImage } from "@/components/app/image-uploader";
import { So3ad } from "@/components/app/so3ad";
import { TagInput } from "@/components/app/tag-input";
import type { ItinerarySummary } from "@/components/app/shared/itinerary-card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldErrorMap } from "@/lib/api-error";

/** The post as the editor needs it (from GET /api/posts/{id}, openapi PostDetailResponse). */
export type EditablePost = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  images: { id: string; url: string }[];
  status: "draft" | "published";
};

type PostStatus = EditablePost["status"];

/** openapi CreatePostRequest / ImageUploadRequest limits (BLG-01, BLG-08, GEN-08). */
export const TITLE_MAX_LENGTH = 200;
const MAX_IMAGES = 5;

const LABELS: Record<string, string> = {
  title: "Title",
  body: "Body",
  tags: "Tags",
  status: "Status",
  images: "Images",
  itineraryId: "Itinerary",
};

type Errors = Record<string, string>;

/** The frontend copy of the backend's rules (the backend checks again). */
function validate(title: string, body: string): Errors {
  const errors: Errors = {};
  if (!title.trim()) errors.title = "Enter a title.";
  else if (title.trim().length > TITLE_MAX_LENGTH) errors.title = `Keep the title under ${TITLE_MAX_LENGTH} characters.`;
  if (!body.trim()) errors.body = "Write the text of your post.";
  return errors;
}

/** Backend field errors by field; "tags.2" is shown under Tags. */
function backendErrors(error: ApiError): Errors {
  const errors: Errors = {};
  for (const [field, message] of Object.entries(fieldErrorMap(error.body))) {
    const key = field.split(".")[0];
    errors[key] = errors[key] ? `${errors[key]} ${message}` : message;
  }
  return errors;
}

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

type LocalImage = ExistingImage & { file: File };

type PostEditorProps = {
  /** Left out for a new post. */
  post?: EditablePost;
  /** The author's itineraries for the BLG-13 picker; null when they couldn't be loaded. */
  itineraries: ItinerarySummary[] | null;
  /** For tests; defaults to router.push. */
  navigate?: (path: string) => void;
};

export function PostEditor({ post, itineraries, navigate }: PostEditorProps) {
  const router = useRouter();
  const go = navigate ?? ((path: string) => router.push(path));
  const editing = post !== undefined;

  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [tags, setTags] = useState<string[]>(post?.tags ?? []);
  const [itinerary, setItinerary] = useState(editing ? KEEP_ITINERARY : NO_ITINERARY);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | undefined>();
  const [saving, setSaving] = useState<PostStatus | null>(null);

  // Edit: the post's images (uploaded at once). New: the chosen files, uploaded after the post is created.
  const [images, setImages] = useState<ExistingImage[]>(post?.images ?? []);
  const [local, setLocal] = useState<LocalImage[]>([]);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Free the previews of the chosen files when leaving the page.
  const localRef = useRef(local);
  useEffect(() => {
    localRef.current = local;
  }, [local]);
  useEffect(() => () => localRef.current.forEach((img) => URL.revokeObjectURL(img.url)), []);

  async function uploadImage(postId: string, file: File): Promise<ExistingImage> {
    const form = new FormData();
    form.append("image", file);
    return apiFetch<ExistingImage>(`/api/posts/${encodeURIComponent(postId)}/images`, { method: "POST", body: form });
  }

  async function addImages(files: File[]) {
    if (!post) {
      setLocal((list) => [...list, ...files.map((file, i) => ({ id: `local-${Date.now()}-${i}`, url: URL.createObjectURL(file), file }))]);
      return;
    }
    let failure: unknown = null;
    for (const file of files) {
      try {
        const added = await uploadImage(post.id, file);
        setImages((list) => [...list, added]);
      } catch (error) {
        failure = error;
        toast.error(`${file.name}: ${messageOf(error, "the image couldn't be uploaded.")}`);
      }
    }
    if (failure) throw failure; // the uploader also shows the error under the field
    toast.success(files.length === 1 ? "Image added" : "Images added");
  }

  function removeImage(id: string) {
    if (!post) {
      // Only chosen here, not uploaded yet: nothing to delete on the server.
      const img = local.find((l) => l.id === id);
      if (img) URL.revokeObjectURL(img.url);
      setLocal((list) => list.filter((l) => l.id !== id));
      return;
    }
    setRemoveId(id); // asks first (GEN-03)
  }

  async function confirmRemove() {
    if (!post || !removeId) return;
    setRemoving(true);
    try {
      await apiFetch(`/api/posts/${encodeURIComponent(post.id)}/images/${encodeURIComponent(removeId)}`, { method: "DELETE" });
      setImages((list) => list.filter((img) => img.id !== removeId));
      setRemoveId(null);
      toast.success("Image removed");
    } catch (error) {
      toast.error(messageOf(error, "We couldn't remove the image. Check your connection and try again."));
    } finally {
      setRemoving(false);
    }
  }

  async function save(status: PostStatus) {
    const problems = validate(title, body);
    setErrors(problems);
    setMessage(undefined);
    if (Object.keys(problems).length > 0) return;

    setSaving(status);
    let postId = post?.id;
    try {
      const json = { title: title.trim(), body, tags, status };
      if (postId) {
        await apiFetch(`/api/posts/${encodeURIComponent(postId)}`, { method: "PATCH", json });
      } else {
        postId = (await apiFetch<{ id: string }>("/api/posts", { method: "POST", json })).id;
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(backendErrors(error));
        setMessage(error.message);
      } else {
        setMessage("We couldn't save your post. Check your connection and try again.");
      }
      setSaving(null);
      return;
    }

    // The post is saved; now the chosen images (new post) and the itinerary (BLG-13).
    const failed: string[] = [];
    for (const img of local) {
      try {
        await uploadImage(postId, img.file);
      } catch {
        failed.push(img.file.name);
      }
    }
    if (itinerary !== KEEP_ITINERARY) {
      try {
        await apiFetch(`/api/posts/${encodeURIComponent(postId)}/itinerary`, {
          method: "PATCH",
          json: { itineraryId: itinerary === NO_ITINERARY ? null : itinerary },
        });
      } catch {
        failed.push("the itinerary");
      }
    }

    const editPath = `/my/posts/${encodeURIComponent(postId)}/edit`;
    if (failed.length > 0) {
      toast.error(`Your post was saved, but ${failed.join(", ")} couldn't be added. Try again here.`);
      if (editing) {
        setSaving(null);
        router.refresh();
      } else go(editPath);
      return;
    }
    if (status === "published") {
      toast.success(editing && post?.status === "published" ? "Changes saved" : "Post published");
      go(`/blog/${encodeURIComponent(postId)}`);
    } else {
      toast.success("Draft saved");
      if (editing) {
        setSaving(null);
        router.refresh();
      } else go(editPath);
    }
  }

  async function deletePost() {
    if (!post) return;
    try {
      await apiFetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
    } catch (error) {
      toast.error(messageOf(error, "We couldn't delete the post. Check your connection and try again."));
      throw error; // keeps the dialog open
    }
    toast.success("The post was deleted");
    go("/my/posts");
    router.refresh();
  }

  const busy = saving !== null;
  const shownImages = post ? images : local;

  return (
    // No submit on Enter: publishing is always an explicit click.
    <form noValidate onSubmit={(event) => event.preventDefault()} className="grid gap-6">
      <FormErrorSummary errors={errors} labels={LABELS} message={message} />

      <FormField label="Title" name="title" required error={errors.title} hint={`${title.trim().length} / ${TITLE_MAX_LENGTH} characters`}>
        <Input value={title} maxLength={TITLE_MAX_LENGTH} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Three days in Cairo" />
      </FormField>

      <FormField label="Body" name="body" required error={errors.body}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-64" placeholder="Tell other travelers about your trip" />
      </FormField>

      <FormField label="Tags" name="tags" error={errors.tags} hint="Up to 5 tags, 30 characters each. Press Enter after each tag.">
        <TagInput value={tags} onChange={setTags} disabled={busy} />
      </FormField>

      <FormField
        label="Images"
        name="images"
        error={errors.images}
        hint={post ? "Images are added and removed right away." : "The images are uploaded when you save the post."}
      >
        <ImageUploader max={MAX_IMAGES} noun="image" existing={shownImages} onAdd={addImages} onRemove={removeImage} />
      </FormField>

      <AttachItineraryPicker
        itineraries={itineraries}
        value={itinerary}
        onChange={setItinerary}
        keepOption={editing}
        error={errors.itineraryId}
        disabled={busy}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => save("published")} loading={saving === "published"} disabled={busy}>
            <SendIcon /> Publish
          </Button>
          <Button type="button" variant="secondary" onClick={() => save("draft")} loading={saving === "draft"} disabled={busy}>
            Save as draft
          </Button>
          <Button asChild variant="ghost">
            <Link href="/my/posts">Cancel</Link>
          </Button>
        </div>
        {post && (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="destructive" disabled={busy}>
                <Trash2Icon /> Delete post
              </Button>
            }
            title="Delete this post?"
            description="The post, its comments, likes and images are removed. This can't be undone."
            confirmLabel="Delete post"
            onConfirm={deletePost}
          />
        )}
      </div>

      {/* Removing an uploaded image asks first (GEN-03); ConfirmDialog needs a trigger, the uploader has its own button. */}
      <AlertDialog open={removeId !== null} onOpenChange={(open) => !open && !removing && setRemoveId(null)}>
        <AlertDialogContent className="gap-5 p-6 data-[size=default]:sm:max-w-md">
          <AlertDialogHeader className="sm:place-items-start sm:text-left">
            <div className="mb-1 flex items-center gap-3">
              <So3ad pose="worried" size={64} />
              <p className="rounded-2xl rounded-bl-sm border border-border bg-muted px-3 py-1.5 text-sm font-semibold">
                &ldquo;Are you sure? No take-backs!&rdquo;
              </p>
            </div>
            <AlertDialogTitle className="text-lg font-semibold">Remove this image?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              The image is removed from your post right away. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="ghost" disabled={removing}>
              Go back
            </AlertDialogCancel>
            <Button type="button" variant="destructive" loading={removing} onClick={confirmRemove}>
              Remove image
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
