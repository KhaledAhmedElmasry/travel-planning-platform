// P-30 post content (BLG-02): title, author (opens the author page, BLG-12), date, tags (each opens its tag
// page, BLG-08), images and body. No browser code: used by the cached page (ISR) and by the browser
// fallback for drafts and hidden posts (post-fallback.tsx).
import Link from "next/link";
import type { ReactNode } from "react";
import { authorHref } from "@/components/app/blog/blog-links";
import type { PostComment } from "@/components/app/blog/comment-item";
import { TagLinks } from "@/components/app/blog/post-card";
import { formatDate } from "@/lib/format";

/** openapi PostDetailResponse (GET /api/posts/{id}) */
export type PostDetail = {
  id: string;
  title: string;
  body: string;
  author: { id: string; name: string };
  date: string;
  tags: string[];
  images: { id: string; url: string }[];
  likeCount: number;
  /** Only when the request carries a session. */
  likedByMe?: boolean;
  status: "draft" | "published";
  comments: PostComment[];
  commentCount: number;
};

type PostViewProps = {
  post: PostDetail;
  /** Badges next to the date (Draft, Hidden). */
  badges?: ReactNode;
  /** Like / report / author / admin buttons, under the header. */
  actions?: ReactNode;
};

export function PostView({ post, badges, actions }: PostViewProps) {
  return (
    <article className="grid gap-6">
      <header className="grid gap-3">
        <h1 className="text-3xl font-bold tracking-tight break-words sm:text-4xl">{post.title}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>
            By{" "}
            <Link href={authorHref(post.author.id)} className="font-medium text-link hover:underline">
              {post.author.name}
            </Link>
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          {badges}
        </p>
        {post.tags.length > 0 && <TagLinks tags={post.tags} />}
        {actions}
      </header>

      {post.images.length > 0 && (
        <div className={post.images.length === 1 ? "grid" : "grid gap-3 sm:grid-cols-2"}>
          {post.images.map((image, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- uploads are served by the backend (same as the kit's ImageUploader)
            <img
              key={image.id}
              src={image.url}
              alt={`${post.title}, photo ${i + 1}`}
              className="aspect-video w-full rounded-xl border border-border object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
          ))}
        </div>
      )}

      <div className="max-w-prose text-base leading-relaxed break-words whitespace-pre-line">{post.body}</div>
    </article>
  );
}
