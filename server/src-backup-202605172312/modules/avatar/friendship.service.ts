// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class FriendshipService {
  async getFriends(avatarId: string) {
    const db = getMySQLClient()
    const result = await db.select('avatar_friends', { avatar_id: avatarId })
    return result.data || []
  }

  async addFriend(avatarId: string, friendAvatarId: string) {
    const db = getMySQLClient()
    const result = await db.insert('avatar_friends', {
      id: Date.now().toString(),
      avatar_id: avatarId,
      friend_avatar_id: friendAvatarId,
      status: 'active',
      created_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async removeFriend(avatarId: string, friendAvatarId: string) {
    const db = getMySQLClient()
    const result = await db.delete('avatar_friends', { 
      avatar_id: avatarId, 
      friend_avatar_id: friendAvatarId 
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async getRequests(avatarId: string) {
    const db = getMySQLClient()
    const result = await db.select('friend_requests', { 
      target_avatar_id: avatarId,
      status: 'pending'
    })
    return result.data || []
  }

  async sendRequest(fromAvatarId: string, toAvatarId: string, message?: string) {
    const db = getMySQLClient()
    const result = await db.insert('friend_requests', {
      id: Date.now().toString(),
      from_avatar_id: fromAvatarId,
      target_avatar_id: toAvatarId,
      message: message || '',
      status: 'pending',
      created_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async acceptRequest(requestId: string) {
    const db = getMySQLClient()
    const result = await db.updateWhere('friend_requests', { id: requestId }, { 
      status: 'accepted',
      updated_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async rejectRequest(requestId: string) {
    const db = getMySQLClient()
    const result = await db.updateWhere('friend_requests', { id: requestId }, { 
      status: 'rejected',
      updated_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }
}
