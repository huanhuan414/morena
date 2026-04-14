const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/workspace/projects/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('查询失败:', error);
  } else {
    console.log('=== 最近的10条消息 ===');
    data.forEach((msg, idx) => {
      const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
      const media = metadata?.media || [];
      const taskState = metadata?.task_state;

      console.log('\n[' + (idx + 1) + '] ID:', msg.id);
      console.log('    时间:', msg.created_at);
      console.log('    角色:', msg.role);
      console.log('    内容:', msg.content?.substring(0, 80) + '...');
      console.log('    Media:', media.length > 0 ? JSON.stringify(media) : '[]');
      console.log('    TaskState:', taskState ? 'status: ' + taskState.status : '无');
    });
  }
})();
