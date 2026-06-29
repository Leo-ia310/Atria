import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
} from '@nestjs/common';

@Injectable({ scope: Scope.DEFAULT })
export class StructuredLoggerService implements NestLoggerService {
  private write(
    level: string,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }

  log(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  verbose(message: string, meta?: Record<string, unknown>): void {
    this.write('verbose', message, meta);
  }

  audit(message: string, meta?: Record<string, unknown>): void {
    this.write('audit', message, meta);
  }
}
