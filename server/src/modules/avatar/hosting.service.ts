import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class HostingService {
  private avatarColumnsCache: Set<string> | null = null

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      return normalized === '1' || normalized === 'true'
    }
    return false
  }

  private async getAvatarTableColumns(): Promise<Set<string>> {
    if (this.avatarColumnsCache) {
      return this.avatarColumnsCache
    }

    const db = getMySQLClient()
    const rows = await db.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'avatars'
    `)

    this.avatarColumnsCache = new Set(
      (rows || [])
        .map((row: any) => String(row.columnName || row.COLUMN_NAME || row.column_name || '').toLowerCase())
        .filter(Boolean)
    )

    return this.avatarColumnsCache
  }

  private async buildHostingUpdate(enabled: boolean, settings?: any): Promise<Record<string, any>> {
    const columns = await this.getAvatarTableColumns()
    const updateData: Record<string, any> = {
      updated_at: new Date()
    }

    if (columns.has('trust_enabled')) {
      updateData.trust_enabled = enabled ? 1 : 0
    }

    if (columns.has('is_hosted')) {
      updateData.is_hosted = enabled ? 1 : 0
    }

    if (columns.has('hosting_enabled')) {
      updateData.hosting_enabled = enabled ? 1 : 0
    }

    if (settings !== undefined && columns.has('hosting_settings')) {
      updateData.hosting_settings = JSON.stringify(settings || {})
    }

    return updateData
  }

  async startHosting(avatarId: string, settings: any) {
    const db = getMySQLClient()
    const result = await db.updateWhere('avatars', { id: avatarId }, await this.buildHostingUpdate(true, settings))
    return { success: (result as any).affectedRows > 0 }
  }

  async stopHosting(avatarId: string) {
    const db = getMySQLClient()
    const result = await db.updateWhere('avatars', { id: avatarId }, await this.buildHostingUpdate(false))
    return { success: (result as any).affectedRows > 0 }
  }

  async getHostingStatus(avatarId: string) {
    const db = getMySQLClient()
    const rows = await db.query(
      'SELECT id, trust_enabled, is_hosted, hosting_enabled, hosting_settings FROM avatars WHERE id = ? LIMIT 1',
      [avatarId]
    ) as any[]
    const result = rows?.[0]
    return {
      enabled: this.parseBoolean(
        result?.trust_enabled
        ?? result?.is_hosted
        ?? result?.hosting_enabled
      ),
      settings: (() => {
        if (!result?.hosting_settings) return {}
        if (typeof result.hosting_settings === 'object') return result.hosting_settings
        try {
          return JSON.parse(result.hosting_settings)
        } catch {
          return {}
        }
      })()
    }
  }

  async updateSettings(avatarId: string, settings: any) {
    const db = getMySQLClient()
    const result = await db.updateWhere('avatars', { id: avatarId }, await this.buildHostingUpdate(true, settings))
    return { success: (result as any).affectedRows > 0 }
  }

  async getHostingLogs(avatarId: string, limit: number = 50) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT *
       FROM hosting_logs
       WHERE avatar_id = ?
       ORDER BY created_at DESC
       LIMIT ${Math.max(1, limit)}`,
      [avatarId]
    ) as any[]
    return rows || []
  }
}
