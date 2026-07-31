import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common'
import { createHash } from 'node:crypto'
import {
  AvatarSquareService,
  WORK_VIEW_SOURCES,
  type WorkViewSource,
} from './avatar-square.service'

@Controller('generated-works')
export class GeneratedWorksController {
  constructor(private readonly avatarSquareService: AvatarSquareService) {}

  @Post(':workId/view')
  @HttpCode(200)
  async recordPublicWorkView(
    @Param('workId') workId: string,
    @Body() body: { source?: WorkViewSource },
    @Req() req: any,
  ) {
    try {
      const id = Number(workId)
      if (!Number.isInteger(id) || id <= 0) {
        return { code: 400, msg: '作品ID无效', data: null }
      }

      const source = body?.source || 'other'
      if (!WORK_VIEW_SOURCES.includes(source)) {
        return { code: 400, msg: '浏览来源无效', data: null }
      }

      const rawUserId = req.user?.id || req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      const visitorHash = createHash('sha256')
        .update(`${req.ip || req.socket?.remoteAddress || ''}|${req.headers['user-agent'] || ''}`)
        .digest('hex')
      const viewerKey = userId ? `user:${userId}` : `anonymous:${visitorHash}`

      const result = await this.avatarSquareService.recordPublicWorkView(
        id,
        userId ? String(userId) : undefined,
        viewerKey,
        source,
      )
      if (!result) {
        return { code: 404, msg: '作品不存在或暂不可见', data: null }
      }

      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('记录作品浏览失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: null,
      }
    }
  }
}