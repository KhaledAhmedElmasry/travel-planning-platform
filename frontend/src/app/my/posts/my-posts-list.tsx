"use client";

// P-33 My posts interactions (BLG-03, GEN-03).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircleIcon, PencilLineIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import { PaginationBar } from "@/components/app/pagination-bar";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export type MyPost = {
  id: string;
  title: string;
  status: "draft" | "published";
  date: string;
  likeCount: number;
  commentCount: number;
};

type MyPostsListProps = {
  posts: MyPost[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function MyPostsList({ posts, page, pageSize, total, totalPages }: MyPostsListProps) {
  const router = useRouter();

  async function removePost(id: string) {
    try {
      await apiFetch(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast.success("The post was deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The post could not be deleted. Check your connection and try again.");
      throw error;
    }
  }

  // Past the last page (e.g. ?page=99 or after deleting a page's only post) while posts exist.
  if (posts.length === 0 && total > 0) {
    return (
      <EmptyState
        title="This page is empty"
        action={<Button asChild><Link href="/my/posts">Go to page 1</Link></Button>}
      />
    );
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        title="No posts yet"
        line="Your travel stories will live here."
        description="Create your first post and share your journey with other travelers."
        action={<Button asChild><Link href="/my/posts/new">Create a post</Link></Button>}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        {posts.map((post) => (
          <article key={post.id} className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid min-w-0 gap-2">
                <h2 className="text-lg font-semibold break-words">{post.title}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                  <StatusBadge kind="post" status={post.status} />
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground" aria-label="Post engagement">
                <span className="inline-flex items-center gap-1.5"><ThumbsUpIcon className="size-4" aria-hidden="true" /><span aria-hidden="true">{post.likeCount}</span><span className="sr-only">{post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</span></span>
                <span className="inline-flex items-center gap-1.5"><MessageCircleIcon className="size-4" aria-hidden="true" /><span aria-hidden="true">{post.commentCount}</span><span className="sr-only">{post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}</span></span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/my/posts/${encodeURIComponent(post.id)}/edit`}><PencilLineIcon /> Edit</Link>
              </Button>
              {post.status === "published" && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/blog/${encodeURIComponent(post.id)}`}>View post</Link>
                </Button>
              )}
              <ConfirmDialog
                trigger={<Button variant="destructive" size="sm"><Trash2Icon /> Delete</Button>}
                title="Delete this post?"
                description="This post and its related content will be removed. This can't be undone."
                confirmLabel="Delete post"
                onConfirm={() => removePost(post.id)}
              />
            </div>
          </article>
        ))}
      </div>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        hrefFor={(nextPage) => `/my/posts?page=${nextPage}`}
      />
    </div>
  );
}

