import { Module } from '@nestjs/common';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';
import { LearningService } from './learning.service';
import { HostingService } from './hosting.service';
import { FriendshipService } from './friendship.service';
import { VoiceCallGateway } from './voice-call.gateway';
import { VoiceCallService } from './voice-call.service';
import { ReverseGeocodingService } from '../../services/reverse-geocoding.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [AvatarController],
  providers: [AvatarService, LearningService, HostingService, FriendshipService, VoiceCallGateway, VoiceCallService, ReverseGeocodingService],
  exports: [AvatarService, LearningService, HostingService, FriendshipService, VoiceCallService]
})
export class AvatarModule {}
