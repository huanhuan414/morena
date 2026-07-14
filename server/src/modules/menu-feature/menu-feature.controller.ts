import { Controller, Get, Query } from '@nestjs/common';
import { MenuFeatureService } from './menu-feature.service';

@Controller('menu-feature')
export class MenuFeatureController {
  constructor(private readonly menuFeatureService: MenuFeatureService) {}

  @Get('enabled')
  async getEnabledMenuKeys(
    @Query('version') version?: string,
    @Query('envVersion') envVersion?: string,
  ) {
    const keys = await this.menuFeatureService.getEnabledMenuKeys(version, envVersion);
    return { code: 200, message: 'success', data: keys };
  }
}