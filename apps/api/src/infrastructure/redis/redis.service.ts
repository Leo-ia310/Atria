import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cliente Redis tolerante a fallos. En desarrollo, si Redis no está disponible,
 * la API arranca igual: los features que dependen de Redis (BullMQ queues,
 * cache) degradan a no-op silencioso.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private connected = false;

  constructor(configService: ConfigService) {
    const url =
      configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.client = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });

    this.client.on('connect', () => {
      this.connected = true;
      this.logger.log('Redis conectado');
    });
    this.client.on('error', (err) => {
      if (this.connected) {
        this.logger.warn(`Redis desconectado: ${err.message}`);
      }
      this.connected = false;
    });
    this.client.on('end', () => {
      this.connected = false;
    });

    this.client.connect().catch(() => {
      this.logger.warn(
        `Redis no disponible en ${url} — features async (queues, cache) deshabilitados.`,
      );
    });
  }

  getClient(): Redis {
    return this.client;
  }

  isAvailable(): boolean {
    return this.connected;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
