import { Module } from '@nestjs/common'
import { GroupBotController } from './group-bot.controller'
import { GroupBotService } from './group-bot.service'

@Module({
  controllers: [GroupBotController],
  providers: [GroupBotService],
  exports: [GroupBotService],
})
export class GroupBotModule {}
