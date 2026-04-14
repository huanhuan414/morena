const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/workspace/projects/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log('开始查询最近的媒体消息...');

  // 查询最近包含视频的消息
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, role, content, metadata, created_at')
    .not('metadata', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }

  console.log(`找到 ${data.length} 条消息`);
  console.log('\n===== 最近的媒体消息 =====\n');

  data.forEach((msg, idx) => {
    const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
    const media = metadata?.media || [];

    console.log(`[${idx + 1}] 消息ID: ${msg.id}`);
    console.log(`    时间: ${msg.created_at}`);
    console.log(`    角色: ${msg.role}`);
    console.log(`    内容: ${msg.content?.substring(0, 100)}...`);
    console.log(`    Media数量: ${media.length}`);

    if (media.length > 0) {
      media.forEach((m, mIdx) => {
        console.log(`    [Media ${mIdx + 1}]`);
        console.log(`        Type: ${m.type}`);
        console.log(`        URL: ${m.url?.substring(0, 80)}...`);
        console.log(`        Thumbnail: ${m.thumbnail?.substring(0, 80)}...`);
      });
    }
    console.log('');
  });

  process.exit(0);
})();
