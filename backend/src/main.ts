import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // TODO: register app-wide setup here as it is built, for example:
  //   - cookie parsing for the httpOnly auth cookies (ACC-19)
  //   - the global validation pipe and exception filter (GEN-02, GEN-13, PDF section 6.7)
  //   - CORS with credentials for the Next.js frontend (Milestone 2)
  //   - the raw request body needed to verify Stripe webhooks (PAY-01)
  //   - serving uploaded images (GEN-08)

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Travel Planning & Booking Platform API')
    .setDescription('Software Project I — Milestone 1')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(
    `API: http://localhost:${port}/api  |  Swagger: http://localhost:${port}/api/docs`,
  );
}
void bootstrap();
