// Cache tags of the ISR pages (.md section 9): P-28 public itinerary, P-30 blog post, P-32 author.
// A page tags its backend fetch, and the backend refreshes those tags through POST /revalidate
// when the content changes, is hidden, deleted, made private, or its author is deactivated (B5):
//
//   fetch(`${BACKEND_URL}/api/posts/${id}`, { next: { tags: [postTag(id), authorTag(authorId)], revalidate: ISR_REVALIDATE_SECONDS } })
//
// The time-based refresh is only the safety net when a backend call fails (team leader, 23 Nov).
export const ISR_REVALIDATE_SECONDS = 60;

export const postTag = (id: string) => `post:${id}`;
export const itineraryTag = (id: string) => `itinerary:${id}`;
export const authorTag = (userId: string) => `author:${userId}`;

/** post:<id>, itinerary:<id> or author:<id>, where id is a MongoDB ObjectId. */
export function isCacheTag(value: unknown): value is string {
  return typeof value === "string" && /^(post|itinerary|author):[a-f0-9]{24}$/.test(value);
}
