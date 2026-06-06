import { Controller, Get } from '@nestjs/common'
import { PriceConfigService } from './price-config.service'

@Controller('price-config')
export class PriceConfigController {
  constructor(private readonly priceConfigService: PriceConfigService) {}

  @Get()
  async getPriceConfig() {
    try {
      const configs = await this.priceConfigService.getAllPriceConfigs()
      return {
        code: 200,
        data: configs || [],
        message: '获取成功'
      }
    } catch (error) {
      this.priceConfigService['logger'].error('获取价格配置失败:', error.message, error.stack)
      return {
        code: 500,
        data: null,
        message: `获取价格配置失败: ${error.message}`
      }
    }
  }
}
