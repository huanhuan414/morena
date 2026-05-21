/**
 * 抖音开放平台模块
 */

import { Module } from '@nestjs/common'
import { DouyinService } from './douyin.service'
import { DouyinController } from './douyin.controller'

@Module({
  controllers: [DouyinController],
  providers: [DouyinService],
  exports: [DouyinService],
})
export class DouyinModule {}
