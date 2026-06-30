import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReportProcessor } from './report.processor';
import { UploadProcessor } from './upload.processor';

/**
 * Carga BullMQ + procesadores solo si `QUEUES_ENABLED=true` en env.
 * En desarrollo sin Redis, el módulo queda vacío y los servicios que
 * encolan trabajos lo registran como no-op.
 */
@Global()
@Module({})
export class QueueModule {
  private static readonly logger = new Logger(QueueModule.name);

  static register(): DynamicModule {
    const enabled = process.env.QUEUES_ENABLED === 'true';
    if (!enabled) {
      QueueModule.logger.warn(
        'QUEUES_ENABLED=false — BullMQ desactivado (sin Redis).',
      );
      return { module: QueueModule, global: true };
    }

    return {
      module: QueueModule,
      global: true,
      imports: [
        ConfigModule,
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            connection: {
              url: configService.getOrThrow<string>('REDIS_URL'),
            },
          }),
        }),
        BullModule.registerQueue({ name: 'reports' }, { name: 'uploads' }),
      ],
      providers: [ReportProcessor, UploadProcessor],
      exports: [BullModule],
    };
  }
}
