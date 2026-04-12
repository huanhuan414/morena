/**
 * 视频数据迁移脚本
 * 为旧消息的视频补充 key 字段
 */

import { getSupabaseClient } from '../server/src/storage/database/supabase-client'

async function migrateVideoKeys() {
  const client = getSupabaseClient()

  console.log('[Video Migration] 开始迁移视频 key...')

  try {
    // 查询所有包含视频的消息（没有 key 字段的）
    const { data: messages, error } = await client
      .from('messages')
      .select('id, metadata, created_at')
      .not('metadata', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[Video Migration] 查询失败:', error)
      return
    }

    console.log(`[Video Migration] 找到 ${messages?.length || 0} 条消息`)

    let updatedCount = 0

    for (const msg of messages || []) {
      const metadata = msg.metadata as any
      const media = metadata?.media || []

      // 检查是否有视频但没有 key
      const hasVideoWithoutKey = media.some((item: any) =>
        item.type === 'video' && !item.key && item.url
      )

      if (hasVideoWithoutKey) {
        // 为视频添加 key
        const newMedia = media.map((item: any) => {
          if (item.type === 'video' && !item.key && item.url) {
            // 尝试从 URL 中提取 key
            const url = item.url as string
            let key = ''

            // 方法1：从 URL path 中提取文件名
            const urlMatch = url.match(/\/([^\/?]+\.mp4)/)
            if (urlMatch) {
              // 格式：doubao-seedance-2-0/02177592056570400000000000000000000ffffac14bbc71f8b8f.mp4
              // 提取：doubao-seedance-2-0/02177592056570400000000000000000000ffffac14bbc71f8b8f.mp4
              const pathMatch = url.match(/\/(doubao-seedance-\d+-\d+\/[^\/?]+\.mp4)/)
              if (pathMatch) {
                key = pathMatch[1]
              } else {
                // 兜底：直接使用文件名
                key = urlMatch[1]
              }
            }

            // 方法2：如果是 coze_storage 格式
            const cozeMatch = url.match(/coze_storage_\d+\/([^\/?]+\.mp4)/)
            if (cozeMatch) {
              key = `video_generate_${cozeMatch[1]}`
            }

            console.log(`[Video Migration] 提取 key: ${key} from URL`)

            return {
              ...item,
              key: key || item.url  // 如果提取失败，使用 URL 作为 key（虽然不完美）
            }
          }
          return item
        })

        // 更新消息
        const { error: updateError } = await client
          .from('messages')
          .update({
            metadata: {
              ...metadata,
              media: newMedia
            }
          })
          .eq('id', msg.id)

        if (updateError) {
          console.error(`[Video Migration] 更新消息 ${msg.id} 失败:`, updateError)
        } else {
          console.log(`[Video Migration] ✅ 更新消息 ${msg.id}`)
          updatedCount++
        }
      }
    }

    console.log(`[Video Migration] 迁移完成！共更新 ${updatedCount} 条消息`)
  } catch (error) {
    console.error('[Video Migration] 迁移失败:', error)
  }
}

// 执行迁移
migrateVideoKeys()
  .then(() => {
    console.log('[Video Migration] 脚本执行完毕')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[Video Migration] 脚本执行失败:', error)
    process.exit(1)
  })
