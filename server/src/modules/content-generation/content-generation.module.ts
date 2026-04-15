import { Module } from '@nestjs/common'
import { ContentGenerationService } from './content-generation.service'
import { ContentGenerationController } from './content-generation.controller'
import { SupabaseService } from '../supabase/supabase.service'

@Module({
  controllers: [ContentGenerationController],
  providers: [ContentGenerationService, SupabaseService],
  exports: [ContentGenerationService]
})
export class ContentGenerationModule {}
