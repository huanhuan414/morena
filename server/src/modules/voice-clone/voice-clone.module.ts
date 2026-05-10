// @ts-nocheck
import { Module } from '@nestjs/common'
import { VoiceCloneController } from './voice-clone.controller'
import { VoiceCloneService } from './voice-clone.service'

@Module({
  controllers: [VoiceCloneController],
  providers: [VoiceCloneService],
  exports: [VoiceCloneService]
})
export class VoiceCloneModule {}
