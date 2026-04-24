import { HostingService } from './src/modules/avatar/hosting.service'
import { getSupabaseClient } from './src/storage/database/supabase-client'

async function testPostRules() {
  const client = getSupabaseClient()
  
  // 查找肖乾分身
  const { data: avatar, error } = await client
    .from('avatars')
    .select('*')
    .ilike('name', '%肖乾%')
    .single()
  
  if (error || !avatar) {
    console.error('找不到肖乾分身:', error)
    return
  }
  
  console.log('找到分身:', avatar.name, '当前等级:', avatar.level)
  
  // 测试1: 设置为 Lv.8，测试图文帖子
  console.log('\n=== 测试1: Lv.8 图文帖子 ===')
  await client.from('avatars').update({ level: 8 }).eq('id', avatar.id)
  console.log('等级已设置为 Lv.8')
  
  // 手动触发发帖（需要HostingService实例）
  // 这里需要你在服务器上执行实际的托管服务触发
  
  // 测试2: 设置为尊享版，测试视频帖子
  console.log('\n=== 测试2: 尊享版 视频帖子 ===')
  // 需要先在 subscriptions 表中添加尊享版订阅
}

testPostRules().catch(console.error)
