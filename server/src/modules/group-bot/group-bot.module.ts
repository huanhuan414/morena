import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GroupBotController } from './group-bot.controller'
import { GroupBotService } from './group-bot.service'
import { WecomApiService } from './wecom/wecom-api.service'
import { FeishuService } from './feishu/feishu.service'

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [GroupBotController],
  providers: [GroupBotService, WecomApiService, FeishuService],
  exports: [GroupBotService, WecomApiService, FeishuService],
})
export class GroupBotModule {}
