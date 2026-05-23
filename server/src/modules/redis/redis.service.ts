import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common'
import Redis from 'ioredis'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private readonly client: Redis

  constructor() {
    const host = process.env.REDIS_HOST || '127.0.0.1'
    const port = parseInt(process.env.REDIS_PORT || '6379', 10)
    const password = process.env.REDIS_PASSWORD || undefined
    const db = parseInt(process.env.REDIS_DB || '0', 10)

    this.client = new Redis({
      host,
      port,
      password,
      db,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 3000)
        return delay
      },
      lazyConnect: true,
    })

    this.client.on('connect', () => {
      this.logger.log(`Redis connected: ${host}:${port}`)
    })

    this.client.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message}`)
    })
  }

  /**
   * 获取原生 Redis 客户端（用于复杂操作）
   */
  getClient(): Redis {
    return this.client
  }

  /**
   * 原子递增计数器，返回递增后的值
   * 用 INCR 实现原子计数，避免数据库行锁
   *
   * @param key Redis key
   * @param ttlSeconds 过期时间（秒），0表示不过期
   * @returns 递增后的计数值
   */
  async incr(key: string, ttlSeconds: number = 0): Promise<number> {
    const result = await this.client.incr(key)
    // 仅在第一次创建时设置TTL（result === 1 说明key刚创建）
    if (ttlSeconds > 0 && result === 1) {
      await this.client.expire(key, ttlSeconds)
    }
    return result
  }

  /**
   * 原子递减计数器，返回递减后的值
   */
  async decr(key: string): Promise<number> {
    return this.client.decr(key)
  }

  /**
   * 获取计数器当前值
   */
  async getCounter(key: string): Promise<number> {
    const val = await this.client.get(key)
    return parseInt(val || '0', 10)
  }

  /**
   * 设置key的TTL
   */
  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds)
  }

  /**
   * 删除key
   */
  async del(key: string): Promise<number> {
    return this.client.del(key)
  }

  /**
   * 删除匹配模式的所有key（慎用！仅删除指定前缀的key）
   */
  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(pattern)
    if (keys.length === 0) return 0
    return this.client.del(...keys)
  }

  /**
   * SET NX（仅当key不存在时设置）+ TTL
   * 用于分布式锁
   */
  async setNX(key: string, value: string, ttlMs: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'PX', ttlMs, 'NX')
    return result === 'OK'
  }

  /**
   * 释放分布式锁（仅当值匹配时删除）
   */
  async releaseLock(key: string, value: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `
    const result = await this.client.eval(script, 1, key, value)
    return result === 1
  }

  /**
   * 使用Lua脚本执行原子操作
   */
  async eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<any> {
    return this.client.eval(script, numKeys, ...args)
  }

  async onModuleDestroy() {
    try {
      await this.client.quit()
      this.logger.log('Redis connection closed')
    } catch {
      this.client.disconnect()
    }
  }
}
