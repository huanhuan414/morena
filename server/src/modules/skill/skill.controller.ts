import { Controller, Get, Post, Delete, Query, Body, Param, Req } from '@nestjs/common';
import { SkillService } from './skill.service';

@Controller('skills')
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  /** 获取技能列表（支持分类筛选） */
  @Get()
  async list(
    @Query('category') category: string,
    @Query('keyword') keyword: string,
  ) {
    const skills = await this.skillService.listSkills(category, keyword);
    return { code: 200, msg: 'success', data: skills };
  }

  /** 获取分身已拥有的技能 */
  @Get('avatar/:avatarId')
  async getAvatarSkills(@Param('avatarId') avatarId: string) {
    const skills = await this.skillService.getAvatarSkills(avatarId);
    return { code: 200, msg: 'success', data: skills };
  }

  /** 给分身添加技能 */
  @Post('avatar/:avatarId/:skillId')
  async addSkillToAvatar(
    @Param('avatarId') avatarId: string,
    @Param('skillId') skillId: string,
  ) {
    const result = await this.skillService.addSkillToAvatar(avatarId, skillId);
    return { code: 200, msg: '技能添加成功', data: result };
  }

  /** 移除分身的技能 */
  @Delete('avatar/:avatarId/:skillId')
  async removeSkillFromAvatar(
    @Param('avatarId') avatarId: string,
    @Param('skillId') skillId: string,
  ) {
    const result = await this.skillService.removeSkillFromAvatar(avatarId, skillId);
    return { code: 200, msg: '技能移除成功', data: result };
  }

  /** 批量给分身添加技能 */
  @Post('avatar/:avatarId/batch')
  async batchAddSkills(
    @Param('avatarId') avatarId: string,
    @Body() body: { skillIds: string[] },
  ) {
    const result = await this.skillService.batchAddSkills(avatarId, body.skillIds);
    return { code: 200, msg: '技能批量添加成功', data: result };
  }

  /** 获取技能分类统计 */
  @Get('categories')
  async getCategories() {
    const categories = await this.skillService.getCategories();
    return { code: 200, msg: 'success', data: categories };
  }
}
