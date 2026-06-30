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
    .setDescription(
      `API multi-tenant para ERP, POS e inventario.\n\n` +
        `**Cómo probar desde Swagger UI:**\n` +
        `1. Llama \`POST /auth/login\` con email + password.\n` +
        `2. Las cookies (atria_access, atria_refresh, atria_csrf) se setean en el navegador automáticamente.\n` +
        `3. Para mutaciones (POST/PUT/PATCH/DELETE) tienes que pasar el CSRF: clic en **Authorize** arriba a la derecha y pega el valor de \`csrfToken\` que devolvió el login en el campo \`x-atria-csrf\`.\n` +
        `4. Las cookies se envían automáticamente (\`withCredentials: true\`).`,
    )
    .setVersion('1.0.0')
    .addCookieAuth('atria_access', {
      type: 'apiKey',
      in: 'cookie',
      name: 'atria_access',
      description: 'JWT de acceso. Se setea automáticamente al hacer login.',
    })
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-atria-csrf',
        description:
          'Token CSRF. Copialo del campo `csrfToken` que devuelve `/auth/login`. Obligatorio en POST/PUT/PATCH/DELETE.',
      },
      'csrf',
    )
    .addTag('Autenticación', 'Registro, login, refresh, logout')
    .addTag('Dashboard', 'KPIs y resumen operativo')
    .addTag('Onboarding', 'Wizard inicial post-registro')
    .addTag('Sucursales')
    .addTag('Inventario')
    .addTag('POS', 'Catálogo y checkout')
    .addTag('Ventas')
    .addTag('Compras')
    .addTag('Contabilidad')
    .addTag('Empleados')
    .addTag('Reportes')
    .addTag('Configuración')
    .addTag('Billing', 'Suscripción SaaS')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
      tryItOutEnabled: true,
      displayRequestDuration: true,
      filter: true,
    },
    customSiteTitle: 'Atria API · Swagger',
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  logger.log('API listening', { port });
}

void (isApiEnabled() ? bootstrapEnabledApi() : bootstrapDisabledApi());
