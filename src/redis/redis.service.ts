import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService {
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      url: this.config.get<string>('UPSTASH_REDIS_REST_URL')!,
      token: this.config.get<string>('UPSTASH_REDIS_REST_TOKEN')!,
    });
  }

  /** 设置键值对，带 TTL（秒） */
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { ex: ttlSeconds });
  }

  /** 获取键值 */
  async get(key: string): Promise<string | null> {
    return this.client.get<string>(key);
  }

  /** 删除键 */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** 检查键是否存在 */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }
}
