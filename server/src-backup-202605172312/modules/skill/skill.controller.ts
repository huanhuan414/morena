import { Controller, Get, Post, Delete, Query, Body, Param, Req, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { SkillService } from './skill.service';
import { AiService } from '../ai/ai.service';

@Controller('skills')
export class SkillController {
  private readonly skillService: SkillService
  private readonly aiService: AiService

  constructor(
    @Inject(SkillService) skillService: SkillService,
    @Inject(AiService) aiService: AiService,
  ) {
    this.skillService = skillService
    this.aiService = aiService
  }

  @Get()
  async list(
    @Query('category') category: string,
    @Query('keyword') keyword: string,
  ) {
    try {
      if (this.skillService) {
        const skills = await this.skillService.listSkills(category, keyword);
        return { code: 200, msg: 'success', data: skills };
      }
    } catch (e) {
      console.error('[SkillController] list error:', e.message)
    }
    return { code: 200, msg: 'success', data: [] };
  }

  @Get('avatar/:avatarId')
  async getAvatarSkills(@Param('avatarId') avatarId: string) {
    try {
      if (this.skillService) {
        const skills = await this.skillService.getAvatarSkills(avatarId);
        return { code: 200, msg: 'success', data: skills };
      }
    } catch (e) {
      console.error('[SkillController] getAvatarSkills error:', e.message)
    }
    return { code: 200, msg: 'success', data: [] };
  }

  @Post('avatar/:avatarId/:skillId')
  async addSkillToAvatar(
    @Param('avatarId') avatarId: string,
    @Param('skillId') skillId: string,
  ) {
    try {
      if (this.skillService) {
        const result = await this.skillService.addSkillToAvatar(avatarId, skillId);
        return { code: 200, msg: '技能添加成功', data: result };
      }
    } catch (e) {
      console.error('[SkillController] addSkillToAvatar error:', e.message)
    }
    return { code: 500, msg: '服务暂不可用', data: null };
  }

  @Delete('avatar/:avatarId/:skillId')
  async removeSkillFromAvatar(
    @Param('avatarId') avatarId: string,
    @Param('skillId') skillId: string,
  ) {
    try {
      if (this.skillService) {
        const result = await this.skillService.removeSkillFromAvatar(avatarId, skillId);
        return { code: 200, msg: '技能移除成功', data: result };
      }
    } catch (e) {
      console.error('[SkillController] removeSkillFromAvatar error:', e.message)
    }
    return { code: 500, msg: '服务暂不可用', data: null };
  }

  @Post('avatar/:avatarId/batch')
  async batchAddSkills(
    @Param('avatarId') avatarId: string,
    @Body() body: { skillIds: string[] },
  ) {
    try {
      if (this.skillService) {
        const result = await this.skillService.batchAddSkills(avatarId, body.skillIds);
        return { code: 200, msg: '技能批量添加成功', data: result };
      }
    } catch (e) {
      console.error('[SkillController] batchAddSkills error:', e.message)
    }
    return { code: 500, msg: '服务暂不可用', data: null };
  }

  @Post(':id/try')
  @HttpCode(HttpStatus.OK)
  async trySkill(
    @Param('id') skillId: string,
    @Body() body: { input?: string },
  ) {
    try {
      if (!this.skillService || !this.aiService) {
        return { code: 500, msg: '服务暂不可用', data: null };
      }
      const skill = await this.skillService.getSkillById(skillId);
      if (!skill) return { code: 404, msg: '技能不存在', data: null };

      const userInput = body.input || '';
      const category = skill.category;
      const skillName = skill.name;

      let prompt = '';
      let contentType = 'text';

      switch (category) {
        case 'life':
          if (skillName.includes('手相')) {
            prompt = `你是一位经验丰富的手相大师。${userInput ? `用户说：${userInput}` : '请为用户模拟一次看手相体验'}。请用轻松愉快的语气，给出一段完整的手相解读（200-300字）。`;
          } else if (skillName.includes('衣品')) {
            prompt = `你是一位顶级时尚造型师。${userInput ? `用户说：${userInput}` : '请为用户模拟一次衣品改造体验'}。请给出完整的穿搭方案（200-300字）。`;
          } else {
            prompt = `你是一位${skillName}领域的专家。${userInput ? `用户输入：${userInput}` : '请为用户做一次体验演示'}。请给出专业且有趣的体验结果（200-300字）。`;
          }
          break;
        case 'image':
          prompt = `你是一位AI绘画创意大师。${userInput ? `用户想生成：${userInput}` : '请为用户模拟一次AI图片生成体验'}。请输出详细的画面描述（150字以上）。`;
          contentType = 'image';
          break;
        case 'video':
          prompt = `你是一位AI视频创意导演。${userInput ? `用户想生成：${userInput}` : '请为用户模拟一次AI视频生成体验'}。请输出分镜头脚本。`;
          contentType = 'video';
          break;
        case 'content':
          prompt = `你是一位顶级内容创作专家。${userInput ? `用户想创作：${userInput}` : '请为用户生成一篇示例内容'}。请输出优质文案（200字以上）。`;
          contentType = 'content';
          break;
        default:
          prompt = `你是一位${skillName}领域的专家。${userInput ? `用户输入：${userInput}` : '请做一次体验演示'}。请给出专业且有趣的体验结果（200-300字）。`;
      }

      const result = await this.aiService.generateContent({
        prompt, platforms: ['通用'], contentType,
      });

      return { code: 200, msg: 'success', data: { skillId, skillName, category, contentType, content: result.content } };
    } catch (error) {
      return { code: 500, msg: error.message || '体验失败', data: null };
    }
  }

  @Get('categories')
  async getCategories() {
    try {
      if (this.skillService) {
        const categories = await this.skillService.getCategories();
        return { code: 200, msg: 'success', data: categories };
      }
    } catch (e) {
      console.error('[SkillController] getCategories error:', e.message)
    }
    return { code: 200, msg: 'success', data: [] };
  }
}
