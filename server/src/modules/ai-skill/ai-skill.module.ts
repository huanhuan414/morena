import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AiSkillController } from './ai-skill.controller';
import { AiSkillService } from './ai-skill.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  ],
  controllers: [AiSkillController],
  providers: [AiSkillService],
  exports: [AiSkillService],
})
export class AiSkillModule {}
