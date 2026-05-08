// @ts-nocheck
import { Module } from '@nestjs/common';
import { PalmReadingController } from './palm-reading.controller';
import { PalmReadingService } from './palm-reading.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [PalmReadingController],
  providers: [PalmReadingService],
})
export class PalmReadingModule {}
