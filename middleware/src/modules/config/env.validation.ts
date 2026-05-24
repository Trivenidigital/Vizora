import { z } from 'zod';

export const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // API Configuration
  MIDDLEWARE_PORT: z.coerce.number().default(3000),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(15).default(12),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  
  // Database
  DATABASE_URL: z.string().url().refine(
    (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
    { message: 'DATABASE_URL must be a valid PostgreSQL connection string' }
  ),
  
  // MongoDB
  MONGODB_URL: z.string().url().refine(
    (url) => url.startsWith('mongodb://') || url.startsWith('mongodb+srv://'),
    { message: 'MONGODB_URL must be a valid MongoDB connection string' }
  ).optional(),
  
  // Redis
  REDIS_URL: z.string().url().refine(
    (url) => url.startsWith('redis://') || url.startsWith('rediss://'),
    { message: 'REDIS_URL must be a valid Redis connection string' }
  ),
  
  // MinIO / S3
  MINIO_ENDPOINT: z.string().min(1).optional(),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().min(1).optional(),
  MINIO_SECRET_KEY: z.string().min(1).optional(),
  MINIO_BUCKET: z.string().min(1).default('vizora-assets'),
  MINIO_USE_SSL: z.string().transform((val) => val === 'true').default('false'),
  
  // Sentry (optional)
  SENTRY_DSN: z.string().url().optional(),

  // JWT Authentication
  JWT_SECRET: z.string().min(32, {
    message: 'JWT_SECRET must be at least 32 characters for security'
  }),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DEVICE_JWT_SECRET: z.string().min(32, {
    message: 'DEVICE_JWT_SECRET must be at least 32 characters for security',
  }),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Internal service-to-service auth (runner script, sidecar, ops scripts).
  // Required in production for the agent-platform-redesign /api/v1/internal/*
  // endpoints. Without this, ConfigService.get('INTERNAL_API_SECRET') returns
  // undefined (Zod strips unknown keys) → InternalSecretGuard fails closed
  // → every internal call returns 401.
  INTERNAL_API_SECRET: z.string().min(32, {
    message: 'INTERNAL_API_SECRET must be at least 32 characters for security',
  }).optional(),
  INTERNAL_API_LOOPBACK_ONLY: z.string().default('true'),
}).superRefine((data, ctx) => {
  // In production, MinIO credentials must be set and not be the default 'minioadmin'
  if (data.NODE_ENV === 'production') {
    if (!data.MINIO_ACCESS_KEY || data.MINIO_ACCESS_KEY === 'minioadmin') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MINIO_ACCESS_KEY must be set and not equal to "minioadmin" in production',
        path: ['MINIO_ACCESS_KEY'],
      });
    }
    if (!data.MINIO_SECRET_KEY || data.MINIO_SECRET_KEY === 'minioadmin') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MINIO_SECRET_KEY must be set and not equal to "minioadmin" in production',
        path: ['MINIO_SECRET_KEY'],
      });
    }
    // INTERNAL_API_SECRET is optional in the base schema (dev + test
    // don't require it for the ops scripts to spin up against an empty
    // env), but it is REQUIRED in production. Without it, every call
    // to /api/v1/internal/* — ops agents writing back state, the
    // realtime gateway pushing content, the in-process MCP audit
    // hooks — returns 401, and the failure mode is silent because
    // those calls fire-and-forget.
    if (!data.INTERNAL_API_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'INTERNAL_API_SECRET must be set in production (min 32 chars). ' +
          'Used for service-to-service auth between middleware, realtime, and ops scripts.',
        path: ['INTERNAL_API_SECRET'],
      });
    }
  }
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  
  if (!result.success) {
    const errors = result.error.errors.map(
      (err) => `  - ${err.path.join('.')}: ${err.message}`
    ).join('\n');
    
    throw new Error(
      `Environment validation failed:\n${errors}\n\n` +
      `Please check your .env file or environment variables.`
    );
  }
  
  return result.data;
}
