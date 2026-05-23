// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

export interface CreateResultDto {
  orderId?: string
  order_id?: string
  avatarId?: string
  avatar_id?: string
  exposure?: number
  likes?: number
  comments?: number
  shares?: number
  linkUrl?: string
  link_url?: string
  description?: string
  screenshots?: string | string[]
}

@Injectable()
export class OrderResultsService {
  async createOrderResult(data: {
    order_id: string
    avatar_id: string
    exposure?: number
    likes?: number
    comments?: number
    shares?: number
    link_url?: string
    description?: string
    screenshots?: string | string[]
  }) {
    const db = getMySQLClient()

    const id = crypto.randomUUID()
    const insertResult = await db.insert('order_results', {
      id,
      order_id: data.order_id,
      avatar_id: data.avatar_id,
      platform: 'auto',
      task_description: data.description || data.link_url || '',
      actual_exposure: data.exposure || 0,
      actual_likes: data.likes || 0,
      actual_comments: data.comments || 0,
      actual_shares: data.shares || 0,
      quality_score: 0,
      notes: data.link_url || '',
      created_at: new Date(),
      screenshots: typeof data.screenshots === 'string' ? data.screenshots : JSON.stringify(data.screenshots || []),
    })

    if (insertResult.error) {
      console.error('[OrderResultsService] createOrderResult 失败:', insertResult.error)
    }

    return { id }
  }

  async getOrderResult(orderId: string) {
    const db = getMySQLClient()
    return await db.queryOne('order_results', { order_id: orderId }) as any
  }

  async getOrderResultsByOrder(orderId: string) {
    const db = getMySQLClient()
    return await db.query(
      'SELECT * FROM order_results WHERE order_id = ? ORDER BY created_at DESC',
      [orderId]
    )
  }

  async createResult(dto: CreateResultDto) {
    return this.createOrderResult({
      order_id: dto.orderId || dto.order_id || '',
      avatar_id: dto.avatarId || dto.avatar_id || '',
      exposure: dto.exposure,
      likes: dto.likes,
      comments: dto.comments,
      shares: dto.shares,
      link_url: dto.linkUrl || dto.link_url,
      description: dto.description,
      screenshots: dto.screenshots,
    })
  }

  async getOrderResults(orderId: string) {
    return this.getOrderResultsByOrder(orderId)
  }

  async getAvatarResults(avatarId: string) {
    const db = getMySQLClient()
    return await db.query(
      'SELECT * FROM order_results WHERE avatar_id = ? ORDER BY created_at DESC',
      [avatarId]
    )
  }
}
