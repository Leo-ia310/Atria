"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = exports.envSchema = void 0;
const zod_1 = require("zod");
const booleanSchema = zod_1.z
    .string()
    .optional()
    .transform((value) => value === 'true');
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: zod_1.z.coerce.number().default(4000),
    DATABASE_URL: zod_1.z.string().min(1),
    DIRECT_URL: zod_1.z.string().optional(),
    SUPABASE_URL: zod_1.z.string().url().optional(),
    SUPABASE_ANON_KEY: zod_1.z.string().optional(),
    REDIS_URL: zod_1.z.string().min(1),
    QUEUES_ENABLED: zod_1.z
        .string()
        .optional()
        .transform((value) => value === 'true'),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    ACCESS_TOKEN_TTL: zod_1.z.string().default('15m'),
    REFRESH_TOKEN_TTL: zod_1.z.string().default('30d'),
    APP_URL: zod_1.z.string().url(),
    API_URL: zod_1.z.string().url(),
    COOKIE_DOMAIN: zod_1.z.string().default('localhost'),
    SECURE_COOKIES: booleanSchema.default(false),
    CORS_ORIGINS: zod_1.z.string().default('http://localhost:3000'),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.coerce.number().optional(),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    SMTP_FROM: zod_1.z.string().email().default('no-reply@atria.local'),
    RESEND_API_KEY: zod_1.z.string().optional(),
    RESEND_FROM: zod_1.z.string().email().optional(),
    UPLOAD_MAX_BYTES: zod_1.z.coerce.number().default(10 * 1024 * 1024),
    REPORT_EXPORT_PATH: zod_1.z.string().default('./exports'),
});
const validateEnv = (config) => {
    return exports.envSchema.parse(config);
};
exports.validateEnv = validateEnv;
//# sourceMappingURL=env.schema.js.map