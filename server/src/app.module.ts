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
import { AudioModule } from './modules/audio/audio.module';
import { StorageModule } from './modules/storage/storage.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OrderDispatchModule } from './modules/order-dispatch/order-dispatch.module';
import { EarningModule } from './modules/earning/earning.module';
import { ReferralModule } from './modules/referral/referral.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';

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
    AudioModule,
    NotificationModule,
    OrderDispatchModule,
    EarningModule,
    ReferralModule,
    SubscriptionModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
