// P-33 My posts: /my/posts
// Part: T2 Hotels + my posts list
// Requirements: BLG-03
// Endpoints: DELETE /api/posts/{id}; GET /api/posts/mine
// Rendering: Dynamic SSR + Client Components. Source: .md section 9 "Blog Editor / Drafts".
// Spec: MILESTONE2_FRONTEND_SPEC.md (page P-33). Use a shell and kit components (frontend/README.md).
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { backendJson } from "@/lib/server/backend";
import { getUnreadCount, requireUser } from "@/lib/server/session";
import { MyPostsList, type MyPost } from "./my-posts-list";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "My posts",
  description: "Manage your travel stories and drafts.",
  robots: { index: false },
};

type PostPage = {
  items: MyPost[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function pageNumber(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const user = await requireUser(["user"]);
  const params = await searchParams;
  const page = pageNumber(params.page);
  const [posts, unreadNotifications] = await Promise.all([
    backendJson<PostPage>(`/api/posts/mine?page=${page}`),
    getUnreadCount(),
  ]);
  if (!posts) throw new Error("Your posts could not be loaded.");

  return (
    <AppShell user={user} unreadNotifications={unreadNotifications}>
      <PageHeader
        title="My posts"
        description="Manage your travel stories and drafts."
        actions={<Button asChild><Link href="/my/posts/new">New post</Link></Button>}
      />
      <MyPostsList posts={posts.items} page={posts.page} pageSize={posts.pageSize} total={posts.total} totalPages={posts.totalPages} />
    </AppShell>
  );
}
