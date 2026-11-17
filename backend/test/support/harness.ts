// Boots the real application for the system tests and gives them an HTTP client that behaves like
// a browser: it keeps the httpOnly cookies the API sets and sends them back.
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import request from 'supertest';
import Stripe from 'stripe';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  calledOperations,
  checkResponse,
  contractProblems,
} from './openapi-contract';

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  text: string;
  headers: Record<string, string | string[] | undefined>;
  /** The raw bytes for binary responses (PDF, CSV). */
  buffer: Buffer;
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** multipart/form-data: text fields. */
  fields?: Record<string, string | string[]>;
  /** multipart/form-data: files. */
  files?: {
    field: string;
    content: Buffer;
    filename: string;
    contentType: string;
  }[];
  headers?: Record<string, string>;
  /** Send this exact text as the body (used for the Stripe webhook). */
  rawBody?: string;
}

/** One browser: its own cookie jar. */
export class Client {
  readonly cookies = new Map<string, string>();
  /** The attributes of the last Set-Cookie header per cookie name. */
  readonly cookieAttributes = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  get = (path: string, options: RequestOptions = {}) =>
    this.send('get', path, options);
  post = (path: string, body?: unknown, options: RequestOptions = {}) =>
    this.send('post', path, { ...options, body: options.body ?? body });
  put = (path: string, body?: unknown, options: RequestOptions = {}) =>
    this.send('put', path, { ...options, body: options.body ?? body });
  patch = (path: string, body?: unknown, options: RequestOptions = {}) =>
    this.send('patch', path, { ...options, body: options.body ?? body });
  delete = (path: string, options: RequestOptions = {}) =>
    this.send('delete', path, options);

  /** A second browser that shares nothing with this one. */
  fresh(): Client {
    return new Client(this.baseUrl);
  }

  private async send(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    options: RequestOptions,
  ): Promise<ApiResponse> {
    let call = request(this.baseUrl)[method](path);
    const query = Object.fromEntries(
      Object.entries(options.query ?? {}).filter(
        ([, value]) => value !== undefined,
      ),
    );
    if (Object.keys(query).length > 0) call = call.query(query);
    if (this.cookies.size > 0) {
      call = call.set(
        'Cookie',
        [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '),
      );
    }
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      call = call.set(name, value);
    }
    if (options.rawBody !== undefined) {
      call = call.set('Content-Type', 'application/json').send(options.rawBody);
    } else if (options.files || options.fields) {
      for (const [name, value] of Object.entries(options.fields ?? {})) {
        for (const item of Array.isArray(value) ? value : [value]) {
          call = call.field(name, item);
        }
      }
      for (const file of options.files ?? []) {
        call = call.attach(file.field, file.content, {
          filename: file.filename,
          contentType: file.contentType,
        });
      }
    } else if (options.body !== undefined) {
      call = call.send(options.body as object);
    }

    const response = await call
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .ok(() => true);

    const buffer = Buffer.isBuffer(response.body)
      ? response.body
      : Buffer.from([]);
    const text = buffer.toString('utf8');
    const contentType = String(response.headers['content-type'] ?? '');
    const isJson = contentType.includes('application/json');
    let body: unknown = text;
    if (isJson && text.length > 0) body = JSON.parse(text);
    if (text.length === 0) body = undefined;

    this.keepCookies(response.headers['set-cookie']);
    const queryText =
      Object.keys(query).length > 0
        ? `?${new URLSearchParams(query as Record<string, string>).toString()}`
        : '';
    checkResponse(method, `${path}${queryText}`, response.status, body, isJson);
    return {
      status: response.status,
      body,
      text,
      headers: response.headers,
      buffer,
    };
  }

  private keepCookies(header: string | string[] | undefined): void {
    const lines = header === undefined ? [] : [header].flat();
    for (const line of lines) {
      const [pair, ...attributes] = line.split(';').map((part) => part.trim());
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      const expires = attributes.find((a) => /^expires=/i.test(a));
      const cleared =
        value === '' ||
        attributes.some((a) => /^max-age=0$/i.test(a)) ||
        (expires !== undefined &&
          new Date(expires.slice('expires='.length)).getTime() <= Date.now());
      this.cookieAttributes.set(name, attributes.join('; '));
      if (cleared) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}

export interface Account {
  id: string;
  email: string;
  password: string;
  client: Client;
}

let sequence = 0;
/** A value that is unique in this test run, for emails, codes and names. */
export function unique(prefix = 'x'): string {
  sequence += 1;
  return `${prefix}${Date.now().toString(36)}${sequence.toString(36)}`;
}

/** YYYY-MM-DD of today (UTC) plus a number of days. */
export function day(offset: number): string {
  return new Date(Date.now() + offset * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export const PASSWORD = 'Passw0rd!x';

/** A 1x1 PNG and a tiny JPG, for the upload rules (GEN-08). */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
export const JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

export class TestApp {
  app!: INestApplication;
  db!: Connection;
  baseUrl!: string;
  /** Stripe test mode, to look at what the application really did at Stripe. */
  stripe!: Stripe;
  private adminClient?: Client;

  async start(): Promise<this> {
    if (!process.env.SYSTEST_DATABASE) {
      throw new Error(
        'Run the system tests with: npm run test:system (jest --config test/jest-system.json).',
      );
    }
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    this.app = moduleRef.createNestApplication({ rawBody: true });
    this.app.useLogger(false);
    configureApp(this.app);
    const port = Number(process.env.SYSTEST_PORT);
    await this.app.listen(port, '127.0.0.1');
    this.baseUrl = `http://127.0.0.1:${port}`;
    this.db = this.app.get<Connection>(getConnectionToken());
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    return this;
  }

  async stop(): Promise<void> {
    await this.app?.close();
    // What this test file found out about docs/api/openapi.yaml; checked by
    // test/system/zz-openapi-contract.system-spec.ts after all other files.
    const called = Object.fromEntries(
      [...calledOperations()].map(([name, codes]) => [name, [...codes]]),
    );
    writeFileSync(
      join(
        process.env.SYSTEST_WORKDIR as string,
        `contract-${randomUUID()}.json`,
      ),
      JSON.stringify({ problems: contractProblems(), called }),
    );
  }

  /** A browser without a session (a guest). */
  guest(): Client {
    return new Client(this.baseUrl);
  }

  /** The service of the running application (used to run a scheduled job now). */
  service<T>(type: new (...args: any[]) => T): T {
    return this.app.get(type, { strict: false });
  }

  collection(name: string) {
    return this.db.collection(name);
  }

  oid(id: string): Types.ObjectId {
    return new Types.ObjectId(id);
  }

  /** The seeded administrator (ACC-18), logged in. */
  async admin(): Promise<Client> {
    if (this.adminClient) {
      const me = await this.adminClient.get('/api/auth/me');
      if (me.status === 200) return this.adminClient;
    }
    const client = this.guest();
    const login = await client.post('/api/auth/login', {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    if (login.status !== 200) {
      throw new Error(`The seeded admin cannot log in: ${login.text}`);
    }
    this.adminClient = client;
    return client;
  }

  /** Registers a new user through the API and logs in. */
  async user(name = 'Test User'): Promise<Account> {
    const email = `${unique('user')}@example.com`;
    const client = this.guest();
    const registered = await client.post('/api/auth/register', {
      name,
      email,
      password: PASSWORD,
      acceptTerms: true,
    });
    if (registered.status !== 201) {
      throw new Error(`Registration failed: ${registered.text}`);
    }
    const login = await client.post('/api/auth/login', {
      email,
      password: PASSWORD,
    });
    if (login.status !== 200) throw new Error(`Login failed: ${login.text}`);
    return {
      id: registered.body.id as string,
      email,
      password: PASSWORD,
      client,
    };
  }

  /** Admin creates an airline (FLT-01). */
  async airline(name = 'Test Air'): Promise<{ id: string; code: string }> {
    const admin = await this.admin();
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = randomCode();
      const created = await admin.post('/api/airlines', undefined, {
        fields: { name: `${name} ${code}`, code },
      });
      if (created.status === 201)
        return { id: created.body.id as string, code };
      if (created.status !== 409) {
        throw new Error(`Airline not created: ${created.text}`);
      }
    }
    throw new Error('No free airline code found.');
  }

  /** Admin creates a hotel (HTL-01). */
  async hotel(
    overrides: Record<string, string> = {},
  ): Promise<{ id: string; name: string }> {
    const admin = await this.admin();
    const name = overrides.name ?? `Hotel ${unique('h')}`;
    const created = await admin.post('/api/hotels', undefined, {
      fields: {
        name,
        address: '1 Nile Street',
        cityId: 'cairo',
        countryCode: 'EG',
        description: 'A hotel for the system tests.',
        starRating: '4',
        ...overrides,
      },
    });
    if (created.status !== 201) {
      throw new Error(`Hotel not created: ${created.text}`);
    }
    return { id: created.body.id as string, name };
  }

  /**
   * Admin creates a moderator with a temporary password (ACC-13); the moderator logs in and sets
   * an own password, which the first login requires.
   */
  async moderator(
    role: 'airline_moderator' | 'hotel_moderator',
    providerId: string,
  ): Promise<Account> {
    const admin = await this.admin();
    const email = `${unique('mod')}@example.com`;
    const temporaryPassword = 'Temp0rary!x';
    const created = await admin.post('/api/admin/moderators', {
      name: 'Test Moderator',
      email,
      role,
      providerId,
      temporaryPassword,
    });
    if (created.status !== 201) {
      throw new Error(`Moderator not created: ${created.text}`);
    }
    const client = this.guest();
    await client.post('/api/auth/login', {
      email,
      password: temporaryPassword,
    });
    const changed = await client.patch('/api/auth/change-password', {
      currentPassword: temporaryPassword,
      newPassword: PASSWORD,
    });
    if (changed.status !== 200) {
      throw new Error(`Moderator password not changed: ${changed.text}`);
    }
    return { id: created.body.id as string, email, password: PASSWORD, client };
  }

  /** Waits until a check returns a value (used for the Stripe webhooks, which arrive later). */
  async eventually<T>(
    check: () => Promise<T | undefined | null | false>,
    what: string,
    timeoutMs = 60_000,
  ): Promise<T> {
    const started = Date.now();
    for (;;) {
      const result = await check();
      if (result) return result;
      if (Date.now() - started > timeoutMs) {
        throw new Error(`Timed out after ${timeoutMs} ms waiting for: ${what}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

function randomCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const pick = () => letters[Math.floor(Math.random() * letters.length)];
  return `${pick()}${pick()}${pick()}`;
}
