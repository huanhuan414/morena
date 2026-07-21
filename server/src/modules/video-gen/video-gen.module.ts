import { Module } from '@nestjs/common';
import { VideoGenController } from './video-gen.controller';
import { VideoGenService } from './video-gen.service';
import { CoinModule } from '../coin/coin.module';
import { AiSkillModule } from '../ai-skill/ai-skill.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [CoinModule, AiSkillModule, UploadModule],
  controllers: [VideoGenController],
  providers: [VideoGenService],
  exports: [VideoGenService],
})
export class VideoGenModule {}
