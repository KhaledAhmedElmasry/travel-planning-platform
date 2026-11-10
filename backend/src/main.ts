import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { globalValidationPipeOptions } from './common/pipes/validation.pipe';

// Swagger UI shows the hand-written API documentation in docs/api/openapi.yaml, one file for every
// endpoint. When you add or change an endpoint, update that file in the same pull request.
const OPENAPI_FILE = join(__dirname, '..', '..', 'docs', 'api', 'openapi.yaml');

async function bootstrap() {
  // rawBody: keeps the exact request bytes in req.rawBody, needed to verify the Stripe webhook
  // signature (PAY-01). JSON bodies are still parsed as usual.
  const app = await NestFactory.create(AppModule, { rawBody: true });

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

  // Milestone 2: enable CORS with credentials for the Next.js frontend here.

  const document = load(readFileSync(OPENAPI_FILE, 'utf8')) as OpenAPIObject;
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { docExpansion: 'none', filter: true },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(
    `API: http://localhost:${port}/api  |  Swagger: http://localhost:${port}/api/docs`,
  );
}
void bootstrap();
