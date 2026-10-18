import Redis from 'ioredis';

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Increments a counter; the TTL is set when the counter is created. */
  incr(key: string, ttlSec: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

class MemoryKV implements KV {
  private map = new Map<string, { v: string; exp: number }>();

  private live(key: string) {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.exp < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return e;
  }
  async get(key: string) {
    return this.live(key)?.v ?? null;
  }
  async set(key: string, value: string, ttlSec: number) {
    this.map.set(key, { v: value, exp: Date.now() + ttlSec * 1000 });
  }
  async del(key: string) {
    this.map.delete(key);
  }
  async incr(key: string, ttlSec: number) {
    const e = this.live(key);
    const n = (e ? Number(e.v) : 0) + 1;
    this.map.set(key, { v: String(n), exp: e?.exp ?? Date.now() + ttlSec * 1000 });
    return n;
  }
  async ttl(key: string) {
    const e = this.live(key);
    return e ? Math.ceil((e.exp - Date.now()) / 1000) : -2;
  }
}

class RedisKV implements KV {
  constructor(private r: Redis) {}
  async get(key: string) {
    return this.r.get(key);
  }
  async set(key: string, value: string, ttlSec: number) {
    await this.r.set(key, value, 'EX', ttlSec);
  }
  async del(key: string) {
    await this.r.del(key);
  }
  async incr(key: string, ttlSec: number) {
    const n = await this.r.incr(key);
    if (n === 1) await this.r.expire(key, ttlSec);
    return n;
  }
  async ttl(key: string) {
    return this.r.ttl(key);
  }
}

const g = globalThis as unknown as { kv?: KV };

function create(): KV {
  if (process.env.REDIS_URL) return new RedisKV(new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2 }));
  if (process.env.NODE_ENV === 'production') {
    console.warn('[kv] REDIS_URL not set — using in-memory store; OTP and rate limits will not survive restarts or scale out.');
  }
  return new MemoryKV();
}

export const kv: KV = g.kv ?? (g.kv = create());
