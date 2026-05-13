import { Injectable } from '@nestjs/common';
import { getMySQLClient } from '@/storage/database/mysql-client';
import { v4 as uuidv4 } from 'uuid';

/** 技能分类名称映射 */
const CATEGORY_NAMES: Record<string, string> = {
  content: '内容创作',
  video: '视频制作',
  audio: '音频处理',
  image: '图片生成',
  music: '音乐推荐',
  life: '生活服务',
  marketing: '营销推广',
  social: '社交互动',
  education: '教育学习',
  tool: '实用工具',
  service: '生活服务',
  growth: '成长提升',
  community: '社区互动',
  knowledge: '知识百科',
};

@Injectable()
export class SkillService {
  /** 获取技能列表 */
  async listSkills(category?: string, keyword?: string) {
    const db = getMySQLClient();
    let sql = 'SELECT * FROM skills WHERE is_active = 1';
    const params: any[] = [];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (keyword) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY sort_order ASC, usage_count DESC';

    const rows = await db.query(sql, params);
    return rows;
  }

  /** 获取分身已拥有的技能 */
  async getAvatarSkills(avatarId: string) {
    const db = getMySQLClient();
    const rows = await db.query(
      `SELECT s.id as skillId, s.name as skillName, s.description, s.category, s.icon, s.rating, s.usage_count, s.price, s.tags,
              ast.level, ast.experience, ast.unlocked, ast.created_at as assignedAt
       FROM skills s 
       INNER JOIN avatar_skills ast ON s.id = ast.skill_id 
       WHERE ast.avatar_id = ? AND s.is_active = 1
       ORDER BY s.sort_order ASC`,
      [avatarId],
    );
    return rows;
  }

  /** 给分身添加技能 */
  async addSkillToAvatar(avatarId: string, skillId: string) {
    const db = getMySQLClient();

    // 检查技能是否存在
    const skillRows: any[] = await db.query('SELECT id FROM skills WHERE id = ? AND is_active = 1', [skillId]);
    if (!skillRows || (Array.isArray(skillRows) && skillRows.length === 0)) {
      throw new Error('技能不存在');
    }

    // 检查是否已拥有
    const existing: any[] = await db.query(
      'SELECT id FROM avatar_skills WHERE avatar_id = ? AND skill_id = ?',
      [avatarId, skillId],
    );
    if (existing && Array.isArray(existing) && existing.length > 0) {
      return { alreadyOwned: true };
    }

    // 生成UUID作为id
    const id = uuidv4();

    // 添加技能
    await db.query(
      'INSERT INTO avatar_skills (id, avatar_id, skill_id, level, experience, unlocked) VALUES (?, ?, ?, 1, 0, 1)',
      [id, avatarId, skillId],
    );

    // 更新技能使用计数
    await db.query(
      'UPDATE skills SET usage_count = usage_count + 1 WHERE id = ?',
      [skillId],
    );

    return { success: true };
  }

  /** 移除分身的技能 */
  async removeSkillFromAvatar(avatarId: string, skillId: string) {
    const db = getMySQLClient();
    await db.query(
      'DELETE FROM avatar_skills WHERE avatar_id = ? AND skill_id = ?',
      [avatarId, skillId],
    );
    return { success: true };
  }

  /** 批量添加技能 */
  async batchAddSkills(avatarId: string, skillIds: string[]) {
    const db = getMySQLClient();
    const results = [];

    for (const skillId of skillIds) {
      try {
        // 检查技能是否存在
        const skillRows: any[] = await db.query('SELECT id FROM skills WHERE id = ? AND is_active = 1', [skillId]);
        if (!skillRows || (Array.isArray(skillRows) && skillRows.length === 0)) {
          results.push({ skillId, status: 'not_found' });
          continue;
        }

        // 跳过已拥有的
        const existing: any[] = await db.query(
          'SELECT id FROM avatar_skills WHERE avatar_id = ? AND skill_id = ?',
          [avatarId, skillId],
        );
        if (existing && Array.isArray(existing) && existing.length > 0) {
          results.push({ skillId, status: 'already_owned' });
          continue;
        }

        // 生成UUID
        const id = uuidv4();

        await db.query(
          'INSERT INTO avatar_skills (id, avatar_id, skill_id, level, experience, unlocked) VALUES (?, ?, ?, 1, 0, 1)',
          [id, avatarId, skillId],
        );
        await db.query(
          'UPDATE skills SET usage_count = usage_count + 1 WHERE id = ?',
          [skillId],
        );
        results.push({ skillId, status: 'added' });
      } catch (e) {
        results.push({ skillId, status: 'error', message: (e as Error).message });
      }
    }

    return results;
  }

  /** 获取技能分类统计 */
  async getSkillById(id: string) {
    const db = getMySQLClient();
    const rows = await db.query(
      'SELECT * FROM skills WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  async getCategories() {
    const db = getMySQLClient();
    const rows: any[] = await db.query(
      'SELECT category, COUNT(*) as count FROM skills WHERE is_active = 1 GROUP BY category ORDER BY count DESC',
    );

    // 映射分类名称
    return (rows || []).map((row: any) => ({
      key: row.category,
      name: CATEGORY_NAMES[row.category] || row.category,
      count: Number(row.count),
    }));
  }
}
