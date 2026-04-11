/**
 * Avatar Agent Module
 * 分身 Agent 模块
 */

import { Module } from '@nestjs/common'
import { AvatarAgentController } from './avatar-agent.controller'
import { AvatarAgentService } from './avatar-agent.service'
import { AvatarMemoryService } from './avatar-memory.service'
import { AvatarLearningService } from './avatar-learning.service'

@Module({
  controllers: [AvatarAgentController],
  providers: [
    AvatarAgentService,
    AvatarMemoryService,
    AvatarLearningService
  ],
  exports: [
    AvatarAgentService,
    AvatarMemoryService,
    AvatarLearningService
  ]
})
export class AvatarAgentModule {}
