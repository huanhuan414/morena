import { Module } from '@nestjs/common';
import { ImageGenController } from './image-gen.controller';
import { ImageGenService } from './image-gen.service';
import { UploadModule } from '../upload/upload.module';
import { CoinModule } from '../coin/coin.module';
import { AiSkillModule } from '../ai-skill/ai-skill.module';

@Module({
  imports: [UploadModule, CoinModule, AiSkillModule],
  controllers: [ImageGenController],
  providers: [ImageGenService],
  exports: [ImageGenService],
})
export class ImageGenModule {}
