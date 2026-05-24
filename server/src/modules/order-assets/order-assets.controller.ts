import { Controller, Get, Post, Delete, Body, Param, Query, UseInterceptors, UploadedFile, Req } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { OrderAssetsService } from './order-assets.service'
import { Request } from 'express'

@Controller('order-assets')
export class OrderAssetsController {
  constructor(private readonly orderAssetsService: OrderAssetsService) {}

  /**
   * 重新生成失败的素材
   */
  @Post('regenerate')
  async regenerateAsset(
    @Body() body: { assetId: string },
    @Req() req?: Request,
  ) {
    const userId = (req as any).userId
    const result = await this.orderAssetsService.regenerateAsset(body.assetId, userId)
    return { code: 200, message: '重新生成已提交', data: result }
  }

  /**
   * 获取订单的素材列表（支持分页）
   */
  @Get(':orderId')
  async getOrderAssets(
    @Param('orderId') orderId: string,
    @Query('type') type?: 'image' | 'video',
    @Query('source') source?: 'ai_generated' | 'user_uploaded',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pagination = {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    }
    const result = await this.orderAssetsService.getOrderAssets(orderId, { type, source }, pagination)
    return { code: 200, message: '获取成功', data: result }
  }

  /**
   * 上传单张图片/视频素材并绑定到订单
   * content_type: image / video
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024 } })) // 200MB
  async uploadAsset(
    @UploadedFile() file: Express.Multer.File,
    @Body('orderId') orderId: string,
    @Body('assetType') assetType: 'image' | 'video',
    @Body('platform') platform?: string,
    @Req() req?: Request,
  ) {
    const userId = (req as any).userId
    const result = await this.orderAssetsService.uploadAndCreateAsset({
      file,
      orderId,
      assetType,
      platform,
      userId,
    })
    return { code: 200, message: '上传成功', data: result }
  }

  /**
   * 上传压缩包，自动解压提取媒体文件并绑定到订单
   */
  @Post('upload-zip')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } })) // 500MB
  async uploadZip(
    @UploadedFile() file: Express.Multer.File,
    @Body('orderId') orderId: string,
    @Body('platform') platform?: string,
    @Req() req?: Request,
  ) {
    const userId = (req as any).userId
    const result = await this.orderAssetsService.extractAndUploadZip(file, orderId, platform, userId)
    return { code: 200, message: '解压上传成功', data: result }
  }

  /**
   * 批量创建素材记录（前端逐个上传后批量绑定）
   */
  @Post('batch')
  async batchCreateAssets(
    @Body() body: {
      orderId: string
      assets: Array<{
        assetType: 'image' | 'video'
        assetUrl: string
        platform?: string
        originalFilename?: string
        fileSize?: number
        mimeType?: string
        sortOrder?: number
      }>
    },
    @Req() req?: Request,
  ) {
    const userId = (req as any).userId
    const result = await this.orderAssetsService.batchCreateAssets(body.orderId, body.assets, userId)
    return { code: 200, message: '批量创建成功', data: result }
  }

  /**
   * 删除素材
   */
  @Delete(':assetId')
  async deleteAsset(
    @Param('assetId') assetId: string,
    @Query('orderId') orderId: string,
    @Req() req?: Request,
  ) {
    const userId = (req as any).userId
    await this.orderAssetsService.deleteAsset(assetId, orderId, userId)
    return { code: 200, message: '删除成功' }
  }

  /**
   * 更新素材排序
   */
  @Post('reorder')
  async reorderAssets(
    @Body() body: {
      orderId: string
      assetIds: string[]
    },
  ) {
    await this.orderAssetsService.reorderAssets(body.orderId, body.assetIds)
    return { code: 200, message: '排序更新成功' }
  }

  /**
   * 获取订单素材概要（图片数量、视频数量、是否满足平台需求）
   */
  @Get(':orderId/summary')
  async getAssetsSummary(@Param('orderId') orderId: string) {
    const summary = await this.orderAssetsService.getAssetsSummary(orderId)
    return { code: 200, message: '获取成功', data: summary }
  }
}
