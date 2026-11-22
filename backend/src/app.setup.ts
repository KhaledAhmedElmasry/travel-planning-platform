import { INestApplication, ValidationPipe } from '@nestjs/common';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { globalValidationPipeOptions } from './common/pipes/validation.pipe';

// Swagger UI shows the hand-written API documentation in docs/api/openapi.yaml, one file for every
// endpoint. When you add or change an endpoint, update that file in the same pull request.
export const OPENAPI_FILE = join(
  __dirname,
  '..',
  '..',
  'docs',
  'api',
  'openapi.yaml',
);

// Everything the HTTP application needs besides the modules: the /api prefix, cookies, uploaded
// files, validation, the error format and Swagger UI. main.ts calls it for the real server and the
// system tests (backend/test) call it too, so both run exactly the same application.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  // Reads the httpOnly auth cookies (access_token, refresh_token) into req.cookies (ACC-19).
  app.use(cookieParser());
  // GEN-08: uploaded images are served by URL at /uploads/...
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // GEN-02: Global validation pipe — validates every @Body() and @Query() using
  // class-validator decorators on DTOs. Strips unknown fields (whitelist) and
  // returns field-level error messages in the standard Error format.
  app.useGlobalPipes(new ValidationPipe(globalValidationPipeOptions));

  // GEN-02, GEN-13: Global exception filter — catches every HttpException (and
  // unexpected errors) and returns the consistent Error envelope defined in
  // docs/api/openapi.yaml (statusCode, error, message, fieldErrors?, path, timestamp).
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // No CORS: the Next.js frontend forwards /api and /uploads to this server (frontend/next.config.ts),
  // so the browser only ever talks to one origin and the SameSite=Strict cookies just work.

  const document = load(readFileSync(OPENAPI_FILE, 'utf8')) as OpenAPIObject;
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { docExpansion: 'none', filter: true },
  });
}
