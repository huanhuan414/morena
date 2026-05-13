import { Controller, Get, Post, Delete, Query, Body, Param, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { SkillService } from './skill.service';
import { AiService } from '../ai/ai.service';

@Controller('skills')
export class SkillController {
  constructor(
    private readonly skillService: SkillService,
    private readonly aiService: AiService,
  ) {}

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

  /** 体验技能 - 根据技能类型生成体验内容 */
  @Post(':id/try')
  @HttpCode(HttpStatus.OK)
  async trySkill(
    @Param('id') skillId: string,
    @Body() body: { input?: string },
  ) {
    try {
      const skill = await this.skillService.getSkillById(skillId);
      if (!skill) {
        return { code: 404, msg: '技能不存在', data: null };
      }

      const userInput = body.input || '';
      const category = skill.category;
      const skillName = skill.name;

      // 根据技能类型构建不同的体验 prompt
      let prompt = '';
      let contentType = 'text';

      switch (category) {
        case 'life':
          // 看手相、衣品改造等生活类
          if (skillName.includes('手相')) {
            prompt = `你是一位经验丰富的手相大师。用户想要体验看手相服务。${userInput ? `用户说：${userInput}` : '请为用户模拟一次看手相体验，给出一个生动有趣的手相分析结果，包括：感情线、智慧线、生命线的解读，以及整体运势分析。风格要幽默风趣，让人会心一笑。'}请用轻松愉快的语气，给出一段完整的手相解读（200-300字）。`;
          } else if (skillName.includes('衣品')) {
            prompt = `你是一位顶级时尚造型师。用户想要体验衣品改造服务。${userInput ? `用户说：${userInput}` : '请为用户模拟一次衣品改造体验，根据用户的风格偏好给出穿搭建议。'}请给出完整的穿搭方案，包括：风格定位、色彩搭配、单品推荐、场合穿搭（200-300字）。`;
          } else {
            prompt = `你是一位${skillName}领域的专家。${userInput ? `用户输入：${userInput}` : '请为用户做一次体验演示。'}请给出专业且有趣的体验结果（200-300字）。`;
          }
          break;

        case 'image':
          prompt = `你是一位AI绘画创意大师。用户想要体验图片生成服务。${userInput ? `用户想生成：${userInput}` : '请为用户模拟一次AI图片生成体验，展示一段精彩的画面描述。'}请输出：1）画面标题 2）详细画面描述（150字以上，包含构图、色彩、光影、风格等细节）3）适合的平台和用途 4）画面情感基调。让用户感受到AI绘画的强大创意能力。`;
          contentType = 'image';
          break;

        case 'video':
          prompt = `你是一位AI视频创意导演。用户想要体验视频生成服务。${userInput ? `用户想生成：${userInput}` : '请为用户模拟一次AI视频生成体验，展示一段精彩的视频创意方案。'}请输出：1）视频标题 2）视频类型（竖屏/横屏）3）时长建议 4）分镜头脚本（3-5个镜头，每个包含画面描述、镜头运动、时长）5）背景音乐风格建议 6）目标平台推荐。让用户感受到AI视频创作的专业能力。`;
          contentType = 'video';
          break;

        case 'content':
          prompt = `你是一位顶级内容创作专家。用户想要体验内容创作服务。${userInput ? `用户想创作：${userInput}` : '请为用户模拟一次爆款内容创作体验，生成一篇示例内容。'}请输出：1）标题（吸引眼球）2）正文内容（200字以上的优质文案）3）推荐标签 4）适合发布的平台 5）预计曝光量级别。让用户感受到AI内容创作的强大实力。`;
          contentType = 'content';
          break;

        default:
          prompt = `你是一位${skillName}领域的专家。${userInput ? `用户输入：${userInput}` : '请为用户做一次精彩的体验演示。'}请给出专业且有趣的体验结果（200-300字）。`;
      }

      const result = await this.aiService.generateContent({
        prompt,
        platforms: ['通用'],
        contentType,
      });

      return {
        code: 200,
        msg: 'success',
        data: {
          skillId,
          skillName,
          category,
          contentType,
          content: result.content,
        },
      };
    } catch (error) {
      return { code: 500, msg: error.message || '体验失败', data: null };
    }
  }

  /** 获取技能分类统计 */
  @Get('categories')
  async getCategories() {
    const categories = await this.skillService.getCategories();
    return { code: 200, msg: 'success', data: categories };
  }
}
