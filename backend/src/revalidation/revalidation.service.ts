import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

// Area: Admin, Notifications & Platform Core (B5, MILESTONE2, team leader 23 Nov)
// Requirements: GEN-10, ITN-20, ACC-12, ACC-15 (.md section 9: ISR pages)
//
// The frontend caches three pages (ISR): the blog post (P-30), the public itinerary (P-28) and the
// author page (P-32). After a change that alters one of them (edit, publish, hide, unhide, delete,
// made private, author renamed / suspended / deactivated), the backend tells the frontend which
// cache tags to refresh: POST {FRONTEND_URL}/revalidate { tags } with the header
// x-revalidate-secret = REVALIDATE_SECRET (same value as frontend/.env.local).
//
// Never blocks or fails the change itself: the call runs after it, and a failure is only logged
// (the pages also refresh on their own every minute). Without REVALIDATE_SECRET nothing is sent.
type IdLike = Types.ObjectId | string;

@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /** A blog post changed: its page and its author's page. */
  post(postId: IdLike, authorId: IdLike): void {
    this.send([`post:${String(postId)}`, `author:${String(authorId)}`]);
  }

  /** An itinerary changed: its public page and its author's page. */
  itinerary(itineraryId: IdLike, ownerId: IdLike): void {
    this.send([
      `itinerary:${String(itineraryId)}`,
      `author:${String(ownerId)}`,
    ]);
  }

  /** An author changed (name, suspended, deactivated): the author page and every post and itinerary page. */
  author(userId: IdLike): void {
    void this.authorTags(userId)
      .then((tags) => this.send(tags))
      .catch((err: unknown) =>
        this.logger.warn(
          `Revalidation tags for author ${String(userId)} failed: ${String(err)}`,
        ),
      );
  }

  private async authorTags(userId: IdLike): Promise<string[]> {
    const id = new Types.ObjectId(String(userId));
    const [posts, itineraries] = await Promise.all([
      this.connection.collection('posts').distinct('_id', { author: id }),
      this.connection.collection('itineraries').distinct('_id', { userId: id }),
    ]);
    return [
      `author:${String(userId)}`,
      ...posts.map((p) => `post:${String(p)}`),
      ...itineraries.map((i) => `itinerary:${String(i)}`),
    ];
  }

  private send(tags: string[]): void {
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    const frontend = this.config.get<string>('FRONTEND_URL');
    if (!secret || !frontend) return;
    void fetch(`${frontend.replace(/\/+$/, '')}/revalidate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(5000),
    })
      .then((res) => {
        if (!res.ok)
          this.logger.warn(
            `Revalidation answered ${res.status} for ${tags.join(', ')}`,
          );
      })
      .catch((err: unknown) =>
        this.logger.warn(
          `Revalidation failed for ${tags.join(', ')}: ${String(err)}`,
        ),
      );
  }
}
