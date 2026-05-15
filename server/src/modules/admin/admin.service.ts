import { Injectable } from '@nestjs/common';
import { getMySQLClient } from '../../storage/database/mysql-client';

@Injectable()
export class AdminService {
  private generateToken(admin: any): string {
    return Buffer.from(JSON.stringify({
      id: admin.id,
      username: admin.username,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    })).toString('base64');
  }

  async verifyAdmin(username: string, password: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const result = await db.query(
        `SELECT * FROM admin_users WHERE username = ? AND password = ?`,
        [username, password]
      );
      
      if (result.error) {
        console.error('查询管理员失败:', result.error);
        return { success: false, message: '验证失败' };
      }
      
      if (result.data && result.data.length > 0) {
        const admin = result.data[0];
        return {
          success: true,
          message: '登录成功',
          data: { token: this.generateToken(admin), admin }
        };
      }
    } catch (error) {
      console.error('验证管理员失败:', error);
    }

    return { success: false, message: '账号或密码错误' };
  }

  async getDashboardStats(): Promise<any> {
    try {
      const db = getMySQLClient();
      
      const totalUsersResult = await db.query(`SELECT COUNT(*) as count FROM users`);
      const totalUsers = totalUsersResult.data?.[0]?.count || 0;
      
      const totalAvatarsResult = await db.query(`SELECT COUNT(*) as count FROM avatars`);
      const totalAvatars = totalAvatarsResult.data?.[0]?.count || 0;
      
      const totalOrdersResult = await db.query(`SELECT COUNT(*) as count FROM orders`);
      const totalOrders = totalOrdersResult.data?.[0]?.count || 0;
      
      const earningsResult = await db.query(`SELECT SUM(amount) as total FROM earnings WHERE type = 'revenue'`);
      const totalRevenue = earningsResult.data?.[0]?.total || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 19).replace('T', ' ');
      
      const todayNewUsersResult = await db.query(
        `SELECT COUNT(*) as count FROM users WHERE created_at >= ?`, [todayStr]
      );
      const todayNewUsers = todayNewUsersResult.data?.[0]?.count || 0;
      
      const todayOrdersResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE created_at >= ?`, [todayStr]
      );
      const todayOrders = todayOrdersResult.data?.[0]?.count || 0;
      
      const pendingOrdersResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'pending'`
      );
      const pendingOrders = pendingOrdersResult.data?.[0]?.count || 0;
      
      const pendingContentResult = await db.query(
        `SELECT COUNT(*) as count FROM posts WHERE status = 'pending'`
      );
      const pendingContent = pendingContentResult.data?.[0]?.count || 0;

      const acceptanceTimeout = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const acceptanceTimeoutStr = acceptanceTimeout.toISOString().slice(0, 19).replace('T', ' ');
      const acceptanceOverdueResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'awaiting_acceptance' AND updated_at < ?`,
        [acceptanceTimeoutStr]
      );
      const acceptanceOverdue = acceptanceOverdueResult.data?.[0]?.count || 0;

      return {
        totalUsers,
        totalAvatars,
        totalOrders,
        totalRevenue,
        todayNewUsers,
        todayOrders,
        pendingOrders,
        pendingContent,
        acceptanceOverdue
      };
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
      return {
        totalUsers: 0, totalAvatars: 0, totalOrders: 0, totalRevenue: 0,
        todayNewUsers: 0, todayOrders: 0, pendingOrders: 0, pendingContent: 0, acceptanceOverdue: 0
      };
    }
  }

  async getAcceptanceOverdueOrders(hours: number = 6, limit: number = 50): Promise<any> {
    try {
      const db = getMySQLClient();
      const timeout = new Date(Date.now() - hours * 60 * 60 * 1000);
      const timeoutStr = timeout.toISOString().slice(0, 19).replace('T', ' ');
      const result = await db.query(
        `SELECT id, user_id, title, status, updated_at
         FROM orders
         WHERE status = 'awaiting_acceptance'
         AND updated_at < ?
         ORDER BY updated_at ASC
         LIMIT ?`,
        [timeoutStr, limit]
      );
      return { list: result.data || [], total: (result.data || []).length, hours, limit };
    } catch (error) {
      console.error('获取待验收超时订单失败:', error);
      return { list: [], total: 0, hours, limit };
    }
  }

  async getUsers(page: number, limit: number, keyword?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const offset = (page - 1) * limit;
      
      let sql = `SELECT * FROM users`;
      let countSql = `SELECT COUNT(*) as count FROM users`;
      const params: any[] = [];
      
      if (keyword) {
        sql += ` WHERE (phone LIKE ? OR nickname LIKE ?)`;
        countSql += ` WHERE (phone LIKE ? OR nickname LIKE ?)`;
        const kw = `%${keyword}%`;
        params.push(kw, kw);
      }
      
      sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      
      const result = await db.query(sql, [...params, limit, offset]);
      const users = result.data || [];
      
      const countResult = await db.query(countSql, params);
      const total = countResult.data?.[0]?.count || 0;
      
      const usersWithStats = await Promise.all(users.map(async (user: any) => {
        const avatarResult = await db.query(
          `SELECT COUNT(*) as count FROM avatars WHERE user_id = ?`, [user.id]
        );
        const avatarCount = avatarResult.data?.[0]?.count || 0;
        
        const orderResult = await db.query(
          `SELECT COUNT(*) as count FROM orders WHERE user_id = ?`, [user.id]
        );
        const orderCount = orderResult.data?.[0]?.count || 0;
        
        return {
          ...user,
          avatar_count: avatarCount,
          order_count: orderCount
        };
      }));

      return { list: usersWithStats, total, page, limit };
    } catch (error) {
      console.error('获取用户列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async getUserDetail(userId: string): Promise<any> {
    try {
      const db = getMySQLClient();
      
      const userResult = await db.query(
        `SELECT * FROM users WHERE id = ?`, [userId]
      );
      const user = userResult.data?.[0];
      if (!user) return null;

      const avatarResult = await db.query(
        `SELECT COUNT(*) as count FROM avatars WHERE user_id = ?`, [userId]
      );
      const avatarCount = avatarResult.data?.[0]?.count || 0;
      
      const orderResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE user_id = ?`, [userId]
      );
      const orderCount = orderResult.data?.[0]?.count || 0;
      
      const postResult = await db.query(
        `SELECT COUNT(*) as count FROM posts WHERE user_id = ?`, [userId]
      );
      const postCount = postResult.data?.[0]?.count || 0;

      const earningsResult = await db.query(
        `SELECT SUM(amount) as total FROM earnings WHERE user_id = ?`, [userId]
      );
      const totalEarnings = earningsResult.data?.[0]?.total || 0;

      return {
        ...user,
        avatar_count: avatarCount,
        order_count: orderCount,
        post_count: postCount,
        total_earnings: totalEarnings
      };
    } catch (error) {
      console.error('获取用户详情失败:', error);
      return null;
    }
  }

  async getOrders(page: number, limit: number, status?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const offset = (page - 1) * limit;
      
      let sql = `SELECT o.*, u.nickname, u.phone 
                 FROM orders o 
                 LEFT JOIN users u ON o.user_id = u.id`;
      let countSql = `SELECT COUNT(*) as count FROM orders`;
      const params: any[] = [];
      
      if (status) {
        sql += ` WHERE o.status = ?`;
        countSql += ` WHERE status = ?`;
        params.push(status);
      }
      
      sql += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
      
      const result = await db.query(sql, [...params, limit, offset]);
      const orders = result.data || [];
      
      const countResult = await db.query(countSql, params);
      const total = countResult.data?.[0]?.count || 0;

      return { list: orders, total, page, limit };
    } catch (error) {
      console.error('获取订单列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async getAvatars(page: number, limit: number): Promise<any> {
    try {
      const db = getMySQLClient();
      const offset = (page - 1) * limit;
      
      const result = await db.query(
        `SELECT a.*, u.nickname, u.phone 
         FROM avatars a 
         LEFT JOIN users u ON a.user_id = u.id 
         ORDER BY a.created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const avatars = result.data || [];
      
      const countResult = await db.query(`SELECT COUNT(*) as count FROM avatars`);
      const total = countResult.data?.[0]?.count || 0;

      return { list: avatars, total, page, limit };
    } catch (error) {
      console.error('获取分身列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async getPosts(page: number, limit: number, status?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const offset = (page - 1) * limit;
      
      let sql = `SELECT p.*, u.nickname, av.name as avatar_name 
                 FROM posts p 
                 LEFT JOIN users u ON p.user_id = u.id 
                 LEFT JOIN avatars av ON p.avatar_id = av.id`;
      let countSql = `SELECT COUNT(*) as count FROM posts`;
      const params: any[] = [];
      
      if (status) {
        sql += ` WHERE p.status = ?`;
        countSql += ` WHERE status = ?`;
        params.push(status);
      }
      
      sql += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
      
      const result = await db.query(sql, [...params, limit, offset]);
      const posts = result.data || [];
      
      const countResult = await db.query(countSql, params);
      const total = countResult.data?.[0]?.count || 0;

      return { list: posts, total, page, limit };
    } catch (error) {
      console.error('获取内容列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async getSkills(page: number, limit: number): Promise<any> {
    try {
      const db = getMySQLClient();
      const offset = (page - 1) * limit;
      
      const result = await db.query(
        `SELECT * FROM skills ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const skills = result.data || [];
      
      const countResult = await db.query(`SELECT COUNT(*) as count FROM skills`);
      const total = countResult.data?.[0]?.count || 0;

      return { list: skills, total, page, limit };
    } catch (error) {
      console.error('获取技能列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async createSkill(data: { name: string; description: string; category: string; icon: string; prompt: string }): Promise<any> {
    try {
      const db = getMySQLClient();
      const id = `skill_${Date.now()}`;
      const result = await db.query(
        `INSERT INTO skills (id, name, description, category, icon, prompt, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
        [id, data.name, data.description, data.category, data.icon, data.prompt]
      );
      
      return { id, ...data, status: 'active' };
    } catch (error) {
      console.error('创建技能失败:', error);
      return null;
    }
  }

  async updateSkill(id: string, data: any): Promise<any> {
    try {
      const db = getMySQLClient();
      const fields: string[] = [];
      const params: any[] = [];
      
      if (data.name) {
        fields.push('name = ?');
        params.push(data.name);
      }
      if (data.description) {
        fields.push('description = ?');
        params.push(data.description);
      }
      if (data.category) {
        fields.push('category = ?');
        params.push(data.category);
      }
      if (data.icon) {
        fields.push('icon = ?');
        params.push(data.icon);
      }
      if (data.prompt) {
        fields.push('prompt = ?');
        params.push(data.prompt);
      }
      
      fields.push('updated_at = NOW()');
      params.push(id);
      
      await db.query(
        `UPDATE skills SET ${fields.join(', ')} WHERE id = ?`,
        params
      );
      
      return { id, ...data };
    } catch (error) {
      console.error('更新技能失败:', error);
      return null;
    }
  }

  async deleteSkill(id: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(`DELETE FROM skills WHERE id = ?`, [id]);
      return { success: true };
    } catch (error) {
      console.error('删除技能失败:', error);
      return { success: false };
    }
  }

  async updateSkillStatus(id: string, status: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(
        `UPDATE skills SET status = ?, updated_at = NOW() WHERE id = ?`,
        [status, id]
      );
      return { success: true };
    } catch (error) {
      console.error('更新技能状态失败:', error);
      return { success: false };
    }
  }

  async getWithdrawals(page: number, limit: number, status?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const offset = (page - 1) * limit;
      
      let sql = `SELECT w.*, u.nickname, u.phone 
                 FROM withdrawal_requests w 
                 LEFT JOIN users u ON w.user_id = u.id`;
      let countSql = `SELECT COUNT(*) as count FROM withdrawal_requests`;
      const params: any[] = [];
      
      if (status) {
        sql += ` WHERE w.status = ?`;
        countSql += ` WHERE status = ?`;
        params.push(status);
      }
      
      sql += ` ORDER BY w.created_at DESC LIMIT ? OFFSET ?`;
      
      const result = await db.query(sql, [...params, limit, offset]);
      const withdrawals = result.data || [];
      
      const countResult = await db.query(countSql, params);
      const total = countResult.data?.[0]?.count || 0;

      return { list: withdrawals, total, page, limit };
    } catch (error) {
      console.error('获取提现列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async approveWithdraw(id: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(
        `UPDATE withdrawal_requests SET status = 'approved', updated_at = NOW() WHERE id = ?`,
        [id]
      );
      return { success: true };
    } catch (error) {
      console.error('批准提现失败:', error);
      return { success: false };
    }
  }

  async rejectWithdraw(id: string, reason?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(
        `UPDATE withdrawal_requests SET status = 'rejected', reject_reason = ?, updated_at = NOW() WHERE id = ?`,
        [reason || '审核未通过', id]
      );
      return { success: true };
    } catch (error) {
      console.error('拒绝提现失败:', error);
      return { success: false };
    }
  }

  async getReferrers(page: number, limit: number): Promise<any> {
    try {
      const db = getMySQLClient();
      const offset = (page - 1) * limit;
      
      const result = await db.query(
        `SELECT r.*, u.nickname, u.phone,
                (SELECT COUNT(*) FROM users WHERE referral_code = r.code) as referral_count,
                (SELECT SUM(amount) FROM earnings WHERE user_id = r.user_id AND type = 'referral_bonus') as total_bonus
         FROM referrals r 
         LEFT JOIN users u ON r.user_id = u.id 
         ORDER BY r.created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const referrers = result.data || [];
      
      const countResult = await db.query(`SELECT COUNT(*) as count FROM referrals`);
      const total = countResult.data?.[0]?.count || 0;

      return { list: referrers, total, page, limit };
    } catch (error) {
      console.error('获取推荐列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async getSystemConfig(): Promise<any> {
    try {
      const db = getMySQLClient();
      const result = await db.query(`SELECT * FROM system_config WHERE id = 'system'`);
      return result.data?.[0] || {
        id: 'system',
        app_name: '我的分身',
        version: '1.0.0',
        maintenance_mode: false
      };
    } catch (error) {
      console.error('获取系统配置失败:', error);
      return null;
    }
  }

  async updateSystemConfig(data: any): Promise<any> {
    try {
      const db = getMySQLClient();
      const fields: string[] = [];
      const params: any[] = [];
      
      if (data.app_name) {
        fields.push('app_name = ?');
        params.push(data.app_name);
      }
      if (data.version) {
        fields.push('version = ?');
        params.push(data.version);
      }
      if (data.maintenance_mode !== undefined) {
        fields.push('maintenance_mode = ?');
        params.push(data.maintenance_mode);
      }
      
      fields.push('updated_at = NOW()');
      params.push('system');
      
      await db.query(
        `UPDATE system_config SET ${fields.join(', ')} WHERE id = ?`,
        params
      );
      
      return { success: true };
    } catch (error) {
      console.error('更新系统配置失败:', error);
      return { success: false };
    }
  }

  async getUserStats(userId: string): Promise<any> {
    try {
      const db = getMySQLClient();
      
      const avatarResult = await db.query(
        `SELECT COUNT(*) as count FROM avatars WHERE user_id = ?`, [userId]
      );
      const avatarCount = avatarResult.data?.[0]?.count || 0;
      
      const postResult = await db.query(
        `SELECT COUNT(*) as count FROM posts WHERE user_id = ?`, [userId]
      );
      const postCount = postResult.data?.[0]?.count || 0;
      
      const orderResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE user_id = ?`, [userId]
      );
      const orderCount = orderResult.data?.[0]?.count || 0;
      
      const earningsResult = await db.query(
        `SELECT SUM(amount) as total FROM earnings WHERE user_id = ?`, [userId]
      );
      const totalEarnings = earningsResult.data?.[0]?.total || 0;
      
      const followResult = await db.query(
        `SELECT COUNT(*) as count FROM follows WHERE user_id = ?`, [userId]
      );
      const followCount = followResult.data?.[0]?.count || 0;
      
      const fanResult = await db.query(
        `SELECT COUNT(*) as count FROM follows WHERE follow_id = ?`, [userId]
      );
      const fanCount = fanResult.data?.[0]?.count || 0;

      return {
        avatar_count: avatarCount,
        post_count: postCount,
        order_count: orderCount,
        total_earnings: totalEarnings,
        follow_count: followCount,
        fan_count: fanCount
      };
    } catch (error) {
      console.error('获取用户统计失败:', error);
      return {
        avatar_count: 0,
        post_count: 0,
        order_count: 0,
        total_earnings: 0,
        follow_count: 0,
        fan_count: 0
      };
    }
  }

  async login(username: string, password: string): Promise<any> {
    return this.verifyAdmin(username, password);
  }

  async verifyToken(token: string): Promise<any> {
    try {
      if (!token) {
        return null;
      }

      const normalizedToken = token.trim()
      if (!normalizedToken) {
        return null
      }

      const tokenValue = normalizedToken.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || normalizedToken
      if (!tokenValue) {
        return null
      }

      const tokenData = Buffer.from(tokenValue, 'base64').toString();
      const parsed = JSON.parse(tokenData);
      
      if (parsed.exp && Date.now() > parsed.exp) {
        return null;
      }
      
      const db = getMySQLClient();
      const result = await db.query(
        `SELECT * FROM admin_users WHERE id = ? AND username = ?`,
        [parsed.id, parsed.username]
      );
      
      if (result.data && result.data.length > 0) {
        return result.data[0];
      }
      return null;
    } catch (error) {
      console.error('验证token失败:', error);
      return null;
    }
  }

  async banUser(userId: string, banned: boolean, reason?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(
        `UPDATE users SET banned = ?, ban_reason = ?, updated_at = NOW() WHERE id = ?`,
        [banned ? 1 : 0, reason || '', userId]
      );
      return { success: true };
    } catch (error) {
      console.error('封禁用户失败:', error);
      return { success: false };
    }
  }

  async updateAvatarStatus(avatarId: string, status: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(
        `UPDATE avatars SET status = ?, updated_at = NOW() WHERE id = ?`,
        [status, avatarId]
      );
      return { success: true };
    } catch (error) {
      console.error('更新分身状态失败:', error);
      return { success: false };
    }
  }

  async updateOrderStatus(orderId: string, status: string, adminNote?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(
        `UPDATE orders SET status = ?, admin_note = ?, updated_at = NOW() WHERE id = ?`,
        [status, adminNote || '', orderId]
      );
      return { success: true };
    } catch (error) {
      console.error('更新订单状态失败:', error);
      return { success: false };
    }
  }

  async reviewPost(postId: string, status: string, reviewNote?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(
        `UPDATE posts SET status = ?, review_note = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [status, reviewNote || '', postId]
      );
      return { success: true };
    } catch (error) {
      console.error('审核内容失败:', error);
      return { success: false };
    }
  }

  async deletePost(postId: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(`DELETE FROM posts WHERE id = ?`, [postId]);
      return { success: true };
    } catch (error) {
      console.error('删除内容失败:', error);
      return { success: false };
    }
  }

  async getFinanceStats(startDate?: string, endDate?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      
      let dateFilter = '';
      const params: any[] = [];
      
      if (startDate && endDate) {
        dateFilter = ` WHERE created_at BETWEEN ? AND ?`;
        params.push(startDate, endDate);
      } else if (startDate) {
        dateFilter = ` WHERE created_at >= ?`;
        params.push(startDate);
      } else if (endDate) {
        dateFilter = ` WHERE created_at <= ?`;
        params.push(endDate);
      }
      
      const revenueResult = await db.query(
        `SELECT SUM(amount) as total FROM earnings ${dateFilter ? dateFilter.replace('WHERE', 'WHERE type = ? AND') : 'WHERE type = ?'}`,
        ['revenue', ...params]
      );
      const totalRevenue = revenueResult.data?.[0]?.total || 0;
      
      const withdrawalResult = await db.query(
        `SELECT SUM(amount) as total FROM withdrawal_requests ${dateFilter ? dateFilter.replace('WHERE', 'WHERE status = ? AND') : 'WHERE status = ?'}`,
        ['approved', ...params]
      );
      const totalWithdrawal = withdrawalResult.data?.[0]?.total || 0;
      
      const orderResult = await db.query(
        `SELECT COUNT(*) as count, SUM(total_price) as total FROM orders ${dateFilter}`,
        params
      );
      const orderCount = orderResult.data?.[0]?.count || 0;
      const orderAmount = orderResult.data?.[0]?.total || 0;

      return {
        totalRevenue,
        totalWithdrawal,
        balance: totalRevenue - totalWithdrawal,
        orderCount,
        orderAmount
      };
    } catch (error) {
      console.error('获取财务统计失败:', error);
      return {
        totalRevenue: 0,
        totalWithdrawal: 0,
        balance: 0,
        orderCount: 0,
        orderAmount: 0
      };
    }
  }

  async getTransactions(page: number, limit: number, type?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const offset = (page - 1) * limit;
      
      let sql = `SELECT t.*, u.nickname, u.phone 
                 FROM transactions t 
                 LEFT JOIN users u ON t.user_id = u.id`;
      let countSql = `SELECT COUNT(*) as count FROM transactions`;
      const params: any[] = [];
      
      if (type) {
        sql += ` WHERE t.type = ?`;
        countSql += ` WHERE type = ?`;
        params.push(type);
      }
      
      sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
      
      const result = await db.query(sql, [...params, limit, offset]);
      const transactions = result.data || [];
      
      const countResult = await db.query(countSql, params);
      const total = countResult.data?.[0]?.count || 0;

      return { list: transactions, total, page, limit };
    } catch (error) {
      console.error('获取交易记录失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async getReferralStats(): Promise<any> {
    try {
      const db = getMySQLClient();
      
      const totalResult = await db.query(`SELECT COUNT(*) as count FROM referrals`);
      const totalReferrers = totalResult.data?.[0]?.count || 0;
      
      const bonusResult = await db.query(
        `SELECT SUM(amount) as total FROM earnings WHERE type = 'referral_bonus'`
      );
      const totalBonus = bonusResult.data?.[0]?.total || 0;
      
      const usersResult = await db.query(
        `SELECT COUNT(*) as count FROM users WHERE referral_code IS NOT NULL AND referral_code != ''`
      );
      const referredUsers = usersResult.data?.[0]?.count || 0;

      return {
        totalReferrers,
        totalBonus,
        referredUsers,
        averageBonus: totalReferrers > 0 ? totalBonus / totalReferrers : 0
      };
    } catch (error) {
      console.error('获取推荐统计失败:', error);
      return {
        totalReferrers: 0,
        totalBonus: 0,
        referredUsers: 0,
        averageBonus: 0
      };
    }
  }

  async updateCommissionRate(rate: number): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(
        `INSERT INTO system_config (id, commission_rate, updated_at) 
         VALUES ('system', ?, NOW()) 
         ON DUPLICATE KEY UPDATE commission_rate = ?, updated_at = NOW()`,
        [rate, rate]
      );
      return { success: true, rate };
    } catch (error) {
      console.error('更新佣金比例失败:', error);
      return { success: false };
    }
  }

  async getAdmins(): Promise<any> {
    try {
      const db = getMySQLClient();
      const result = await db.query(`SELECT id, username, role, created_at FROM admin_users`);
      return result.data || [];
    } catch (error) {
      console.error('获取管理员列表失败:', error);
      return [];
    }
  }

  async addAdmin(username: string, password: string, role: string = 'admin'): Promise<any> {
    try {
      const db = getMySQLClient();
      const id = `admin_${Date.now()}`;
      await db.query(
        `INSERT INTO admin_users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, NOW())`,
        [id, username, password, role]
      );
      return { id, username, role };
    } catch (error) {
      console.error('添加管理员失败:', error);
      return null;
    }
  }

  async deleteAdmin(id: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(`DELETE FROM admin_users WHERE id = ?`, [id]);
      return { success: true };
    } catch (error) {
      console.error('删除管理员失败:', error);
      return { success: false };
    }
  }

  async changePassword(id: string, newPassword: string): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(
        `UPDATE admin_users SET password = ?, updated_at = NOW() WHERE id = ?`,
        [newPassword, id]
      );
      return { success: true };
    } catch (error) {
      console.error('修改密码失败:', error);
      return { success: false };
    }
  }

  async getConfig(key: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const result = await db.query(
        `SELECT * FROM system_config WHERE id = ?`, [key]
      );
      return result.data?.[0] || null;
    } catch (error) {
      console.error('获取配置失败:', error);
      return null;
    }
  }

  async updateConfig(key: string, value: any): Promise<any> {
    try {
      const db = getMySQLClient();
      await db.query(
        `INSERT INTO system_config (id, config_value, updated_at) 
         VALUES (?, ?, NOW()) 
         ON DUPLICATE KEY UPDATE config_value = ?, updated_at = NOW()`,
        [key, JSON.stringify(value), JSON.stringify(value)]
      );
      return { success: true };
    } catch (error) {
      console.error('更新配置失败:', error);
      return { success: false };
    }
  }
}
