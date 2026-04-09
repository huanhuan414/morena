import { Module } from '@nestjs/common';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';
import { LearningService } from './learning.service';
import { HostingService } from './hosting.service';
import { VoiceCallGateway } from './voice-call.gateway';
import { VoiceCallService } from './voice-call.service';
import { ReverseGeocodingService } from '../../services/reverse-geocoding.service';

@Module({
  imports: [],
  controllers: [AvatarController],
  providers: [AvatarService, LearningService, HostingService, VoiceCallGateway, VoiceCallService, ReverseGeocodingService],
  exports: [AvatarService, LearningService, HostingService, VoiceCallService]
})
export class AvatarModule {}
