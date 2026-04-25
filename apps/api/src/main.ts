import './instrumentation'; // OTel must be imported first
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { logger } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // use Pino via middleware instead
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env['APP_URL'] ?? 'http://localhost:3001',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Lumora API')
    .setDescription('Tanzania School Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = parseInt(process.env['PORT'] ?? '3000', 10);
  await app.listen(port);
  logger.info({ port }, 'Lumora API started');
}

void bootstrap();
