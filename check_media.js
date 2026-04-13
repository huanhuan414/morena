const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function checkLatestMessage() {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, created_at, metadata')
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (data && data.length > 0) {
    const msg = data[0]
    console.log('Latest assistant message:')
    console.log('ID:', msg.id)
    console.log('Has agent_result:', !!msg.metadata?.agent_result)
    console.log('agent_result.steps count:', msg.metadata?.agent_result?.steps?.length || 0)
    console.log('Has media:', !!msg.metadata?.media)
    console.log('media count:', msg.metadata?.media?.length || 0)
    console.log('\nFull metadata:', JSON.stringify(msg.metadata, null, 2))
  }
}

checkLatestMessage()
