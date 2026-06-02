const mysql = require('mysql2/promise')

async function main() {
  const conn = await mysql.createConnection({
    host: '180.184.205.74',
    port: 16033,
    user: 'mrl',
    password: 'SYDPHJB8aGBn83Eh',
    database: 'mrl'
  })

  const userId = '60a737a0-cac0-43f9-921c-0cfd503c3e93'

  console.log('=== 直接运行 getMembershipBenefits 查询 ===')
  const [subscriptions] = await conn.query(`
    SELECT us.plan_id, sp.*
    FROM user_subscriptions us
    LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = ? AND us.status = 'active'
    ORDER BY us.created_at DESC LIMIT 1
  `, [userId])
  
  console.log('查询结果:', JSON.stringify(subscriptions, null, 2))
  
  const sub = (subscriptions as any[])?.[0]
  if (sub) {
    console.log('')
    console.log('解析后的 benefits:')
    console.log(`  level: ${sub.plan_id}`)
    console.log(`  name: ${sub.name}`)
    console.log(`  concurrentLimit: ${sub.concurrentLimit || sub.concurrent_limit}`)
  } else {
    console.log('未找到订阅记录！')
  }

  await conn.end()
}

main().catch(console.error)
