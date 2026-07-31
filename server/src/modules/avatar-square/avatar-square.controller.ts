import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { AvatarSquareService } from './avatar-square.service'

@Controller('avatar-square')
export class AvatarSquareController {
  constructor(private readonly avatarSquareService: AvatarSquareService) {}

  @Get('manage/works')
  async getManagedWorks(
    @Req() req: any,
    @Query('avatarId') avatarId?: string,
    @Query('display') display?: string,
    @Query('category') category?: string,
    @Query('sort') sort?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
  ) {
    try {
      const rawUserId = req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const normalizedAvatarId = avatarId ? Number(avatarId) : undefined
      if (normalizedAvatarId !== undefined
        && (!Number.isInteger(normalizedAvatarId) || normalizedAvatarId <= 0)) {
        return { code: 400, msg: '分身ID无效', data: null }
      }
      if (display && !['shown', 'hidden'].includes(display)) {
        return { code: 400, msg: '展示状态无效', data: null }
      }
      const categories = ['图片', '图文', '文字', '视频']
      if (category && !categories.includes(category)) {
        return { code: 400, msg: '作品分类无效', data: null }
      }

      const result = await this.avatarSquareService.getManagedWorks(userId, {
        avatarId: normalizedAvatarId,
        display,
        category,
        sort,
        page: Math.max(1, parseInt(page) || 1),
        pageSize: Math.min(20, Math.max(1, parseInt(pageSize) || 20)),
      })
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取作品管理列表失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  @Delete('manage/works/:workId')
  async deleteManagedWork(@Param('workId') workId: string, @Req() req: any) {
    try {
      const id = Number(workId)
      if (!Number.isInteger(id) || id <= 0) {
        return { code: 400, msg: '作品ID无效', data: null }
      }
      const rawUserId = req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const deleted = await this.avatarSquareService.deleteManagedWork(id, userId)
      if (!deleted) return { code: 404, msg: '作品不存在或无权删除', data: null }
      return { code: 200, msg: '删除成功', data: { id } }
    } catch (error) {
      console.error('删除作品失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }
  @Get()
  async getPublicAvatarSquare(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('skillType') skillType?: string,
    @Query('sort') sort: string = 'recommend',
  ) {
    try {
      const rawUserId = req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      const normalizedSkillType = skillType?.trim()
      const effectiveSkillType = normalizedSkillType
        && !['undefined', 'null', '全部'].includes(normalizedSkillType.toLowerCase())
        ? normalizedSkillType
        : undefined
      const result = await this.avatarSquareService.getPublicAvatarSquare({
        page: Math.max(1, parseInt(page) || 1),
        pageSize: Math.min(20, Math.max(1, parseInt(pageSize) || 20)),
        skillType: effectiveSkillType,
        sort,
      }, userId)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取分身广场列表失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: { list: [], page: 1, pageSize: 20, hasMore: false },
      }
    }
  }

  @Get('work-square')
  async getPublicWorkSquare(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('category') category?: string,
    @Query('avatarName') avatarName?: string,
    @Query('sort') sort: string = 'recommend',
  ) {
    try {
      const categories = ['图片', '图文', '文字', '视频']
      if (category && !categories.includes(category)) {
        return { code: 400, msg: '作品分类无效', data: null }
      }
      const sorts = ['recommend', 'income', 'views', 'favorites']
      if (!sorts.includes(sort)) {
        return { code: 400, msg: '排序方式无效', data: null }
      }

      const rawUserId = req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      const result = await this.avatarSquareService.getPublicWorkSquare({
        page: Math.max(1, parseInt(page) || 1),
        pageSize: Math.min(20, Math.max(1, parseInt(pageSize) || 20)),
        category,
        avatarName: avatarName?.trim().slice(0, 50) || undefined,
        sort,
      }, userId)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取作品广场列表失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: { list: [], page: 1, pageSize: 20, hasMore: false },
      }
    }
  }

  @Post(':id/favorite')
  @HttpCode(200)
  async favoriteTarget(
    @Param('id') id: string,
    @Body('targetType') targetType: string,
    @Req() req: any,
  ) {
    return this.updateFavorite(id, targetType, req, true)
  }

  @Delete(':id/favorite')
  async unfavoriteTarget(
    @Param('id') id: string,
    @Body('targetType') targetType: string,
    @Req() req: any,
  ) {
    return this.updateFavorite(id, targetType, req, false)
  }

  private async updateFavorite(
    id: string,
    targetType: string,
    req: any,
    isFavorited: boolean,
  ) {
    try {
      const targetId = Number(id)
      if (!Number.isInteger(targetId) || targetId <= 0) {
        return { code: 400, msg: '收藏对象ID无效', data: null }
      }
      if (targetType !== '分身' && targetType !== '作品') {
        return { code: 400, msg: '收藏对象类型无效', data: null }
      }

      const rawUserId = req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      if (!userId) {
        return { code: 401, msg: '请先登录', data: null }
      }

      const result = await this.avatarSquareService.setFavorite(
        targetId,
        userId,
        targetType,
        isFavorited,
      )
      if (!result) {
        return { code: 404, msg: '收藏对象不存在或暂不可见', data: null }
      }

      return {
        code: 200,
        msg: isFavorited ? '收藏成功' : '已取消收藏',
        data: result,
      }
    } catch (error) {
      console.error(isFavorited ? '收藏失败:' : '取消收藏失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: null,
      }
    }
  }

  @Get(':id/works')
  async getPublicAvatarWorks(
    @Param('id') id: string,
    @Query('category') category?: string,
  ) {
    try {
      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: [] }
      }

      const categories = ['图片', '图文', '文字', '视频']
      if (category && !categories.includes(category)) {
        return { code: 400, msg: '作品分类无效', data: [] }
      }

      const result = await this.avatarSquareService.getPublicAvatarWorks(avatarId, category)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取分身公开作品失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: [],
      }
    }
  }

  @Get(':id/owner-works')
  async getOwnerAvatarWorks(
    @Param('id') id: string,
    @Query('category') category?: string,
  ) {
    try {
      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: [] }
      }

      const categories = ['图片', '图文', '文字', '视频']
      if (category && !categories.includes(category)) {
        return { code: 400, msg: '作品分类无效', data: [] }
      }

      const result = await this.avatarSquareService.getOwnerAvatarWorks(avatarId, category)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取分身作品总览失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: [],
      }
    }
  }

  @Get('public-works/:workId')
  async getPublicWorkDetail(@Param('workId') workId: string) {
    try {
      const id = Number(workId)
      if (!Number.isInteger(id) || id <= 0) {
        return { code: 400, msg: '作品ID无效', data: null }
      }

      const result = await this.avatarSquareService.getPublicWorkDetail(id)
      if (!result) {
        return { code: 404, msg: '作品不存在或暂不可见', data: null }
      }
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取公开作品详情失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: null,
      }
    }
  }

  @Get('internal-works/:workId')
  async getInternalWorkDetail(
    @Param('workId') workId: string,
    @Req() req: any,
  ) {
    try {
      const id = Number(workId)
      if (!Number.isInteger(id) || id <= 0) {
        return { code: 400, msg: '作品ID无效', data: null }
      }

      const rawUserId = req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      if (!userId) {
        return { code: 401, msg: '请先登录', data: null }
      }

      const result = await this.avatarSquareService.getInternalWorkDetail(id, userId)
      if (!result) {
        return { code: 404, msg: '作品不存在或无权查看', data: null }
      }
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取内部作品详情失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: null,
      }
    }
  }

  @Get(':id')
  async getPublicAvatarSquareDetail(@Param('id') id: string) {
    try {
      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      const result = await this.avatarSquareService.getPublicAvatarSquareDetail(avatarId)
      if (!result) {
        return { code: 404, msg: '分身不存在或暂不可见', data: null }
      }

      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取分身广场详情失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: null,
      }
    }
  }
}