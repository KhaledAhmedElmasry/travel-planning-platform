// System tests: accounts and sessions, over HTTP against the real application.
// Expected results come from the Excel sheet "Mandatory" (row in brackets) and the project
// description section 8.1.
import { Client, PASSWORD, TestApp, unique } from '../support/harness';

describe('Accounts and sessions', () => {
  const t = new TestApp();
  beforeAll(() => t.start());
  afterAll(() => t.stop());

  const registration = (overrides: Record<string, unknown> = {}) => ({
    name: 'Nour Hassan',
    email: `${unique('reg')}@example.com`,
    password: PASSWORD,
    acceptTerms: true,
    ...overrides,
  });
  const login = (email: string, password: string) =>
    t.guest().post('/api/auth/login', { email, password });

  it('the server reports that it runs and is connected to MongoDB Atlas', async () => {
    const res = await t.guest().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
  });

  describe('ACC-01 registration (Mandatory row 2)', () => {
    it('registers a guest with name, unique email, password and consent as a registered user', async () => {
      const body = registration();
      const res = await t.guest().post('/api/auth/register', body);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Nour Hassan',
        email: body.email,
        role: 'user',
        status: 'active',
      });
      expect(res.body.id).toMatch(/^[0-9a-f]{24}$/);
      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    });

    it.each([
      ['an invalid email', { email: 'not-an-email' }, 'email'],
      ['a password shorter than 8 characters', { password: 'Ab1' }, 'password'],
      ['a password without a digit', { password: 'OnlyLetters' }, 'password'],
      ['a password without a letter', { password: '1234567890' }, 'password'],
      ['consent not given', { acceptTerms: false }, 'acceptTerms'],
      ['a missing name', { name: '' }, 'name'],
    ])(
      'rejects %s with a field-level error (GEN-02)',
      async (_case, overrides, field) => {
        const res = await t
          .guest()
          .post('/api/auth/register', registration(overrides));
        expect(res.status).toBe(400);
        expect(
          res.body.fieldErrors.map((e: { field: string }) => e.field),
        ).toContain(field);
      },
    );

    it('accepts a password of exactly 8 characters with one letter and one digit', async () => {
      const res = await t
        .guest()
        .post('/api/auth/register', registration({ password: 'abcdefg1' }));
      expect(res.status).toBe(201);
    });

    it('rejects an email that is already registered, whatever its letter case', async () => {
      const body = registration();
      expect((await t.guest().post('/api/auth/register', body)).status).toBe(
        201,
      );
      const again = await t.guest().post('/api/auth/register', {
        ...body,
        email: body.email.toUpperCase(),
      });
      expect(again.status).toBe(409);
    });

    it('ACC-18: a role sent at registration never creates an admin', async () => {
      const res = await t
        .guest()
        .post('/api/auth/register', registration({ role: 'admin' }));
      expect(res.status).toBe(201);
      expect(res.body.role).toBe('user');
    });

    it('GEN-13: the password is stored only as a salted hash', async () => {
      const body = registration();
      await t.guest().post('/api/auth/register', body);
      const stored = await t.collection('users').findOne({ email: body.email });
      expect(stored?.password).toBeUndefined();
      expect(stored?.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(stored?.passwordHash).not.toContain(PASSWORD);
    });
  });

  describe('ACC-04 login, ACC-19 cookies (Mandatory rows 3 and 101)', () => {
    it('logs in and issues the access and refresh tokens as httpOnly, Secure, SameSite cookies', async () => {
      const user = await t.user();
      const client = t.guest();
      const res = await client.post('/api/auth/login', {
        email: user.email,
        password: PASSWORD,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: user.id,
        email: user.email,
        role: 'user',
      });
      for (const name of ['access_token', 'refresh_token']) {
        expect(client.cookies.has(name)).toBe(true);
        const attributes = client.cookieAttributes.get(name)!.toLowerCase();
        expect(attributes).toContain('httponly');
        expect(attributes).toContain('secure');
        expect(attributes).toMatch(/samesite=(strict|lax)/);
      }
      expect(JSON.stringify(res.body)).not.toContain(
        client.cookies.get('access_token'),
      );
    });

    it('the current user comes from /auth/me, and a guest gets 401', async () => {
      const user = await t.user('Me Tester');
      const me = await user.client.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({
        id: user.id,
        name: 'Me Tester',
        role: 'user',
        status: 'active',
      });
      expect((await t.guest().get('/api/auth/me')).status).toBe(401);
    });

    it('answers a wrong password and an unknown email with the same generic message', async () => {
      const user = await t.user();
      const wrong = await login(user.email, 'Wrong1234');
      const unknown = await login(`${unique('no')}@example.com`, 'Wrong1234');
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body.message).toMatch(/^invalid email or password$/i);
      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it('the seeded admin logs in with role admin (ACC-18)', async () => {
      const admin = await t.admin();
      expect((await admin.get('/api/auth/me')).body.role).toBe('admin');
    });
  });

  describe('ACC-05 lockout (Mandatory row 4)', () => {
    it('locks the account for 15 minutes after 5 consecutive failed logins', async () => {
      const user = await t.user();
      for (let i = 1; i <= 4; i++) {
        expect((await login(user.email, 'Wrong1234')).status).toBe(401);
      }
      const before = Date.now();
      const fifth = await login(user.email, 'Wrong1234');
      expect(fifth.status).toBe(403);
      expect(fifth.body.message).toMatch(/locked/i);
      const stored = await t.collection('users').findOne({ email: user.email });
      const lockedFor = new Date(stored!.lockUntil as Date).getTime() - before;
      expect(lockedFor).toBeGreaterThan(14.9 * 60_000);
      expect(lockedFor).toBeLessThan(15.1 * 60_000);
      // Even the right password is refused while the lock lasts.
      const right = await login(user.email, PASSWORD);
      expect(right.status).toBe(403);
      expect(right.body.message).toMatch(/locked/i);
      // After the 15 minutes the account can log in again.
      await t
        .collection('users')
        .updateOne(
          { email: user.email },
          { $set: { lockUntil: new Date(Date.now() - 1000) } },
        );
      expect((await login(user.email, PASSWORD)).status).toBe(200);
    });

    it('a successful login resets the counter', async () => {
      const user = await t.user();
      for (let i = 1; i <= 4; i++) await login(user.email, 'Wrong1234');
      expect((await login(user.email, PASSWORD)).status).toBe(200);
      for (let i = 1; i <= 4; i++) {
        expect((await login(user.email, 'Wrong1234')).status).toBe(401);
      }
      expect((await login(user.email, PASSWORD)).status).toBe(200);
    });
  });

  describe('ACC-06 logout and session expiry (Mandatory row 5)', () => {
    it('logout clears both cookies and revokes the refresh token on the server', async () => {
      const user = await t.user();
      const oldCookies = new Map(user.client.cookies);
      const res = await user.client.post('/api/auth/logout');
      expect(res.status).toBe(204);
      expect(user.client.cookies.has('access_token')).toBe(false);
      expect(user.client.cookies.has('refresh_token')).toBe(false);
      // A copy of the old cookies no longer works: the session is revoked on the server.
      const copy: Client = t.guest();
      oldCookies.forEach((value, name) => copy.cookies.set(name, value));
      expect((await copy.get('/api/auth/me')).status).toBe(401);
      expect((await copy.post('/api/auth/refresh')).status).toBe(401);
    });

    const setIdle = (userId: string, minutes: number) =>
      t.collection('sessions').updateMany(
        { userId: t.oid(userId) },
        {
          $set: {
            lastActivityAt: new Date(Date.now() - minutes * 60_000),
            expiresAt: new Date(Date.now() + (30 - minutes) * 60_000),
          },
        },
      );

    it('a session without an authenticated request for 30 minutes expires', async () => {
      const user = await t.user();
      await setIdle(user.id, 29);
      expect((await user.client.get('/api/auth/me')).status).toBe(200);
      await setIdle(user.id, 31);
      expect((await user.client.get('/api/auth/me')).status).toBe(401);
      expect((await user.client.post('/api/auth/refresh')).status).toBe(401);
    });

    it('every authenticated request restarts the 30 minutes', async () => {
      const user = await t.user();
      // 29 minutes 30 seconds idle, then one request ...
      await setIdle(user.id, 29.5);
      expect((await user.client.get('/api/auth/me')).status).toBe(200);
      // ... so the session now ends 30 minutes after that request.
      const session = await t
        .collection('sessions')
        .findOne({ userId: t.oid(user.id) });
      const left = new Date(session!.expiresAt as Date).getTime() - Date.now();
      expect(left).toBeGreaterThan(29.5 * 60_000);
      expect(left).toBeLessThanOrEqual(30 * 60_000);
    });
  });

  describe('ACC-08 change password (Mandatory row 7)', () => {
    it('changes the password with the current password and a new one that meets the rules', async () => {
      const user = await t.user();
      const res = await user.client.patch('/api/auth/change-password', {
        currentPassword: PASSWORD,
        newPassword: 'NewPassw0rd',
      });
      expect(res.status).toBe(200);
      expect((await login(user.email, PASSWORD)).status).toBe(401);
      expect((await login(user.email, 'NewPassw0rd')).status).toBe(200);
    });

    it('rejects a wrong current password and a new password that breaks the rules', async () => {
      const user = await t.user();
      const wrong = await user.client.patch('/api/auth/change-password', {
        currentPassword: 'Wrong1234',
        newPassword: 'NewPassw0rd',
      });
      expect(wrong.status).toBe(400);
      expect(wrong.body.fieldErrors[0].field).toBe('currentPassword');
      const weak = await user.client.patch('/api/auth/change-password', {
        currentPassword: PASSWORD,
        newPassword: 'short1',
      });
      expect(weak.status).toBe(400);
      expect(weak.body.fieldErrors[0].field).toBe('newPassword');
      expect((await login(user.email, PASSWORD)).status).toBe(200);
      const guest = await t.guest().patch('/api/auth/change-password', {
        currentPassword: PASSWORD,
        newPassword: 'NewPassw0rd',
      });
      expect(guest.status).toBe(401);
    });
  });

  describe('ACC-09 profile (Mandatory row 8) and GET /users/me', () => {
    it('edits name, phone number and preferred currency', async () => {
      const user = await t.user();
      const res = await user.client.patch('/api/users/me', {
        name: 'New Name',
        phone: '+20 100 123 4567',
        preferredCurrency: 'EUR',
      });
      expect(res.status).toBe(200);
      const me = await user.client.get('/api/users/me');
      expect(me.body).toMatchObject({
        id: user.id,
        name: 'New Name',
        phone: '+20 100 123 4567',
        preferredCurrency: 'EUR',
        email: user.email,
      });
    });

    it('saves nothing when one field fails validation', async () => {
      const user = await t.user('Keep Me');
      const res = await user.client.patch('/api/users/me', {
        name: 'Changed',
        preferredCurrency: 'XXX',
      });
      expect(res.status).toBe(400);
      expect(res.body.fieldErrors[0].field).toBe('preferredCurrency');
      const bad = await user.client.patch('/api/users/me', {
        name: 'Changed',
        phone: 'abc',
      });
      expect(bad.status).toBe(400);
      expect((await user.client.get('/api/users/me')).body.name).toBe(
        'Keep Me',
      );
    });

    it('accepts only currencies of the supported list (Countries.csv)', async () => {
      const user = await t.user();
      for (const currency of [
        'EGP',
        'AED',
        'GBP',
        'USD',
        'EUR',
        'JPY',
        'SAR',
      ]) {
        const res = await user.client.patch('/api/users/me', {
          preferredCurrency: currency,
        });
        expect(res.status).toBe(200);
      }
      const chf = await user.client.patch('/api/users/me', {
        preferredCurrency: 'CHF',
      });
      expect(chf.status).toBe(400);
      expect((await t.guest().get('/api/users/me')).status).toBe(401);
    });
  });

  describe('ACC-07a admin password reset (Mandatory row 6)', () => {
    const TEMP = 'Temp0rary!x';
    it('sets a temporary password; the account must set a new one at its next login', async () => {
      const admin = await t.admin();
      const user = await t.user();
      const reset = await admin.post(
        `/api/admin/users/${user.id}/reset-password`,
        { temporaryPassword: TEMP },
      );
      expect(reset.status).toBe(200);
      // The old password and the old session stop working.
      expect((await user.client.get('/api/auth/me')).status).toBe(401);
      expect((await login(user.email, PASSWORD)).status).toBe(401);
      const client = t.guest();
      const first = await client.post('/api/auth/login', {
        email: user.email,
        password: TEMP,
      });
      expect(first.status).toBe(200);
      expect(first.body.mustChangePassword).toBe(true);
      // Nothing else is allowed until the password is changed.
      expect((await client.get('/api/users/me')).status).toBe(403);
      const weak = await client.patch('/api/auth/change-password', {
        currentPassword: TEMP,
        newPassword: 'weak',
      });
      expect(weak.status).toBe(400);
      const changed = await client.patch('/api/auth/change-password', {
        currentPassword: TEMP,
        newPassword: 'Fresh1234',
      });
      expect(changed.status).toBe(200);
      expect((await client.get('/api/users/me')).status).toBe(200);
      expect((await client.get('/api/auth/me')).body.mustChangePassword).toBe(
        false,
      );
    });

    it('is for admins only and rejects a temporary password that breaks the rules', async () => {
      const admin = await t.admin();
      const user = await t.user();
      const other = await t.user();
      const path = `/api/admin/users/${user.id}/reset-password`;
      const body = { temporaryPassword: TEMP };
      expect((await other.client.post(path, body)).status).toBe(403);
      expect((await t.guest().post(path, body)).status).toBe(401);
      expect(
        (await admin.post(path, { temporaryPassword: 'weak' })).status,
      ).toBe(400);
      const missing = await admin.post(
        '/api/admin/users/000000000000000000000000/reset-password',
        body,
      );
      expect(missing.status).toBe(404);
      expect((await login(user.email, PASSWORD)).status).toBe(200);
    });
  });

  describe('ACC-12 deactivate own account (Mandatory row 11)', () => {
    it('a deactivated user cannot log in and the session ends', async () => {
      const user = await t.user();
      const res = await user.client.delete('/api/users/me');
      expect(res.status).toBe(204);
      expect((await user.client.get('/api/auth/me')).status).toBe(401);
      const again = await login(user.email, PASSWORD);
      expect([401, 403]).toContain(again.status);
      expect((await t.guest().delete('/api/users/me')).status).toBe(401);
    });
  });
});
