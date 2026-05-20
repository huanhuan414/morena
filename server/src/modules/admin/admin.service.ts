import { Injectable } from '@nestjs/common';
import { getMySQLClient } from '../../storage/database/mysql-client';
import { ensureGrowthCampaignTables } from '../activities/growth-campaign.tables';
import { isOrderStatus } from '../order/order-status';
import type {
  AdminFailureReasons,
  AdminMetricsFunnel,
  AdminMetricsOverview,
  FailureReasonItem,
  MetricsRangeInput,
  MetricsRangeResolved,
} from './admin.metrics.types'

@Injectable()
export class AdminService {
  private tableColumnsCache = new Map<string, Set<string>>()

  private unwrapRows(result: any): any[] {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (Array.isArray(result.data)) return result.data;
    return [];
  }

  private unwrapFirst(result: any): any {
    return this.unwrapRows(result)[0];
  }

  private async ensureGrowthCampaignTables(): Promise<void> {
    await ensureGrowthCampaignTables();
  }

  private async getTableColumns(tableName: string): Promise<Set<string>> {
    const cached = this.tableColumnsCache.get(tableName)
    if (cached) return cached

    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    )
    const columns = new Set<string>(
      (rows || [])
        .map((row: any) => String(row.columnName || row.COLUMN_NAME || row.column_name || '').toLowerCase())
        .filter(Boolean)
    )
    this.tableColumnsCache.set(tableName, columns)
    return columns
  }

  private resolveRange(input: MetricsRangeInput | undefined, defaults: { days: number }): MetricsRangeResolved {
    const rawDays = input?.days
    const normalizedDays = Math.max(1, Math.min(90, Number(rawDays ?? defaults.days) || defaults.days))
    const startDate = String(input?.startDate || '').trim()
    const endDate = String(input?.endDate || '').trim()

    if (startDate || endDate) {
      const safeStart = startDate ? `${startDate} 00:00:00` : null
      const safeEnd = endDate ? `${endDate} 23:59:59` : null
      const now = new Date()
      const fallbackEnd = now.toISOString().slice(0, 19).replace('T', ' ')
      const fallbackStartDate = new Date(Date.now() - (normalizedDays - 1) * 24 * 60 * 60 * 1000)
      const fallbackStart = fallbackStartDate.toISOString().slice(0, 19).replace('T', ' ')
      return {
        mode: 'custom',
        days: normalizedDays,
        startAt: safeStart || fallbackStart,
        endAt: safeEnd || fallbackEnd,
      }
    }

    const startAtDate = new Date(Date.now() - (normalizedDays - 1) * 24 * 60 * 60 * 1000)
    const startAt = startAtDate.toISOString().slice(0, 19).replace('T', ' ')
    const endAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    return { mode: 'days', days: normalizedDays, startAt, endAt }
  }

  private buildTimeFilter(column: string, range: MetricsRangeResolved): { where: string; params: any[] } {
    const params: any[] = []
    let where = ''
    if (range.mode === 'custom') {
      where = ` WHERE ${column} BETWEEN ? AND ?`
      params.push(range.startAt, range.endAt)
      return { where, params }
    }
    where = ` WHERE ${column} >= ?`
    params.push(range.startAt)
    return { where, params }
  }

  private buildOrderAmountExpr(orderColumns: Set<string>): string {
    if (orderColumns.has('total_price')) return 'o.total_price'
    if (orderColumns.has('budget')) return 'o.budget'
    if (orderColumns.has('price')) return 'o.price'
    return '0'
  }

  async getGrowthCampaignConfig(): Promise<any> {
    try {
      await this.ensureGrowthCampaignTables();
      const db = getMySQLClient();
      const result = await db.query(`SELECT * FROM growth_campaigns WHERE id = 'current' LIMIT 1`);
      const row = result.data?.[0] || result?.[0];
      return {
        id: 'current',
        enabled: Number(row?.enabled || 0),
        title: row?.title || '',
        description: row?.description || '',
        startAt: row?.start_at || row?.startAt || '',
        endAt: row?.end_at || row?.endAt || '',
        updatedAt: row?.updated_at || row?.updatedAt || null,
      };
    } catch (error) {
      console.error('获取活动配置失败:', error);
      return {
        id: 'current',
        enabled: 0,
        title: '',
        description: '',
        startAt: '',
        endAt: '',
      };
    }
  }

  async getMetricsOverview(input?: MetricsRangeInput): Promise<AdminMetricsOverview> {
    const range = this.resolveRange(input, { days: 30 })
    const db = getMySQLClient()

    const [orderColumns, userColumns, avatarColumns] = await Promise.all([
      this.getTableColumns('orders'),
      this.getTableColumns('users'),
      this.getTableColumns('avatars'),
    ])

    const orderCreatedAt = orderColumns.has('created_at') ? 'o.created_at' : 'o.updated_at'
    const orderTime = this.buildTimeFilter(orderCreatedAt, range)
    const orderAmountExpr = this.buildOrderAmountExpr(orderColumns)

    const totalOrdersRes = await db.query(`SELECT COUNT(*) as count FROM orders o${orderTime.where}`, orderTime.params)
    const totalOrders = Number(this.unwrapFirst(totalOrdersRes)?.count || 0)

    let paidOrders: number | null = null
    if (orderColumns.has('is_paid')) {
      const paidRes = await db.query(
        `SELECT COUNT(*) as count FROM orders o${orderTime.where}${orderTime.where ? ' AND' : ' WHERE'} IFNULL(o.is_paid, 0) = 1`,
        orderTime.params
      )
      paidOrders = Number(this.unwrapFirst(paidRes)?.count || 0)
    }

    const totalGmvRes = await db.query(
      `SELECT COALESCE(SUM(${orderAmountExpr}), 0) as total FROM orders o${orderTime.where}`,
      orderTime.params
    )
    const totalGmv = Number(this.unwrapFirst(totalGmvRes)?.total || 0) || 0

    const verifiedSupported = orderColumns.has('publish_verified')
    let verifiedOrderCount = 0
    let verifiedGmv = 0
    if (verifiedSupported) {
      const verifiedCountRes = await db.query(
        `SELECT COUNT(*) as count FROM orders o${orderTime.where}${orderTime.where ? ' AND' : ' WHERE'} o.publish_verified = 1`,
        orderTime.params
      )
      verifiedOrderCount = Number(this.unwrapFirst(verifiedCountRes)?.count || 0)

      const verifiedGmvRes = await db.query(
        `SELECT COALESCE(SUM(${orderAmountExpr}), 0) as total FROM orders o${orderTime.where}${orderTime.where ? ' AND' : ' WHERE'} o.publish_verified = 1`,
        orderTime.params
      )
      verifiedGmv = Number(this.unwrapFirst(verifiedGmvRes)?.total || 0) || 0
    }

    const userCreatedAt = userColumns.has('created_at') ? 'created_at' : 'updated_at'
    const userTime = this.buildTimeFilter(userCreatedAt, range)
    const newUsersRes = await db.query(`SELECT COUNT(*) as count FROM users${userTime.where}`, userTime.params)
    const newUsers = Number(this.unwrapFirst(newUsersRes)?.count || 0)

    let activeAvatars = 0
    if (avatarColumns.size > 0) {
      try {
        const res = await db.query(
          avatarColumns.has('status')
            ? `SELECT COUNT(*) as count FROM avatars WHERE status = 'active'`
            : `SELECT COUNT(*) as count FROM avatars`
        )
        activeAvatars = Number(this.unwrapFirst(res)?.count || 0)
      } catch {
        activeAvatars = 0
      }
    }

    return {
      range,
      northStar: { verifiedGmv, verifiedOrderCount },
      kpi: { totalOrders, paidOrders, totalGmv, newUsers, activeAvatars },
    }
  }

  async getMetricsFunnel(input?: MetricsRangeInput): Promise<AdminMetricsFunnel> {
    const range = this.resolveRange(input, { days: 30 })
    const db = getMySQLClient()

    const [orderColumns, avatarColumns, dispatchColumns] = await Promise.all([
      this.getTableColumns('orders'),
      this.getTableColumns('avatars'),
      this.getTableColumns('order_dispatch_requests'),
    ])

    const orderCreatedAt = orderColumns.has('created_at') ? 'created_at' : 'updated_at'
    const orderTime = this.buildTimeFilter(`o.${orderCreatedAt}`, range)

    const ordersCreatedRes = await db.query(`SELECT COUNT(*) as count FROM orders o${orderTime.where}`, orderTime.params)
    const ordersCreated = Number(this.unwrapFirst(ordersCreatedRes)?.count || 0)

    let ordersPaid: number | null = null
    const ordersPaidSupported = orderColumns.has('is_paid')
    if (ordersPaidSupported) {
      const paidRes = await db.query(
        `SELECT COUNT(*) as count FROM orders o${orderTime.where}${orderTime.where ? ' AND' : ' WHERE'} IFNULL(o.is_paid, 0) = 1`,
        orderTime.params
      )
      ordersPaid = Number(this.unwrapFirst(paidRes)?.count || 0)
    }

    const dispatchCreatedAt = dispatchColumns.has('created_at') ? 'created_at' : 'updated_at'
    const dispatchTime = this.buildTimeFilter(`od.${dispatchCreatedAt}`, range)
    const dispatchedOrders = dispatchColumns.size > 0
      ? Number(
          this.unwrapFirst(
            await db.query(
              `SELECT COUNT(DISTINCT od.order_id) as count FROM order_dispatch_requests od${dispatchTime.where}`,
              dispatchTime.params
            )
          )?.count || 0
        )
      : 0

    const acceptedOrders = dispatchColumns.size > 0
      ? Number(
          this.unwrapFirst(
            await db.query(
              `SELECT COUNT(DISTINCT od.order_id) as count
               FROM order_dispatch_requests od${dispatchTime.where}${dispatchTime.where ? ' AND' : ' WHERE'}
               od.status IN ('accepted', 'completed', 'settled', 'done')`,
              dispatchTime.params
            )
          )?.count || 0
        )
      : 0

    const publishedOrdersRes = await db.query(
      `SELECT COUNT(*) as count FROM orders o${orderTime.where}${orderTime.where ? ' AND' : ' WHERE'}
       o.status IN ('published', 'awaiting_acceptance', 'publish_failed', 'publish_timeout', 'completed')`,
      orderTime.params
    )
    const publishedOrders = Number(this.unwrapFirst(publishedOrdersRes)?.count || 0)

    const verifiedOrders = orderColumns.has('publish_verified')
      ? Number(
          this.unwrapFirst(
            await db.query(
              `SELECT COUNT(*) as count FROM orders o${orderTime.where}${orderTime.where ? ' AND' : ' WHERE'} o.publish_verified = 1`,
              orderTime.params
            )
          )?.count || 0
        )
      : 0

    const dispatchSettledSupported = dispatchColumns.has('status')
    let settledOrders = 0
    if (dispatchSettledSupported) {
      const settledRes = await db.query(
        `SELECT COUNT(DISTINCT od.order_id) as count
         FROM order_dispatch_requests od${dispatchTime.where}${dispatchTime.where ? ' AND' : ' WHERE'}
         od.status IN ('settled', 'done')`,
        dispatchTime.params
      )
      settledOrders = Number(this.unwrapFirst(settledRes)?.count || 0)
    } else {
      const settledFallbackRes = await db.query(
        `SELECT COUNT(*) as count FROM orders o${orderTime.where}${orderTime.where ? ' AND' : ' WHERE'} o.status = 'completed'`,
        orderTime.params
      )
      settledOrders = Number(this.unwrapFirst(settledFallbackRes)?.count || 0)
    }

    const demandRaw: Array<{ key: string; label: string; count: number | null }> = [
      { key: 'orders_created', label: '需求：创建订单', count: ordersCreated },
      { key: 'orders_paid', label: '需求：支付订单', count: ordersPaid },
      { key: 'orders_dispatched', label: '需求：进入派单', count: dispatchedOrders },
      { key: 'orders_accepted', label: '需求：有人接单', count: acceptedOrders },
      { key: 'orders_published_stage', label: '需求：到达发布阶段', count: publishedOrders },
      { key: 'orders_verified', label: '需求：验真通过', count: verifiedOrders },
      { key: 'orders_settled', label: '需求：结算完成', count: settledOrders },
    ]

    const calcSteps = (steps: Array<{ key: string; label: string; count: number | null }>) => {
      const out: Array<{ key: string; label: string; count: number | null; conversionFromPrev: number | null }> = []
      for (let i = 0; i < steps.length; i++) {
        const cur = steps[i]
        if (i === 0) {
          out.push({ ...cur, conversionFromPrev: null })
          continue
        }
        const prevCount = steps[i - 1].count
        const curCount = cur.count
        if (prevCount === null || curCount === null) {
          out.push({ ...cur, conversionFromPrev: null })
          continue
        }
        out.push({ ...cur, conversionFromPrev: prevCount > 0 ? curCount / prevCount : 0 })
      }
      return out
    }

    let activeAvatars = 0
    if (avatarColumns.size > 0) {
      try {
        const res = await db.query(
          avatarColumns.has('status')
            ? `SELECT COUNT(*) as count FROM avatars WHERE status = 'active'`
            : `SELECT COUNT(*) as count FROM avatars`
        )
        activeAvatars = Number(this.unwrapFirst(res)?.count || 0)
      } catch {}
    }

    const hasDispatchAvatarId = dispatchColumns.has('avatar_id')
    const hasDispatchTargetAvatarId = dispatchColumns.has('target_avatar_id')
    const avatarIdExpr = hasDispatchAvatarId && hasDispatchTargetAvatarId
      ? 'COALESCE(od.avatar_id, od.target_avatar_id)'
      : (hasDispatchAvatarId ? 'od.avatar_id' : (hasDispatchTargetAvatarId ? 'od.target_avatar_id' : 'NULL'))

    let dispatchedAvatars = 0
    if (dispatchColumns.size > 0 && (hasDispatchTargetAvatarId || hasDispatchAvatarId)) {
      const field = hasDispatchTargetAvatarId ? 'od.target_avatar_id' : 'od.avatar_id'
      dispatchedAvatars = Number(
        this.unwrapFirst(
          await db.query(
            `SELECT COUNT(DISTINCT ${field}) as count FROM order_dispatch_requests od${dispatchTime.where}`,
            dispatchTime.params
          )
        )?.count || 0
      )
    }

    const acceptedAvatars = dispatchColumns.size > 0
      ? Number(
          this.unwrapFirst(
            await db.query(
              `SELECT COUNT(DISTINCT ${avatarIdExpr}) as count
               FROM order_dispatch_requests od${dispatchTime.where}${dispatchTime.where ? ' AND' : ' WHERE'}
               od.status IN ('accepted', 'completed', 'settled', 'done')`,
              dispatchTime.params
            )
          )?.count || 0
        )
      : 0

    const completedAvatars = dispatchColumns.size > 0
      ? Number(
          this.unwrapFirst(
            await db.query(
              `SELECT COUNT(DISTINCT ${avatarIdExpr}) as count
               FROM order_dispatch_requests od${dispatchTime.where}${dispatchTime.where ? ' AND' : ' WHERE'}
               od.status IN ('completed', 'settled', 'done')`,
              dispatchTime.params
            )
          )?.count || 0
        )
      : 0

    let settledAvatars = 0
    if (dispatchSettledSupported) {
      const settledRes = await db.query(
        `SELECT COUNT(DISTINCT ${avatarIdExpr}) as count
         FROM order_dispatch_requests od${dispatchTime.where}${dispatchTime.where ? ' AND' : ' WHERE'}
         od.status IN ('settled', 'done')`,
        dispatchTime.params
      )
      settledAvatars = Number(this.unwrapFirst(settledRes)?.count || 0)
    } else {
      settledAvatars = completedAvatars
    }

    const supplyRaw: Array<{ key: string; label: string; count: number | null }> = [
      { key: 'avatars_active', label: '供给：活跃分身', count: activeAvatars },
      { key: 'avatars_dispatched', label: '供给：收到派单', count: dispatchedAvatars },
      { key: 'avatars_accepted', label: '供给：接单分身', count: acceptedAvatars },
      { key: 'avatars_completed', label: '供给：完成履约', count: completedAvatars },
      { key: 'avatars_settled', label: '供给：结算完成', count: settledAvatars },
    ]

    return {
      range,
      demand: calcSteps(demandRaw),
      supply: calcSteps(supplyRaw),
      flags: {
        ordersPaidSupported,
        dispatchSettledSupported,
      },
    }
  }

  private mergeReasonCounts(target: Map<string, number>, items: FailureReasonItem[]) {
    for (const item of items) {
      const reason = String(item.reason || '').trim() || 'unknown'
      const prev = target.get(reason) || 0
      target.set(reason, prev + Number(item.count || 0))
    }
  }

  private toTopReasons(map: Map<string, number>, top: number): FailureReasonItem[] {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([reason, count]) => ({ reason, count }))
  }

  async getFailureReasons(input?: MetricsRangeInput & { top?: number }): Promise<AdminFailureReasons> {
    const range = this.resolveRange(input, { days: 30 })
    const top = Math.max(1, Math.min(50, Number((input as any)?.top ?? 10) || 10))
    const db = getMySQLClient()

    const [dispatchColumns, contentColumns, orderColumns] = await Promise.all([
      this.getTableColumns('order_dispatch_requests'),
      this.getTableColumns('content_generation_requests'),
      this.getTableColumns('orders'),
    ])

    const dispatchMap = new Map<string, number>()
    if (dispatchColumns.size > 0) {
      try {
        const timeCol = dispatchColumns.has('created_at') ? 'created_at' : 'updated_at'
        const t = this.buildTimeFilter(timeCol, range)
        const reasonExpr = dispatchColumns.has('reject_reason')
          ? `COALESCE(NULLIF(TRIM(reject_reason), ''), status)`
          : `status`
        const rows = await db.query(
          `SELECT ${reasonExpr} as reason, COUNT(*) as count
           FROM order_dispatch_requests${t.where}${t.where ? ' AND' : ' WHERE'}
           status IN ('rejected', 'expired', 'timeout')
           GROUP BY reason
           ORDER BY count DESC
           LIMIT ?`,
          [...t.params, top]
        )
        this.mergeReasonCounts(dispatchMap, this.unwrapRows(rows) as any)
      } catch {}
    }

    const fulfillmentMap = new Map<string, number>()
    if (contentColumns.size > 0) {
      try {
        const timeCol = contentColumns.has('created_at') ? 'created_at' : 'updated_at'
        const t = this.buildTimeFilter(timeCol, range)
        const errorExpr = contentColumns.has('error')
          ? `COALESCE(NULLIF(TRIM(error), ''), 'unknown_error')`
          : `'unknown_error'`
        const rows = await db.query(
          `SELECT ${errorExpr} as reason, COUNT(*) as count
           FROM content_generation_requests${t.where}${t.where ? ' AND' : ' WHERE'}
           status IN ('failed', 'partial_failed')
           GROUP BY reason
           ORDER BY count DESC
           LIMIT ?`,
          [...t.params, top]
        )
        this.mergeReasonCounts(fulfillmentMap, this.unwrapRows(rows) as any)
      } catch {}
    }

    const verificationMap = new Map<string, number>()
    if (orderColumns.size > 0) {
      try {
        const timeCol = orderColumns.has('created_at') ? 'created_at' : 'updated_at'
        const t = this.buildTimeFilter(`o.${timeCol}`, range)
        const rows = await db.query(
          `SELECT o.status as reason, COUNT(*) as count
           FROM orders o${t.where}${t.where ? ' AND' : ' WHERE'}
           o.status IN ('publish_failed', 'publish_timeout')
           GROUP BY o.status`,
          t.params
        )
        this.mergeReasonCounts(verificationMap, this.unwrapRows(rows) as any)
      } catch {}
    }

    try {
      const logColumns = await this.getTableColumns('order_timeout_logs')
      if (logColumns.size > 0) {
        const timeCol = logColumns.has('created_at') ? 'created_at' : 'updated_at'
        const t = this.buildTimeFilter(timeCol, range)
        const noteExpr = logColumns.has('notes')
          ? `COALESCE(NULLIF(TRIM(notes), ''), 'publish_timeout')`
          : `'publish_timeout'`
        const rows = await db.query(
          `SELECT ${noteExpr} as reason, COUNT(*) as count
           FROM order_timeout_logs${t.where}${t.where ? ' AND' : ' WHERE'}
           event_type = 'publish_timeout'
           GROUP BY reason
           ORDER BY count DESC
           LIMIT ?`,
          [...t.params, top]
        )
        this.mergeReasonCounts(verificationMap, this.unwrapRows(rows) as any)
      }
    } catch {}

    const settlementMap = new Map<string, number>()
    try {
      const wrColumns = await this.getTableColumns('withdrawal_requests')
      if (wrColumns.size > 0) {
        const timeCol = wrColumns.has('created_at') ? 'created_at' : 'updated_at'
        const t = this.buildTimeFilter(timeCol, range)
        const reasonExpr = wrColumns.has('reject_reason')
          ? `COALESCE(NULLIF(TRIM(reject_reason), ''), 'rejected')`
          : `'rejected'`
        const rows = await db.query(
          `SELECT ${reasonExpr} as reason, COUNT(*) as count
           FROM withdrawal_requests${t.where}${t.where ? ' AND' : ' WHERE'}
           status = 'rejected'
           GROUP BY reason
           ORDER BY count DESC
           LIMIT ?`,
          [...t.params, top]
        )
        this.mergeReasonCounts(settlementMap, this.unwrapRows(rows) as any)
      }
    } catch {}

    try {
      const payoutColumns = await this.getTableColumns('referral_payouts')
      if (payoutColumns.size > 0) {
        const timeCol = payoutColumns.has('created_at') ? 'created_at' : 'updated_at'
        const t = this.buildTimeFilter(timeCol, range)
        const reasonExpr = payoutColumns.has('review_reason')
          ? `COALESCE(NULLIF(TRIM(review_reason), ''), 'rejected')`
          : `'rejected'`
        const rows = await db.query(
          `SELECT ${reasonExpr} as reason, COUNT(*) as count
           FROM referral_payouts${t.where}${t.where ? ' AND' : ' WHERE'}
           status = 'rejected'
           GROUP BY reason
           ORDER BY count DESC
           LIMIT ?`,
          [...t.params, top]
        )
        this.mergeReasonCounts(settlementMap, this.unwrapRows(rows) as any)
      }
    } catch {}

    return {
      range,
      top,
      groups: [
        { key: 'dispatch', label: '分发', items: this.toTopReasons(dispatchMap, top) },
        { key: 'fulfillment', label: '履约', items: this.toTopReasons(fulfillmentMap, top) },
        { key: 'verification', label: '验真', items: this.toTopReasons(verificationMap, top) },
        { key: 'settlement', label: '结算', items: this.toTopReasons(settlementMap, top) },
      ],
    }
  }

  async updateGrowthCampaignConfig(payload: any): Promise<any> {
    try {
      await this.ensureGrowthCampaignTables();
      const db = getMySQLClient();
      const enabled = payload?.enabled ? 1 : 0;
      const title = payload?.title || '';
      const description = payload?.description || '';
      const startAt = payload?.startAt ? new Date(payload.startAt) : null;
      const endAt = payload?.endAt ? new Date(payload.endAt) : null;

      await db.query(
        `INSERT INTO growth_campaigns (id, enabled, title, description, start_at, end_at, created_at, updated_at)
         VALUES ('current', ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), title = VALUES(title), description = VALUES(description),
         start_at = VALUES(start_at), end_at = VALUES(end_at), updated_at = NOW()`,
        [enabled, title, description, startAt, endAt]
      );

      return { success: true, data: await this.getGrowthCampaignConfig() };
    } catch (error) {
      console.error('更新活动配置失败:', error);
      return { success: false, data: null };
    }
  }

  async getGrowthCampaignStats(days: number = 7): Promise<any> {
    try {
      await this.ensureGrowthCampaignTables();
      const db = getMySQLClient();
      const normalizedDays = Math.max(1, Math.min(30, Number(days) || 7));
      const result = await db.query(
        `SELECT DATE(created_at) as day, event_type, COUNT(*) as count
         FROM growth_campaign_events
         WHERE campaign_id = 'current' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(created_at), event_type
         ORDER BY day DESC`,
        [normalizedDays - 1]
      );
      const rows = result.data || result || [];
      const statMap = new Map<string, { exposures: number; clicks: number }>();

      for (const row of rows) {
        const day = String(row.day || '');
        if (!day) continue;
        const current = statMap.get(day) || { exposures: 0, clicks: 0 };
        if (row.event_type === 'exposure') current.exposures = Number(row.count || 0);
        if (row.event_type === 'click') current.clicks = Number(row.count || 0);
        statMap.set(day, current);
      }

      const daily: Array<{ day: string; exposures: number; clicks: number }> = [];
      let totalExposures = 0;
      let totalClicks = 0;
      for (let i = 0; i < normalizedDays; i++) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const day = d.toISOString().slice(0, 10);
        const current = statMap.get(day) || { exposures: 0, clicks: 0 };
        totalExposures += current.exposures;
        totalClicks += current.clicks;
        daily.push({ day, exposures: current.exposures, clicks: current.clicks });
      }

      return {
        days: normalizedDays,
        totalExposures,
        totalClicks,
        clickThroughRate: totalExposures > 0 ? totalClicks / totalExposures : 0,
        daily,
      };
    } catch (error) {
      console.error('获取活动统计失败:', error);
      return {
        days: Number(days) || 7,
        totalExposures: 0,
        totalClicks: 0,
        clickThroughRate: 0,
        daily: [],
      };
    }
  }

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

      const rows = this.unwrapRows(result);
      if (rows.length > 0) {
        const admin = rows[0];
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
      const totalUsers = this.unwrapFirst(totalUsersResult)?.count || 0;
      
      const totalAvatarsResult = await db.query(`SELECT COUNT(*) as count FROM avatars`);
      const totalAvatars = this.unwrapFirst(totalAvatarsResult)?.count || 0;
      
      const totalOrdersResult = await db.query(`SELECT COUNT(*) as count FROM orders`);
      const totalOrders = this.unwrapFirst(totalOrdersResult)?.count || 0;
      
      const earningsResult = await db.query(`SELECT SUM(amount) as total FROM earnings WHERE type = 'revenue'`);
      const totalRevenue = this.unwrapFirst(earningsResult)?.total || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 19).replace('T', ' ');
      
      const todayNewUsersResult = await db.query(
        `SELECT COUNT(*) as count FROM users WHERE created_at >= ?`, [todayStr]
      );
      const todayNewUsers = this.unwrapFirst(todayNewUsersResult)?.count || 0;
      
      const todayOrdersResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE created_at >= ?`, [todayStr]
      );
      const todayOrders = this.unwrapFirst(todayOrdersResult)?.count || 0;
      
      const pendingOrdersResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'pending'`
      );
      const pendingOrders = this.unwrapFirst(pendingOrdersResult)?.count || 0;
      
      const pendingContentResult = await db.query(
        `SELECT COUNT(*) as count FROM posts WHERE status = 'pending'`
      );
      const pendingContent = this.unwrapFirst(pendingContentResult)?.count || 0;

      const acceptanceTimeout = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const acceptanceTimeoutStr = acceptanceTimeout.toISOString().slice(0, 19).replace('T', ' ');
      const acceptanceOverdueResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'awaiting_acceptance' AND updated_at < ?`,
        [acceptanceTimeoutStr]
      );
      const acceptanceOverdue = this.unwrapFirst(acceptanceOverdueResult)?.count || 0;

      const pendingDispatchResult = await db.query(
        `SELECT COUNT(*) as count FROM order_dispatch_requests WHERE status = 'pending'`
      );
      const pendingDispatch = this.unwrapFirst(pendingDispatchResult)?.count || 0;

      const dispatchExpiredResult = await db.query(
        `SELECT COUNT(*) as count FROM order_dispatch_requests WHERE status = 'expired' AND updated_at >= ?`,
        [todayStr]
      );
      const dispatchExpiredToday = this.unwrapFirst(dispatchExpiredResult)?.count || 0;

      const awaitingAcceptanceResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'awaiting_acceptance'`
      );
      const awaitingAcceptance = this.unwrapFirst(awaitingAcceptanceResult)?.count || 0;

      return {
        totalUsers,
        totalAvatars,
        totalOrders,
        totalRevenue,
        todayNewUsers,
        todayOrders,
        pendingOrders,
        pendingContent,
        acceptanceOverdue,
        pendingDispatch,
        dispatchExpiredToday,
        awaitingAcceptance
      };
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
      return {
        totalUsers: 0, totalAvatars: 0, totalOrders: 0, totalRevenue: 0,
        todayNewUsers: 0, todayOrders: 0, pendingOrders: 0, pendingContent: 0, acceptanceOverdue: 0,
        pendingDispatch: 0, dispatchExpiredToday: 0, awaitingAcceptance: 0
      };
    }
  }

  async getDashboardTrends(days: number = 7): Promise<any> {
    try {
      const db = getMySQLClient();
      const normalizedDays = Math.max(1, Math.min(30, Number(days) || 7));

      const [usersResult, ordersResult, revenueResult] = await Promise.all([
        db.query(
          `SELECT DATE(created_at) as day, COUNT(*) as count
           FROM users
           WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           GROUP BY DATE(created_at)`,
          [normalizedDays - 1]
        ),
        db.query(
          `SELECT DATE(created_at) as day, COUNT(*) as count
           FROM orders
           WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           GROUP BY DATE(created_at)`,
          [normalizedDays - 1]
        ),
        db.query(
          `SELECT DATE(created_at) as day, COALESCE(SUM(amount), 0) as total
           FROM earnings
           WHERE type = 'revenue' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           GROUP BY DATE(created_at)`,
          [normalizedDays - 1]
        ),
      ]);

      const usersRows = this.unwrapRows(usersResult);
      const ordersRows = this.unwrapRows(ordersResult);
      const revenueRows = this.unwrapRows(revenueResult);

      const usersMap = new Map<string, number>();
      const ordersMap = new Map<string, number>();
      const revenueMap = new Map<string, number>();

      for (const row of usersRows) {
        const day = String((row as any).day || '');
        if (!day) continue;
        usersMap.set(day, Number((row as any).count || 0));
      }
      for (const row of ordersRows) {
        const day = String((row as any).day || '');
        if (!day) continue;
        ordersMap.set(day, Number((row as any).count || 0));
      }
      for (const row of revenueRows) {
        const day = String((row as any).day || '');
        if (!day) continue;
        revenueMap.set(day, Number((row as any).total || 0));
      }

      const daily: Array<{ day: string; newUsers: number; orders: number; revenue: number }> = [];
      let totalNewUsers = 0;
      let totalOrders = 0;
      let totalRevenue = 0;
      for (let i = 0; i < normalizedDays; i++) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const day = d.toISOString().slice(0, 10);
        const newUsers = usersMap.get(day) || 0;
        const orders = ordersMap.get(day) || 0;
        const revenue = revenueMap.get(day) || 0;
        totalNewUsers += newUsers;
        totalOrders += orders;
        totalRevenue += revenue;
        daily.push({ day, newUsers, orders, revenue });
      }

      return { days: normalizedDays, totalNewUsers, totalOrders, totalRevenue, daily };
    } catch (error) {
      console.error('获取仪表盘趋势失败:', error);
      return {
        days: Number(days) || 7,
        totalNewUsers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        daily: [],
      };
    }
  }

  async getSupplyQueue(queue: string, limit: number = 20): Promise<any> {
    const db = getMySQLClient();
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 20));

    if (queue === 'pending_dispatch') {
      const result = await db.query(
        `SELECT od.id, od.order_id, od.target_avatar_id as avatar_id, od.created_at,
                o.title as order_title,
                a.name as avatar_name
         FROM order_dispatch_requests od
         LEFT JOIN orders o ON od.order_id = o.id
         LEFT JOIN avatars a ON od.target_avatar_id = a.id
         WHERE od.status = 'pending'
         ORDER BY od.created_at ASC
         LIMIT ?`,
        [safeLimit]
      );
      const list = this.unwrapRows(result);
      return { queue, list, total: list.length };
    }

    if (queue === 'dispatch_expired') {
      const result = await db.query(
        `SELECT od.id, od.order_id, od.avatar_id, od.responded_at, od.updated_at,
                o.title as order_title,
                a.name as avatar_name
         FROM order_dispatch_requests od
         LEFT JOIN orders o ON od.order_id = o.id
         LEFT JOIN avatars a ON od.avatar_id = a.id
         WHERE od.status = 'expired'
         ORDER BY COALESCE(od.responded_at, od.updated_at) DESC
         LIMIT ?`,
        [safeLimit]
      );
      const list = this.unwrapRows(result);
      return { queue, list, total: list.length };
    }

    if (queue === 'awaiting_acceptance') {
      const result = await db.query(
        `SELECT o.id, o.user_id, o.title, o.updated_at, o.assigned_to,
                a.name as avatar_name
         FROM orders o
         LEFT JOIN avatars a ON o.assigned_to = a.id
         WHERE o.status = 'awaiting_acceptance'
         ORDER BY o.updated_at ASC
         LIMIT ?`,
        [safeLimit]
      );
      const list = this.unwrapRows(result);
      return { queue, list, total: list.length };
    }

    return { queue, list: [], total: 0 };
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
      const list = this.unwrapRows(result);
      return { list, total: list.length, hours, limit };
    } catch (error) {
      console.error('获取待验收超时订单失败:', error);
      return { list: [], total: 0, hours, limit };
    }
  }

  async getUsers(page: number, limit: number, keyword?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const safePage = Math.max(1, Number(page) || 1)
      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
      const offset = (safePage - 1) * safeLimit;
      
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
      
      const result = await db.query(sql, [...params, safeLimit, offset]);
      const users = this.unwrapRows(result);
      
      const countResult = await db.query(countSql, params);
      const total = this.unwrapFirst(countResult)?.count || 0;
      
      const usersWithStats = await Promise.all(users.map(async (user: any) => {
        const avatarResult = await db.query(
          `SELECT COUNT(*) as count FROM avatars WHERE user_id = ?`, [user.id]
        );
        const avatarCount = this.unwrapFirst(avatarResult)?.count || 0;
        
        const orderResult = await db.query(
          `SELECT COUNT(*) as count FROM orders WHERE user_id = ?`, [user.id]
        );
        const orderCount = this.unwrapFirst(orderResult)?.count || 0;
        
        return {
          ...user,
          avatar_count: avatarCount,
          order_count: orderCount
        };
      }));

      return { list: usersWithStats, total, page: safePage, limit: safeLimit };
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
      const user = this.unwrapFirst(userResult);
      if (!user) return null;

      const avatarResult = await db.query(
        `SELECT COUNT(*) as count FROM avatars WHERE user_id = ?`, [userId]
      );
      const avatarCount = this.unwrapFirst(avatarResult)?.count || 0;
      
      const orderResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE user_id = ?`, [userId]
      );
      const orderCount = this.unwrapFirst(orderResult)?.count || 0;
      
      const postResult = await db.query(
        `SELECT COUNT(*) as count FROM posts WHERE user_id = ?`, [userId]
      );
      const postCount = this.unwrapFirst(postResult)?.count || 0;

      const earningsResult = await db.query(
        `SELECT SUM(amount) as total FROM earnings WHERE user_id = ?`, [userId]
      );
      const totalEarnings = this.unwrapFirst(earningsResult)?.total || 0;

      const spentResult = await db.query(
        `SELECT SUM(budget) as total FROM orders WHERE user_id = ? AND is_paid = 1`, [userId]
      );
      const totalSpent = this.unwrapFirst(spentResult)?.total || 0;

      const friendResult = await db.query(
        `SELECT COUNT(*) as count FROM friendships WHERE (user_id = ? OR friend_id = ?) AND status = ?`,
        [userId, userId, 'accepted']
      );
      const friendCount = this.unwrapFirst(friendResult)?.count || 0;

      return {
        ...user,
        avatar_count: avatarCount,
        order_count: orderCount,
        post_count: postCount,
        total_earnings: totalEarnings,
        total_spent: totalSpent,
        friend_count: friendCount
      };
    } catch (error) {
      console.error('获取用户详情失败:', error);
      return null;
    }
  }

  async getOrders(page: number, limit: number, keyword?: string, status?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const safePage = Math.max(1, Number(page) || 1)
      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
      const offset = (safePage - 1) * safeLimit;
      
      let sql = `SELECT o.*, u.nickname, u.phone, a.name as avatar_name
                 FROM orders o 
                 LEFT JOIN users u ON o.user_id = u.id
                 LEFT JOIN avatars a ON o.avatar_id = a.id`;
      let countSql = `SELECT COUNT(*) as count FROM orders o 
                      LEFT JOIN users u ON o.user_id = u.id
                      LEFT JOIN avatars a ON o.avatar_id = a.id`;
      const params: any[] = [];
      const where: string[] = [];
      
      if (status) {
        const value = String(status).trim().toLowerCase()
        const statusGroupMap: Record<string, string[]> = {
          pending: ['pending_payment', 'open', 'pending_dispatch', 'pending_acceptance'],
          processing: ['in_progress', 'submitted', 'awaiting_acceptance', 'revision_requested'],
          completed: ['completed'],
          cancelled: ['cancelled', 'rejected'],
        }
        const statusList = statusGroupMap[value] || [value]
        if (statusList.length === 1) {
          where.push(`o.status = ?`)
          params.push(statusList[0])
        } else if (statusList.length > 1) {
          where.push(`o.status IN (${statusList.map(() => '?').join(', ')})`)
          params.push(...statusList)
        }
      }

      if (keyword) {
        const kw = `%${keyword}%`
        where.push(`(o.title LIKE ? OR o.id LIKE ? OR u.phone LIKE ? OR u.nickname LIKE ? OR a.name LIKE ?)`)
        params.push(kw, kw, kw, kw, kw)
      }

      if (where.length > 0) {
        sql += ` WHERE ${where.join(' AND ')}`
        countSql += ` WHERE ${where.join(' AND ')}`
      }
      
      sql += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
      
      const result = await db.query(sql, [...params, safeLimit, offset]);
      const orders = this.unwrapRows(result);
      
      const countResult = await db.query(countSql, params);
      const total = this.unwrapFirst(countResult)?.count || 0;

      return { list: orders, total, page: safePage, limit: safeLimit };
    } catch (error) {
      console.error('获取订单列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async getAvatars(page: number, limit: number, keyword?: string, status?: string, userId?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const safePage = Math.max(1, Number(page) || 1)
      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
      const offset = (safePage - 1) * safeLimit

      let sql = `SELECT
          a.id,
          a.user_id,
          a.name,
          a.avatar_url,
          a.status,
          a.created_at,
          a.hosting_enabled,
          a.hosting_price,
          a.total_orders,
          a.completion_rate,
          u.phone as user_phone
        FROM avatars a
        LEFT JOIN users u ON a.user_id = u.id`
      let countSql = `SELECT COUNT(*) as count FROM avatars a LEFT JOIN users u ON a.user_id = u.id`
      const params: any[] = []

      const where: string[] = []
      if (status) {
        where.push('a.status = ?')
        params.push(status)
      }
      if (userId) {
        where.push('a.user_id = ?')
        params.push(userId)
      }
      if (keyword) {
        where.push('(a.name LIKE ? OR u.phone LIKE ? OR u.nickname LIKE ?)')
        const kw = `%${keyword}%`
        params.push(kw, kw, kw)
      }
      if (where.length > 0) {
        sql += ` WHERE ${where.join(' AND ')}`
        countSql += ` WHERE ${where.join(' AND ')}`
      }

      sql += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`

      const result = await db.query(sql, [...params, safeLimit, offset])
      const avatars = this.unwrapRows(result)

      const countResult = await db.query(countSql, params)
      const total = this.unwrapFirst(countResult)?.count || 0

      return { list: avatars, total, page: safePage, limit: safeLimit };
    } catch (error) {
      console.error('获取分身列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async getAvatarDetail(avatarId: string): Promise<any> {
    try {
      const db = getMySQLClient()
      const result = await db.query(
        `SELECT
          a.*,
          u.phone as user_phone,
          u.nickname as user_nickname
        FROM avatars a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.id = ?
        LIMIT 1`,
        [avatarId]
      )
      const avatar = this.unwrapFirst(result)
      if (!avatar) return null

      const conversationsCountRes = await db.query(
        `SELECT COUNT(*) as count FROM conversations WHERE avatar_id = ?`,
        [avatarId]
      )
      const conversationsCount = Number(this.unwrapFirst(conversationsCountRes)?.count || 0)

      return { ...avatar, conversations_count: conversationsCount }
    } catch (error) {
      console.error('获取分身详情失败:', error)
      return null
    }
  }

  async getAvatarConversations(avatarId: string, page: number, limit: number): Promise<any> {
    try {
      const db = getMySQLClient()
      const safePage = Math.max(1, Number(page) || 1)
      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
      const offset = (safePage - 1) * safeLimit

      const listRes = await db.query(
        `SELECT
          c.id,
          c.user_id,
          c.avatar_id,
          c.title,
          c.updated_at,
          c.created_at,
          u.phone as user_phone,
          u.nickname as user_nickname,
          (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
        FROM conversations c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.avatar_id = ?
        ORDER BY c.updated_at DESC
        LIMIT ? OFFSET ?`,
        [avatarId, safeLimit, offset]
      )
      const list = this.unwrapRows(listRes)

      const countRes = await db.query(
        `SELECT COUNT(*) as count FROM conversations WHERE avatar_id = ?`,
        [avatarId]
      )
      const total = Number(this.unwrapFirst(countRes)?.count || 0)

      return { list, total, page: safePage, limit: safeLimit }
    } catch (error) {
      console.error('获取分身对话列表失败:', error)
      return { list: [], total: 0, page, limit }
    }
  }

  async getConversationMessages(conversationId: string): Promise<any[]> {
    try {
      const db = getMySQLClient()
      const result = await db.query(
        `SELECT id, conversation_id, role, content, metadata, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC`,
        [conversationId]
      )
      const list = this.unwrapRows(result)
      return list.map((item: any) => {
        const raw = item?.metadata
        let metadata: any = null
        if (raw) {
          try {
            metadata = typeof raw === 'string' ? JSON.parse(raw) : raw
          } catch {
            metadata = null
          }
        }
        return { ...item, metadata }
      })
    } catch (error) {
      console.error('获取对话消息失败:', error)
      return []
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
      const posts = this.unwrapRows(result);
      
      const countResult = await db.query(countSql, params);
      const total = this.unwrapFirst(countResult)?.count || 0;

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

      const columns = await this.getTableColumns('skills')
      const orderByParts: string[] = []
      if (columns.has('sort_order')) orderByParts.push('sort_order ASC')
      if (columns.has('usage_count')) orderByParts.push('usage_count DESC')
      if (columns.has('created_at')) orderByParts.push('created_at DESC')
      if (orderByParts.length === 0) orderByParts.push('id DESC')

      const result = await db.query(
        `SELECT * FROM skills ORDER BY ${orderByParts.join(', ')} LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const skills = this.unwrapRows(result).map((row: any) => {
        const usageCount =
          Number(row.usage_count ?? row.usageCount ?? row.order_count ?? row.orderCount ?? 0) || 0
        const isActiveRaw = row.is_active ?? row.isActive
        const isActiveFromStatus =
          typeof row.status === 'string' ? (row.status.toLowerCase() === 'active' ? 1 : 0) : undefined
        const isActive = Number(isActiveRaw ?? isActiveFromStatus ?? 0) ? 1 : 0
        return {
          ...row,
          order_count: usageCount,
          status: isActive ? 'active' : 'inactive',
        }
      })

      const countResult = await db.query(`SELECT COUNT(*) as count FROM skills`);
      const total = this.unwrapFirst(countResult)?.count || 0;

      return { list: skills, total, page, limit };
    } catch (error) {
      console.error('获取技能列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async createSkill(data: { name: string; description: string; category?: string; icon?: string; price?: number }): Promise<any> {
    try {
      const db = getMySQLClient();
      const name = String(data.name || '').trim()
      const description = String(data.description || '').trim()
      if (!name || !description) {
        return { success: false, message: '请填写完整信息', data: null }
      }

      const columns = await this.getTableColumns('skills')
      const id = `skill_${Date.now()}`

      const insertCols: string[] = []
      const insertVals: string[] = []
      const params: any[] = []

      const pushParam = (col: string, value: any) => {
        if (!columns.has(col)) return
        insertCols.push(col)
        insertVals.push('?')
        params.push(value)
      }
      const pushNow = (col: string) => {
        if (!columns.has(col)) return
        insertCols.push(col)
        insertVals.push('NOW()')
      }

      pushParam('id', id)
      pushParam('name', name)
      pushParam('description', description)
      pushParam('category', String(data.category || 'content'))
      pushParam('icon', String(data.icon || '🔧'))
      pushParam('price', Number(data.price || 0))

      if (columns.has('is_active')) pushParam('is_active', 1)
      if (columns.has('status')) pushParam('status', 'active')
      if (columns.has('usage_count')) pushParam('usage_count', 0)
      if (columns.has('sort_order')) pushParam('sort_order', 0)
      if (columns.has('rating')) pushParam('rating', 0)

      pushNow('created_at')
      pushNow('updated_at')

      if (insertCols.length === 0) {
        return { success: false, message: 'skills 表结构异常', data: null }
      }

      await db.query(
        `INSERT INTO skills (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        params
      )

      return {
        success: true,
        message: 'success',
        data: { id },
      }
    } catch (error) {
      console.error('创建技能失败:', error);
      return { success: false, message: '创建失败', data: null };
    }
  }

  async updateSkill(id: string, data: any): Promise<any> {
    try {
      const db = getMySQLClient();
      const columns = await this.getTableColumns('skills')
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
      if (data.price !== undefined && columns.has('price')) {
        fields.push('price = ?')
        params.push(Number(data.price) || 0)
      }
      if (data.sort_order !== undefined && columns.has('sort_order')) {
        fields.push('sort_order = ?')
        params.push(Number(data.sort_order) || 0)
      }
      if (data.tags !== undefined && columns.has('tags')) {
        fields.push('tags = ?')
        params.push(data.tags)
      }
      if (data.rating !== undefined && columns.has('rating')) {
        fields.push('rating = ?')
        params.push(Number(data.rating) || 0)
      }

      if (columns.has('updated_at')) fields.push('updated_at = NOW()');
      params.push(id);

      if (fields.length === 0) {
        return { success: false, message: '没有可更新字段' }
      }
      
      await db.query(
        `UPDATE skills SET ${fields.join(', ')} WHERE id = ?`,
        params
      );
      
      return { success: true, message: 'success' };
    } catch (error) {
      console.error('更新技能失败:', error);
      return { success: false, message: '更新失败' };
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
      const normalized = String(status || '').toLowerCase()
      const isActive = normalized === 'active' || normalized === '1' || normalized === 'true' ? 1 : 0

      const columns = await this.getTableColumns('skills')
      const updates: string[] = []
      const params: any[] = []

      if (columns.has('is_active')) {
        updates.push('is_active = ?')
        params.push(isActive)
      }
      if (columns.has('status')) {
        updates.push('status = ?')
        params.push(isActive ? 'active' : 'inactive')
      }
      if (columns.has('updated_at')) {
        updates.push('updated_at = NOW()')
      }

      if (updates.length === 0) {
        return { success: false, message: 'skills 表缺少 is_active/status 字段' }
      }

      params.push(id)
      await db.query(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`, params)
      return { success: true, message: 'success' };
    } catch (error) {
      console.error('更新技能状态失败:', error);
      return { success: false, message: '更新失败' };
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
      const withdrawals = this.unwrapRows(result);
      
      const countResult = await db.query(countSql, params);
      const total = this.unwrapFirst(countResult)?.count || 0;

      return { list: withdrawals, total, page, limit };
    } catch (error) {
      console.error('获取提现列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async approveWithdraw(id: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const reqResult = await db.query(`SELECT * FROM withdrawal_requests WHERE id = ?`, [id])
      const req = this.unwrapFirst(reqResult)
      if (!req) {
        return { success: false, message: '提现申请不存在' }
      }

      const amount = Number(req.amount) || 0
      const userId = req.user_id || req.userId
      const reqColumns = await this.getTableColumns('withdrawal_requests')

      const reqUpdates: string[] = [`status = 'approved'`]
      if (reqColumns.has('processed_at')) reqUpdates.push('processed_at = NOW()')
      if (reqColumns.has('updated_at')) reqUpdates.push('updated_at = NOW()')
      await db.query(`UPDATE withdrawal_requests SET ${reqUpdates.join(', ')} WHERE id = ?`, [id])

      const userColumns = await this.getTableColumns('users')
      if (!userColumns.has('frozen_balance')) {
        return { success: false, message: '用户表缺少 frozen_balance 字段' }
      }
      const userUpdates: string[] = [`frozen_balance = frozen_balance - ?`]
      if (userColumns.has('updated_at')) userUpdates.push('updated_at = NOW()')
      await db.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, [amount, userId])

      const txColumns = await this.getTableColumns('transactions')
      if (txColumns.has('reference_id')) {
        await db.query(
          `UPDATE transactions SET status = 'completed' WHERE type = 'withdraw' AND reference_id = ?`,
          [id]
        )
      }

      return { success: true, message: 'success' };
    } catch (error) {
      console.error('批准提现失败:', error);
      return { success: false, message: '批准失败' };
    }
  }

  async rejectWithdraw(id: string, reason?: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const reqResult = await db.query(`SELECT * FROM withdrawal_requests WHERE id = ?`, [id])
      const req = this.unwrapFirst(reqResult)
      if (!req) {
        return { success: false, message: '提现申请不存在' }
      }

      const amount = Number(req.amount) || 0
      const userId = req.user_id || req.userId
      const rejectReason = reason || '审核未通过'

      const reqColumns = await this.getTableColumns('withdrawal_requests')
      const reqUpdates: string[] = [`status = 'rejected'`]
      if (reqColumns.has('reject_reason')) reqUpdates.push(`reject_reason = ?`)
      else if (reqColumns.has('notes')) reqUpdates.push(`notes = ?`)
      if (reqColumns.has('processed_at')) reqUpdates.push('processed_at = NOW()')
      if (reqColumns.has('updated_at')) reqUpdates.push('updated_at = NOW()')

      const reqParams: any[] = []
      if (reqUpdates.some(s => s.includes('= ?'))) reqParams.push(rejectReason)
      reqParams.push(id)
      await db.query(`UPDATE withdrawal_requests SET ${reqUpdates.join(', ')} WHERE id = ?`, reqParams)

      const userColumns = await this.getTableColumns('users')
      if (!userColumns.has('frozen_balance')) {
        return { success: false, message: '用户表缺少 frozen_balance 字段' }
      }
      const balanceCol = userColumns.has('balance') ? 'balance' : (userColumns.has('current_balance') ? 'current_balance' : '')
      if (!balanceCol) {
        return { success: false, message: '用户表缺少 balance/current_balance 字段' }
      }
      const userUpdates: string[] = [`frozen_balance = frozen_balance - ?`, `${balanceCol} = ${balanceCol} + ?`]
      if (userColumns.has('updated_at')) userUpdates.push('updated_at = NOW()')
      await db.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, [amount, amount, userId])

      const txColumns = await this.getTableColumns('transactions')
      if (txColumns.has('reference_id')) {
        await db.query(
          `UPDATE transactions SET status = 'rejected' WHERE type = 'withdraw' AND reference_id = ?`,
          [id]
        )
      }

      return { success: true, message: 'success' };
    } catch (error) {
      console.error('拒绝提现失败:', error);
      return { success: false, message: '拒绝失败' };
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
      const referrers = this.unwrapRows(result);
      
      const countResult = await db.query(`SELECT COUNT(*) as count FROM referrals`);
      const total = this.unwrapFirst(countResult)?.count || 0;

      return { list: referrers, total, page, limit };
    } catch (error) {
      console.error('获取推荐列表失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async getReferralReferrers(days: number = 14): Promise<any> {
    try {
      const db = getMySQLClient()
      const normalizedDays = Math.max(1, Math.min(90, Number(days) || 14))
      const startDate = new Date()
      startDate.setHours(0, 0, 0, 0)
      startDate.setDate(startDate.getDate() - (normalizedDays - 1))
      const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ')

      const rows = await db.query(
        `SELECT
           u.id as referrer_id,
           u.nickname,
           COALESCE(u.avatar_url, u.avatar, '') as avatar_url,
           u.phone,
           u.referral_code,
           u.created_at,
           COUNT(r.id) as invited_total,
           SUM(CASE WHEN r.created_at >= ? THEN 1 ELSE 0 END) as invited_count,
           COALESCE(p.pending_count, 0) as pending_count,
           COALESCE(p.pending_amount, 0) as pending_amount,
           COALESCE(p.approved_count, 0) as approved_count,
           COALESCE(p.approved_amount, 0) as approved_amount
         FROM users u
         INNER JOIN referrals r ON r.referrer_id = u.id
         LEFT JOIN (
           SELECT
             referrer_id,
             SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
             SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
             SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
             SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount
           FROM referral_payouts
           GROUP BY referrer_id
         ) p ON p.referrer_id = u.id
         GROUP BY u.id
         ORDER BY invited_count DESC, invited_total DESC
         LIMIT 200`,
        [startDateStr]
      )

      const list = (rows || []).map((row: any) => {
        const phone = String(row.phone || '')
        const phoneMasked = phone && phone.length >= 7
          ? `${phone.slice(0, 3)}****${phone.slice(-4)}`
          : phone
        return {
          referrerId: row.referrerId,
          nickname: row.nickname || '',
          avatarUrl: row.avatarUrl || '',
          phoneMasked,
          referralCode: row.referralCode || '',
          createdAt: row.createdAt || null,
          invitedTotal: Number(row.invitedTotal || 0),
          invitedCount: Number(row.invitedCount || 0),
          pendingCount: Number(row.pendingCount || 0),
          pendingAmount: Number(row.pendingAmount || 0),
          approvedCount: Number(row.approvedCount || 0),
          approvedAmount: Number(row.approvedAmount || 0),
        }
      })

      return { list, total: list.length, days: normalizedDays }
    } catch (error) {
      console.error('获取推广员聚合列表失败:', error)
      return { list: [], total: 0, days: Number(days) || 14 }
    }
  }

  async getReferralPayouts(payload: { status: string; type?: string; days: number }): Promise<any> {
    try {
      const db = getMySQLClient()
      const normalizedDays = Math.max(1, Math.min(90, Number(payload?.days) || 14))
      const startDate = new Date()
      startDate.setHours(0, 0, 0, 0)
      startDate.setDate(startDate.getDate() - (normalizedDays - 1))
      const startDateStr = startDate.toISOString().slice(0, 19).replace('T', ' ')

      const where: string[] = ['p.created_at >= ?']
      const params: any[] = [startDateStr]

      if (payload?.status) {
        where.push('p.status = ?')
        params.push(String(payload.status).trim().toLowerCase())
      }
      if (payload?.type) {
        where.push('p.payout_type = ?')
        params.push(String(payload.type).trim())
      }

      const sql = `SELECT
          p.*,
          ru.nickname as referrer_nickname,
          COALESCE(ru.avatar_url, ru.avatar, '') as referrer_avatar_url,
          ru.phone as referrer_phone,
          ru.referral_code as referrer_code,
          uu.nickname as user_nickname,
          COALESCE(uu.avatar_url, uu.avatar, '') as user_avatar_url,
          uu.phone as user_phone
        FROM referral_payouts p
        LEFT JOIN users ru ON p.referrer_id = ru.id
        LEFT JOIN users uu ON p.user_id = uu.id
        WHERE ${where.join(' AND ')}
        ORDER BY p.created_at DESC
        LIMIT 200`

      const rows = await db.query(sql, params)
      const list = (rows || []).map((row: any) => ({
        id: row.id,
        payoutType: row.payoutType,
        referrerId: row.referrerId,
        userId: row.userId,
        referredId: row.referredId || null,
        orderId: row.orderId || null,
        amount: Number(row.amount || 0),
        status: row.status,
        reviewReason: row.reviewReason || '',
        reviewedBy: row.reviewedBy || null,
        reviewedAt: row.reviewedAt || null,
        createdAt: row.createdAt || null,
        referrer: {
          nickname: row.referrerNickname || '',
          avatarUrl: row.referrerAvatarUrl || '',
          phone: row.referrerPhone || '',
          code: row.referrerCode || '',
        },
        user: {
          nickname: row.userNickname || '',
          avatarUrl: row.userAvatarUrl || '',
          phone: row.userPhone || '',
        },
      }))

      return { list, total: list.length, days: normalizedDays }
    } catch (error) {
      console.error('获取推广发放审核列表失败:', error)
      return { list: [], total: 0, days: Number(payload?.days) || 14 }
    }
  }

  private async creditReferralPayout(payout: any): Promise<void> {
    const db = getMySQLClient()
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    const earningsColumns = await this.getTableColumns('earnings')
    const earningsData: Record<string, any> = {
      id: `earn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      user_id: payout.userId,
      amount: Number(payout.amount || 0),
      status: 'completed',
      description: payout.payoutType === 'order_commission' ? '订单分佣' : '邀请奖励',
      created_at: now,
    }

    if (payout.orderId) {
      earningsData.order_id = payout.orderId
    }
    if (earningsColumns.has('type')) {
      earningsData.type = payout.payoutType === 'order_commission' ? 'order_commission' : 'referral_bonus'
    } else if (earningsColumns.has('source_type')) {
      earningsData.source_type = payout.payoutType === 'order_commission' ? 'order_commission' : 'referral_bonus'
    }

    const filteredEarningsData = Object.fromEntries(
      Object.entries(earningsData).filter(([key]) => earningsColumns.has(String(key).toLowerCase()))
    )

    if (Object.keys(filteredEarningsData).length > 0) {
      await db.insert('earnings', filteredEarningsData)
    }

    const usersColumns = await this.getTableColumns('users')
    const setParts: string[] = []
    const params: any[] = []
    const amount = Number(payout.amount || 0)

    if (usersColumns.has('current_balance')) {
      setParts.push('current_balance = current_balance + ?')
      params.push(amount)
    } else if (usersColumns.has('balance')) {
      setParts.push('balance = balance + ?')
      params.push(amount)
    }

    if (usersColumns.has('total_earnings')) {
      setParts.push('total_earnings = total_earnings + ?')
      params.push(amount)
    }

    if (usersColumns.has('updated_at')) {
      setParts.push('updated_at = NOW()')
    }

    if (setParts.length > 0) {
      params.push(payout.userId)
      await db.query(`UPDATE users SET ${setParts.join(', ')} WHERE id = ?`, params)
    }
  }

  async approveReferralPayouts(adminId: string, ids: string[]): Promise<any> {
    try {
      const normalizedIds = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)))
      if (normalizedIds.length === 0) {
        return { success: false, message: '缺少待审核记录', data: null }
      }

      const db = getMySQLClient()
      const placeholders = normalizedIds.map(() => '?').join(', ')
      const payouts = await db.query(
        `SELECT * FROM referral_payouts WHERE status = 'pending' AND id IN (${placeholders})`,
        normalizedIds
      )

      if (!payouts || payouts.length === 0) {
        return { success: true, message: '无可审核记录', data: { approved: 0, failed: 0 } }
      }

      await db.query(
        `UPDATE referral_payouts SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_reason = '' WHERE status = 'pending' AND id IN (${placeholders})`,
        [adminId, ...normalizedIds]
      )

      const failures: Array<{ id: string; error: string }> = []
      for (const payout of payouts) {
        try {
          await this.creditReferralPayout(payout)
        } catch (e: any) {
          failures.push({ id: payout.id, error: e?.message || String(e) })
        }
      }

      return {
        success: failures.length === 0,
        message: failures.length === 0 ? 'success' : '部分发放失败',
        data: { approved: payouts.length, failed: failures.length, failures },
      }
    } catch (error: any) {
      console.error('审核通过失败:', error)
      return { success: false, message: '审核通过失败', data: null }
    }
  }

  async rejectReferralPayouts(adminId: string, ids: string[], reason: string): Promise<any> {
    try {
      const normalizedIds = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)))
      if (normalizedIds.length === 0) {
        return { success: false, message: '缺少待审核记录', data: null }
      }

      const db = getMySQLClient()
      const placeholders = normalizedIds.map(() => '?').join(', ')
      const result = await db.query(
        `UPDATE referral_payouts SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_reason = ? WHERE status = 'pending' AND id IN (${placeholders})`,
        [adminId, reason || '', ...normalizedIds]
      )

      const affectedRows = Number((result as any)?.affectedRows || 0)
      return { success: true, message: 'success', data: { rejected: affectedRows } }
    } catch (error: any) {
      console.error('审核驳回失败:', error)
      return { success: false, message: '审核驳回失败', data: null }
    }
  }

  async getSystemConfig(): Promise<any> {
    try {
      const db = getMySQLClient();
      const result = await db.query(`SELECT * FROM system_config WHERE id = 'system'`);
      return this.unwrapFirst(result) || {
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
      const avatarCount = this.unwrapFirst(avatarResult)?.count || 0;
      
      const postResult = await db.query(
        `SELECT COUNT(*) as count FROM posts WHERE user_id = ?`, [userId]
      );
      const postCount = this.unwrapFirst(postResult)?.count || 0;
      
      const orderResult = await db.query(
        `SELECT COUNT(*) as count FROM orders WHERE user_id = ?`, [userId]
      );
      const orderCount = this.unwrapFirst(orderResult)?.count || 0;
      
      const earningsResult = await db.query(
        `SELECT SUM(amount) as total FROM earnings WHERE user_id = ?`, [userId]
      );
      const totalEarnings = this.unwrapFirst(earningsResult)?.total || 0;
      
      const followResult = await db.query(
        `SELECT COUNT(*) as count FROM follows WHERE user_id = ?`, [userId]
      );
      const followCount = this.unwrapFirst(followResult)?.count || 0;
      
      const fanResult = await db.query(
        `SELECT COUNT(*) as count FROM follows WHERE follow_id = ?`, [userId]
      );
      const fanCount = this.unwrapFirst(fanResult)?.count || 0;

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

      const rows = this.unwrapRows(result);
      if (rows.length > 0) return rows[0];
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

  async updateOrderStatus(orderId: string, status: string): Promise<any> {
    try {
      const db = getMySQLClient();
      const nextStatus = String(status || '').trim().toLowerCase()
      if (!isOrderStatus(nextStatus)) {
        return { success: false, message: '非法状态' };
      }

      const orderResult = await db.query(`SELECT id FROM orders WHERE id = ? LIMIT 1`, [orderId])
      const exists = this.unwrapFirst(orderResult)
      if (!exists) {
        return { success: false, message: '订单不存在' };
      }

      let updateSql = `UPDATE orders SET status = ?, updated_at = NOW()`
      const params: any[] = [nextStatus]
      if (nextStatus === 'completed') {
        updateSql += `, completed_at = NOW()`
      }
      updateSql += ` WHERE id = ?`
      params.push(orderId)

      await db.query(updateSql, params);
      return { success: true, message: 'success' };
    } catch (error) {
      console.error('更新订单状态失败:', error);
      return { success: false, message: '更新失败' };
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
      
      const txColumns = await this.getTableColumns('transactions')
      const hasTransactions = txColumns.size > 0

      let totalRecharge = 0
      let totalWithdraw = 0
      let totalCommission = 0
      let totalOrderIncome = 0
      let pendingWithdraw = 0
      let totalRevenue = 0
      let totalWithdrawal = 0

      if (hasTransactions) {
        const sumByType = async (type: string) => {
          const res = await db.query(
            `SELECT SUM(amount) as total FROM transactions ${dateFilter ? dateFilter.replace('WHERE', 'WHERE type = ? AND') : 'WHERE type = ?'} AND status IN ('completed', 'paid')`,
            [type, ...params]
          )
          return Number(this.unwrapFirst(res)?.total || 0) || 0
        }

        const sumPendingWithdraw = async () => {
          const res = await db.query(
            `SELECT SUM(amount) as total FROM transactions ${dateFilter ? dateFilter.replace('WHERE', 'WHERE type = ? AND') : 'WHERE type = ?'} AND status = 'pending'`,
            ['withdraw', ...params]
          )
          return Number(this.unwrapFirst(res)?.total || 0) || 0
        }

        totalRecharge = await sumByType('recharge')
        totalWithdraw = await sumByType('withdraw')
        totalCommission = await sumByType('commission')
        totalOrderIncome = await sumByType('order')
        pendingWithdraw = await sumPendingWithdraw()

        totalRevenue = totalRecharge
        totalWithdrawal = totalWithdraw
      } else {
        const revenueResult = await db.query(
          `SELECT SUM(amount) as total FROM earnings ${dateFilter ? dateFilter.replace('WHERE', 'WHERE type = ? AND') : 'WHERE type = ?'}`,
          ['revenue', ...params]
        );
        totalRevenue = Number(this.unwrapFirst(revenueResult)?.total || 0) || 0;
        
        const withdrawalResult = await db.query(
          `SELECT SUM(amount) as total FROM withdrawal_requests ${dateFilter ? dateFilter.replace('WHERE', 'WHERE status = ? AND') : 'WHERE status = ?'}`,
          ['approved', ...params]
        );
        totalWithdrawal = Number(this.unwrapFirst(withdrawalResult)?.total || 0) || 0;
      }

      const wrColumns = await this.getTableColumns('withdrawal_requests')
      if (wrColumns.size > 0) {
        const pendingWrResult = await db.query(
          `SELECT SUM(amount) as total FROM withdrawal_requests ${dateFilter ? dateFilter.replace('WHERE', 'WHERE status = ? AND') : 'WHERE status = ?'}`,
          ['pending', ...params]
        )
        const pending = Number(this.unwrapFirst(pendingWrResult)?.total || 0) || 0
        if (pending > 0) {
          pendingWithdraw = pending
        }
      }
      
      const orderResult = await db.query(
        `SELECT COUNT(*) as count, SUM(total_price) as total FROM orders ${dateFilter}`,
        params
      );
      const orderCount = this.unwrapFirst(orderResult)?.count || 0;
      const orderAmount = this.unwrapFirst(orderResult)?.total || 0;

      return {
        totalRecharge,
        totalWithdraw,
        totalCommission,
        totalOrderIncome,
        pendingWithdraw,
        balance: totalRecharge - totalWithdraw,
        orderCount,
        orderAmount,
        totalRevenue,
        totalWithdrawal
      };
    } catch (error) {
      console.error('获取财务统计失败:', error);
      return {
        totalRecharge: 0,
        totalWithdraw: 0,
        totalCommission: 0,
        totalOrderIncome: 0,
        pendingWithdraw: 0,
        balance: 0,
        orderCount: 0,
        orderAmount: 0,
        totalRevenue: 0,
        totalWithdrawal: 0
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
      const transactions = this.unwrapRows(result);
      
      const countResult = await db.query(countSql, params);
      const total = this.unwrapFirst(countResult)?.count || 0;

      return { list: transactions, total, page, limit };
    } catch (error) {
      console.error('获取交易记录失败:', error);
      return { list: [], total: 0, page, limit };
    }
  }

  async getReferralStats(days: number = 14): Promise<any> {
    try {
      const db = getMySQLClient();
      
      const totalReferredResult = await db.query(`SELECT COUNT(*) as count FROM referrals`);
      const totalReferred = this.unwrapFirst(totalReferredResult)?.count || 0;

      const totalReferrersResult = await db.query(`SELECT COUNT(DISTINCT referrer_id) as count FROM referrals`);
      const totalReferrers = this.unwrapFirst(totalReferrersResult)?.count || 0;

      const totalCommissionResult = await db.query(
        `SELECT SUM(amount) as total FROM earnings WHERE type = 'referral_bonus'`
      );
      const totalCommission = this.unwrapFirst(totalCommissionResult)?.total || 0;

      let commissionRate = 10
      try {
        const configResult = await db.query(`SELECT commission_rate FROM system_config WHERE id = 'system'`)
        const rate = this.unwrapFirst(configResult)?.commission_rate
        if (rate !== undefined && rate !== null && rate !== '') {
          commissionRate = Number(rate)
        }
      } catch (e) {
        console.error('获取佣金比例失败:', e);
      }

      const normalizedDays = Math.max(1, Math.min(90, Number(days) || 14))
      const startDateResult = await db.query(
        `SELECT DATE_SUB(CURDATE(), INTERVAL ? DAY) as start_date`,
        [normalizedDays - 1]
      )
      const startDate = this.unwrapFirst(startDateResult)?.start_date

      const referralDailyResult = await db.query(
        `SELECT DATE(created_at) as day,
                COUNT(*) as invitedRegistrations,
                COUNT(DISTINCT referrer_id) as inviters
         FROM referrals
         WHERE created_at >= ?
         GROUP BY DATE(created_at)
         ORDER BY day DESC`,
        [startDate]
      )
      const referralDailyRows = this.unwrapRows(referralDailyResult)

      const bonusDailyResult = await db.query(
        `SELECT DATE(created_at) as day,
                COUNT(*) as bonusCount,
                SUM(amount) as bonusAmount
         FROM earnings
         WHERE type = 'referral_bonus' AND created_at >= ?
         GROUP BY DATE(created_at)
         ORDER BY day DESC`,
        [startDate]
      )
      const bonusDailyRows = this.unwrapRows(bonusDailyResult)

      const referralDailyMap = new Map<string, any>()
      for (const row of referralDailyRows) {
        if (!row?.day) continue
        referralDailyMap.set(String(row.day), row)
      }

      const bonusDailyMap = new Map<string, any>()
      for (const row of bonusDailyRows) {
        if (!row?.day) continue
        bonusDailyMap.set(String(row.day), row)
      }

      const funnelByDay: any[] = []
      for (let i = 0; i < normalizedDays; i++) {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() - i)
        const day = d.toISOString().slice(0, 10)
        const referralRow = referralDailyMap.get(day) || {}
        const bonusRow = bonusDailyMap.get(day) || {}
        funnelByDay.push({
          day,
          inviters: Number(referralRow.inviters || 0),
          invitedRegistrations: Number(referralRow.invitedRegistrations || 0),
          bonusCount: Number(bonusRow.bonusCount || 0),
          bonusAmount: Number(bonusRow.bonusAmount || 0)
        })
      }

      return {
        totalReferrers,
        totalReferred,
        totalCommission,
        commissionRate,
        funnelByDay,
        averageCommission: totalReferrers > 0 ? totalCommission / totalReferrers : 0
      };
    } catch (error) {
      console.error('获取推荐统计失败:', error);
      return {
        totalReferrers: 0,
        totalReferred: 0,
        totalCommission: 0,
        commissionRate: 10,
        funnelByDay: [],
        averageCommission: 0
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
      return this.unwrapRows(result);
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
      return this.unwrapFirst(result) || null;
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
