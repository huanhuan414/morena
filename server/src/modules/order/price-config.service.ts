import { Injectable, Logger } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

export interface ContentTypePrice {
  id: string
  label: string
  icon: string
  basePrice: number
  contentPrice: number
  desc: string
  output: string
}

export interface PriceCalculation {
  base: number
  content: number
  total: number
}

@Injectable()
export class PriceConfigService {
  private readonly logger = new Logger(PriceConfigService.name)
  private cache: Map<string, ContentTypePrice> = new Map()
  private cacheTime: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000

  async getAllPriceConfigs(): Promise<ContentTypePrice[]> {
    if (Date.now() - this.cacheTime < this.CACHE_TTL && this.cache.size > 0) {
      return Array.from(this.cache.values())
    }

    try {
      const db = getMySQLClient()
      const rows = await db.query(
        `SELECT id, content_type, name, icon, base_price, content_price, description, output_unit, sort_order
         FROM content_type_prices
         WHERE is_active = TRUE
         ORDER BY sort_order ASC`
      )

      this.cache.clear()
      for (const row of rows as any[]) {
        this.cache.set(row.content_type, {
          id: row.content_type,
          label: row.name,
          icon: row.icon || '',
          basePrice: Number(row.base_price),
          contentPrice: Number(row.content_price),
          desc: row.description || '',
          output: row.output_unit || '',
        })
      }
      this.cacheTime = Date.now()

      this.logger.log(`[价格配置] 已加载 ${this.cache.size} 个内容类型价格`)
      return Array.from(this.cache.values())
    } catch (error: any) {
      this.logger.error(`[价格配置] 加载失败: ${error.message}，使用默认配置`)
      const defaults = this.getDefaultPriceConfigs()
      this.cache.clear()
      for (const config of defaults) {
        this.cache.set(config.id, config)
      }
      this.cacheTime = Date.now()
      return defaults
    }
  }

  async getPriceConfig(contentType: string): Promise<ContentTypePrice | undefined> {
    if (Date.now() - this.cacheTime >= this.CACHE_TTL || this.cache.size === 0) {
      await this.getAllPriceConfigs()
    }
    
    let key = contentType
    if (contentType === 'simple_task') {
      key = 'simple'
    }
    
    return this.cache.get(key)
  }

  async calculatePrice(
    contentType: string,
    avatarCount: number,
    quantityPerAvatar: number
  ): Promise<PriceCalculation> {
    const config = await this.getPriceConfig(contentType)
    if (!config) {
      this.logger.warn(`[价格计算] 未知内容类型: ${contentType}, 使用默认价格`)
      const defaultConfig = this.getDefaultPriceConfig(contentType)
      const base = defaultConfig.basePrice * avatarCount
      const content = defaultConfig.contentPrice * quantityPerAvatar * avatarCount
      return { base, content, total: base + content }
    }

    const base = config.basePrice * avatarCount
    const content = config.contentPrice * quantityPerAvatar * avatarCount
    const total = base + content

    this.logger.log(
      `[价格计算] contentType=${contentType}, avatarCount=${avatarCount}, quantityPerAvatar=${quantityPerAvatar}, base=${base}, content=${content}, total=${total}`
    )

    return { base, content, total }
  }

  async validatePrice(
    contentType: string,
    avatarCount: number,
    quantityPerAvatar: number,
    expectedBase: number,
    expectedContent: number
  ): Promise<{ valid: boolean; actual: PriceCalculation }> {
    const actual = await this.calculatePrice(contentType, avatarCount, quantityPerAvatar)

    const valid =
      Math.abs(actual.base - expectedBase) < 0.01 &&
      Math.abs(actual.content - expectedContent) < 0.01

    if (!valid) {
      this.logger.warn(
        `[价格校验] 不匹配: contentType=${contentType}, expected={base:${expectedBase}, content:${expectedContent}}, actual={base:${actual.base}, content:${actual.content}}`
      )
    }

    return { valid, actual }
  }

  private getDefaultPriceConfigs(): ContentTypePrice[] {
    return [
      { id: 'simple', label: '简单任务', icon: '✅', basePrice: 0.5, contentPrice: 0, desc: '关注/点赞/转发等', output: '个任务' },
      { id: 'text', label: '纯文案', icon: '📝', basePrice: 2, contentPrice: 0, desc: '文字内容创作', output: '篇原创文案' },
      { id: 'image', label: '图文笔记', icon: '🖼️', basePrice: 3, contentPrice: 1, desc: '图文搭配呈现', output: '篇图文笔记' },
      { id: 'video', label: '短视频', icon: '🎬', basePrice: 5, contentPrice: 20, desc: 'AI生成真实视频', output: '条短视频' },
    ]
  }

  private getDefaultPriceConfig(contentType: string): ContentTypePrice {
    const defaults = this.getDefaultPriceConfigs()
    let key = contentType
    if (contentType === 'simple_task') {
      key = 'simple'
    }
    return defaults.find(c => c.id === key) || defaults[1]
  }
}
