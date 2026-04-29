import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PalmReadingController } from './palm-reading.controller';
import { PalmReadingService } from './palm-reading.service';

@Module({
  imports: [ConfigModule],
  controllers: [PalmReadingController],
  providers: [PalmReadingService],
  exports: [PalmReadingService],
})
export class PalmReadingModule {}
