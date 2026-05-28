import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { GroupBotController } from './group-bot.controller'
import { GroupBotService } from './group-bot.service'
import { WecomApiService } from './wecom/wecom-api.service'

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [GroupBotController],
  providers: [GroupBotService, WecomApiService],
  exports: [GroupBotService, WecomApiService],
})
export class GroupBotModule {}
