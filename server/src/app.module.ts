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

@Module({
  imports: [OrderModule, ChatModule, AuthModule, AvatarModule, UserModule, TaskModule, SocialModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
