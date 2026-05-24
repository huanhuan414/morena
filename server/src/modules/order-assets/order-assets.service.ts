import { Injectable, Logger } from '@nestjs/common'
import { VolcengineService } from '../upload/volcengine.service'
import { getPool } from '../../storage/database/mysql-client'

// 延迟获取 ContentGenerationService 实例（避免循环依赖）
let contentGenServiceInstance: any = null
export function setContentGenerationService(instance: any) {
  contentGenServiceInstance = instance
}
function getContentGenerationService(): any {
  return contentGenServiceInstance
}

// 媒体文件扩展名白名单
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm']

// ZIP解压炸弹防护：解压后单文件最大200MB，总大小最大2GB
const MAX_SINGLE_FILE_SIZE = 200 * 1024 * 1024
const MAX_TOTAL_EXTRACTED_SIZE = 2 * 1024 * 1024 * 1024

export interface CreateAssetInput {
  assetType: 'image' | 'video'
  assetUrl: string
  platform?: string
  originalFilename?: string
  fileSize?: number
  mimeType?: string
  sortOrder?: number
  source?: 'ai_generated' | 'user_uploaded'
  prompt?: string
  status?: 'pending' | 'generating' | 'uploading' | 'ready' | 'failed'
  seedanceTaskId?: string
}

@Injectable()
export class OrderAssetsService {
  private readonly logger = new Logger(OrderAssetsService.name)
  private volcengineServiceInstance: VolcengineService

  constructor() {
    this.volcengineServiceInstance = new VolcengineService()
  }

  /**
   * 获取订单素材列表（支持分页）
   */
  async getOrderAssets(
    orderId: string,
    filter?: { type?: 'image' | 'video'; source?: 'ai_generated' | 'user_uploaded' },
    pagination?: { page?: number; pageSize?: number },
  ) {
    const pool = getPool()
    const page = Math.max(1, pagination?.page || 1)
    const pageSize = Math.min(100, Math.max(1, pagination?.pageSize || 20))
    const offset = (page - 1) * pageSize

    let whereSql = 'WHERE order_id = ?'
    const params: any[] = [orderId]

    if (filter?.type) {
      whereSql += ' AND asset_type = ?'
      params.push(filter.type)
    }
    if (filter?.source) {
      whereSql += ' AND source = ?'
      params.push(filter.source)
    }

    // 查总数
    const countParams = [...params]
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM order_assets ${whereSql}`,
      countParams,
    )
    const total = (countRows as any[])[0].total

    // 查分页数据
    const dataParams = [...params, pageSize, offset]
    const [rows] = await pool.execute(
      `SELECT * FROM order_assets ${whereSql} ORDER BY sort_order ASC, created_at ASC LIMIT ? OFFSET ?`,
      dataParams,
    )

    return {
      list: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 上传单个文件并创建素材记录
   */
  async uploadAndCreateAsset(params: {
    file: Express.Multer.File
    orderId: string
    assetType: 'image' | 'video'
    platform?: string
    userId?: string
  }) {
    const { file, orderId, assetType, platform, userId } = params

    // 上传到TOS
    let assetUrl: string
    if (assetType === 'image') {
      const result = await this.volcengineServiceInstance.uploadImage(file)
      assetUrl = result.url
    } else {
      const result = await this.volcengineServiceInstance.uploadVideo(file.buffer, file.originalname)
      assetUrl = result.url
    }

    // 创建order_assets记录
    const asset = await this.createAsset(orderId, {
      assetType,
      assetUrl,
      platform,
      originalFilename: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      source: 'user_uploaded',
      status: 'ready',
    })

    // 更新订单的素材概要
    await this.updateOrderAssetsSummary(orderId)

    this.logger.log(`[素材上传] 订单${orderId} 上传${assetType}成功: ${assetUrl}`)
    return asset
  }

  /**
   * 上传压缩包并解压提取媒体文件
   */
  async extractAndUploadZip(
    file: Express.Multer.File,
    orderId: string,
    platform?: string,
    userId?: string,
  ) {
    // 动态导入adm-zip避免构建问题
    const AdmZip = require('adm-zip')
    let zip: any

    try {
      zip = new AdmZip(file.buffer)
    } catch (err) {
      throw new Error('压缩包格式无法识别，请确保是有效的ZIP文件')
    }

    const entries = zip.getEntries()
    const results = { images: [] as any[], videos: [] as any[], skipped: 0, errors: [] as string[] }

    let totalExtractedSize = 0

    for (const entry of entries) {
      if (entry.isDirectory) continue

      const filename = entry.entryName
      // 跳过macOS的隐藏文件和Windows的Thumbs
      const basename = filename.split('/').pop()
      if (basename?.startsWith('.') || basename?.startsWith('__MACOSX') || basename === 'Thumbs.db') {
        results.skipped++
        continue
      }

      const ext = filename.split('.').pop()?.toLowerCase()
      if (!ext) {
        results.skipped++
        continue
      }

      // 解压炸弹防护
      const entrySize = entry.header.size
      if (entrySize > MAX_SINGLE_FILE_SIZE) {
        results.errors.push(`${filename}: 文件过大(${(entrySize / 1024 / 1024).toFixed(1)}MB)`)
        results.skipped++
        continue
      }
      totalExtractedSize += entrySize
      if (totalExtractedSize > MAX_TOTAL_EXTRACTED_SIZE) {
        results.errors.push('解压总大小超过2GB限制，已截断')
        break
      }

      try {
        const buffer = entry.getData()

        if (IMAGE_EXTENSIONS.includes(ext)) {
          const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
          const mockFile = {
            buffer,
            originalname: basename,
            mimetype: mimeType,
            size: buffer.length,
          } as Express.Multer.File

          const uploadResult = await this.volcengineServiceInstance.uploadImage(mockFile)
          const asset = await this.createAsset(orderId, {
            assetType: 'image',
            assetUrl: uploadResult.url,
            platform,
            originalFilename: filename,
            fileSize: buffer.length,
            mimeType,
            source: 'user_uploaded',
            status: 'ready',
          })
          results.images.push({ id: asset.id, url: uploadResult.url, filename })
        } else if (VIDEO_EXTENSIONS.includes(ext)) {
          const mimeType = `video/${ext === 'mov' ? 'quicktime' : ext}`
          const mockFile = {
            buffer,
            originalname: basename,
            mimetype: mimeType,
            size: buffer.length,
          } as Express.Multer.File

          const uploadResult = await this.volcengineServiceInstance.uploadVideo(buffer, basename)
          const asset = await this.createAsset(orderId, {
            assetType: 'video',
            assetUrl: uploadResult.url,
            platform,
            originalFilename: filename,
            fileSize: buffer.length,
            mimeType,
            source: 'user_uploaded',
            status: 'ready',
          })
          results.videos.push({ id: asset.id, url: uploadResult.url, filename })
        } else {
          results.skipped++
        }
      } catch (err) {
        this.logger.warn(`[ZIP解压] 文件${filename}处理失败: ${err.message}`)
        results.errors.push(`${filename}: ${err.message}`)
        results.skipped++
      }
    }

    // 更新订单的素材概要
    await this.updateOrderAssetsSummary(orderId)

    this.logger.log(
      `[ZIP解压] 订单${orderId} 提取完成: ${results.images.length}张图片, ${results.videos.length}个视频, ${results.skipped}个跳过`,
    )

    return results
  }

  /**
   * 创建单个素材记录
   */

  async createAsset(orderId: string, input: CreateAssetInput): Promise<any> {
    const pool = getPool()
    const id = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

    const sql = `INSERT INTO order_assets 
      (id, order_id, asset_type, source, platform, asset_url, original_filename, prompt, status, file_size, mime_type, sort_order, seedance_task_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

    const params = [
      id,
      orderId,
      input.assetType,
      input.source || 'user_uploaded',
      input.platform || null,
      input.assetUrl,
      input.originalFilename || null,
      input.prompt || null,
      input.status || 'ready',
      input.fileSize || null,
      input.mimeType || null,
      input.sortOrder || 0,
      input.seedanceTaskId || null,
    ]

    await pool.execute(sql, params)

    const [rows] = await pool.execute('SELECT * FROM order_assets WHERE id = ?', [id])
    return (rows as any[])[0]
  }

  /**
   * 批量创建素材记录
   */
  async batchCreateAssets(
    orderId: string,
    assets: Array<{
      assetType: 'image' | 'video'
      assetUrl: string
      platform?: string
      originalFilename?: string
      fileSize?: number
      mimeType?: string
      sortOrder?: number
    }>,
    userId?: string,
  ) {
    const results = []
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i]
      const asset = await this.createAsset(orderId, {
        assetType: a.assetType,
        assetUrl: a.assetUrl,
        platform: a.platform,
        originalFilename: a.originalFilename,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
        sortOrder: a.sortOrder ?? i,
        source: 'user_uploaded',
        status: 'ready',
      })
      results.push(asset)
    }

    await this.updateOrderAssetsSummary(orderId)
    return results
  }

  /**
   * 删除素材
   */
  async deleteAsset(assetId: string, orderId: string, userId?: string) {
    const pool = getPool()

    // 先检查素材是否存在且属于该订单
    const [rows] = await pool.execute('SELECT * FROM order_assets WHERE id = ? AND order_id = ?', [assetId, orderId])
    if ((rows as any[]).length === 0) {
      throw new Error('素材不存在或不属于该订单')
    }

    await pool.execute('DELETE FROM order_assets WHERE id = ?', [assetId])
    await this.updateOrderAssetsSummary(orderId)

    this.logger.log(`[素材删除] 订单${orderId} 删除素材${assetId}`)
  }

  /**
   * 更新素材排序
   */
  async reorderAssets(orderId: string, assetIds: string[]) {
    const pool = getPool()

    for (let i = 0; i < assetIds.length; i++) {
      await pool.execute('UPDATE order_assets SET sort_order = ? WHERE id = ? AND order_id = ?', [i, assetIds[i], orderId])
    }
  }

  /**
   * 获取订单素材概要
   */
  async getAssetsSummary(orderId: string) {
    const pool = getPool()

    const [rows] = await pool.execute(
      `SELECT asset_type, source, status, COUNT(*) as count
       FROM order_assets
       WHERE order_id = ?
       GROUP BY asset_type, source, status`,
      [orderId],
    )

    let total = 0, ready = 0, generating = 0, failed = 0
    let images = 0, videos = 0, userUploaded = 0, aiGenerated = 0

    for (const row of rows as any[]) {
      total += row.count
      if (row.asset_type === 'image') images += row.count
      if (row.asset_type === 'video') videos += row.count
      if (row.source === 'user_uploaded') userUploaded += row.count
      if (row.source === 'ai_generated') aiGenerated += row.count
      if (row.status === 'ready') ready += row.count
      if (row.status === 'pending' || row.status === 'generating' || row.status === 'uploading') generating += row.count
      if (row.status === 'failed') failed += row.count
    }

    return { total, ready, generating, failed, images, videos, user_uploaded: userUploaded, ai_generated: aiGenerated }
  }

  /**
   * 更新订单的素材概要字段
   */
  async updateOrderAssetsSummary(orderId: string) {
    const pool = getPool()

    const summary = await this.getAssetsSummary(orderId)
    const hasUserAssets = summary.user_uploaded > 0

    await pool.execute(
      `UPDATE orders SET has_user_assets = ?, user_assets_summary = ? WHERE id = ?`,
      [hasUserAssets ? 1 : 0, JSON.stringify(summary), orderId],
    )
  }

  /**
   * 分配素材给生成请求
   * 从order_assets中取出ready状态的素材分配给请求
   */
  async assignAssetsToRequest(orderId: string, options?: { maxImages?: number; needVideo?: boolean }) {
    const pool = getPool()
    const maxImages = options?.maxImages ?? 9
    const needVideo = options?.needVideo ?? true

    // 获取ready状态的图片素材
    const [imageRows] = await pool.execute(
      `SELECT * FROM order_assets 
       WHERE order_id = ? AND asset_type = 'image' AND status = 'ready' 
       ORDER BY sort_order ASC, created_at ASC 
       LIMIT ?`,
      [orderId, maxImages],
    )

    // 获取ready状态的视频素材（取1个）
    let videoUrl: string | null = null
    if (needVideo) {
      const [videoRows] = await pool.execute(
        `SELECT * FROM order_assets 
         WHERE order_id = ? AND asset_type = 'video' AND status = 'ready' 
         ORDER BY sort_order ASC, created_at ASC 
         LIMIT 1`,
        [orderId],
      )
      if ((videoRows as any[]).length > 0) {
        videoUrl = (videoRows as any[])[0].asset_url
      }
    }

    const imageUrls = (imageRows as any[]).map(r => r.asset_url)

    return { imageUrls, videoUrl }
  }

  /**
   * 更新素材状态
   */
  async updateAssetStatus(assetId: string, status: string, extraFields?: Record<string, any>) {
    const pool = getPool()

    const sets = ['status = ?', 'updated_at = NOW()']
    const params: any[] = [status]

    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        sets.push(`${key} = ?`)
        params.push(value)
      }
    }

    params.push(assetId)
    await pool.execute(`UPDATE order_assets SET ${sets.join(', ')} WHERE id = ?`, params)
  }

  /**
   * 等待素材就绪（短轮询，用于接单时素材还在AI生成中的场景）
   */
  async waitForAssetsReady(
    orderId: string,
    assetType: 'image' | 'video',
    timeoutMs: number = 30000,
  ): Promise<string[]> {
    const pool = getPool()
    const startTime = Date.now()
    const intervalMs = 3000

    while (Date.now() - startTime < timeoutMs) {
      const [rows] = await pool.execute(
        `SELECT asset_url FROM order_assets 
         WHERE order_id = ? AND asset_type = ? AND status = 'ready' 
         ORDER BY sort_order ASC, created_at ASC`,
        [orderId, assetType],
      )

      const urls = (rows as any[]).map(r => r.asset_url)
      if (urls.length > 0) return urls

      // 检查是否有pending/generating的素材在排队
      const [pendingRows] = await pool.execute(
        `SELECT COUNT(*) as cnt FROM order_assets 
         WHERE order_id = ? AND asset_type = ? AND status IN ('pending', 'generating', 'uploading')`,
        [orderId, assetType],
      )

      if ((pendingRows as any[])[0].cnt === 0) {
        // 没有排队中的素材，说明全部失败了
        return []
      }

      // 等待3秒后重试
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    // 超时，返回已就绪的
    const [rows] = await pool.execute(
      `SELECT asset_url FROM order_assets
       WHERE order_id = ? AND asset_type = ? AND status = 'ready'
       ORDER BY sort_order ASC, created_at ASC`,
      [orderId, assetType],
    )
    return (rows as any[]).map(r => r.asset_url)
  }

  /**
   * 重新生成失败的AI素材
   */
  async regenerateAsset(assetId: string, userId?: string): Promise<{ success: boolean; assetId: string; message: string }> {
    const pool = getPool()
    const [rows] = await pool.execute(
      `SELECT id, order_id, asset_type, source, prompt, status FROM order_assets WHERE id = ?`,
      [assetId],
    )
    const asset = (rows as any[])[0]

    if (!asset) {
      return { success: false, assetId, message: '素材不存在' }
    }
    if (asset.source !== 'ai_generated') {
      return { success: false, assetId, message: '只能重新生成AI素材' }
    }
    if (asset.status === 'generating') {
      return { success: false, assetId, message: '素材正在生成中，请稍候' }
    }

    // 获取订单信息用于构造prompt
    const [orderRows] = await pool.execute(
      `SELECT title, description, platforms FROM orders WHERE id = ?`,
      [asset.order_id],
    )
    const order = (orderRows as any[])[0]
    const prompt = asset.prompt || `为订单"${order?.title || ''}"生成配图`

    // 更新状态为generating
    await pool.execute(
      `UPDATE order_assets SET status = 'generating', asset_url = '' WHERE id = ?`,
      [assetId],
    )

    // 通过ContentGenerationService重新生成（延迟获取避免循环依赖）
    const contentGenService = getContentGenerationService()
    if (contentGenService) {
      contentGenService.regenerateAssetImage(assetId, prompt, asset.order_id, asset.asset_type).catch((err: any) => {
        this.logger.error(`素材重新生成失败 assetId=${assetId}:`, err.message)
      })
    } else {
      this.logger.error(`素材重新生成失败: ContentGenerationService 未初始化`)
    }

    return { success: true, assetId, message: '重新生成已提交' }
  }

  /**
   * 为订单触发AI素材生成（从素材等待页触发）
   * 无素材时创建素材记录并生成；有失败素材时重新生成
   */
  async generateForOrder(orderId: string, _userId?: string) {
    console.log(`[OrderAssets] 为订单 ${orderId} 触发AI素材生成`)

    // 查询订单信息
    const pool = getPool()
    const [orderRows] = await pool.execute(
      'SELECT content_type, platforms, requirements FROM orders WHERE id = ?',
      [orderId]
    ) as [any[], any]
    if (!orderRows || orderRows.length === 0) {
      throw new Error('订单不存在')
    }
    const order = orderRows[0]

    if (order.content_type === 'text') {
      throw new Error('纯文案订单无需生成素材')
    }

    // 更新订单 requirements 中 ai_auto_fill = true，确保 pregenerateOrderAssets 会执行
    await pool.execute(
      'UPDATE orders SET requirements = JSON_SET(COALESCE(requirements, "{}"), "$.ai_auto_fill", true) WHERE id = ?',
      [orderId]
    )

    // 触发预生成（延迟获取避免循环依赖）
    const contentGenService = getContentGenerationService()
    if (contentGenService) {
      contentGenService.pregenerateOrderAssets(orderId).catch(err => {
        console.error(`[OrderAssets] AI素材生成失败: ${err.message}`)
      })
    } else {
      console.error('[OrderAssets] AI素材生成失败: ContentGenerationService 未初始化')
    }

    return { success: true, orderId, message: 'AI素材生成已提交' }
  }
}
