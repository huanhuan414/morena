import { Injectable } from '@nestjs/common';
import { getMySQLClient } from '../../storage/database/mysql-client';

@Injectable()
export class MenuFeatureService {
  async getEnabledMenuKeys(): Promise<string[]> {
    const client = getMySQLClient('menu_feature');
    const result = await client.query(`
      SELECT menu_key as menuKey
      FROM menu_feature
      WHERE enabled = 1 and module = 'profile'
      ORDER BY sort_order ASC
    `);
    return result.map((item: { menuKey: string }) => item.menuKey);
  }
}