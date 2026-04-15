import { Module } from '@nestjs/common'
import { ContentGenerationService } from './content-generation.service'
import { ContentGenerationController } from './content-generation.controller'
import { AvatarAgentModule } from '../avatar-agent/avatar-agent.module'

@Module({
  imports: [AvatarAgentModule],
  controllers: [ContentGenerationController],
  providers: [ContentGenerationService],
  exports: [ContentGenerationService]
})
export class ContentGenerationModule {}
