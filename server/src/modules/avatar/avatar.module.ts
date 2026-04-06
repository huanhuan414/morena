import { Module } from '@nestjs/common';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';
import { LearningService } from './learning.service';
import { HostingService } from './hosting.service';
import { VoiceCallGateway } from './voice-call.gateway';
import { VoiceCallService } from './voice-call.service';

@Module({
  controllers: [AvatarController],
  providers: [AvatarService, LearningService, HostingService, VoiceCallGateway, VoiceCallService],
  exports: [AvatarService, LearningService, HostingService, VoiceCallService]
})
export class AvatarModule {}
