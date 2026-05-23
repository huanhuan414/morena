import { Module } from '@nestjs/common';
import { AsrController } from './asr.controller';

@Module({
  controllers: [AsrController],
  providers: [],
  exports: [],
})
export class AsrModule {}
