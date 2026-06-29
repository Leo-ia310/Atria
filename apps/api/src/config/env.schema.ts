import { z } from 'zod';

const booleanSchema = z
  .string()
  .optional()
  .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  COOKIE_DOMAIN: z.string().default('localhost'),
  SECURE_COOKIES: booleanSchema.default(false),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default('no-reply@atria.local'),
  UPLOAD_MAX_BYTES: z.coerce.number().default(10 * 1024 * 1024),
  REPORT_EXPORT_PATH: z.string().default('./exports'),
});

export type AppEnv = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>): AppEnv => {
  return envSchema.parse(config);
};
