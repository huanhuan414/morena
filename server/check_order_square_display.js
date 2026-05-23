const mysql = require('mysql2/promise');

// 数据库配置
const config = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '16033', 10),
  user: process.env.MYSQL_USER || 'mrl',
  password: process.env.MYSQL_PASSWORD || 'YOUR_MYSQL_PASSWORD',
  database: process.env.MYSQL_DATABASE || 'mrl'
};

async function checkOrderSquareDisplay() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('='.repeat(100));
    console.log('查询 13595193172 的订单在发单广场的展示情况');
    console.log('='.repeat(100));
    console.log('');

    // 1. 查询用户ID
    console.log('【步骤1】查询用户ID');
    const [users] = await connection.execute(
      'SELECT id, phone, nickname FROM users WHERE phone = ?',
      ['13595193172']
    );

    if (users.length === 0) {
      console.log('未找到用户！');
      return;
    }

    const userId = users[0].id;
    console.log('用户ID:', userId);
    console.log('');

    // 2. 查询该用户发起的所有订单及其详细状态
    console.log('【步骤2】查询所有订单及其详细状态');
    const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.title,
        o.status,
        o.is_paid,
        o.budget,
        o.expected_quantity,
        o.avatar_count,
        o.deadline,
        o.created_at,
        o.updated_at,
        (SELECT COUNT(DISTINCT avatar_id) 
         FROM order_dispatch_requests 
         WHERE order_id = o.id 
         AND status IN ('accepted', 'in_progress', 'completed')) as accept_count,
        (SELECT COUNT(*) 
         FROM order_dispatch_requests 
         WHERE order_id = o.id) as total_dispatch
      FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [userId]);

    console.log('找到', orders.length, '个订单');
    console.log('');

    // 3. 检查每个订单是否应该在广场展示
    console.log('【步骤3】检查每个订单是否应该展示在发单广场');
    console.log('');

    // 发单广场的展示条件
    const ALLOWED_STATUSES = [
      'pending',
      'pending_acceptance',
      'awaiting_acceptance',
      'in_progress',
      'accepted',
      'content_generated',
      'submitted',
      'published',
      'publish_failed',
      'publish_timeout'
    ];

    orders.forEach((order, index) => {
      console.log(`📋 订单 ${index + 1}: ${order.title || '未命名订单'}`);
      console.log(`   订单ID: ${order.id}`);
      console.log(`   当前状态: ${order.status}`);
      console.log(`   是否已支付: ${order.is_paid}`);
      console.log(`   预算: ${order.budget} 元`);
      console.log(`   需要的分身数: ${order.expected_quantity || order.avatar_count || 1}`);
      console.log(`   已接受的分身数: ${order.accept_count}`);
      console.log(`   总分派次数: ${order.total_dispatch}`);
      console.log(`   截止时间: ${order.deadline}`);
      console.log(`   创建时间: ${order.created_at}`);
      console.log('');

      // 检查各个条件
      console.log(`   🔍 条件检查:`);
      
      // 条件1: 订单状态
      const statusCheck = ALLOWED_STATUSES.includes(order.status);
      console.log(`      1️⃣ 状态在允许列表中: ${statusCheck ? '✅ YES' : '❌ NO'}`);
      if (!statusCheck) {
        console.log(`         允许的状态: ${ALLOWED_STATUSES.join(', ')}`);
        console.log(`         当前状态: ${order.status}`);
      }

      // 条件1.5: pending_payment + is_paid
      if (order.status === 'pending_payment') {
        const paidCheck = order.is_paid === 1;
        console.log(`      1.5️⃣ pending_payment + is_paid=1: ${paidCheck ? '✅ YES' : '❌ NO'}`);
      }

      // 条件2: 数量条件
      const requiredCount = order.expected_quantity || order.avatar_count || 1;
      const acceptCount = order.accept_count || 0;
      const quantityCheck = acceptCount < requiredCount;
      console.log(`      2️⃣ 已接受数(${acceptCount}) < 需要数(${requiredCount}): ${quantityCheck ? '✅ YES' : '❌ NO'}`);

      // 条件3: 时间条件（建议）
      if (order.deadline) {
        const now = new Date();
        const deadline = new Date(order.deadline);
        const timeCheck = deadline > now;
        console.log(`      3️⃣ 未过期(deadline > now): ${timeCheck ? '✅ YES' : '❌ NO (已过期)'}`);
      } else {
        console.log(`      3️⃣ 无截止时间: ✅ YES`);
      }

      // 最终结论
      console.log('');
      const shouldShow = statusCheck && quantityCheck;
      console.log(`   📊 结论: ${shouldShow ? '✅ 应该展示在发单广场' : '❌ 不应该展示在发单广场'}`);
      console.log('');
      console.log('-'.repeat(100));
      console.log('');
    });

    // 4. 查询这些订单是否在发单广场API返回结果中
    console.log('【步骤4】模拟发单广场API查询，检查这些订单是否会被返回');
    console.log('');

    const userIdClause = `'${userId}'`;
    const [squareOrders] = await connection.execute(`
      SELECT o.id, o.title, o.status, o.avatar_count,
             (SELECT COUNT(DISTINCT avatar_id) 
              FROM order_dispatch_requests 
              WHERE order_id = o.id 
              AND status IN ('accepted', 'in_progress', 'completed')) as accept_count
      FROM orders o
      WHERE (
        o.status IN ('pending', 'pending_acceptance', 'awaiting_acceptance', 
                    'in_progress', 'accepted', 'content_generated', 'submitted', 
                    'published', 'publish_failed', 'publish_timeout')
        OR (o.status = 'pending_payment' AND IFNULL(o.is_paid, 0) = 1)
      )
      HAVING accept_count < COALESCE(avatar_count, 1)
      ORDER BY o.priority DESC, o.created_at DESC
      LIMIT 100
    `);

    console.log(`发单广场返回了 ${squareOrders.length} 个订单`);
    console.log('');

    // 5. 检查用户的订单是否在广场结果中
    console.log('【步骤5】检查该用户的订单是否在广场结果中');
    console.log('');

    const userOrderIds = orders.map(o => o.id);
    const squareOrderIds = squareOrders.map(o => o.id);
    const intersection = userOrderIds.filter(id => squareOrderIds.includes(id));

    console.log(`该用户有 ${userOrderIds.length} 个订单`);
    console.log(`发单广场返回 ${squareOrderIds.length} 个订单`);
    console.log(`该用户订单在广场中的: ${intersection.length} 个`);
    console.log('');

    if (intersection.length === 0) {
      console.log('❌ 该用户的所有订单都没有在发单广场展示！');
      console.log('');
      
      // 详细分析原因
      console.log('【详细原因分析】');
      orders.forEach((order, index) => {
        console.log(`\n订单 ${index + 1}: ${order.title || '未命名订单'}`);
        
        const reasons = [];
        
        // 检查状态
        if (!ALLOWED_STATUSES.includes(order.status)) {
          reasons.push(`❌ 状态 ${order.status} 不在允许列表中`);
        }

        // 检查数量
        const requiredCount = order.expected_quantity || order.avatar_count || 1;
        const acceptCount = order.accept_count || 0;
        if (acceptCount >= requiredCount) {
          reasons.push(`❌ 已接受数(${acceptCount}) >= 需要数(${requiredCount})`);
        }

        // 检查时间
        if (order.deadline) {
          const now = new Date();
          const deadline = new Date(order.deadline);
          if (deadline <= now) {
            reasons.push(`❌ 已过期(截止时间: ${order.deadline})`);
          }
        }

        if (reasons.length > 0) {
          console.log('  原因:');
          reasons.forEach(reason => console.log(`    ${reason}`));
        } else {
          console.log('  ⚠️ 状态符合，但未出现在广场中（可能是其他原因）');
        }
      });
    } else {
      console.log(`✅ 该用户有 ${intersection.length} 个订单在发单广场展示`);
    }

  } catch (error) {
    console.error('查询失败:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
    console.log('');
    console.log('='.repeat(100));
    console.log('查询完成！');
    console.log('='.repeat(100));
  }
}

checkOrderSquareDisplay();
