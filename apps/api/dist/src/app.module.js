"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const jwt_1 = require("@nestjs/jwt");
const throttler_1 = require("@nestjs/throttler");
const audit_module_1 = require("./audit/audit.module");
const accounting_module_1 = require("./accounting/accounting.module");
const auth_module_1 = require("./auth/auth.module");
const billing_module_1 = require("./billing/billing.module");
const branches_module_1 = require("./branches/branches.module");
const access_token_guard_1 = require("./common/guards/access-token.guard");
const csrf_guard_1 = require("./common/guards/csrf.guard");
const permissions_guard_1 = require("./common/guards/permissions.guard");
const audit_interceptor_1 = require("./common/interceptors/audit.interceptor");
const request_context_middleware_1 = require("./common/middleware/request-context.middleware");
const env_schema_1 = require("./config/env.schema");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const employees_module_1 = require("./employees/employees.module");
const health_module_1 = require("./health/health.module");
const logger_module_1 = require("./infrastructure/logger/logger.module");
const prisma_module_1 = require("./infrastructure/prisma/prisma.module");
const queue_module_1 = require("./infrastructure/queue/queue.module");
const redis_module_1 = require("./infrastructure/redis/redis.module");
const inventory_module_1 = require("./inventory/inventory.module");
const mailer_module_1 = require("./mailer/mailer.module");
const notifications_module_1 = require("./notifications/notifications.module");
const onboarding_module_1 = require("./onboarding/onboarding.module");
const pos_module_1 = require("./pos/pos.module");
const purchases_module_1 = require("./purchases/purchases.module");
const realtime_module_1 = require("./realtime/realtime.module");
const reports_module_1 = require("./reports/reports.module");
const sales_module_1 = require("./sales/sales.module");
const settings_module_1 = require("./settings/settings.module");
const uploads_module_1 = require("./uploads/uploads.module");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(request_context_middleware_1.RequestContextMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                cache: true,
                validate: env_schema_1.validateEnv,
            }),
            jwt_1.JwtModule.register({ global: true }),
            event_emitter_1.EventEmitterModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60_000,
                    limit: 180,
                },
            ]),
            bullmq_1.BullModule,
            logger_module_1.LoggerModule,
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            queue_module_1.QueueModule.register(),
            audit_module_1.AuditModule,
            mailer_module_1.MailerModule,
            auth_module_1.AuthModule,
            health_module_1.HealthModule,
            dashboard_module_1.DashboardModule,
            notifications_module_1.NotificationsModule,
            onboarding_module_1.OnboardingModule,
            branches_module_1.BranchesModule,
            inventory_module_1.InventoryModule,
            pos_module_1.PosModule,
            purchases_module_1.PurchasesModule,
            sales_module_1.SalesModule,
            accounting_module_1.AccountingModule,
            employees_module_1.EmployeesModule,
            reports_module_1.ReportsModule,
            settings_module_1.SettingsModule,
            billing_module_1.BillingModule,
            uploads_module_1.UploadsModule,
            realtime_module_1.RealtimeModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_GUARD, useClass: access_token_guard_1.AccessTokenGuard },
            { provide: core_1.APP_GUARD, useClass: csrf_guard_1.CsrfGuard },
            { provide: core_1.APP_GUARD, useClass: permissions_guard_1.PermissionsGuard },
            { provide: core_1.APP_INTERCEPTOR, useClass: audit_interceptor_1.AuditInterceptor },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map