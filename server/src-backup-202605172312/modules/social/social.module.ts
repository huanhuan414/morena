// @ts-nocheck
import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  controllers: [SocialController],
  providers: [
    SocialService,
    {
      provide: 'SOCIAL_SERVICE',
      useClass: SocialService
    }
  ]
})
export class SocialModule {}
