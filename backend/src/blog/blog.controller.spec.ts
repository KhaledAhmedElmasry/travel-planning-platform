import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { Role } from '../common/enums';
import { globalValidationPipeOptions } from '../common/pipes/validation.pipe';
import { SessionsService } from '../auth/sessions.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';

describe('POST /api/posts (BLG-01)', () => {
  let app: INestApplication;
  const createPost = jest.fn();
  const authenticate = jest.fn();
  const authorId = '665f1c2a9b1e8a0012340001';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BlogController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        Reflector,
        { provide: SessionsService, useValue: { authenticate } },
        { provide: BlogService, useValue: { createPost } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe(globalValidationPipeOptions));
    await app.init();
  });

  beforeEach(() => {
    createPost.mockReset();
    authenticate.mockReset();
    createPost.mockResolvedValue({
      id: '665f1c2a9b1e8a0012345678',
      title: 'Three days in Cairo',
      body: 'We started at the Egyptian Museum.',
      author: { id: authorId, name: 'Alex Traveler' },
      status: 'draft',
      tags: [],
      hidden: false,
      likeCount: 0,
      commentCount: 0,
      createdAt: '2026-11-03T10:00:00.000Z',
      updatedAt: '2026-11-03T10:00:00.000Z',
    });
    authenticate.mockImplementation((token: string) =>
      token !== 'valid-session'
        ? Promise.reject(new UnauthorizedException('Session expired'))
        : Promise.resolve({
            id: authorId,
            role: Role.User,
            sessionId: '665f1c2a9b1e8a0012340099',
            airlineId: null,
            hotelId: null,
            mustChangePassword: false,
          }),
    );
  });

  afterAll(async () => app.close());

  const submit = (
    body: unknown,
    authenticated = true,
    token = 'valid-session',
  ) => {
    const server = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];
    const call = request(server).post('/api/posts').send(body);
    return authenticated ? call.set('Cookie', `access_token=${token}`) : call;
  };

  it('creates a draft and returns the documented response', async () => {
    const response = await submit({
      title: 'Three days in Cairo',
      body: 'We started at the Egyptian Museum.',
      status: 'draft',
    }).expect(201);

    expect(response.body).toMatchObject({
      author: { id: authorId, name: 'Alex Traveler' },
      status: 'draft',
      hidden: false,
      tags: [],
      likeCount: 0,
      commentCount: 0,
    });
    expect(createPost).toHaveBeenCalledWith(
      authorId,
      expect.objectContaining({
        title: 'Three days in Cairo',
        status: 'draft',
      }),
    );
  });

  it('creates a published post and normalizes optional tags', async () => {
    createPost.mockImplementation((_id: string, dto: CreatePostDto) =>
      Promise.resolve({
        id: '665f1c2a9b1e8a0012345678',
        title: dto.title,
        body: dto.body,
        author: { id: authorId, name: 'Alex Traveler' },
        status: dto.status,
        tags: dto.tags,
        hidden: false,
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    const response = await submit({
      title: 'Cairo',
      body: 'A travel story.',
      status: 'published',
      tags: [' Egypt ', 'CAIRO'],
    }).expect(201);

    const responseBody = response.body as { status: string; tags: string[] };
    expect(responseBody.status).toBe('published');
    expect(responseBody.tags).toEqual(['egypt', 'cairo']);
  });

  it.each([
    [{ body: 'Text', status: 'draft' }, 'title'],
    [{ title: 'Title', status: 'draft' }, 'body'],
    [{ title: '', body: 'Text', status: 'draft' }, 'title'],
    [{ title: '   ', body: 'Text', status: 'draft' }, 'title'],
    [{ title: 'Title', body: '', status: 'draft' }, 'body'],
    [{ title: 'Title', body: '   ', status: 'draft' }, 'body'],
    [{ title: 42, body: 'Text', status: 'draft' }, 'title'],
    [{ title: 'Title', body: false, status: 'draft' }, 'body'],
    [{ title: 'Title', body: 'Text', status: 'unlisted' }, 'status'],
    [{ title: 'Title', body: 'Text', status: 'draft', tags: 'egypt' }, 'tags'],
    [{ title: 'Title', body: 'Text', status: 'draft', tags: [''] }, 'tags'],
    [
      { title: 'Title', body: 'Text', status: 'draft', tags: ['a'.repeat(31)] },
      'tags',
    ],
    [
      {
        title: 'Title',
        body: 'Text',
        status: 'draft',
        tags: Array(6).fill('tag'),
      },
      'tags',
    ],
    [
      {
        title: 'Title',
        body: 'Text',
        status: 'draft',
        tags: ['Egypt', 'egypt'],
      },
      'tags',
    ],
  ])('rejects invalid input for %s', async (body, field) => {
    const response = await submit(body).expect(400);
    const responseBody = response.body as { fieldErrors: unknown[] };
    expect(responseBody.fieldErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    expect(createPost).not.toHaveBeenCalled();
  });

  it('accepts documented boundary lengths', async () => {
    await submit({
      title: 't'.repeat(200),
      body: 'b',
      status: 'published',
      tags: ['a'.repeat(30), 'tag2', 'tag3', 'tag4', 'tag5'],
    }).expect(201);
  });

  it('returns 401 without authentication or with an invalid session', async () => {
    await submit(
      { title: 'Title', body: 'Text', status: 'draft' },
      false,
    ).expect(401);
    await submit(
      { title: 'Title', body: 'Text', status: 'draft' },
      true,
      'expired-session',
    ).expect(401);
    expect(createPost).not.toHaveBeenCalled();
  });

  it('returns 403 to authenticated users with another role', async () => {
    authenticate.mockResolvedValueOnce({
      id: authorId,
      role: Role.Admin,
      sessionId: '665f1c2a9b1e8a0012340099',
      airlineId: null,
      hotelId: null,
      mustChangePassword: false,
    });
    await submit({ title: 'Title', body: 'Text', status: 'draft' }).expect(403);
    expect(createPost).not.toHaveBeenCalled();
  });

  it('ignores a client supplied author and uses the authenticated identity', async () => {
    await submit({
      title: 'Title',
      body: 'Text',
      status: 'draft',
      author: '665f1c2a9b1e8a0012349999',
    }).expect(201);

    expect(createPost).toHaveBeenCalledWith(
      authorId,
      expect.not.objectContaining({ author: '665f1c2a9b1e8a0012349999' }),
    );
  });
});
