import { Module } from '@nestjs/common';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';
import { LearningService } from './learning.service';

@Module({
  controllers: [AvatarController],
  providers: [AvatarService, LearningService],
  exports: [AvatarService, LearningService]
})
export class AvatarModule {}
