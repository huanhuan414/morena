import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PalmReadingController } from './palm-reading.controller';
import { PalmReadingService } from './palm-reading.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ConfigModule, StorageModule],
  controllers: [PalmReadingController],
  providers: [PalmReadingService],
  exports: [PalmReadingService],
})
export class PalmReadingModule {}
