import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common'

import { AiAvatarService, type CreateAiAvatarDto } from './ai-avatar.service'

@Controller('ai-avatar')
export class AiAvatarController {
  constructor(private readonly aiAvatarService: AiAvatarService) {}

  /**
   * GET /api/ai-avatar/templates - 查询官方模板列表
   * 可选 ?skill_type=文字生成 按技能类型筛选
   */
  @Get('templates')
  async getTemplates(@Query('skill_type') skillType?: string) {
    try {
      const list = await this.aiAvatarService.getOfficialTemplates(skillType || undefined)
      return { code: 200, msg: 'success', data: list }
    } catch (error) {
      console.error('查询模板列表失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * GET /api/ai-avatar/templates/:templateId/detail - 查询模板详情（含关联模型API信息）
   * 用于技能认证页面展示
   */
  @Get('templates/:templateId/detail')
  async getTemplateDetail(@Param('templateId') templateId: string) {
    try {
      const id = Number(templateId)
      if (!Number.isInteger(id) || id <= 0) {
        return { code: 400, msg: '模板ID无效', data: null }
      }
      const detail = await this.aiAvatarService.getTemplateDetail(id)
      if (!detail) return { code: 404, msg: '模板不存在', data: null }
      return { code: 200, msg: 'success', data: detail }
    } catch (error) {
      console.error('查询模板详情失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * POST /api/ai-avatar/templates/:templateId/debug-run - 调试运行（调用模型生成内容）
   * body: { filledPrompt: string, materialValues?: Record<string, string> }
   */
  @Post('templates/:templateId/debug-run')
  @HttpCode(200)
  async debugRun(
    @Param('templateId') templateId: string,
    @Body() body: { filledPrompt: string; materialValues?: Record<string, string> },
  ) {
    try {
      const id = Number(templateId)
      if (!Number.isInteger(id) || id <= 0) {
        return { code: 400, msg: '模板ID无效', data: null }
      }
      if (!body.filledPrompt?.trim()) {
        return { code: 400, msg: '提示词不能为空', data: null }
      }
      const result = await this.aiAvatarService.debugRun(id, body.filledPrompt, body.materialValues)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('调试运行失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * GET /api/ai-avatar/templates/:templateId/debug-poll - 轮询异步任务状态
   */
  @Get('templates/:templateId/debug-poll')
  async debugPoll(
    @Param('templateId') templateId: string,
    @Query('task_id') taskId: string,
  ) {
    try {
      const id = Number(templateId)
      if (!Number.isInteger(id) || id <= 0) {
        return { code: 400, msg: '模板ID无效', data: null }
      }
      if (!taskId?.trim()) {
        return { code: 400, msg: '缺少task_id参数', data: null }
      }
      const result = await this.aiAvatarService.debugPoll(id, taskId)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('轮询任务失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * POST /api/ai-avatar/generation-tasks - 创建任务+扣积分（不调模型）
   *
   * 前端拿到 taskNo 后自行调用 debug-run 生成内容，
   * 生成完毕后调用 POST /generation-tasks/:taskNo/complete 提交结果。
   */
  @Post('generation-tasks')
  @HttpCode(200)
  async createTaskAndDeductPoints(
    @Req() req: any,
    @Body() body: {
      avatarId: number
      templateId: number
      inputParams?: Record<string, string>
      inputMaterials?: Array<{ name: string; url: string; type: string }>
      idempotencyKey: string
    },
  ) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      if (!body.avatarId || !body.templateId) {
        return { code: 400, msg: '分身ID和模板ID不能为空', data: null }
      }
      if (!body.idempotencyKey?.trim()) {
        return { code: 400, msg: '缺少幂等键', data: null }
      }

      const result = await this.aiAvatarService.createTaskAndDeductPoints(userId, {
        avatarId: body.avatarId,
        templateId: body.templateId,
        inputParams: body.inputParams,
        inputMaterials: body.inputMaterials,
        idempotencyKey: body.idempotencyKey.trim(),
      })

      if (!result.success) {
        return { code: 500, msg: result.error || '创建任务失败', data: null }
      }
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('创建生成任务失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * POST /api/ai-avatar/generation-tasks/:taskNo/complete - 提交模型结果（落作品+收益 或 退款）
   */
  @Post('generation-tasks/:taskNo/complete')
  @HttpCode(200)
  async completeGenerationTask(
    @Param('taskNo') taskNo: string,
    @Req() req: any,
    @Body() body: {
      success: boolean
      output_type?: string | null
      result?: any
      error?: string | null
    },
  ) {
    const startTime = Date.now()
    console.log(`[complete] 开始处理 taskNo=${taskNo}, success=${body.success}`)
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      if (!taskNo?.trim()) {
        return { code: 400, msg: '任务编号不能为空', data: null }
      }

      const result = await this.aiAvatarService.completeGenerationTask(userId, taskNo.trim(), {
        success: !!body.success,
        output_type: body.output_type || null,
        result: body.result || {},
        error: body.error || null,
      })

      console.log(`[complete] 处理完成 taskNo=${taskNo}, result.success=${result.success}, 耗时=${Date.now() - startTime}ms`)
      return { code: result.success ? 200 : 500, msg: result.success ? 'success' : (result.error || result.status || '处理失败'), data: result }
    } catch (error) {
      console.error(`[complete] 处理异常 taskNo=${taskNo}, 耗时=${Date.now() - startTime}ms, error:`, error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * POST /api/ai-avatar/generation-tasks/:taskNo/execute - 后端执行模型调用+落作品
   *
   * 前端只传 filledPrompt，后端自己调模型、处理结果、写入数据库。
   * 返回精简预览（不含 base64 大数据）。
   */
  @Post('generation-tasks/:taskNo/execute')
  @HttpCode(200)
  async executeGenerationTask(
    @Param('taskNo') taskNo: string,
    @Req() req: any,
    @Body() body: { filledPrompt: string; materialValues?: Record<string, string> },
  ) {
    const startTime = Date.now()
    console.log(`[execute] 开始处理 taskNo=${taskNo}`)
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      if (!taskNo?.trim()) {
        return { code: 400, msg: '任务编号不能为空', data: null }
      }
      if (!body.filledPrompt?.trim()) {
        return { code: 400, msg: '提示词不能为空', data: null }
      }

      const result = await this.aiAvatarService.executeGenerationTask(userId, taskNo.trim(), body.filledPrompt, body.materialValues)
      console.log(`[execute] 处理完成 taskNo=${taskNo}, success=${result.success}, 耗时=${Date.now() - startTime}ms`)
      return { code: result.success ? 200 : (result.pending ? 202 : 500), msg: result.success ? 'success' : (result.error || result.status || '处理失败'), data: result }
    } catch (error) {
      console.error(`[execute] 处理异常 taskNo=${taskNo}, 耗时=${Date.now() - startTime}ms, error:`, error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * GET /api/ai-avatar/generation-tasks/:taskNo/poll - 轮询异步任务状态（后端自动处理落作品）
   */
  @Get('generation-tasks/:taskNo/poll')
  async pollGenerationTask(@Param('taskNo') taskNo: string, @Req() req: any) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      if (!taskNo?.trim()) return { code: 400, msg: '任务编号不能为空', data: null }

      const result = await this.aiAvatarService.pollGenerationTask(userId, taskNo.trim())
      return { code: result.success ? 200 : 202, msg: result.success ? 'success' : (result.status || 'pending'), data: result }
    } catch (error) {
      console.error('[poll] 异常:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * POST /api/ai-avatar/generation-tasks/:taskNo/retry-save - 重试保存作品（任务已生成成功但作品未落库时使用）
   */
  @Post('generation-tasks/:taskNo/retry-save')
  @HttpCode(200)
  async retrySaveWork(@Param('taskNo') taskNo: string, @Req() req: any) {
    const startTime = Date.now()
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      if (!taskNo?.trim()) return { code: 400, msg: '任务编号不能为空', data: null }

      const result = await this.aiAvatarService.retrySaveWork(userId, taskNo.trim())
      console.log(`[retry-save] taskNo=${taskNo}, success=${result.success}, 耗时=${Date.now() - startTime}ms`)
      return { code: result.success ? 200 : 500, msg: result.success ? 'success' : (result.error || '保存失败'), data: result }
    } catch (error) {
      console.error(`[retry-save] 异常 taskNo=${taskNo}:`, error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * POST /api/ai-avatar/:id/templates - 复制官方模板并绑定到分身
   * body: { templateIds: number[] }
   */
  @Post(':id/templates')
  @HttpCode(200)
  async copyTemplates(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { templateIds: number[] },
  ) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      if (!body.templateIds?.length) {
        return { code: 400, msg: '请至少选择一个模板', data: null }
      }

      const result = await this.aiAvatarService.copyTemplatesToAvatar(avatarId, userId, body.templateIds)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('添加模板到分身失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * GET /api/ai-avatar/:id/templates - 查询分身已绑定的模板（返回 source_template_id 列表）
   */
  @Get(':id/templates')
  async getBoundTemplates(@Param('id') id: string, @Req() req: any) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      const bound = await this.aiAvatarService.getAvatarBoundTemplates(avatarId, userId)
      return { code: 200, msg: 'success', data: { sourceTemplateIds: bound.sourceIds, skillType: bound.skillType } }
    } catch (error) {
      console.error('查询分身已绑定模板失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * PUT /api/ai-avatar/:id/templates - 差量同步分身模板（编辑模式）
   * body: { templateIds: number[] } — 本次选中的官方模板 source ID 列表
   */
  @Put(':id/templates')
  @HttpCode(200)
  async syncTemplates(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { templateIds: number[] },
  ) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      if (!body.templateIds?.length) {
        return { code: 400, msg: '请至少选择一个模板', data: null }
      }

      const result = await this.aiAvatarService.syncTemplatesToAvatar(avatarId, userId, body.templateIds)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('同步分身模板失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * GET /api/ai-avatar/quota - 查询当前用户分身配额
   * 返回用户等级、已创建数量、最大可创建数量、是否还能创建
   */
  @Get('quota')
  async getQuota(@Req() req: any) {
    try {
      const userId = this.getUserId(req)
      if (!userId) {
        return { code: 401, msg: '请先登录', data: null }
      }
      const quota = await this.aiAvatarService.getAvatarQuota(userId)
      return { code: 200, msg: 'success', data: quota }
    } catch (error) {
      console.error('查询分身配额失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: null,
      }
    }
  }

  /**
   * GET /api/ai-avatar/:id/pending-templates - 查询分身下待测试模版数量
   */
  @Get(':id/pending-templates')
  async getPendingTemplates(@Param('id') id: string, @Req() req: any) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      const result = await this.aiAvatarService.getPendingTemplates(avatarId, userId)
      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('查询待测试模版失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * GET /api/ai-avatar/:id - 查询分身详情（仅本人可查）
   */
  @Get(':id')
  async getAvatarDetail(@Param('id') id: string, @Req() req: any) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      const avatar = await this.aiAvatarService.getAvatarById(avatarId, userId)
      if (!avatar) return { code: 404, msg: '分身不存在', data: null }

      const rawTagsJson = avatar.tagsJson ?? avatar.tags_json
      const tagsJson = typeof rawTagsJson === 'string'
        ? (() => { try { return JSON.parse(rawTagsJson) } catch { return null } })()
        : rawTagsJson

      return {
        code: 200,
        msg: 'success',
        data: {
          id: avatar.id,
          avatarName: avatar.avatarName ?? avatar.avatar_name,
          avatarUrl: avatar.avatarUrl ?? avatar.avatar_url,
          coverUrl: avatar.coverUrl ?? avatar.cover_url,
          description: avatar.description,
          tagsJson: tagsJson,
          skillType: avatar.skillType ?? avatar.skill_type,
          status: avatar.status,
        },
      }
    } catch (error) {
      console.error('查询分身详情失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * PUT /api/ai-avatar/:id - 更新分身基础信息（编辑模式）
   */
  @Put(':id')
  @HttpCode(200)
  async updateAvatar(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: CreateAiAvatarDto,
  ) {
    try {
      const userId = this.getUserId(req)
      if (!userId) return { code: 401, msg: '请先登录', data: null }

      const avatarId = Number(id)
      if (!Number.isInteger(avatarId) || avatarId <= 0) {
        return { code: 400, msg: '分身ID无效', data: null }
      }

      if (!body.avatar_name || !body.avatar_name.trim()) {
        return { code: 400, msg: '分身昵称不能为空', data: null }
      }

      if (body.avatar_name.trim().length > 50) {
        return { code: 400, msg: '分身昵称不能超过50个字符', data: null }
      }

      const validSkillTypes = ['文字生成', '图片生成', '视频生成', '图文生成']
      if (!body.skill_type || !validSkillTypes.includes(body.skill_type)) {
        return { code: 400, msg: '技能类型无效', data: null }
      }

      if (body.description && body.description.length > 500) {
        return { code: 400, msg: '个性描述不能超过500个字符', data: null }
      }

      const result = await this.aiAvatarService.updateAvatar(avatarId, userId, {
        avatar_name: body.avatar_name.trim(),
        avatar_url: body.avatar_url,
        cover_url: body.cover_url,
        description: body.description?.trim(),
        tags_json: body.tags_json,
        skill_type: body.skill_type,
      })

      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('更新分身失败:', error)
      return { code: 500, msg: error instanceof Error ? error.message : '服务器错误', data: null }
    }
  }

  /**
   * POST /api/ai-avatar - 创建分身（第1步基础信息保存）
   * 写入 ai_avatar 表，状态为"草稿"
   */
  @Post()
  @HttpCode(200)
  async createAvatar(
    @Req() req: any,
    @Body() body: CreateAiAvatarDto,
  ) {
    try {
      const userId = this.getUserId(req)
      if (!userId) {
        return { code: 401, msg: '请先登录', data: null }
      }

      if (!body.avatar_name || !body.avatar_name.trim()) {
        return { code: 400, msg: '分身昵称不能为空', data: null }
      }

      if (body.avatar_name.trim().length > 50) {
        return { code: 400, msg: '分身昵称不能超过50个字符', data: null }
      }

      const validSkillTypes = ['文字生成', '图片生成', '视频生成', '图文生成']
      if (!body.skill_type || !validSkillTypes.includes(body.skill_type)) {
        return { code: 400, msg: '技能类型无效', data: null }
      }

      if (body.description && body.description.length > 500) {
        return { code: 400, msg: '个性描述不能超过500个字符', data: null }
      }

      const result = await this.aiAvatarService.createAvatar(userId, {
        avatar_name: body.avatar_name.trim(),
        avatar_url: body.avatar_url,
        cover_url: body.cover_url,
        description: body.description?.trim(),
        tags_json: body.tags_json,
        skill_type: body.skill_type,
      })

      return { code: 200, msg: 'success', data: result }
    } catch (error) {
      console.error('创建分身失败:', error)
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '服务器错误',
        data: null,
      }
    }
  }

  private getUserId(req: any): string | undefined {
    const rawUserId = req.headers['x-user-id']
    return Array.isArray(rawUserId) ? rawUserId[0] : rawUserId
  }
}
