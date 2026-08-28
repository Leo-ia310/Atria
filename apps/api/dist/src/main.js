"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const global_exception_filter_1 = require("./common/filters/global-exception.filter");
const sanitize_input_pipe_1 = require("./common/pipes/sanitize-input.pipe");
const logger_service_1 = require("./infrastructure/logger/logger.service");
const hasTrustProxySetter = (value) => typeof value === 'object' &&
    value !== null &&
    'set' in value &&
    typeof value.set === 'function';
let DisabledApiModule = class DisabledApiModule {
};
DisabledApiModule = __decorate([
    (0, common_1.Module)({})
], DisabledApiModule);
const isApiEnabled = () => {
    if (process.env.API_ENABLED) {
        return process.env.API_ENABLED === 'true';
    }
    return process.env.NODE_ENV === 'production';
};
async function bootstrapDisabledApi() {
    const app = await core_1.NestFactory.create(DisabledApiModule, {
        bufferLogs: true,
    });
    const logger = new common_1.Logger('Bootstrap');
    const port = Number(process.env.PORT ?? 4000);
    app.use((_request, response) => {
        response.status(503).json({
            statusCode: 503,
            error: 'Service Unavailable',
            message: 'API deshabilitada en este entorno de desarrollo. Activa API_ENABLED=true para habilitarla.',
        });
    });
    await app.listen(port);
    logger.warn(`API deshabilitada en este entorno. Todas las solicitudes responderan 503 en el puerto ${port}.`);
}
async function bootstrapEnabledApi() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bufferLogs: true,
    });
    const logger = app.get(logger_service_1.StructuredLoggerService);
    app.useLogger(logger);
    const expressApp = app.getHttpAdapter().getInstance();
    if (hasTrustProxySetter(expressApp)) {
        expressApp.set('trust proxy', 1);
    }
    app.use((0, cookie_parser_1.default)());
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    }));
    app.enableCors({
        origin: (process.env.CORS_ORIGINS ?? '').split(','),
        credentials: true,
    });
    app.setGlobalPrefix('api');
    app.enableVersioning({
        type: common_1.VersioningType.URI,
        defaultVersion: '1',
    });
    app.useGlobalPipes(new sanitize_input_pipe_1.SanitizeInputPipe(), new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new global_exception_filter_1.GlobalExceptionFilter(logger));
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('Atria API')
        .setDescription(`API multi-tenant para ERP, POS e inventario.\n\n` +
        `**Cómo probar desde Swagger UI:**\n` +
        `1. Llama \`POST /auth/login\` con email + password.\n` +
        `2. Las cookies (atria_access, atria_refresh, atria_csrf) se setean en el navegador automáticamente.\n` +
        `3. Para mutaciones (POST/PUT/PATCH/DELETE) tienes que pasar el CSRF: clic en **Authorize** arriba a la derecha y pega el valor de \`csrfToken\` que devolvió el login en el campo \`x-csrf-token\`.\n` +
        `4. Las cookies se envían automáticamente (\`withCredentials: true\`).`)
        .setVersion('1.0.0')
        .addCookieAuth('atria_access', {
        type: 'apiKey',
        in: 'cookie',
        name: 'atria_access',
        description: 'JWT de acceso. Se setea automáticamente al hacer login.',
    })
        .addApiKey({
        type: 'apiKey',
        in: 'header',
        name: 'x-csrf-token',
        description: 'Token CSRF. Copialo del campo `csrfToken` que devuelve `/auth/login`. Obligatorio en POST/PUT/PATCH/DELETE.',
    }, 'csrf')
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
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('api/docs', app, document, {
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
//# sourceMappingURL=main.js.map