import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ReferralModule } from './modules/referral/referral.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { MediaModule } from './modules/media/media.module';
import { ContentGenerationModule } from './modules/content-generation/content-generation.module';
import { UploadModule } from './modules/upload/upload.module';
import { AsrModule } from './modules/asr/asr.module';
import { VideoModule } from './modules/video/video.module';
import { VisionModule } from './modules/vision/vision.module';
import { VoiceCloneModule } from './modules/voice-clone/voice-clone.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

import { OrderProcessingModule } from './modules/order-processing/order-processing.module';
import { AdminModule } from './modules/admin/admin.module';
import { TikHubModule } from './modules/tikhub/tikhub.module';
import { PalmReadingModule } from './modules/palm-reading/palm-reading.module';
import { EarningsModule } from './modules/earnings/earnings.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { UserStatsModule } from './modules/user-stats/user-stats.module';
import { AiModule } from './modules/ai/ai.module';
import { SkillModule } from './modules/skill/skill.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ImageGenModule } from './modules/image-gen/image-gen.module';
import { AiSkillModule } from './modules/ai-skill/ai-skill.module';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    RedisModule,
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
    ReferralModule,
    SubscriptionModule,
    MediaModule,
    ContentGenerationModule,
    UploadModule,
    AsrModule,
    VideoModule,
    VisionModule,
    VoiceCloneModule,
    DashboardModule,
    TikHubModule,
    OrderProcessingModule,
    AdminModule,
    PalmReadingModule,
    EarningsModule,
    ActivitiesModule,
    UserStatsModule,
    AiModule,
    SkillModule,
    PaymentModule,
    ImageGenModule,
    AiSkillModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
