import { Module } from '@nestjs/common'
import { ContentGenerationService } from './content-generation.service'
import { ContentGenerationController } from './content-generation.controller'
import { SupabaseService } from '../supabase/supabase.service'
import { AvatarToolRegistry } from '../avatar-agent/tools/tool-registry'

@Module({
  controllers: [ContentGenerationController],
  providers: [ContentGenerationService, SupabaseService, AvatarToolRegistry],
  exports: [ContentGenerationService]
})
export class ContentGenerationModule {}
