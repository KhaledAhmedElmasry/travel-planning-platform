// B5 part 2 (team leader, 23 Nov): after a change that alters a cached page (P-28 public itinerary,
// P-30 blog post, P-32 author page), the backend calls the frontend's POST /revalidate with the
// shared secret and the cache tags post:<id>, itinerary:<id>, author:<userId>. Triggers: hide,
// unhide, delete, private, deactivate, suspend (GEN-10, ITN-20, ACC-12, ACC-15) and also edits and
// publishing (decided 23 Nov). A fake frontend records the calls.
import {
  REVALIDATION_PORT,
  REVALIDATION_SECRET,
  savedRevalidationEnv,
} from '../support/revalidation-env';
import { createServer, type Server } from 'http';
import { Account, TestApp, day, unique } from '../support/harness';

interface Call {
  secret: string | undefined;
  tags: string[];
}

describe('On-demand revalidation of the ISR pages (B5)', () => {
  const calls: Call[] = [];
  let frontend: Server;
  const t = new TestApp();
  let author: Account;

  beforeAll(async () => {
    frontend = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        if (req.method === 'POST' && req.url === '/revalidate') {
          calls.push({
            secret: req.headers['x-revalidate-secret'] as string | undefined,
            tags: (JSON.parse(body) as { tags: string[] }).tags,
          });
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });
    });
    await new Promise<void>((r) =>
      frontend.listen(REVALIDATION_PORT, '127.0.0.1', r),
    );
    await t.start();
    author = await t.user('Cached Author');
  });
  afterAll(async () => {
    await t.stop();
    frontend.close();
    process.env.FRONTEND_URL = savedRevalidationEnv.url;
    process.env.REVALIDATE_SECRET = savedRevalidationEnv.secret;
  });

  /** Waits until the fake frontend received a call with exactly these tags (order ignored). */
  const expectRevalidated = (tags: string[]) =>
    t.eventually(
      () =>
        Promise.resolve(
          calls.find(
            (c) =>
              c.secret === REVALIDATION_SECRET &&
              [...c.tags].sort().join() === [...tags].sort().join(),
          ),
        ),
      `a /revalidate call with ${tags.join(', ')}`,
      10_000,
    );

  const newPost = async (account = author) => {
    const res = await account.client.post('/api/posts', {
      title: `Post ${unique('p')}`,
      body: 'A long story about a trip.',
      status: 'published',
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };
  // ITN-01 creates a private itinerary; ITN-20 makes it public (that refreshes the author page).
  const newItinerary = async (account = author) => {
    const res = await account.client.post('/api/itineraries', {
      title: `Trip ${unique('t')}`,
      countryCodes: ['EG'],
      startDate: day(30),
    });
    expect(res.status).toBe(201);
    const id = res.body.id as string;
    const shared = await account.client.patch(`/api/itineraries/${id}`, {
      visibility: 'public',
    });
    expect(shared.status).toBe(200);
    return id;
  };

  it('publishing, editing and deleting a post refresh the post and its author', async () => {
    const id = await newPost();
    const tags = [`post:${id}`, `author:${author.id}`];
    await expectRevalidated(tags);
    calls.length = 0;
    expect(
      (await author.client.patch(`/api/posts/${id}`, { title: 'Edited title' }))
        .status,
    ).toBe(200);
    await expectRevalidated(tags);
    calls.length = 0;
    expect((await author.client.delete(`/api/posts/${id}`)).status).toBe(204);
    await expectRevalidated(tags);
  });

  it('every itinerary change refreshes the itinerary and its author (ITN-20 private included)', async () => {
    const id = await newItinerary();
    const tags = [`itinerary:${id}`, `author:${author.id}`];
    await expectRevalidated(tags);
    calls.length = 0;
    const dayRes = await author.client.post(`/api/itineraries/${id}/days`, {
      cityId: 'cairo',
    });
    expect(dayRes.status).toBe(201);
    await expectRevalidated(tags);
    // ITN-10: an activity is saved through the itinerary document (ItinerariesService).
    calls.length = 0;
    const activity = await author.client.post(
      `/api/itineraries/${id}/days/${dayRes.body.id}/activities`,
      { name: 'Tower', description: 'Top floor', cost: 40, currency: 'USD' },
    );
    expect(activity.status).toBe(201);
    await expectRevalidated(tags);
    calls.length = 0;
    expect(
      (
        await author.client.patch(`/api/itineraries/${id}`, {
          visibility: 'private',
        })
      ).status,
    ).toBe(200);
    await expectRevalidated(tags);
    calls.length = 0;
    expect((await author.client.delete(`/api/itineraries/${id}`)).status).toBe(
      204,
    );
    await expectRevalidated(tags);
  });

  it('an admin hiding, unhiding or deleting a post refreshes it (GEN-10)', async () => {
    const id = await newPost();
    const tags = [`post:${id}`, `author:${author.id}`];
    const admin = await t.admin();
    calls.length = 0;
    expect(
      (
        await admin.patch(`/api/admin/content/post/${id}/hide`, {
          reason: 'Spam',
        })
      ).status,
    ).toBe(200);
    await expectRevalidated(tags);
    calls.length = 0;
    expect(
      (await admin.patch(`/api/admin/content/post/${id}/unhide`)).status,
    ).toBe(200);
    await expectRevalidated(tags);
    calls.length = 0;
    expect((await admin.delete(`/api/admin/content/post/${id}`)).status).toBe(
      204,
    );
    await expectRevalidated(tags);
  });

  it('changing the name, suspending or deactivating an author refreshes the author page and all their posts and itineraries (ACC-09, ACC-15, ACC-12)', async () => {
    const writer = await t.user('Soon Gone');
    const postId = await newPost(writer);
    const itineraryId = await newItinerary(writer);
    const tags = [
      `author:${writer.id}`,
      `post:${postId}`,
      `itinerary:${itineraryId}`,
    ];
    calls.length = 0;
    expect(
      (await writer.client.patch('/api/users/me', { name: 'New Name' })).status,
    ).toBe(200);
    await expectRevalidated(tags);
    const admin = await t.admin();
    calls.length = 0;
    expect(
      (
        await admin.patch(`/api/admin/accounts/${writer.id}/suspend`, {
          reason: 'Test',
        })
      ).status,
    ).toBe(200);
    await expectRevalidated(tags);
    calls.length = 0;
    expect(
      (await admin.patch(`/api/admin/accounts/${writer.id}/reactivate`)).status,
    ).toBe(200);
    await expectRevalidated(tags);
    // Log in again: the suspension ended the old sessions (ACC-15).
    const again = t.guest();
    expect(
      (
        await again.post('/api/auth/login', {
          email: writer.email,
          password: writer.password,
        })
      ).status,
    ).toBe(200);
    calls.length = 0;
    expect((await again.delete('/api/users/me')).status).toBe(204);
    await expectRevalidated(tags);
  });
});
