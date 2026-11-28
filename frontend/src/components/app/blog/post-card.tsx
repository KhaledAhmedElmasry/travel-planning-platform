// PostCard
// Part: T4 Blog
// Requirements: BLG-02, BLG-09
// Used by: P-29, P-31, P-32
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// <PostCard post={summary} />                      (P-29 listing / search, P-31 tag page)
// <PostCard post={summary} showAuthor={false} />   (P-32 author page: every post is by that author)
// One published post from GET /api/posts, GET /api/tags/{tag}/posts or GET /api/authors/{id}:
// title (opens P-30), author (opens P-32), date, excerpt (BLG-09), tags (each opens P-31, BLG-08),
// like and comment counts. Works in Server Components (no browser code).
import Link from "next/link";
import { MessageCircleIcon, ThumbsUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { authorHref, postHref, tagHref } from "./blog-links";

/** openapi PostSummary (GET /api/posts, GET /api/tags/{tag}/posts, GET /api/authors/{id}) */
export type PostSummary = {
  id: string;
  title: string;
  author: { id: string; name: string };
  date: string;
  excerpt: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
};

/** Paginated list of posts (openapi PostSummaryList, GEN-05). */
export type PostSummaryPage = {
  items: PostSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** The post's tags as links to their tag page (BLG-08: "clickable to list matching posts"). */
export function TagLinks({ tags }: { tags: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>
          <Badge asChild variant="outline" className="h-7 px-3 text-[13px]">
            <Link href={tagHref(tag)}>#{tag}</Link>
          </Badge>
        </li>
      ))}
    </ul>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type PostCardProps = {
  post: PostSummary;
  /** Default true. Off on the author's own page (P-32). */
  showAuthor?: boolean;
};

export function PostCard({ post, showAuthor = true }: PostCardProps) {
  return (
    <article className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold break-words">
          <Link href={postHref(post.id)} className="hover:underline">
            {post.title}
          </Link>
        </h2>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {showAuthor && (
            <>
              <Link href={authorHref(post.author.id)} className="font-medium text-link hover:underline">
                {post.author.name}
              </Link>
              <span aria-hidden="true">·</span>
            </>
          )}
          <time dateTime={post.date}>{formatDate(post.date)}</time>
        </p>
      </div>
      {post.excerpt && <p className="break-words text-muted-foreground">{post.excerpt}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {post.tags.length > 0 ? <TagLinks tags={post.tags} /> : <span />}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ThumbsUpIcon className="size-4" aria-hidden="true" />
            <span aria-hidden="true">{post.likeCount}</span>
            <span className="sr-only">{plural(post.likeCount, "like")}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircleIcon className="size-4" aria-hidden="true" />
            <span aria-hidden="true">{post.commentCount}</span>
            <span className="sr-only">{plural(post.commentCount, "comment")}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
