import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { AvatarSquareService } from './avatar-square.service'

@Controller('avatar-square')
export class AvatarSquareController {
  constructor(private readonly avatarSquareService: AvatarSquareService) {}

  @Get('manage/works')
  async getManagedWorks(
    @Req() req: any,
    @Query('avatarId') avatarId?: string,
    @Query('display') display?: string,
    @Query('filters') filters?: string,
    @Query('publicStatus') publicStatus?: string,
    @Query('profileDisplay') profileDisplay?: string,
    @Query('squareDisplay') squareDisplay?: string,
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
      const normalizedFilters = filters
        ? filters.split(',').map(item => item.trim()).filter(Boolean)
        : []
      const allowedFilters = ['public', 'private', 'profile', 'square']
      if (normalizedFilters.some(item => !allowedFilters.includes(item))) {
        return { code: 400, msg: '筛选条件无效', data: null }
      }
      if (normalizedFilters.includes('public') && normalizedFilters.includes('private')) {
        return { code: 400, msg: '公开和私有不能同时筛选', data: null }
      }
      if (publicStatus && !['公开', '私有'].includes(publicStatus)) {
        return { code: 400, msg: '公开状态无效', data: null }
      }
      if (profileDisplay && !['shown', 'hidden'].includes(profileDisplay)) {
        return { code: 400, msg: '个人主页筛选无效', data: null }
      }
      if (squareDisplay && !['shown', 'hidden'].includes(squareDisplay)) {
        return { code: 400, msg: '动态广场筛选无效', data: null }
      }
      const categories = ['图片', '图文', '文字', '视频']
      if (category && !categories.includes(category)) {
        return { code: 400, msg: '作品分类无效', data: null }
      }

      const result = await this.avatarSquareService.getManagedWorks(userId, {
        avatarId: normalizedAvatarId,
        display,
        filters: normalizedFilters,
        publicStatus,
        profileDisplay,
        squareDisplay,
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

  @Put('manage/works/:workId/status')
  async updateManagedWorkStatus(
    @Param('workId') workId: string,
    @Body('field') field: string,
    @Body('value') value: string,
    @Req() req: any,
  ) {
    try {
      const id = Number(workId)
      if (!Number.isInteger(id) || id <= 0) {
        return { code: 400, msg: '作品ID无效', data: null }
      }
      const rawUserId = req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const allowedFields = ['publicStatus', 'avatarAcceptStatus', 'avatarAuthStatus']
      if (!allowedFields.includes(field)) {
        return { code: 400, msg: '更新字段无效', data: null }
      }

      const result = await this.avatarSquareService.updateManagedWorkStatus(
        id,
        String(userId),
        field as 'publicStatus' | 'avatarAcceptStatus' | 'avatarAuthStatus',
        value,
      )
      if (result.state === 'invalid') return { code: 400, msg: '状态值无效', data: null }
      if (result.state === 'profile_limit') return { code: 400, msg: '每个分身个人主页最多展示4个作品', data: null }
      if (result.state === 'audit_rejected') return { code: 400, msg: '内容审核未通过', data: null }
      if (result.state === 'not_found') return { code: 404, msg: '作品不存在或无权修改', data: null }
      return { code: 200, msg: '更新成功', data: result.data }
    } catch (error) {
      console.error('更新作品展示状态失败:', error)
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

  @Get('work-square/:workId')
  async getPublicWorkSquareDetail(
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
      const result = await this.avatarSquareService.getPublicWorkSquareDetail(
        id,
        userId ? String(userId) : undefined,
      )
      if (!result) {
        return { code: 404, msg: '作品不存在或暂不可见', data: null }
      }
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取作品广场详情失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: null,
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
    @Req() req?: any,
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

      const rawUserId = req?.headers?.['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      const result = await this.avatarSquareService.getPublicAvatarWorks(
        avatarId,
        category,
        userId ? String(userId) : undefined,
      )
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

  @Get(':id/work-stats')
  async getAvatarWorkStats(@Param('id') id: string) {
    try {
      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      const result = await this.avatarSquareService.getAvatarWorkStats(avatarId)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取分身作品统计失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: null,
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

  @Get(':id/settings')
  async getOwnedAvatarSettings(@Param('id') id: string, @Req() req: any) {
    try {
      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }
      const rawUserId = req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const result = await this.avatarSquareService.getOwnedAvatarSettings(avatarId, userId)
      if (!result) return { code: 404, msg: '分身不存在或无权管理', data: null }
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('获取分身设置失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  @Put(':id/settings')
  @HttpCode(200)
  async updateOwnedAvatarSettings(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: any,
  ) {
    try {
      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }
      const rawUserId = req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const allowedKeys = ['avatarName', 'avatarUrl', 'description', 'publicStatus', 'status']
      const bodyKeys = Object.keys(body || {})
      if (bodyKeys.length === 0 || bodyKeys.some(key => !allowedKeys.includes(key))) {
        return { code: 400, msg: '设置参数无效', data: null }
      }

      const updates: {
        avatarName?: string
        avatarUrl?: string
        description?: string
        publicStatus?: '公开' | '私有'
        status?: '已上线' | '已下线'
      } = {}
      if (Object.prototype.hasOwnProperty.call(body, 'avatarName')) {
        if (typeof body.avatarName !== 'string' || !body.avatarName.trim() || body.avatarName.trim().length > 50) {
          return { code: 400, msg: '分身名称需为1-50个字符', data: null }
        }
        updates.avatarName = body.avatarName.trim()
      }
      if (Object.prototype.hasOwnProperty.call(body, 'avatarUrl')) {
        if (typeof body.avatarUrl !== 'string' || body.avatarUrl.length > 2048 || !body.avatarUrl.startsWith('https://')) {
          return { code: 400, msg: '分身头像地址无效', data: null }
        }
        updates.avatarUrl = body.avatarUrl
      }
      if (Object.prototype.hasOwnProperty.call(body, 'description')) {
        if (typeof body.description !== 'string' || body.description.length > 500) {
          return { code: 400, msg: '分身介绍不能超过500个字符', data: null }
        }
        updates.description = body.description.trim()
      }
      if (Object.prototype.hasOwnProperty.call(body, 'publicStatus')) {
        if (body.publicStatus !== '公开' && body.publicStatus !== '私有') {
          return { code: 400, msg: '公开状态无效', data: null }
        }
        updates.publicStatus = body.publicStatus
      }
      if (Object.prototype.hasOwnProperty.call(body, 'status')) {
        if (body.status !== '已上线' && body.status !== '已下线') {
          return { code: 400, msg: '上线状态无效', data: null }
        }
        updates.status = body.status
      }

      const result = await this.avatarSquareService.updateOwnedAvatarSettings(avatarId, userId, updates)
      if (result.state === 'not_found') {
        return { code: 404, msg: '分身不存在或无权管理', data: null }
      }
      if (result.state === 'status_locked') {
        return { code: 409, msg: '已封禁分身不能修改上线状态', data: result.data }
      }
      if (result.state === 'audit_rejected') {
        return { code: 400, msg: '内容审核未通过，暂不能公开', data: result.data }
      }
      return { code: 200, msg: '保存成功', data: result.data }
    } catch (error) {
      console.error('更新分身设置失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  @Post(':id/view')
  @HttpCode(200)
  async recordPublicAvatarView(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    try {
      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      const rawUserId = req.user?.id || req.headers['x-user-id']
      const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
      const visitorHash = createHash('sha256')
        .update(`${req.ip || req.socket?.remoteAddress || ''}|${req.headers['user-agent'] || ''}`)
        .digest('hex')
      const viewerKey = userId ? `user:${userId}` : `anonymous:${visitorHash}`

      const result = await this.avatarSquareService.recordPublicAvatarView(
        avatarId,
        userId ? String(userId) : undefined,
        viewerKey,
      )
      if (!result) {
        return { code: 404, msg: '分身不存在或暂不可见', data: null }
      }

      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('记录分身浏览失败:', error)
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
