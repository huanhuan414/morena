// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class HostingService {
  async startHosting(avatarId: string, settings: any) {
    const db = getMySQLClient()
    const result = await db.updateWhere('avatars', { id: parseInt(avatarId) }, {
      hosting_enabled: true,
      hosting_settings: JSON.stringify(settings),
      updated_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async stopHosting(avatarId: string) {
    const db = getMySQLClient()
    const result = await db.updateWhere('avatars', { id: parseInt(avatarId) }, {
      hosting_enabled: false,
      updated_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async getHostingStatus(avatarId: string) {
    const db = getMySQLClient()
    const result = await db.queryOne('avatars', { id: parseInt(avatarId) })
    return {
      enabled: result?.data?.hosting_enabled || false,
      settings: result?.data?.hosting_settings || {}
    }
  }

  async updateSettings(avatarId: string, settings: any) {
    const db = getMySQLClient()
    const result = await db.updateWhere('avatars', { id: parseInt(avatarId) }, {
      hosting_settings: JSON.stringify(settings),
      updated_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async getHostingLogs(avatarId: string, limit: number = 50) {
    const db = getMySQLClient()
    const result = await db.select('hosting_logs', { avatar_id: avatarId }, {
      orderBy: 'created_at',
      orderDirection: 'desc',
      limit
    })
    return result.data || []
  }
}
