import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;

export function getRedis(): RedisClientType | null {
  return client;
}

export async function connectRedis(): Promise<RedisClientType | null> {
  const uri = process.env.REDIS_URL;
  if (!uri || uri.trim() === '') {
    console.log('Redis skipped (REDIS_URL not set)');
    return null;
  }

  if (client) {
    return client;
  }

  try {
    client = createClient({ url: uri });
    await client.connect();
    console.log('Redis connected successfully');
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    client = null;
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.disconnect();
    client = null;
    console.log('Redis disconnected successfully');
  }
}
