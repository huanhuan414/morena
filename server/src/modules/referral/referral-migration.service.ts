import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class ReferralMigrationService {
  /**
   * 初始化邀请裂变活动表结构
   */
  async initReferralTables(): Promise<void> {
    const db = getMySQLClient()

    console.log('[ReferralMigrationService] 开始创建邀请裂变活动表结构...')

    // 1. 创建阶梯配置表
    await this.createReferralTiersTable(db)

    // 2. 创建任务链表
    await this.createReferralTaskChainsTable(db)

    // 3. 创建返佣记录表
    await this.createReferralCommissionsTable(db)

    // 4. 创建基础奖励发放记录表
    await this.createReferralRewardsTable(db)

    // 5. 创建风控记录表
    await this.createReferralRiskControlsTable(db)

    // 6. 初始化阶梯配置数据
    await this.initTierData(db)

    console.log('[ReferralMigrationService] 邀请裂变活动表结构初始化完成')
  }

  /**
   * 创建阶梯配置表
   */
  private async createReferralTiersTable(db: any): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_tiers (
        id VARCHAR(36) PRIMARY KEY,
        tier_level INT NOT NULL,
        min_invites INT NOT NULL,
        max_invites INT NOT NULL DEFAULT -1 COMMENT '-1表示无上限',
        base_reward DECIMAL(10,2) DEFAULT 0 COMMENT '基础现金奖励（元）',
        coins_reward INT DEFAULT 0 COMMENT '积分奖励',
        commission_rate DECIMAL(5,4) DEFAULT 0 COMMENT '返佣比例（0-1）',
        extra_reward VARCHAR(200) COMMENT '额外奖励描述',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_tier_level (tier_level),
        INDEX idx_min_invites (min_invites)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请阶梯配置表'
    `)
    console.log('[ReferralMigrationService] referral_tiers表创建成功')
  }

  /**
   * 创建任务链表
   */
  private async createReferralTaskChainsTable(db: any): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_task_chains (
        id VARCHAR(36) PRIMARY KEY,
        referral_id VARCHAR(36) NOT NULL COMMENT '关联referrals表',
        referrer_id VARCHAR(36) NOT NULL COMMENT '邀请人ID',
        referred_id VARCHAR(36) NOT NULL COMMENT '被邀请人ID',
        task_chain_status VARCHAR(20) DEFAULT 'registered' COMMENT '任务链状态: registered/avatar_created/order_completed/subscribed/expired',
        expires_at TIMESTAMP NOT NULL COMMENT '过期时间（72小时）',
        base_reward_status VARCHAR(20) DEFAULT 'pending' COMMENT '基础奖励状态: pending/completed',
        commission_enabled BOOLEAN DEFAULT FALSE COMMENT '返佣是否开启',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_referral_id (referral_id),
        INDEX idx_referrer_id (referrer_id),
        INDEX idx_referred_id (referred_id),
        INDEX idx_task_chain_status (task_chain_status),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请任务链表'
    `)
    console.log('[ReferralMigrationService] referral_task_chains表创建成功')
  }

  /**
   * 创建返佣记录表
   */
  private async createReferralCommissionsTable(db: any): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_commissions (
        id VARCHAR(36) PRIMARY KEY,
        referrer_id VARCHAR(36) NOT NULL COMMENT '邀请人ID',
        referred_id VARCHAR(36) NOT NULL COMMENT '被邀请人ID',
        consumption_type VARCHAR(50) NOT NULL COMMENT '消费类型: subscription/coin_recharge',
        consumption_amount DECIMAL(10,2) NOT NULL COMMENT '消费金额',
        commission_rate DECIMAL(5,4) NOT NULL COMMENT '返佣比例',
        commission_amount DECIMAL(10,2) NOT NULL COMMENT '返佣金额',
        status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending/completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_referrer_id (referrer_id),
        INDEX idx_referred_id (referred_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请返佣记录表'
    `)
    console.log('[ReferralMigrationService] referral_commissions表创建成功')
  }

  /**
   * 创建基础奖励发放记录表
   */
  private async createReferralRewardsTable(db: any): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_rewards (
        id VARCHAR(36) PRIMARY KEY,
        referrer_id VARCHAR(36) NOT NULL COMMENT '邀请人ID',
        referred_id VARCHAR(36) NOT NULL COMMENT '被邀请人ID',
        tier_level INT NOT NULL COMMENT '阶梯等级',
        base_reward DECIMAL(10,2) NOT NULL COMMENT '现金奖励',
        coins_reward INT NOT NULL COMMENT '积分奖励',
        reward_type VARCHAR(20) DEFAULT 'base' COMMENT '奖励类型: base/extra',
        status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending/completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_referrer_id (referrer_id),
        INDEX idx_referred_id (referred_id),
        INDEX idx_tier_level (tier_level),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请基础奖励记录表'
    `)
    console.log('[ReferralMigrationService] referral_rewards表创建成功')
  }

  /**
   * 创建风控记录表
   */
  private async createReferralRiskControlsTable(db: any): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_risk_controls (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        device_id VARCHAR(200) COMMENT '设备ID',
        ip_address VARCHAR(50) COMMENT 'IP地址',
        risk_type VARCHAR(50) NOT NULL COMMENT '风险类型: duplicate_device/duplicate_ip',
        risk_level VARCHAR(20) DEFAULT 'medium' COMMENT '风险等级: low/medium/high',
        action_taken VARCHAR(20) DEFAULT 'warn' COMMENT '处理措施: warn/freeze',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_device_id (device_id),
        INDEX idx_ip_address (ip_address)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请风控记录表'
    `)
    console.log('[ReferralMigrationService] referral_risk_controls表创建成功')
  }

  /**
   * 初始化阶梯配置数据（仅在表不存在数据时初始化）
   */
  private async initTierData(db: any): Promise<void> {
    // 检查表是否已有数据
    const existingData = await db.query(`SELECT COUNT(*) as count FROM referral_tiers`)

    if (existingData[0].count > 0) {
      console.log('[ReferralMigrationService] referral_tiers表已有数据，跳过初始化')
      return
    }

    // 仅在表为空时插入初始数据
    const tiers = [
      { id: 'tier_1', tier_level: 1, min_invites: 0, max_invites: 5, base_reward: 0, coins_reward: 10, commission_rate: 0.05, extra_reward: null },
      { id: 'tier_2', tier_level: 2, min_invites: 5, max_invites: 10, base_reward: 1, coins_reward: 10, commission_rate: 0.1, extra_reward: null },
      { id: 'tier_3', tier_level: 3, min_invites: 10, max_invites: 20, base_reward: 1, coins_reward: 15, commission_rate: 0.15, extra_reward: null },
      { id: 'tier_4', tier_level: 4, min_invites: 20, max_invites: 50, base_reward: 1, coins_reward: 15, commission_rate: 0.2, extra_reward: null },
      { id: 'tier_5', tier_level: 5, min_invites: 50, max_invites: -1, base_reward: 1, coins_reward: 20, commission_rate: 0.2, extra_reward: '价值298元礼品' }
    ]

    for (const tier of tiers) {
      await db.query(
        `INSERT INTO referral_tiers (id, tier_level, min_invites, max_invites, base_reward, coins_reward, commission_rate, extra_reward)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tier.id, tier.tier_level, tier.min_invites, tier.max_invites, tier.base_reward, tier.coins_reward, tier.commission_rate, tier.extra_reward]
      )
    }
    console.log('[ReferralMigrationService] 阶梯配置数据初始化成功')
  }
}