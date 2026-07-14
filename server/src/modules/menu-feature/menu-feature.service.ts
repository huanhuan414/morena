import { Injectable } from '@nestjs/common';
import { getMySQLClient } from '../../storage/database/mysql-client';

type MenuFeatureRow = {
  menuKey: string;
  enabled: number;
  minVersion?: string | null;
  maxVersion?: string | null;
};

@Injectable()
export class MenuFeatureService {
  async getEnabledMenuKeys(version?: string, envVersion?: string): Promise<string[]> {
    const client = getMySQLClient('menu_feature');
    const result = await client.query(`
      SELECT
        menu_key as menuKey,
        enabled,
        min_version as minVersion,
        max_version as maxVersion
      FROM menu_feature
      WHERE module = 'profile'
      ORDER BY sort_order ASC
    `) as MenuFeatureRow[];

    const currentVersion = String(version || '').trim();
    const currentEnv = String(envVersion || '').trim().toLowerCase();
    const shouldApplyReviewControl = currentEnv !== 'release' && !!currentVersion;

    return result
      .filter((item) => {
        if (!shouldApplyReviewControl) return true;

        const inControlVersion = this.isVersionInRange(
          currentVersion,
          item.minVersion,
          item.maxVersion,
        );

        if (!inControlVersion) return true;
        return Number(item.enabled) === 1;
      })
      .map((item) => item.menuKey);
  }

  private isVersionInRange(version: string, minVersion?: string | null, maxVersion?: string | null): boolean {
    const min = String(minVersion || '').trim();
    const max = String(maxVersion || '').trim();
    if (!min && !max) return false;
    if (min && this.compareVersions(version, min) < 0) return false;
    if (max && this.compareVersions(version, max) > 0) return false;
    return true;
  }

  private compareVersions(left: string, right: string): number {
    const leftParts = this.parseVersion(left);
    const rightParts = this.parseVersion(right);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let i = 0; i < length; i += 1) {
      const leftValue = leftParts[i] || 0;
      const rightValue = rightParts[i] || 0;
      if (leftValue > rightValue) return 1;
      if (leftValue < rightValue) return -1;
    }

    return 0;
  }

  private parseVersion(version: string): number[] {
    return String(version || '')
      .replace(/^v/i, '')
      .split(/[._-]/)
      .map((part) => Number.parseInt(part.replace(/\D/g, ''), 10))
      .map((part) => (Number.isFinite(part) ? part : 0));
  }
}