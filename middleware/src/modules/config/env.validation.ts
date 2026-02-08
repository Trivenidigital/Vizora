import { z } from 'zod';

export const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // API Configuration
  API_PORT: z.coerce.number().default(3000),
  
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
