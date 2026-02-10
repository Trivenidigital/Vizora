import { envSchema, validateEnv } from './env.validation';

describe('envSchema', () => {
  const validEnv = {
    NODE_ENV: 'development',
    MIDDLEWARE_PORT: '3000',
    BCRYPT_ROUNDS: '12',
    CORS_ORIGIN: 'http://localhost:3001',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/vizora',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'a'.repeat(32),
    JWT_EXPIRES_IN: '7d',
    DEVICE_JWT_SECRET: 'b'.repeat(32),
    LOG_LEVEL: 'info',
  };

  describe('valid configurations', () => {
    it('should accept a fully valid env config', () => {
      const result = envSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
    });

    it('should accept postgres:// prefix for DATABASE_URL', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        DATABASE_URL: 'postgres://user:pass@localhost:5432/vizora',
      });
      expect(result.success).toBe(true);
    });

    it('should accept rediss:// prefix for REDIS_URL', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        REDIS_URL: 'rediss://localhost:6379',
      });
      expect(result.success).toBe(true);
    });

    it('should accept mongodb+srv:// prefix for MONGODB_URL', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        MONGODB_URL: 'mongodb+srv://user:pass@cluster.mongodb.net/db',
      });
      expect(result.success).toBe(true);
    });

    it('should accept mongodb:// prefix for MONGODB_URL', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        MONGODB_URL: 'mongodb://localhost:27017/vizora',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('defaults', () => {
    it('should default NODE_ENV to development', () => {
      const env = { ...validEnv };
      delete (env as any).NODE_ENV;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('development');
      }
    });

    it('should default MIDDLEWARE_PORT to 3000', () => {
      const env = { ...validEnv };
      delete (env as any).MIDDLEWARE_PORT;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.MIDDLEWARE_PORT).toBe(3000);
      }
    });

    it('should default BCRYPT_ROUNDS to 12', () => {
      const env = { ...validEnv };
      delete (env as any).BCRYPT_ROUNDS;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.BCRYPT_ROUNDS).toBe(12);
      }
    });

    it('should default CORS_ORIGIN to http://localhost:3001', () => {
      const env = { ...validEnv };
      delete (env as any).CORS_ORIGIN;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.CORS_ORIGIN).toBe('http://localhost:3001');
      }
    });

    it('should default JWT_EXPIRES_IN to 7d', () => {
      const env = { ...validEnv };
      delete (env as any).JWT_EXPIRES_IN;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.JWT_EXPIRES_IN).toBe('7d');
      }
    });

    it('should default LOG_LEVEL to info', () => {
      const env = { ...validEnv };
      delete (env as any).LOG_LEVEL;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.LOG_LEVEL).toBe('info');
      }
    });

    it('should default MINIO_PORT to 9000', () => {
      const result = envSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.MINIO_PORT).toBe(9000);
      }
    });

    it('should default MINIO_BUCKET to vizora-assets', () => {
      const result = envSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.MINIO_BUCKET).toBe('vizora-assets');
      }
    });

    it('should default MINIO_USE_SSL to false', () => {
      const result = envSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.MINIO_USE_SSL).toBe(false);
      }
    });
  });

  describe('NODE_ENV validation', () => {
    it('should accept production', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'production',
        MINIO_ACCESS_KEY: 'prod-key',
        MINIO_SECRET_KEY: 'prod-secret',
      });
      expect(result.success).toBe(true);
    });

    it('should accept test', () => {
      const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'test' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid NODE_ENV', () => {
      const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' });
      expect(result.success).toBe(false);
    });
  });

  describe('BCRYPT_ROUNDS validation', () => {
    it('should reject rounds below 10', () => {
      const result = envSchema.safeParse({ ...validEnv, BCRYPT_ROUNDS: '9' });
      expect(result.success).toBe(false);
    });

    it('should accept rounds of 10', () => {
      const result = envSchema.safeParse({ ...validEnv, BCRYPT_ROUNDS: '10' });
      expect(result.success).toBe(true);
    });

    it('should accept rounds of 15', () => {
      const result = envSchema.safeParse({ ...validEnv, BCRYPT_ROUNDS: '15' });
      expect(result.success).toBe(true);
    });

    it('should reject rounds above 15', () => {
      const result = envSchema.safeParse({ ...validEnv, BCRYPT_ROUNDS: '16' });
      expect(result.success).toBe(false);
    });
  });

  describe('DATABASE_URL validation', () => {
    it('should reject non-postgresql URLs', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        DATABASE_URL: 'mysql://user:pass@localhost:3306/vizora',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing DATABASE_URL', () => {
      const env = { ...validEnv };
      delete (env as any).DATABASE_URL;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(false);
    });
  });

  describe('REDIS_URL validation', () => {
    it('should reject non-redis URLs', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        REDIS_URL: 'http://localhost:6379',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('MONGODB_URL validation', () => {
    it('should allow MONGODB_URL to be optional', () => {
      const env = { ...validEnv };
      delete (env as any).MONGODB_URL;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(true);
    });

    it('should reject non-mongodb URLs', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        MONGODB_URL: 'http://localhost:27017',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('JWT_SECRET validation', () => {
    it('should reject JWT_SECRET shorter than 32 characters', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        JWT_SECRET: 'short',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.errors.map(e => e.message);
        expect(messages).toContain('JWT_SECRET must be at least 32 characters for security');
      }
    });

    it('should accept JWT_SECRET of exactly 32 characters', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        JWT_SECRET: 'a'.repeat(32),
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing JWT_SECRET', () => {
      const env = { ...validEnv };
      delete (env as any).JWT_SECRET;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(false);
    });
  });

  describe('DEVICE_JWT_SECRET validation', () => {
    it('should reject DEVICE_JWT_SECRET shorter than 32 characters', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        DEVICE_JWT_SECRET: 'short',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.errors.map(e => e.message);
        expect(messages).toContain('DEVICE_JWT_SECRET must be at least 32 characters for security');
      }
    });

    it('should reject missing DEVICE_JWT_SECRET', () => {
      const env = { ...validEnv };
      delete (env as any).DEVICE_JWT_SECRET;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(false);
    });
  });

  describe('LOG_LEVEL validation', () => {
    it.each(['debug', 'info', 'warn', 'error'])('should accept %s', (level) => {
      const result = envSchema.safeParse({ ...validEnv, LOG_LEVEL: level });
      expect(result.success).toBe(true);
    });

    it('should reject invalid log level', () => {
      const result = envSchema.safeParse({ ...validEnv, LOG_LEVEL: 'trace' });
      expect(result.success).toBe(false);
    });
  });

  describe('MINIO_USE_SSL coercion', () => {
    it('should coerce "true" to true', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        MINIO_USE_SSL: 'true',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.MINIO_USE_SSL).toBe(true);
      }
    });

    it('should coerce "false" to false', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        MINIO_USE_SSL: 'false',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.MINIO_USE_SSL).toBe(false);
      }
    });

    it('should coerce arbitrary string to false', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        MINIO_USE_SSL: 'yes',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.MINIO_USE_SSL).toBe(false);
      }
    });
  });

  describe('SENTRY_DSN validation', () => {
    it('should accept a valid Sentry DSN URL', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        SENTRY_DSN: 'https://abc123@sentry.io/123',
      });
      expect(result.success).toBe(true);
    });

    it('should allow SENTRY_DSN to be optional', () => {
      const env = { ...validEnv };
      delete (env as any).SENTRY_DSN;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(true);
    });

    it('should reject invalid SENTRY_DSN URL', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        SENTRY_DSN: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('production superRefine checks', () => {
    it('should reject minioadmin as MINIO_ACCESS_KEY in production', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'production',
        MINIO_ACCESS_KEY: 'minioadmin',
        MINIO_SECRET_KEY: 'prod-secret',
      });
      expect(result.success).toBe(false);
    });

    it('should reject minioadmin as MINIO_SECRET_KEY in production', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'production',
        MINIO_ACCESS_KEY: 'prod-key',
        MINIO_SECRET_KEY: 'minioadmin',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing MINIO_ACCESS_KEY in production', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'production',
        MINIO_SECRET_KEY: 'prod-secret',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing MINIO_SECRET_KEY in production', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'production',
        MINIO_ACCESS_KEY: 'prod-key',
      });
      expect(result.success).toBe(false);
    });

    it('should accept proper credentials in production', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'production',
        MINIO_ACCESS_KEY: 'prod-key',
        MINIO_SECRET_KEY: 'prod-secret',
      });
      expect(result.success).toBe(true);
    });

    it('should not enforce MinIO credentials in development', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'development',
        MINIO_ACCESS_KEY: 'minioadmin',
        MINIO_SECRET_KEY: 'minioadmin',
      });
      expect(result.success).toBe(true);
    });

    it('should not enforce MinIO credentials in test', () => {
      const result = envSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'test',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('validateEnv', () => {
  const validEnv = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/vizora',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'a'.repeat(32),
    DEVICE_JWT_SECRET: 'b'.repeat(32),
  };

  it('should return validated config for valid env', () => {
    const result = validateEnv(validEnv);
    expect(result.NODE_ENV).toBe('development');
    expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/vizora');
  });

  it('should throw descriptive error for invalid env', () => {
    expect(() => validateEnv({})).toThrow('Environment validation failed');
  });

  it('should list individual errors in the error message', () => {
    try {
      validateEnv({});
      fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('DATABASE_URL');
      expect((error as Error).message).toContain('REDIS_URL');
      expect((error as Error).message).toContain('JWT_SECRET');
    }
  });

  it('should include help text in the error message', () => {
    try {
      validateEnv({});
      fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('Please check your .env file');
    }
  });
});
