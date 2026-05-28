import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AiSkillController } from './ai-skill.controller';
import { AiSkillService } from './ai-skill.service';
import { StorageService } from '../storage/storage.service';
import { UploadModule } from '../upload/upload.module';
import { CoinModule } from '../coin/coin.module';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
    UploadModule,
    CoinModule,
  ],
  controllers: [AiSkillController],
  providers: [AiSkillService, StorageService],
  exports: [AiSkillService],
})
export class AiSkillModule {}
