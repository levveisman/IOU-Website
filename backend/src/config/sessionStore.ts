import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

export async function disconnectSessionStore(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Build express-session options with a Redis store when REDIS_URL is set.
 * Falls back to the default in-memory store in development only.
 */
export async function buildSessionOptions(
  secret: string,
  isProd: boolean,
  cookieSecure: boolean
): Promise<session.SessionOptions> {
  const base: session.SessionOptions = {
    secret,
    resave: false,
    saveUninitialized: false,
    proxy: isProd,
    cookie: {
      secure: cookieSecure,
      httpOnly: true,
      maxAge: undefined,
      sameSite: 'lax',
    },
  };

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    if (isProd) {
      throw new Error('REDIS_URL is required in production for persistent sessions');
    }
    console.warn('Session store: in-memory (set REDIS_URL for persistent sessions)');
    return base;
  }

  redisClient = createClient({ url: redisUrl });
  redisClient.on('error', (err: Error) => {
    console.error('Redis session client error:', err);
  });
  await redisClient.connect();

  const store = new RedisStore({
    client: redisClient,
    prefix: 'iou:sess:',
  });

  console.log('Session store: Redis');
  return { ...base, store };
}
