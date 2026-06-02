import { Controller, Get } from '@nestjs/common'
import { PriceConfigService } from './price-config.service'

@Controller('order')
export class PriceConfigController {
  constructor(private readonly priceConfigService: PriceConfigService) {}

  @Get('price-config')
  async getPriceConfig() {
    const configs = await this.priceConfigService.getAllPriceConfigs()
    return {
      code: 200,
      data: configs,
      message: '获取成功'
    }
  }
}
