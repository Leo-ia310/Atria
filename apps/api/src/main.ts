import { Logger, Module, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import { SanitizeInputPipe } from '@/common/pipes/sanitize-input.pipe';
import { StructuredLoggerService } from '@/infrastructure/logger/logger.service';

const hasTrustProxySetter = (
  value: unknown,
): value is { set: (name: string, enabled: number) => void } =>
  typeof value === 'object' &&
  value !== null &&
  'set' in value &&
  typeof value.set === 'function';

@Module({})
class DisabledApiModule {}

const isApiEnabled = (): boolean => {
  if (process.env.API_ENABLED) {
    return process.env.API_ENABLED === 'true';
  }

  return process.env.NODE_ENV === 'production';
};

async function bootstrapDisabledApi() {
  const app = await NestFactory.create(DisabledApiModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT ?? 4000);

  app.use((_request: Request, response: Response) => {
    response.status(503).json({
      statusCode: 503,
      error: 'Service Unavailable',
      message:
        'API deshabilitada en este entorno de desarrollo. Activa API_ENABLED=true para habilitarla.',
    });
  });

  await app.listen(port);
  logger.warn(
    `API deshabilitada en este entorno. Todas las solicitudes responderan 503 en el puerto ${port}.`,
  );
}

async function bootstrapEnabledApi() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(StructuredLoggerService);

  app.useLogger(logger);
  const expressApp: unknown = app.getHttpAdapter().getInstance();
  if (hasTrustProxySetter(expressApp)) {
    expressApp.set('trust proxy', 1);
  }
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '').split(','),
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new SanitizeInputPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Atria API')
    .setDescription('API multi-tenant para ERP, POS e inventario.')
    .setVersion('1.0.0')
    .addCookieAuth('atria_access')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  logger.log('API listening', { port });
}

void (isApiEnabled() ? bootstrapEnabledApi() : bootstrapDisabledApi());
