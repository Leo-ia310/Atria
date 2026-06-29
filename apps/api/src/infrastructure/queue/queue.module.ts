import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReportProcessor } from './report.processor';
import { UploadProcessor } from './upload.processor';

@Global()
@Module({
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
})
export class QueueModule {}
