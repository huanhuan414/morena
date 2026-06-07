/**
 * 清理 Redis 中残留的错误计数器
 * 
 * 问题背景：
 * - order-timeout.service.ts 之前使用了错误的 key 前缀 `order:{orderId}:accepted`
 * - 正确的 key 前缀是 `order:accept:count:{orderId}`（与 order-dispatch.service.ts 一致）
 * - 旧的 key `order:*:accepted` 是残留的错误数据，需要清理
 * 
 * 用法：
 *   node dist/src/scripts/cleanup-redis-counters.js
 * 
 * 或者直接用 redis-cli：
 *   redis-cli KEYS "order:*:accepted"     # 先查看
 *   redis-cli DEL $(redis-cli KEYS "order:*:accepted")  # 再删除
 */

const Redis = require('ioredis')

async function cleanup() {
  const host = process.env.REDIS_HOST || '127.0.0.1'
  const port = parseInt(process.env.REDIS_PORT || '6379', 10)
  const password = process.env.REDIS_PASSWORD || undefined
  const db = parseInt(process.env.REDIS_DB || '0', 10)

  const client = new Redis({ host, port, password, db })

  try {
    // 1. 查找残留的错误 key（order:{orderId}:accepted 格式）
    //    正确格式是 order:accept:count:{orderId}
    const wrongPattern = 'order:*:accepted'
    const wrongKeys = await client.keys(wrongPattern)
    
    // 过滤掉正确格式的 key（order:accept:count:* 不匹配 order:*:accepted）
    // 但 order:xxx:accepted 这种只有2段的才是错误的
    const badKeys = wrongKeys.filter(key => {
      // order:accept:count:xxx 不会被 *:accepted 匹配，但以防万一
      // 只删除确实是 order:{orderId}:accepted 格式的 key
      const parts = key.split(':')
      return parts.length === 3 && parts[0] === 'order' && parts[2] === 'accepted'
    })

    console.log(`\n=== Redis 计数器清理报告 ===`)
    console.log(`扫描模式: ${wrongPattern}`)
    console.log(`匹配 key 数: ${wrongKeys.length}`)
    console.log(`待清理 key 数: ${badKeys.length}`)

    if (badKeys.length > 0) {
      console.log(`\n待删除的 key:`)
      for (const key of badKeys) {
        const val = await client.get(key)
        const ttl = await client.ttl(key)
        console.log(`  ${key} = ${val} (TTL: ${ttl}s)`)
      }

      // 删除
      const deleted = await client.del(...badKeys)
      console.log(`\n已删除 ${deleted} 个残留 key`)
    } else {
      console.log(`\n无需清理，没有残留的错误 key`)
    }

    // 2. 同时检查正确格式的 key 是否存在异常值
    const correctPattern = 'order:accept:count:*'
    const correctKeys = await client.keys(correctPattern)
    console.log(`\n--- 正确格式的计数器状态 ---`)
    console.log(`key 数量: ${correctKeys.length}`)
    
    for (const key of correctKeys.slice(0, 20)) {  // 最多展示20个
      const val = await client.get(key)
      const ttl = await client.ttl(key)
      const numVal = parseInt(val || '0', 10)
      const isAbnormal = numVal < 0 || numVal > 100
      console.log(`  ${key} = ${val} (TTL: ${ttl}s)${isAbnormal ? ' ⚠️ 异常值!' : ''}`)
    }
    if (correctKeys.length > 20) {
      console.log(`  ... 还有 ${correctKeys.length - 20} 个 key 未展示`)
    }

    // 3. 修正负值计数器
    const negativeKeys = []
    for (const key of correctKeys) {
      const val = await client.get(key)
      if (parseInt(val || '0', 10) < 0) {
        negativeKeys.push(key)
      }
    }
    if (negativeKeys.length > 0) {
      console.log(`\n发现 ${negativeKeys.length} 个负值计数器，修正为 0:`)
      for (const key of negativeKeys) {
        await client.set(key, '0', 'EX', 86400 * 7)
        console.log(`  ${key}: 已修正为 0`)
      }
    }

    console.log(`\n=== 清理完成 ===\n`)
  } catch (error) {
    console.error('清理失败:', error)
    process.exit(1)
  } finally {
    await client.quit()
  }
}

cleanup()
