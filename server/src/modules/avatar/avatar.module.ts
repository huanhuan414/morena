import { Module } from '@nestjs/common';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';
import { LearningService } from './learning.service';
import { HostingService } from './hosting.service';

@Module({
  controllers: [AvatarController],
  providers: [AvatarService, LearningService, HostingService],
  exports: [AvatarService, LearningService, HostingService]
})
export class AvatarModule {}
