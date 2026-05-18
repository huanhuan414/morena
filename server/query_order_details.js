const mysql = require('mysql2/promise');

// 数据库配置
const config = {
  host: '180.184.205.74',
  port: 16033,
  user: 'mrl',
  password: 'SYDPHJB8aGBn83Eh',
  database: 'mrl'
};

async function queryOrderDetails() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('=' .repeat(60));
    console.log('查询订单详情 - 76f7759b-03c8-4f41-8f8a-646b7efce4f4');
    console.log('=' .repeat(60));
    console.log('');

    // 查询订单基本信息
    const [orders] = await connection.execute(`
      SELECT
        id,
        user_id,
        title,
        description,
        budget,
        status,
        created_at,
        completed_at,
        expected_quantity,
        quantity_per_avatar
      FROM orders
      WHERE id = ?
    `, ['76f7759b-03c8-4f41-8f8a-646b7efce4f4']);

    if (orders.length === 0) {
      console.log('未找到该订单！');
      return;
    }

    const order = orders[0];
    console.log('【订单基本信息】');
    console.log('- 订单ID:', order.id);
    console.log('- 订单标题:', order.title);
    console.log('- 订单描述:', order.description);
    console.log('- 订单预算:', order.budget, '元');
    console.log('- 订单状态:', order.status);
    console.log('- 创建时间:', order.created_at);
    console.log('- 完成时间:', order.completed_at);
    console.log('- 预期分身数量:', order.expected_quantity);
    console.log('- 每个分身数量:', order.quantity_per_avatar);
    console.log('');

    // 查询发单者信息
    const [users] = await connection.execute(`
      SELECT id, phone, nickname FROM users WHERE id = ?
    `, [order.user_id]);

    if (users.length > 0) {
      console.log('【发单者信息】');
      console.log('- 发单者ID:', users[0].id);
      console.log('- 发单者手机:', users[0].phone);
      console.log('- 发单者昵称:', users[0].nickname);
      console.log('');
    }

    // 查询接单的分身信息
    const [dispatches] = await connection.execute(`
      SELECT
        odr.id,
        odr.avatar_id,
        odr.user_id,
        odr.status,
        a.name as avatar_name,
        u.nickname as user_nickname
      FROM order_dispatch_requests odr
      LEFT JOIN avatars a ON odr.avatar_id = a.id
      LEFT JOIN users u ON odr.user_id = u.id
      WHERE odr.order_id = ?
    `, ['76f7759b-03c8-4f41-8f8a-646b7efce4f4']);

    if (dispatches.length > 0) {
      console.log('【接单分身信息】');
      dispatches.forEach((d, i) => {
        console.log(`${i + 1}. 分身ID: ${d.avatar_id}`);
        console.log('   分身名称: ' + (d.avatar_name || '未知'));
        console.log('   接单用户: ' + (d.user_nickname || '未知'));
        console.log('   状态: ' + d.status);
        console.log('');
      });
    }

    // 计算收益分配
    console.log('【收益分配计算】');
    const budget = parseFloat(order.budget);
    const participantCount = dispatches.length || 1;
    const amountPerAvatar = budget / participantCount;
    console.log('- 订单总预算:', budget, '元');
    console.log('- 接单分身数量:', participantCount);
    console.log('- 每个分身收益:', amountPerAvatar.toFixed(2), '元');
    console.log('');

    // 查询收益记录
    const [earnings] = await connection.execute(`
      SELECT
        e.user_id,
        e.avatar_id,
        e.amount,
        e.status,
        u.nickname
      FROM earnings e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.order_id = ?
    `, ['76f7759b-03c8-4f41-8f8a-646b7efce4f4']);

    if (earnings.length > 0) {
      console.log('【收益分配记录】');
      earnings.forEach((e, i) => {
        console.log(`${i + 1}. 用户: ${e.nickname || e.user_id}`);
        console.log('   分身: ${e.avatar_id}');
        console.log('   收益: ${e.amount} 元');
        console.log('   状态: ${e.status}');
        console.log('');
      });
    }

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await connection.end();
    console.log('=' .repeat(60));
    console.log('查询完成！');
    console.log('=' .repeat(60));
  }
}

queryOrderDetails();
