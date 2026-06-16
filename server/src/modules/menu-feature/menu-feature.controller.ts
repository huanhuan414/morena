import { Controller, Get } from '@nestjs/common';
import { MenuFeatureService } from './menu-feature.service';

@Controller('menu-feature')
export class MenuFeatureController {
  constructor(private readonly menuFeatureService: MenuFeatureService) {}

  @Get('enabled')
  async getEnabledMenuKeys() {
    const keys = await this.menuFeatureService.getEnabledMenuKeys();
    return { code: 200, message: 'success', data: keys };
  }
}