// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { getMySQLClient } from '../../storage/database/mysql-client';

@Injectable()
export class UserService {
  async getUser(userId: string) {
    const db = getMySQLClient();
    const result = await db.query('users', { id: userId });
    return (result as any)?.data?.[0] || null;
  }

  async updateUser(userId: string, data: any) {
    const db = getMySQLClient();
    await db.updateWhere('users', { id: userId }, data);
    return { success: true };
  }

  async getUserStats(userId: string) {
    const db = getMySQLClient();
    const result = await db.query('users', { id: userId });
    const user = (result as any)?.data?.[0] || {};
    
    return {
      total_avatars: 0,
      total_posts: 0,
      total_earnings: 0,
      courses_completed: 0,
      skills_learned: 0,
      streak_days: 0
    };
  }

  async getSecurityStatus(userId: string) {
    const db = getMySQLClient();
    const result = await db.query('users', { id: userId });
    const user = (result as any)?.data?.[0] || {};
    
    return {
      hasPassword: true,
      hasPhone: !!user.phone,
      hasEmail: false,
      lastLoginTime: '刚刚',
      loginDevice: '微信小程序'
    };
  }
}
