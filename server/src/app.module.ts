import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { OrderModule } from './modules/order/order.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuthModule } from './modules/auth/auth.module';
import { AvatarModule } from './modules/avatar/avatar.module';
import { UserModule } from './modules/user/user.module';
import { TaskModule } from './modules/task/task.module';
import { SocialModule } from './modules/social/social.module';
import { AgentModule } from './modules/agent/agent.module';
import { AvatarAgentModule } from './modules/avatar-agent/avatar-agent.module';
import { AudioModule } from './modules/audio/audio.module';
import { StorageModule } from './modules/storage/storage.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OrderDispatchModule } from './modules/order-dispatch/order-dispatch.module';
import { OrderResultsModule } from './modules/order-results/order-results.module';
import { EarningModule } from './modules/earning/earning.module';
import { ReferralModule } from './modules/referral/referral.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { MediaModule } from './modules/media/media.module';
import { ContentGenerationModule } from './modules/content-generation/content-generation.module';
import { UploadModule } from './modules/upload/upload.module';
import { AsrModule } from './modules/asr/asr.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { VideoModule } from './modules/video/video.module';
import { VisionModule } from './modules/vision/vision.module';

import { OrderProcessingModule } from './modules/order-processing/order-processing.module';
import { AdminModule } from './modules/admin/admin.module';
import { TikHubModule } from './modules/tikhub/tikhub.module';
import { PalmReadingModule } from './modules/palm-reading/palm-reading.module';
import { EarningsModule } from './modules/earnings/earnings.module';

@Module({
  imports: [
    StorageModule,
    OrderModule,
    ChatModule,
    AuthModule,
    AvatarModule,
    UserModule,
    TaskModule,
    SocialModule,
    AgentModule,
    AvatarAgentModule,
    AudioModule,
    NotificationModule,
    OrderDispatchModule,
    OrderResultsModule,
    EarningModule,
    ReferralModule,
    SubscriptionModule,
    MediaModule,
    ContentGenerationModule,
    UploadModule,
    AsrModule,
    RecommendationModule,
    VideoModule,
    VisionModule,
    TikHubModule,
    OrderProcessingModule,
    AdminModule,
    PalmReadingModule,
    EarningsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
