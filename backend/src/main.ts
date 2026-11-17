import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  // rawBody: keeps the exact request bytes in req.rawBody, needed to verify the Stripe webhook
  // signature (PAY-01). JSON bodies are still parsed as usual.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Prefix, cookies, uploads, validation, error format and Swagger UI (see app.setup.ts).
  configureApp(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(
    `API: http://localhost:${port}/api  |  Swagger: http://localhost:${port}/api/docs`,
  );
}
void bootstrap();
