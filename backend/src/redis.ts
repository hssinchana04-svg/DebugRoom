import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

class MockRedis {
  private store: Map<string, Map<string, string>> = new Map();

  async hSet(key: string, field: string, value: string): Promise<number> {
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    this.store.get(key)!.set(field, value);
    return 1;
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    return this.store.get(key)?.get(field);
  }

  async hDel(key: string, field: string): Promise<number> {
    const map = this.store.get(key);
    if (map) {
      const deleted = map.delete(field);
      return deleted ? 1 : 0;
    }
    return 0;
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    const map = this.store.get(key);
    const result: Record<string, string> = {};
    if (map) {
      map.forEach((val, k) => {
        result[k] = val;
      });
    }
    return result;
  }
}

let activeClient: any;
let isMock = false;

const realClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries >= 1) { // Fallback quickly for smooth developer UX
        if (!isMock) {
          console.warn('[Redis] Real server unreachable. Switching to in-memory Mock Redis fallback.');
          isMock = true;
          activeClient = new MockRedis();
        }
        return false; // Stop trying to reconnect
      }
      return 500;
    }
  }
});

realClient.on('error', (err) => {
  if (!isMock) {
    console.warn('[Redis] Connection issue:', err.message);
  }
});

activeClient = realClient;

// Attempt real connection
realClient.connect()
  .then(() => {
    if (!isMock) {
      console.log('[Redis] Connected to real Redis server successfully.');
    }
  })
  .catch(() => {
    if (!isMock) {
      console.warn('[Redis] Failed to connect to Redis. Switched to Mock Redis.');
      isMock = true;
      activeClient = new MockRedis();
    }
  });

export default {
  hSet: async (key: string, field: string, value: string) => {
    return activeClient.hSet(key, field, value);
  },
  hGet: async (key: string, field: string) => {
    return activeClient.hGet(key, field);
  },
  hDel: async (key: string, field: string) => {
    return activeClient.hDel(key, field);
  },
  hGetAll: async (key: string) => {
    return activeClient.hGetAll(key);
  }
};
