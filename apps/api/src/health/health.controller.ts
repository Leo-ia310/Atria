import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async status() {
    await this.prisma.$queryRaw`SELECT 1`;
    const redisStatus = await this.redis.getClient().ping();

    return {
      status: 'ok',
      services: {
        database: 'ok',
        redis: redisStatus.toLowerCase(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
