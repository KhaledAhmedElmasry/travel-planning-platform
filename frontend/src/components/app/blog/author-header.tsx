// AuthorHeader
// Part: T4 Blog
// Requirements: BLG-12, ACC-12
// Used by: P-32
// Spec: MILESTONE2_FRONTEND_SPEC.md sections 3 and 6. Build it from kit parts (design-system/yallaway/MASTER.md 6.2).
// <AuthorHeader author={data.author} postCount={data.posts.total} itineraryCount={data.itineraries.total} />
// The top of the public author page: initials avatar, the author's name as the page's h1, join date (BLG-12)
// and how many published posts and public itineraries they have.
// ACC-12: a deactivated author has no public page (GET /api/authors/{id} answers 404, the page shows not-found),
// so this header is only ever shown for an active author.
import { CalendarIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/format";
import { initials } from "@/lib/session";

/** openapi PublicAuthorPageResponse.author */
export type PublicAuthor = { id: string; name: string; createdAt: string };

type AuthorHeaderProps = {
  author: PublicAuthor;
  postCount?: number;
  itineraryCount?: number;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function AuthorHeader({ author, postCount, itineraryCount }: AuthorHeaderProps) {
  const counts = [
    postCount !== undefined && plural(postCount, "published post", "published posts"),
    itineraryCount !== undefined && plural(itineraryCount, "public itinerary", "public itineraries"),
  ].filter(Boolean);

  return (
    <header className="flex flex-wrap items-center gap-4 pb-6">
      <Avatar className="size-16">
        <AvatarFallback className="bg-muted text-xl font-semibold text-link">{initials(author.name)}</AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 gap-1">
        <h1 className="text-3xl font-bold tracking-tight break-words">{author.name}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="size-4" aria-hidden="true" />
            Joined <time dateTime={author.createdAt}>{formatDate(author.createdAt)}</time>
          </span>
          {counts.map((text) => (
            <span key={String(text)}>{text}</span>
          ))}
        </p>
      </div>
    </header>
  );
}
