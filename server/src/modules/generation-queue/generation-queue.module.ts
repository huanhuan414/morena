import { Module } from '@nestjs/common';
import { ImageGenModule } from '../image-gen/image-gen.module';
import { VideoGenModule } from '../video-gen/video-gen.module';
import { CoinModule } from '../coin/coin.module';
import { GenerationQueueService } from './generation-queue.service';

@Module({
  imports: [ImageGenModule, VideoGenModule, CoinModule],
  providers: [GenerationQueueService],
})
export class GenerationQueueModule {}