import { Module } from '@nestjs/common';
import { MenuFeatureController } from './menu-feature.controller';
import { MenuFeatureService } from './menu-feature.service';

@Module({
  controllers: [MenuFeatureController],
  providers: [MenuFeatureService],
})
export class MenuFeatureModule {}
