// System tests: blog, comments, likes, tags, reports and moderation, administration of accounts
// and providers, the audit log and in-app notifications.
// Expected results come from the Excel sheet "Mandatory" (row in brackets) and the project
// description sections 6.1, 6.6, 6.7, 8.2 and 8.9.
import { Account, PASSWORD, PNG, TestApp, unique } from '../support/harness';
import {
  airlineWithModerator,
  hotelWithModerator,
  notifications,
} from '../support/scenarios';

describe('Blog, moderation and administration', () => {
  const t = new TestApp();
  let author: Account;
  let reader: Account;
  beforeAll(async () => {
    await t.start();
    author = await t.user('Amira Author');
    reader = await t.user('Ramy Reader');
  });
  afterAll(() => t.stop());

  const post = async (
    account: Account,
    overrides: Record<string, unknown> = {},
  ) => {
    const res = await account.client.post('/api/posts', {
      title: `Post ${unique('p')}`,
      body: 'A long story about a trip.',
      status: 'published',
      ...overrides,
    });
    if (res.status !== 201) throw new Error(res.text);
    return res.body as { id: string; title: string; [key: string]: any };
  };
  const detail = (id: string, client = t.guest()) =>
    client.get(`/api/posts/${id}`);
  const listed = async (query: Record<string, string | number>) =>
    ((await t.guest().get('/api/posts', { query })).body.items as any[]).map(
      (p) => p.id as string,
    );
  const comment = async (account: Account, postId: string, text: string) => {
    const res = await account.client.post(`/api/posts/${postId}/comments`, {
      text,
    });
    if (res.status !== 201) throw new Error(res.text);
    const comments = (await detail(postId, account.client)).body
      .comments as any[];
    return comments.find((c) => c.text === text) as { id: string };
  };

  describe('BLG-01 create (Mandatory row 74), BLG-03 my posts (row 76), BLG-04 edit/delete (row 77)', () => {
    it('creates a post with a required title and body, saved as Draft or Published', async () => {
      const res = await author.client.post('/api/posts', {
        title: 'Cairo in 3 days',
        body: 'Day one...',
        status: 'draft',
        tags: ['Egypt', 'city'],
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: 'Cairo in 3 days',
        body: 'Day one...',
        status: 'draft',
        author: { id: author.id, name: 'Amira Author' },
        likeCount: 0,
        commentCount: 0,
      });
      for (const broken of [
        { title: '' },
        { body: '' },
        { status: 'archived' },
        { status: undefined },
      ]) {
        const bad = await author.client.post('/api/posts', {
          title: 'T',
          body: 'B',
          status: 'draft',
          ...broken,
        });
        expect(bad.status).toBe(400);
      }
      expect(
        (
          await t
            .guest()
            .post('/api/posts', { title: 'T', body: 'B', status: 'draft' })
        ).status,
      ).toBe(401);
    });

    it('a draft is visible to its author only; published posts appear in the blog and in search', async () => {
      const title = `Hidden gem ${unique('g')}`;
      const draft = await post(author, { title, status: 'draft' });
      expect((await detail(draft.id)).status).toBe(404);
      expect((await detail(draft.id, reader.client)).status).toBe(404);
      expect((await detail(draft.id, author.client)).status).toBe(200);
      expect(await listed({ keyword: title })).toEqual([]);
      const published = await author.client.patch(`/api/posts/${draft.id}`, {
        status: 'published',
      });
      expect(published.status).toBe(200);
      expect((await detail(draft.id)).status).toBe(200);
      expect(await listed({ keyword: title })).toEqual([draft.id]);
    });

    it('BLG-03: lists own posts including drafts with title, status, date, like count and comment count', async () => {
      const writer = await t.user('Wael Writer');
      const draft = await post(writer, { title: 'My draft', status: 'draft' });
      const live = await post(writer, { title: 'My live post' });
      await reader.client.post(`/api/posts/${live.id}/like`);
      await comment(reader, live.id, 'Nice');
      const res = await writer.client.get('/api/posts/mine');
      expect(res.status).toBe(200);
      const rows = Object.fromEntries(
        (res.body.items as any[]).map((p) => [p.id, p]),
      );
      expect(rows[draft.id]).toMatchObject({
        title: 'My draft',
        status: 'draft',
        likeCount: 0,
        commentCount: 0,
      });
      expect(rows[live.id]).toMatchObject({
        title: 'My live post',
        status: 'published',
        likeCount: 1,
        commentCount: 1,
      });
      expect(new Date(rows[live.id].date as string).getTime()).toBeGreaterThan(
        Date.now() - 600_000,
      );
      expect(
        (await reader.client.get('/api/posts/mine')).body.items.map(
          (p: any) => p.id,
        ),
      ).not.toContain(draft.id);
      expect((await t.guest().get('/api/posts/mine')).status).toBe(401);
    });

    it('BLG-04: only the author edits and deletes a post', async () => {
      const mine = await post(author);
      expect(
        (
          await reader.client.patch(`/api/posts/${mine.id}`, {
            title: 'Hacked',
          })
        ).status,
      ).toBe(403);
      expect((await reader.client.delete(`/api/posts/${mine.id}`)).status).toBe(
        403,
      );
      expect((await t.guest().delete(`/api/posts/${mine.id}`)).status).toBe(
        401,
      );
      const edited = await author.client.patch(`/api/posts/${mine.id}`, {
        title: 'Edited title',
        body: 'Edited body',
      });
      expect(edited.status).toBe(200);
      expect((await detail(mine.id)).body).toMatchObject({
        title: 'Edited title',
        body: 'Edited body',
      });
      expect(
        (await author.client.patch(`/api/posts/${mine.id}`, { title: '' }))
          .status,
      ).toBe(400);
      expect((await author.client.delete(`/api/posts/${mine.id}`)).status).toBe(
        204,
      );
      expect((await detail(mine.id)).status).toBe(404);
    });
  });

  describe('BLG-02 browse and open (row 75), BLG-08 tags (row 81), BLG-09 search (row 82)', () => {
    it('the post page shows title, author, date, body, tags, images, like count and comments', async () => {
      const mine = await post(author, {
        title: 'Full page',
        body: 'Body text',
        tags: ['food'],
      });
      await reader.client.post(`/api/posts/${mine.id}/like`);
      await comment(reader, mine.id, 'First!');
      const res = await detail(mine.id);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        title: 'Full page',
        body: 'Body text',
        author: { id: author.id, name: 'Amira Author' },
        tags: ['food'],
        images: [],
        likeCount: 1,
      });
      expect(new Date(res.body.date as string).getTime()).toBeGreaterThan(
        Date.now() - 600_000,
      );
      expect(
        (res.body.comments as any[]).map((c) => [c.text, c.author.name]),
      ).toEqual([['First!', 'Ramy Reader']]);
    });

    it('BLG-08: up to 5 tags of at most 30 characters, editable, and clickable to list matching posts', async () => {
      const tag = unique('tag');
      const base = { title: 'T', body: 'B', status: 'published' };
      expect(
        (
          await author.client.post('/api/posts', {
            ...base,
            tags: ['a', 'b', 'c', 'd', 'e', 'f'],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await author.client.post('/api/posts', {
            ...base,
            tags: ['x'.repeat(31)],
          })
        ).status,
      ).toBe(400);
      const five = await author.client.post('/api/posts', {
        ...base,
        tags: [tag, 'b', 'c', 'd', 'x'.repeat(30)],
      });
      expect(five.status).toBe(201);
      const byTag = async () =>
        (
          (await t.guest().get(`/api/tags/${tag}/posts`)).body.items as any[]
        ).map((p) => p.id);
      expect(await byTag()).toEqual([five.body.id]);
      expect(await listed({ tag })).toEqual([five.body.id]);
      // Tags are searchable.
      expect(await listed({ keyword: tag })).toEqual([five.body.id]);
      // Edited later.
      expect(
        (
          await author.client.patch(`/api/posts/${five.body.id}`, {
            tags: ['other'],
          })
        ).status,
      ).toBe(200);
      expect(await byTag()).toEqual([]);
      expect(
        (
          await author.client.patch(`/api/posts/${five.body.id}`, {
            tags: ['1', '2', '3', '4', '5', '6'],
          })
        ).status,
      ).toBe(400);
    });

    it('BLG-09: searches title, tags or author name; orders by likes + comments, newest first on a tie', async () => {
      const word = unique('zanzibar');
      const writer = await t.user(`Karim ${word}`);
      const likers = [await t.user(), await t.user()];
      const quiet = await post(author, {
        title: `${word} quiet`,
        body: 'x'.repeat(500),
      });
      const popular = await post(author, { title: `${word} popular` });
      const tied = await post(author, { title: `${word} tied` });
      const byName = await post(writer, { title: 'Unrelated title' });
      // popular: 2 likes + 1 comment = 3. quiet and tied: 1 each. byName: 0.
      for (const liker of likers)
        await liker.client.post(`/api/posts/${popular.id}/like`);
      await comment(reader, popular.id, 'Great');
      await reader.client.post(`/api/posts/${quiet.id}/like`);
      await comment(reader, tied.id, 'Hm');
      const res = await t
        .guest()
        .get('/api/posts', { query: { keyword: word.toUpperCase() } });
      expect((res.body.items as any[]).map((p) => p.id)).toEqual([
        popular.id,
        tied.id,
        quiet.id,
        byName.id,
      ]);
      const row = (res.body.items as any[]).find((p) => p.id === quiet.id);
      expect(row).toMatchObject({
        title: `${word} quiet`,
        author: { name: 'Amira Author' },
      });
      expect(row.date).toBeDefined();
      expect(row.excerpt.length).toBeGreaterThan(0);
      expect(row.excerpt.length).toBeLessThan(500);
      const none = await t
        .guest()
        .get('/api/posts', { query: { keyword: unique('nothinghere') } });
      expect(none.status).toBe(200);
      expect(none.body).toMatchObject({ items: [], total: 0 });
    });
  });

  describe('BLG-05 comments (row 78), BLG-07 own comments (row 80), BLG-06 likes (row 79)', () => {
    it('comments are non-empty, at most 500 characters and shown in chronological order', async () => {
      const mine = await post(author);
      const path = `/api/posts/${mine.id}/comments`;
      expect((await reader.client.post(path, { text: '' })).status).toBe(400);
      expect((await reader.client.post(path, { text: '   ' })).status).toBe(
        400,
      );
      expect(
        (await reader.client.post(path, { text: 'x'.repeat(501) })).status,
      ).toBe(400);
      expect((await t.guest().post(path, { text: 'Hi' })).status).toBe(401);
      await comment(reader, mine.id, 'one');
      await comment(author, mine.id, 'two');
      expect(
        (await reader.client.post(path, { text: 'x'.repeat(500) })).status,
      ).toBe(201);
      const comments = (await detail(mine.id)).body.comments as any[];
      expect(comments.map((c) => c.text.slice(0, 3))).toEqual([
        'one',
        'two',
        'xxx',
      ]);
      // Only on published posts.
      const draft = await post(author, { status: 'draft' });
      expect(
        (
          await author.client.post(`/api/posts/${draft.id}/comments`, {
            text: 'note',
          })
        ).status,
      ).toBe(404);
    });

    it('BLG-07: a user edits and deletes own comments only', async () => {
      const mine = await post(author);
      const c = await comment(reader, mine.id, 'original');
      expect(
        (
          await author.client.patch(`/api/comments/${c.id}`, {
            text: 'changed by another',
          })
        ).status,
      ).toBe(403);
      expect((await author.client.delete(`/api/comments/${c.id}`)).status).toBe(
        403,
      );
      const edited = await reader.client.patch(`/api/comments/${c.id}`, {
        text: 'edited',
      });
      expect(edited.status).toBe(200);
      expect(edited.body.text).toBe('edited');
      expect(
        (
          await reader.client.patch(`/api/comments/${c.id}`, {
            text: 'x'.repeat(501),
          })
        ).status,
      ).toBe(400);
      expect((await reader.client.delete(`/api/comments/${c.id}`)).status).toBe(
        204,
      );
      expect((await detail(mine.id)).body.comments).toEqual([]);
      expect(
        (await author.client.get('/api/posts/mine')).body.items.find(
          (p: any) => p.id === mine.id,
        ).commentCount,
      ).toBe(0);
    });

    it('BLG-06: a user likes a post once and can remove the like; the count follows', async () => {
      const mine = await post(author);
      const like = await reader.client.post(`/api/posts/${mine.id}/like`);
      expect(like.status).toBe(201);
      expect(like.body).toEqual({ likeCount: 1 });
      expect(
        (await reader.client.post(`/api/posts/${mine.id}/like`)).status,
      ).toBe(409);
      expect(
        (await author.client.post(`/api/posts/${mine.id}/like`)).body,
      ).toEqual({ likeCount: 2 });
      expect((await detail(mine.id)).body.likeCount).toBe(2);
      const unlike = await reader.client.delete(`/api/posts/${mine.id}/like`);
      expect(unlike.status).toBe(200);
      expect(unlike.body).toEqual({ likeCount: 1 });
      expect(
        (await reader.client.delete(`/api/posts/${mine.id}/like`)).status,
      ).toBe(404);
      expect((await t.guest().post(`/api/posts/${mine.id}/like`)).status).toBe(
        401,
      );
      // Five likes at the same moment from one user still count once.
      const eager = await t.user();
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          eager.client.post(`/api/posts/${mine.id}/like`),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect((await detail(mine.id)).body.likeCount).toBe(2);
    });
  });

  describe('BLG-10 images (row 83), BLG-12 author page (row 84)', () => {
    it('the author attaches up to 5 JPG/PNG images and removes them', async () => {
      const mine = await post(author);
      const upload = (
        account: Account,
        content = PNG,
        filename = 'a.png',
        contentType = 'image/png',
      ) =>
        account.client.post(`/api/posts/${mine.id}/images`, undefined, {
          files: [{ field: 'image', content, filename, contentType }],
        });
      expect((await upload(reader)).status).toBe(403);
      expect(
        (
          await upload(
            author,
            Buffer.from('%PDF-1.4'),
            'a.pdf',
            'application/pdf',
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await upload(
            author,
            Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]),
          )
        ).status,
      ).toBe(400);
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await upload(author);
        expect(res.status).toBe(201);
        ids.push(res.body.id as string);
      }
      expect((await upload(author)).status).toBe(400);
      const images = (await detail(mine.id)).body.images as any[];
      expect(images).toHaveLength(5);
      expect(
        (await t.guest().get(images[0].url as string)).buffer.equals(PNG),
      ).toBe(true);
      expect(
        (await reader.client.delete(`/api/posts/${mine.id}/images/${ids[0]}`))
          .status,
      ).toBe(403);
      expect(
        (await author.client.delete(`/api/posts/${mine.id}/images/${ids[0]}`))
          .status,
      ).toBe(204);
      expect((await detail(mine.id)).body.images).toHaveLength(4);
      expect((await t.guest().get(images[0].url as string)).status).toBe(404);
    });

    it('the public author page shows name, join date, published posts and public itineraries', async () => {
      const writer = await t.user('Public Person');
      const live = await post(writer, { title: 'Seen by all' });
      await post(writer, { title: 'Still a draft', status: 'draft' });
      const trip = async (title: string, visibility: string) => {
        const created = await writer.client.post('/api/itineraries', {
          title,
          countryCodes: ['EG'],
          startDate: '2030-01-01',
        });
        await writer.client.patch(`/api/itineraries/${created.body.id}`, {
          visibility,
        });
        return created.body.id as string;
      };
      const shared = await trip('Shared trip', 'public');
      await trip('Secret trip', 'private');
      const res = await t.guest().get(`/api/authors/${writer.id}`);
      expect(res.status).toBe(200);
      expect(res.body.author).toMatchObject({
        id: writer.id,
        name: 'Public Person',
      });
      expect(
        new Date(res.body.author.createdAt as string).getTime(),
      ).toBeGreaterThan(Date.now() - 600_000);
      expect((res.body.posts.items as any[]).map((p) => p.id)).toEqual([
        live.id,
      ]);
      expect(
        (res.body.itineraries.items as any[]).map((i) => [i.id, i.title]),
      ).toEqual([[shared, 'Shared trip']]);
      expect(JSON.stringify(res.body)).not.toContain(writer.email);
      expect(
        (await t.guest().get('/api/authors/000000000000000000000000')).status,
      ).toBe(404);
    });

    it('ACC-12: after deactivation posts and public itineraries are hidden and comments show "Deleted user"', async () => {
      const leaver = await t.user('Leaving Soon');
      const word = unique('farewell');
      const own = await post(leaver, { title: word });
      const created = await leaver.client.post('/api/itineraries', {
        title: word,
        countryCodes: ['EG'],
        startDate: '2030-01-01',
      });
      await leaver.client.patch(`/api/itineraries/${created.body.id}`, {
        visibility: 'public',
      });
      const elsewhere = await post(author);
      await comment(leaver, elsewhere.id, 'I was here');
      expect((await leaver.client.delete('/api/users/me')).status).toBe(204);

      expect((await detail(own.id)).status).toBe(404);
      expect(await listed({ keyword: word })).toEqual([]);
      expect(
        (
          await t
            .guest()
            .get('/api/itineraries/public/search', { query: { keyword: word } })
        ).body.items,
      ).toEqual([]);
      expect(
        (await t.guest().get(`/api/itineraries/public/${created.body.id}`))
          .status,
      ).toBe(404);
      expect((await t.guest().get(`/api/authors/${leaver.id}`)).status).toBe(
        404,
      );
      const comments = (await detail(elsewhere.id)).body.comments as any[];
      expect(comments.map((c) => [c.text, c.author.name])).toEqual([
        ['I was here', 'Deleted user'],
      ]);
    });
  });

  describe('GEN-09 reports (row 93), GEN-10 moderation (row 94), GEN-07 audit log (row 91)', () => {
    const report = (
      account: Account,
      contentType: string,
      contentId: string,
      reason = 'Spam',
    ) =>
      account.client.post('/api/reports', { contentType, contentId, reason });

    it('a registered user reports a post, comment or itinerary with a reason, at most once per item', async () => {
      const mine = await post(author);
      const c = await comment(author, mine.id, 'Reported comment');
      const first = await report(reader, 'post', mine.id, 'Offensive');
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        contentType: 'post',
        contentId: mine.id,
        reason: 'Offensive',
        status: 'open',
        reporter: { id: reader.id },
      });
      expect((await report(reader, 'post', mine.id, 'Again')).status).toBe(409);
      expect((await report(reader, 'comment', c.id)).status).toBe(201);
      // Another user may report the same item.
      const second = await t.user();
      expect((await report(second, 'post', mine.id)).status).toBe(201);
      expect((await report(reader, 'post', mine.id, '')).status).toBe(400);
      expect((await report(reader, 'photo', mine.id)).status).toBe(400);
      expect(
        (await report(reader, 'post', '000000000000000000000000')).status,
      ).toBe(404);
      expect(
        (
          await t.guest().post('/api/reports', {
            contentType: 'post',
            contentId: mine.id,
            reason: 'x',
          })
        ).status,
      ).toBe(401);
      expect(
        (await report({ ...reader, client: await t.admin() }, 'post', mine.id))
          .status,
      ).toBe(403);
      // Private content of another user cannot be reported (it cannot even be seen).
      const draft = await post(author, { status: 'draft' });
      expect((await report(reader, 'post', draft.id)).status).toBe(404);
    });

    it('the admin lists open reports and dismisses one: the content stays, the action is audited', async () => {
      const admin = await t.admin();
      const mine = await post(author);
      const created = (await report(reader, 'post', mine.id, 'Not nice')).body;
      const open = await admin.get('/api/admin/reports', {
        query: { contentType: 'post' },
      });
      expect(open.status).toBe(200);
      expect((open.body.items as any[]).every((r) => r.status === 'open')).toBe(
        true,
      );
      const all = [];
      for (let page = 1; page <= open.body.totalPages; page++) {
        all.push(
          ...((
            await admin.get('/api/admin/reports', {
              query: { contentType: 'post', page },
            })
          ).body.items as any[]),
        );
      }
      expect(all.find((r) => r.id === created.id)).toMatchObject({
        reason: 'Not nice',
        contentId: mine.id,
        reporter: { id: reader.id },
      });
      expect((await reader.client.get('/api/admin/reports')).status).toBe(403);

      const dismissed = await admin.patch(`/api/admin/reports/${created.id}`, {
        action: 'dismiss',
      });
      expect(dismissed.status).toBe(200);
      expect(dismissed.body.status).toBe('dismissed');
      expect((await detail(mine.id)).status).toBe(200);
      expect(
        (
          await admin.patch(`/api/admin/reports/${created.id}`, {
            action: 'hide',
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await admin.patch(`/api/admin/reports/${created.id}`, {
            action: 'burn',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await reader.client.patch(`/api/admin/reports/${created.id}`, {
            action: 'dismiss',
          })
        ).status,
      ).toBe(403);
      const audit = await admin.get('/api/admin/audit-logs', {
        query: { action: 'dismiss_report' },
      });
      expect(
        (audit.body.items as any[]).some((e) => e.targetId === mine.id),
      ).toBe(true);
    });

    it('hiding through a report: hidden content is visible only to its author and admins', async () => {
      const admin = await t.admin();
      const word = unique('hideme');
      const mine = await post(author, { title: word });
      const created = (await report(reader, 'post', mine.id)).body;
      const hidden = await admin.patch(`/api/admin/reports/${created.id}`, {
        action: 'hide',
      });
      expect(hidden.body.status).toBe('content_hidden');
      expect((await detail(mine.id)).status).toBe(404);
      expect((await detail(mine.id, reader.client)).status).toBe(404);
      expect((await detail(mine.id, author.client)).status).toBe(200);
      expect((await detail(mine.id, admin)).status).toBe(200);
      expect(await listed({ keyword: word })).toEqual([]);
      expect(
        (await reader.client.post(`/api/posts/${mine.id}/like`)).status,
      ).toBe(404);
      // The author is told.
      expect(
        (await notifications(author.client)).some((n) =>
          /hidden/i.test(n.title),
        ),
      ).toBe(true);
      const audit = await admin.get('/api/admin/audit-logs', {
        query: { action: 'hide_content' },
      });
      expect(
        (audit.body.items as any[]).some(
          (e) =>
            e.targetId === mine.id && e.admin.email === process.env.ADMIN_EMAIL,
        ),
      ).toBe(true);
    });

    it('the admin hides or deletes any post or comment directly; deletions are in the audit log', async () => {
      const admin = await t.admin();
      const mine = await post(author);
      const c = await comment(reader, mine.id, 'Rude words');
      // Hide a comment directly: only its author and admins still see it.
      const hide = await admin.patch(
        `/api/admin/content/comment/${c.id}/hide`,
        {},
      );
      expect(hide.status).toBe(200);
      expect((await detail(mine.id)).body.comments).toEqual([]);
      expect((await detail(mine.id, author.client)).body.comments).toEqual([]);
      expect(
        ((await detail(mine.id, reader.client)).body.comments as any[]).map(
          (x) => x.text,
        ),
      ).toEqual(['Rude words']);
      expect(
        ((await detail(mine.id, admin)).body.comments as any[]).map(
          (x) => x.text,
        ),
      ).toEqual(['Rude words']);
      expect(
        (
          await reader.client.patch(
            `/api/admin/content/comment/${c.id}/hide`,
            {},
          )
        ).status,
      ).toBe(403);
      expect(
        (await admin.patch(`/api/admin/content/photo/${c.id}/hide`, {})).status,
      ).toBe(400);

      // Delete the post directly.
      const gone = await admin.delete(`/api/admin/content/post/${mine.id}`);
      expect(gone.status).toBe(204);
      expect((await detail(mine.id, author.client)).status).toBe(404);
      expect(
        (await admin.delete(`/api/admin/content/post/${mine.id}`)).status,
      ).toBe(404);
      expect(
        (await reader.client.delete(`/api/admin/content/post/${mine.id}`))
          .status,
      ).toBe(403);
      const audit = await admin.get('/api/admin/audit-logs', {
        query: { action: 'delete_content' },
      });
      const entry = (audit.body.items as any[]).find(
        (e) => e.targetId === mine.id,
      );
      expect(entry).toMatchObject({
        action: 'delete_content',
        targetType: 'post',
      });
      expect(new Date(entry.createdAt as string).getTime()).toBeGreaterThan(
        Date.now() - 600_000,
      );
      expect((await reader.client.get('/api/admin/audit-logs')).status).toBe(
        403,
      );
      expect((await t.guest().get('/api/admin/audit-logs')).status).toBe(401);
    });

    it('a hidden itinerary leaves the public search and stays visible to its owner', async () => {
      const admin = await t.admin();
      const title = `Hidden trip ${unique('h')}`;
      const created = await author.client.post('/api/itineraries', {
        title,
        countryCodes: ['EG'],
        startDate: '2030-01-01',
      });
      await author.client.patch(`/api/itineraries/${created.body.id}`, {
        visibility: 'public',
      });
      expect(
        (await report(reader, 'itinerary', created.body.id as string)).status,
      ).toBe(201);
      expect(
        (
          await admin.patch(
            `/api/admin/content/itinerary/${created.body.id}/hide`,
            { reason: 'Reported' },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await t.guest().get('/api/itineraries/public/search', {
            query: { keyword: title },
          })
        ).body.items,
      ).toEqual([]);
      expect(
        (await t.guest().get(`/api/itineraries/public/${created.body.id}`))
          .status,
      ).toBe(404);
      expect(
        (await reader.client.post(`/api/itineraries/${created.body.id}/clone`))
          .status,
      ).toBe(404);
      expect(
        (await author.client.get(`/api/itineraries/${created.body.id}`)).status,
      ).toBe(200);
      // GEN-10: "Hidden content is visible only to its author and admins": the read-only public
      // view still opens for the author and for an admin, for nobody else.
      const publicView = `/api/itineraries/public/${created.body.id}`;
      expect((await admin.get(publicView)).status).toBe(200);
      expect((await author.client.get(publicView)).status).toBe(200);
      expect((await reader.client.get(publicView)).status).toBe(404);
      expect(
        (
          await admin.patch(
            `/api/admin/content/itinerary/${created.body.id}/unhide`,
          )
        ).status,
      ).toBe(200);
      expect(
        (await t.guest().get(`/api/itineraries/public/${created.body.id}`))
          .status,
      ).toBe(200);
    });
  });

  describe('ACC-13 moderators (row 12), ACC-14 accounts (row 13), ACC-15/16 suspension and providers (rows 14-15)', () => {
    it('ACC-13: creates a moderator linked to exactly one airline or hotel with a temporary password to change at first login', async () => {
      const admin = await t.admin();
      const airline = await t.airline();
      const email = `${unique('mod')}@example.com`;
      const body = {
        name: 'Mona Moderator',
        email,
        role: 'airline_moderator',
        providerId: airline.id,
        temporaryPassword: 'Temp0rary!x',
      };
      const res = await admin.post('/api/admin/moderators', body);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Mona Moderator',
        email,
        role: 'airline_moderator',
        airlineId: airline.id,
        mustChangePassword: true,
      });
      expect(res.body.hotelId).toBeUndefined();
      expect((await admin.post('/api/admin/moderators', body)).status).toBe(
        409,
      );
      for (const broken of [
        { role: 'admin' },
        { role: 'user' },
        { providerId: 'x' },
        { temporaryPassword: 'weak' },
        { email: 'nope' },
        { name: '' },
      ]) {
        const bad = await admin.post('/api/admin/moderators', {
          ...body,
          email: `${unique('m')}@example.com`,
          ...broken,
        });
        expect(bad.status).toBe(400);
      }
      // The provider must exist and match the role.
      const hotel = await t.hotel();
      expect(
        (
          await admin.post('/api/admin/moderators', {
            ...body,
            email: `${unique('m')}@example.com`,
            providerId: hotel.id,
          })
        ).status,
      ).toBe(404);
      expect(
        (await reader.client.post('/api/admin/moderators', body)).status,
      ).toBe(403);

      const client = t.guest();
      const login = await client.post('/api/auth/login', {
        email,
        password: 'Temp0rary!x',
      });
      expect(login.status).toBe(200);
      expect(login.body).toMatchObject({
        role: 'airline_moderator',
        airlineId: airline.id,
        mustChangePassword: true,
      });
      // Must change the password before managing the airline.
      expect(
        (
          await client.put(`/api/airlines/${airline.id}/baggage-policy`, {
            extraBagPrice: 100,
            maxExtraBagsPerPassenger: 1,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await client.patch('/api/auth/change-password', {
            currentPassword: 'Temp0rary!x',
            newPassword: PASSWORD,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await client.put(`/api/airlines/${airline.id}/baggage-policy`, {
            extraBagPrice: 100,
            maxExtraBagsPerPassenger: 1,
          })
        ).status,
      ).toBe(200);
      const audit = await admin.get('/api/admin/audit-logs', {
        query: { action: 'create_moderator' },
      });
      expect(
        (audit.body.items as any[]).some((e) => e.targetId === res.body.id),
      ).toBe(true);
    });

    it('ACC-14: paginated list of all accounts with name, email, role, status, registration date; search and filters', async () => {
      const admin = await t.admin();
      const word = unique('findme');
      const target = await t.user(`Zed ${word}`);
      const byName = await admin.get('/api/admin/accounts', {
        query: { search: word.toUpperCase() },
      });
      expect(byName.status).toBe(200);
      expect(byName.body).toMatchObject({ page: 1, pageSize: 10, total: 1 });
      expect(byName.body.items[0]).toMatchObject({
        id: target.id,
        name: `Zed ${word}`,
        email: target.email,
        role: 'user',
        status: 'active',
      });
      expect(
        new Date(byName.body.items[0].registrationDate as string).getTime(),
      ).toBeGreaterThan(Date.now() - 600_000);
      expect(JSON.stringify(byName.body)).not.toMatch(
        /passwordHash|\$2[aby]\$/,
      );
      const byEmail = await admin.get('/api/admin/accounts', {
        query: { search: target.email.slice(0, 12) },
      });
      expect((byEmail.body.items as any[]).map((a) => a.id)).toContain(
        target.id,
      );
      const admins = await admin.get('/api/admin/accounts', {
        query: { role: 'admin' },
      });
      expect(
        (admins.body.items as any[]).every((a) => a.role === 'admin'),
      ).toBe(true);
      expect(admins.body.total).toBeGreaterThanOrEqual(1);
      expect(
        (
          await admin.get('/api/admin/accounts', {
            query: { search: word, role: 'hotel_moderator' },
          })
        ).body.total,
      ).toBe(0);
      expect(
        (
          await admin.get('/api/admin/accounts', {
            query: { search: word, status: 'suspended' },
          })
        ).body.total,
      ).toBe(0);
      expect(
        (await admin.get('/api/admin/accounts', { query: { role: 'king' } }))
          .status,
      ).toBe(400);
      const everyone = await admin.get('/api/admin/accounts');
      expect(everyone.body.items).toHaveLength(10);
      expect(everyone.body.total).toBeGreaterThan(10);
      expect((await reader.client.get('/api/admin/accounts')).status).toBe(403);
      expect((await t.guest().get('/api/admin/accounts')).status).toBe(401);
    });

    it('ACC-16: a suspended user cannot log in and sees "account suspended"; reactivation restores access; both are audited and notified', async () => {
      const admin = await t.admin();
      const target = await t.user('Suspended Sam');
      const own = await post(target, { title: `Stays visible ${unique('v')}` });
      const suspended = await admin.patch(
        `/api/admin/accounts/${target.id}/suspend`,
        { reason: 'Abusive content' },
      );
      expect(suspended.status).toBe(200);
      expect(suspended.body.status).toBe('suspended');
      // The running session ends and login is refused with the message.
      expect([401, 403]).toContain(
        (await target.client.get('/api/auth/me')).status,
      );
      const login = await t
        .guest()
        .post('/api/auth/login', { email: target.email, password: PASSWORD });
      expect(login.status).toBe(403);
      expect(login.body.message).toMatch(/account suspended/i);
      // A wrong password still gets the generic message.
      expect(
        (
          await t.guest().post('/api/auth/login', {
            email: target.email,
            password: 'Wrong1234',
          })
        ).status,
      ).toBe(401);
      // Their content stays visible.
      expect((await detail(own.id)).status).toBe(200);
      expect(
        (await admin.patch(`/api/admin/accounts/${target.id}/suspend`, {}))
          .status,
      ).toBe(409);
      expect(
        (
          await reader.client.patch(
            `/api/admin/accounts/${target.id}/reactivate`,
            {},
          )
        ).status,
      ).toBe(403);

      const back = await admin.patch(
        `/api/admin/accounts/${target.id}/reactivate`,
        {},
      );
      expect(back.status).toBe(200);
      expect(back.body.status).toBe('active');
      const client = t.guest();
      expect(
        (
          await client.post('/api/auth/login', {
            email: target.email,
            password: PASSWORD,
          })
        ).status,
      ).toBe(200);
      // GEN-01: notification of the suspension.
      expect(
        (await notifications(client)).some(
          (n) =>
            /suspend/i.test(n.title) && n.message.includes('Abusive content'),
        ),
      ).toBe(true);
      // GEN-07: both actions are in the audit log.
      for (const action of ['suspend_account', 'reactivate_account']) {
        const audit = await admin.get('/api/admin/audit-logs', {
          query: { action },
        });
        expect(
          (audit.body.items as any[]).some((e) => e.targetId === target.id),
        ).toBe(true);
      }
      // An admin account cannot be suspended.
      const adminId = (await admin.get('/api/auth/me')).body.id as string;
      expect(
        (await admin.patch(`/api/admin/accounts/${adminId}/suspend`, {}))
          .status,
      ).toBe(403);
      expect(
        (
          await admin.patch(
            '/api/admin/accounts/000000000000000000000000/suspend',
            {},
          )
        ).status,
      ).toBe(404);
    });

    it('ACC-15: a suspended moderator cannot log in; deactivating a provider is separate and notifies its moderator', async () => {
      const admin = await t.admin();
      const airline = await airlineWithModerator(t);
      const hotel = await hotelWithModerator(t);
      // Suspend the moderator: the airline itself stays active.
      expect(
        (
          await admin.patch(
            `/api/admin/accounts/${airline.moderator.id}/suspend`,
            {},
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await t.guest().post('/api/auth/login', {
            email: airline.moderator.email,
            password: PASSWORD,
          })
        ).status,
      ).toBe(403);
      expect(
        (await t.guest().get(`/api/airlines/${airline.airlineId}`)).status,
      ).toBe(200);
      expect(
        (
          await admin.patch(
            `/api/admin/accounts/${airline.moderator.id}/reactivate`,
            {},
          )
        ).status,
      ).toBe(200);

      // Deactivate the hotel: its moderator can still log in.
      const off = await admin.patch(
        `/api/admin/providers/hotel/${hotel.hotelId}/deactivate`,
        { reason: 'Licence expired' },
      );
      expect(off.status).toBe(200);
      expect(off.body).toMatchObject({ id: hotel.hotelId, active: false });
      expect((await t.guest().get(`/api/hotels/${hotel.hotelId}`)).status).toBe(
        404,
      );
      expect(
        (
          await t.guest().post('/api/auth/login', {
            email: hotel.moderator.email,
            password: PASSWORD,
          })
        ).status,
      ).toBe(200);
      expect(
        (await notifications(hotel.moderator.client)).some(
          (n) =>
            /deactivated/i.test(n.title) &&
            n.message.includes('Licence expired'),
        ),
      ).toBe(true);
      expect(
        (
          await admin.patch(
            `/api/admin/providers/hotel/${hotel.hotelId}/deactivate`,
            {},
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await admin.patch(
            `/api/admin/providers/resort/${hotel.hotelId}/deactivate`,
            {},
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await admin.patch(
            '/api/admin/providers/hotel/000000000000000000000000/deactivate',
            {},
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await reader.client.patch(
            `/api/admin/providers/hotel/${hotel.hotelId}/reactivate`,
            {},
          )
        ).status,
      ).toBe(403);
      const on = await admin.patch(
        `/api/admin/providers/hotel/${hotel.hotelId}/reactivate`,
        {},
      );
      expect(on.body).toMatchObject({ id: hotel.hotelId, active: true });
      expect((await t.guest().get(`/api/hotels/${hotel.hotelId}`)).status).toBe(
        200,
      );
      expect(
        (
          await admin.patch(
            `/api/admin/providers/hotel/${hotel.hotelId}/reactivate`,
            {},
          )
        ).status,
      ).toBe(409);
      const audit = await admin.get('/api/admin/audit-logs', {
        query: { action: 'deactivate_hotel' },
      });
      expect(
        (audit.body.items as any[]).some((e) => e.targetId === hotel.hotelId),
      ).toBe(true);
    });
  });

  describe('GEN-01 in-app notifications (row 85)', () => {
    it('unread count, list and mark as read; only the own notifications', async () => {
      const admin = await t.admin();
      const target = await t.user('Notified Nada');
      // Two notifications: suspension and reactivation.
      await admin.patch(`/api/admin/accounts/${target.id}/suspend`, {});
      await admin.patch(`/api/admin/accounts/${target.id}/reactivate`, {});
      const client = t.guest();
      await client.post('/api/auth/login', {
        email: target.email,
        password: PASSWORD,
      });
      expect(
        (await client.get('/api/notifications/unread-count')).body.count,
      ).toBe(2);
      const list = await client.get('/api/notifications');
      expect(list.status).toBe(200);
      expect(list.body.total).toBe(2);
      // Newest first.
      expect((list.body.items as any[]).map((n) => n.title)).toEqual([
        'Account Reactivated',
        'Account Suspended',
      ]);
      expect((list.body.items as any[]).every((n) => n.read === false)).toBe(
        true,
      );
      const first = list.body.items[0].id as string;
      // Another user cannot read or mark it.
      expect(
        (await reader.client.patch(`/api/notifications/${first}/read`)).status,
      ).toBe(404);
      const marked = await client.patch(`/api/notifications/${first}/read`);
      expect(marked.status).toBe(200);
      expect(marked.body.read).toBe(true);
      expect(
        (await client.get('/api/notifications/unread-count')).body.count,
      ).toBe(1);
      const unread = await client.get('/api/notifications', {
        query: { unreadOnly: true },
      });
      expect((unread.body.items as any[]).map((n) => n.title)).toEqual([
        'Account Suspended',
      ]);
      expect((await client.patch('/api/notifications/read-all')).status).toBe(
        200,
      );
      expect(
        (await client.get('/api/notifications/unread-count')).body.count,
      ).toBe(0);
      expect((await t.guest().get('/api/notifications')).status).toBe(401);
      expect(
        (await t.guest().get('/api/notifications/unread-count')).status,
      ).toBe(401);
    });
  });

  describe('GEN-12 reference data (row 99), GEN-02 / GEN-13 errors (rows 86, 100)', () => {
    it('countries, cities and supported currencies are seeded from the official datasets', async () => {
      const countries = await t.guest().get('/api/countries');
      expect(countries.body.total).toBe(8);
      expect(countries.body.items).toContainEqual({
        code: 'AE',
        name: 'United Arab Emirates',
        currency: 'AED',
      });
      const cities = await t.guest().get('/api/cities');
      expect(cities.body.total).toBe(8);
      expect(cities.body.items).toContainEqual({
        cityId: 'new_york',
        name: 'New York',
        countryCode: 'US',
      });
      expect(
        (await t.guest().get('/api/cities', { query: { country: 'DE' } })).body
          .items,
      ).toEqual([
        { cityId: 'frankfurt', name: 'Frankfurt', countryCode: 'DE' },
      ]);
      const currencies = await t.guest().get('/api/currencies');
      expect(
        (currencies.body.items as any[]).map((c) => c.code).sort(),
      ).toEqual(['AED', 'EGP', 'EUR', 'GBP', 'JPY', 'SAR', 'USD']);
      const attractions = await t
        .guest()
        .get('/api/attractions', { query: { city: 'cairo' } });
      expect(attractions.body.items).toEqual([
        {
          attractionId: 'att-1',
          name: 'Giza Pyramids and Sphinx',
          cityId: 'cairo',
        },
      ]);
      expect((await t.guest().get('/api/attractions')).body.total).toBe(8);
    });

    it('every error has the same shape, with field-level messages for validation errors', async () => {
      const res = await t
        .guest()
        .post('/api/auth/register', { email: 'bad', password: 'x' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'BAD_REQUEST',
        path: '/api/auth/register',
      });
      expect(typeof res.body.message).toBe('string');
      expect(new Date(res.body.timestamp as string).getTime()).toBeGreaterThan(
        Date.now() - 60_000,
      );
      for (const fieldError of res.body.fieldErrors as any[]) {
        expect(typeof fieldError.field).toBe('string');
        expect(fieldError.messages.length).toBeGreaterThan(0);
      }
      expect(
        (res.body.fieldErrors as any[]).map((e) => e.field).sort(),
      ).toEqual(['acceptTerms', 'email', 'name', 'password']);
      const missing = await t.guest().get('/api/flights/not-an-id');
      expect(missing.status).toBe(400);
      expect(missing.body).toMatchObject({
        statusCode: 400,
        error: 'BAD_REQUEST',
      });
      const unknown = await t.guest().get('/api/no-such-route');
      expect(unknown.body).toMatchObject({
        statusCode: 404,
        error: 'NOT_FOUND',
        path: '/api/no-such-route',
      });
    });
  });
});
