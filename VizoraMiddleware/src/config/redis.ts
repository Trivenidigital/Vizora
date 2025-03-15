import Redis from 'ioredis';

export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

export const REDIS_KEYS = {
  displays: 'vizora:displays',
  pairingCodes: 'vizora:pairing-codes',
  controllers: 'vizora:controllers',
  displayControllers: 'vizora:display-controllers',
};

export const EXPIRATION = {
  display: 60 * 60, // 1 hour
  pairingCode: 5 * 60, // 5 minutes
  controller: 24 * 60 * 60, // 24 hours
};

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis(REDIS_CONFIG);
    
    redisClient.on('error', (error) => {
      console.error('Redis Client Error:', error);
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });
  }
  return redisClient;
}; 