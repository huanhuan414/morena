import { Controller, Delete, Get, HttpCode, Param, Query, Req } from '@nestjs/common'

import { MyAvatarService, type MyAvatarFilter } from './my-avatar.service'

@Controller('my-avatars')
export class MyAvatarController {
  constructor(private readonly myAvatarService: MyAvatarService) {}

  @Get()
  async getMyAvatars(
    @Req() req: any,
    @Query('filter') filter: string = 'all',
  ) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }
      if (!['all', 'skilled', 'pending'].includes(filter)) {
        return { code: 400, msg: '分身分类无效', data: null }
      }

      const result = await this.myAvatarService.getMyAvatars(userId, filter as MyAvatarFilter)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取我的分身失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  @Get(':id/works')
  async getMyAvatarWorks(@Param('id') id: string, @Req() req: any) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      const result = await this.myAvatarService.getMyAvatarWorks(avatarId, userId)
      if (!result) return { code: 404, msg: '分身不存在或无权访问', data: null }
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取我的分身作品失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  @Delete(':id')
  @HttpCode(200)
  async deleteMyAvatar(@Param('id') id: string, @Req() req: any) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      const deleted = await this.myAvatarService.deleteMyAvatar(avatarId, userId)
      if (!deleted) return { code: 404, msg: '分身不存在或已删除', data: null }
      return { code: 200, msg: '删除成功', data: { id: avatarId } }
    } catch (error) {
      console.error('删除我的分身失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  private getUserId(req: any) {
    const rawUserId = req.headers['x-user-id']
    return Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
  }
}
