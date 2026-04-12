/**
 * 技能广场控制器
 * 提供技能列表、购买、评价等 API
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Put,
  Delete
} from '@nestjs/common'
import { SkillsService } from './skills.service'
import {
  CreateSkillDto,
  PurchaseSkillDto,
  SkillFilter
} from './skills.types'

@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  /**
   * 获取技能列表
   */
  @Get()
  async getSkillsList(
    @Query('type') type?: 'prebuilt' | 'custom' | 'paid',
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minRating') minRating?: string,
    @Query('tags') tags?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    try {
      const filter: SkillFilter = {}
      if (type) filter.type = type
      if (category) filter.category = category
      if (minPrice) filter.minPrice = parseFloat(minPrice)
      if (maxPrice) filter.maxPrice = parseFloat(maxPrice)
      if (minRating) filter.minRating = parseFloat(minRating)
      if (tags) filter.tags = tags.split(',').map(t => t.trim())
      if (search) filter.search = search

      const result = await this.skillsService.getSkills(
        filter,
        page ? parseInt(page) : 1,
        pageSize ? parseInt(pageSize) : 20
      )

      return {
        code: 200,
        data: result,
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取技能列表失败'
      }
    }
  }

  /**
   * 获取分身已拥有的技能
   */
  @Get('avatar/:avatarId')
  async getAvatarSkills(@Param('avatarId') avatarId: string) {
    try {
      const skills = await this.skillsService.getAvatarSkills(avatarId)

      return {
        code: 200,
        data: skills,
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取分身技能失败'
      }
    }
  }

  /**
   * 获取技能详情
   */
  @Get(':id')
  async getSkillDetail(@Param('id') id: string) {
    try {
      const skill = await this.skillsService.getSkillById(id)

      return {
        code: 200,
        data: skill,
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 404,
        data: null,
        message: error.message || '技能不存在'
      }
    }
  }

  /**
   * 创建自定义技能
   */
  @Post()
  async createSkill(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateSkillDto
  ) {
    try {
      const skill = await this.skillsService.createSkill(userId, dto)

      return {
        code: 200,
        data: skill,
        message: '创建成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '创建技能失败'
      }
    }
  }

  /**
   * 购买技能
   */
  @Post('purchase')
  async purchaseSkill(
    @Headers('x-user-id') userId: string,
    @Body() dto: PurchaseSkillDto
  ) {
    try {
      const avatarSkill = await this.skillsService.purchaseSkill(userId, dto)

      return {
        code: 200,
        data: avatarSkill,
        message: '购买成功'
      }
    } catch (error) {
      return {
        code: 400,
        data: null,
        message: error.message || '购买技能失败'
      }
    }
  }

  /**
   * 添加技能评价
   */
  @Post(':skillId/reviews')
  async addReview(
    @Headers('x-user-id') userId: string,
    @Param('skillId') skillId: string,
    @Body() body: { rating: number; comment?: string }
  ) {
    try {
      const review = await this.skillsService.addReview(
        userId,
        skillId,
        body.rating,
        body.comment
      )

      return {
        code: 200,
        data: review,
        message: '评价成功'
      }
    } catch (error) {
      return {
        code: 400,
        data: null,
        message: error.message || '添加评价失败'
      }
    }
  }

  /**
   * 获取技能评价列表
   */
  @Get(':skillId/reviews')
  async getSkillReviews(
    @Param('skillId') skillId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    try {
      const result = await this.skillsService.getSkillReviews(
        skillId,
        page ? parseInt(page) : 1,
        pageSize ? parseInt(pageSize) : 10
      )

      return {
        code: 200,
        data: result,
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: null,
        message: error.message || '获取评价列表失败'
      }
    }
  }

  /**
   * 获取所有分类
   */
  @Get('categories/list')
  async getCategories() {
    try {
      const categories = await this.skillsService.getCategories()

      return {
        code: 200,
        data: categories,
        message: '获取成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: [],
        message: '获取分类失败'
      }
    }
  }

  /**
   * 搜索技能
   */
  @Get('search/:keyword')
  async searchSkills(
    @Param('keyword') keyword: string,
    @Query('limit') limit?: string
  ) {
    try {
      const skills = await this.skillsService.searchSkills(
        keyword,
        limit ? parseInt(limit) : 10
      )

      return {
        code: 200,
        data: skills,
        message: '搜索成功'
      }
    } catch (error) {
      return {
        code: 500,
        data: [],
        message: '搜索失败'
      }
    }
  }

  /**
   * 使用 AI 生成技能
   */
  @Post('ai-generate')
  async generateSkillWithAI(@Body() body: { prompt: string }) {
    try {
      const generatedSkill = await this.skillsService.generateSkillWithAI(body.prompt)

      return {
        code: 200,
        data: { skill: generatedSkill },
        message: 'AI 生成成功'
      }
    } catch (error) {
      console.error('[SkillsController] AI 生成失败:', error)
      return {
        code: 500,
        data: null,
        message: 'AI 生成失败'
      }
    }
  }

  /**
   * 移除分身技能
   */
  @Delete('remove')
  async removeSkill(
    @Headers('x-user-id') userId: string,
    @Body() body: { skillId: string; avatarId: string }
  ) {
    try {
      await this.skillsService.removeSkill(userId, body)

      return {
        code: 200,
        data: null,
        message: '移除成功'
      }
    } catch (error) {
      return {
        code: 400,
        data: null,
        message: error.message || '移除技能失败'
      }
    }
  }
}
