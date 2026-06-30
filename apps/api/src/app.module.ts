import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from '@/audit/audit.module';
import { AccountingModule } from '@/accounting/accounting.module';
import { AuthModule } from '@/auth/auth.module';
import { BillingModule } from '@/billing/billing.module';
import { BranchesModule } from '@/branches/branches.module';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { CsrfGuard } from '@/common/guards/csrf.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { AuditInterceptor } from '@/common/interceptors/audit.interceptor';
import { RequestContextMiddleware } from '@/common/middleware/request-context.middleware';
import { validateEnv } from '@/config/env.schema';
import { DashboardModule } from '@/dashboard/dashboard.module';
import { EmployeesModule } from '@/employees/employees.module';
import { HealthModule } from '@/health/health.module';
import { LoggerModule } from '@/infrastructure/logger/logger.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { QueueModule } from '@/infrastructure/queue/queue.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';
import { InventoryModule } from '@/inventory/inventory.module';
import { MailerModule } from '@/mailer/mailer.module';
import { OnboardingModule } from '@/onboarding/onboarding.module';
import { PosModule } from '@/pos/pos.module';
import { PurchasesModule } from '@/purchases/purchases.module';
import { RealtimeModule } from '@/realtime/realtime.module';
import { ReportsModule } from '@/reports/reports.module';
import { SalesModule } from '@/sales/sales.module';
import { SettingsModule } from '@/settings/settings.module';
import { UploadsModule } from '@/uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    JwtModule.register({ global: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 180,
      },
    ]),
    BullModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    QueueModule.register(),
    AuditModule,
    MailerModule,
    AuthModule,
    HealthModule,
    DashboardModule,
    OnboardingModule,
    BranchesModule,
    InventoryModule,
    PosModule,
    PurchasesModule,
    SalesModule,
    AccountingModule,
    EmployeesModule,
    ReportsModule,
    SettingsModule,
    BillingModule,
    UploadsModule,
    RealtimeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
