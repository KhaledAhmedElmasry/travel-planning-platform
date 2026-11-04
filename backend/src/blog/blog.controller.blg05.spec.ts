import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ACCESS_COOKIE } from '../auth/auth-cookies';
import { SessionsService } from '../auth/sessions.service';
import { Role } from '../common/enums';
import type { AuthUser } from '../common/interfaces';
import { globalValidationPipeOptions } from '../common/pipes/validation.pipe';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';

describe('BlogController BLG-05', () => {
  let app: INestApplication;
  let sessions: { authenticate: jest.Mock };
  let blogService: { createComment: jest.Mock };
  const authenticatedUser: AuthUser = {
    id: '665f1c2a9b1e8a0012345678',
    role: Role.User,
    sessionId: 'session-1',
    airlineId: null,
    hotelId: null,
    mustChangePassword: false,
  };

  function httpServer(): Server {
    // Nest currently types getHttpServer() as any although it returns an HTTP server.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return app.getHttpServer();
  }

  beforeAll(async () => {
    sessions = { authenticate: jest.fn().mockResolvedValue(authenticatedUser) };
    blogService = { createComment: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      controllers: [BlogController],
      providers: [
        { provide: BlogService, useValue: blogService },
        { provide: SessionsService, useValue: sessions },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe(globalValidationPipeOptions));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessions.authenticate.mockResolvedValue(authenticatedUser);
    blogService.createComment.mockResolvedValue(undefined);
  });

  afterAll(async () => app.close());

  it('requires authentication', async () => {
    await request(httpServer())
      .post('/api/posts/665f1c2a9b1e8a00123400a1/comments')
      .send({ text: 'A helpful comment' })
      .expect(401);
    expect(blogService.createComment).not.toHaveBeenCalled();
  });

  it('allows registered users and derives the author from the session', async () => {
    await request(httpServer())
      .post('/api/posts/665f1c2a9b1e8a00123400a1/comments')
      .set('Cookie', `${ACCESS_COOKIE}=valid-session`)
      .send({
        text: '  A helpful comment  ',
        author: '665f1c2a9b1e8a0012349999',
      })
      .expect(201)
      .expect((response) => expect(response.text).toBe(''));

    expect(blogService.createComment).toHaveBeenCalledWith(
      expect.anything(),
      authenticatedUser.id,
      { text: '  A helpful comment  ' },
    );
  });

  it('returns 403 when the authenticated account has a non-user role', async () => {
    sessions.authenticate.mockResolvedValue({
      ...authenticatedUser,
      role: Role.Admin,
    });

    await request(httpServer())
      .post('/api/posts/665f1c2a9b1e8a00123400a1/comments')
      .set('Cookie', `${ACCESS_COOKIE}=admin-session`)
      .send({ text: 'A helpful comment' })
      .expect(403);
    expect(blogService.createComment).not.toHaveBeenCalled();
  });

  it.each(['', '   '])(
    'rejects an empty or whitespace-only comment',
    async (text) => {
      await request(httpServer())
        .post('/api/posts/665f1c2a9b1e8a00123400a1/comments')
        .set('Cookie', `${ACCESS_COOKIE}=valid-session`)
        .send({ text })
        .expect(400);
      expect(blogService.createComment).not.toHaveBeenCalled();
    },
  );

  it('rejects a comment longer than 500 characters', async () => {
    await request(httpServer())
      .post('/api/posts/665f1c2a9b1e8a00123400a1/comments')
      .set('Cookie', `${ACCESS_COOKIE}=valid-session`)
      .send({ text: 'a'.repeat(501) })
      .expect(400);
  });

  it('rejects malformed post ids before calling the service', async () => {
    await request(httpServer())
      .post('/api/posts/not-an-object-id/comments')
      .set('Cookie', `${ACCESS_COOKIE}=valid-session`)
      .send({ text: 'A helpful comment' })
      .expect(400);
    expect(blogService.createComment).not.toHaveBeenCalled();
  });
});
