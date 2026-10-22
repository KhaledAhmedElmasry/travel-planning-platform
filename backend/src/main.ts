import { NestFactory } from '@nestjs/core';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';
import { AppModule } from './app.module';

// Swagger UI shows the hand-written API documentation in docs/api/openapi.yaml, one file for every
// endpoint. When you add or change an endpoint, update that file in the same pull request.
const OPENAPI_FILE = join(__dirname, '..', '..', 'docs', 'api', 'openapi.yaml');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // TODO: register app-wide setup here as it is built, for example:
  //   - cookie parsing for the httpOnly auth cookies (ACC-19)
  //   - the global validation pipe and exception filter (GEN-02, GEN-13, PDF section 6.7)
  //   - CORS with credentials for the Next.js frontend (Milestone 2)
  //   - the raw request body needed to verify Stripe webhooks (PAY-01)
  //   - serving uploaded images (GEN-08)

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
