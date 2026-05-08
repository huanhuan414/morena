// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class EarningsService {
  async createEarning(userId: string, data: {
    type: string
    amount: number
    description?: string
    reference_id?: string
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('earnings', {
      id,
      user_id: userId,
      type: data.type,
      amount: data.amount,
      description: data.description || '',
      reference_id: data.reference_id || null,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { id }
  }

  async getEarnings(userId: string, page = 1, pageSize = 20) {
    const db = getMySQLClient()
    
    const earnings = await db.query('earnings', { user_id: userId }) as any
    const total = earnings?.length || 0
    const offset = (page - 1) * pageSize
    
    return {
      list: earnings?.slice(offset, offset + pageSize) || [],
      total,
      page,
      pageSize
    }
  }

  async getEarningStats(userId: string) {
    const db = getMySQLClient()
    
    const earnings = await db.query('earnings', { user_id: userId }) as any
    const totalEarnings = earnings?.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) || 0
    const pendingEarnings = earnings?.filter((e: any) => e.status === 'pending')
      .reduce((sum: number, e: any) => sum + (e.amount || 0), 0) || 0
    
    return {
      total_earnings: totalEarnings,
      pending_earnings: pendingEarnings,
      available_earnings: totalEarnings - pendingEarnings
    }
  }

  async updateEarningStatus(earningId: string, status: string) {
    const db = getMySQLClient()
    
    await db.updateWhere('earnings', { id: earningId }, {
      status,
      updated_at: new Date()
    })
    
    return { success: true }
  }
}

import * as crypto from 'crypto'
