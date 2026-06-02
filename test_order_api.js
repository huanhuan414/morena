const mysql = require('mysql2/promise');

async function testOrderAPI() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'mrl'
  });

  const orderId = 'b3d1ac1d-4bf0-425b-abcb-093e5bbdc5b6';

  try {
    // 查询订单数据
    const [rows] = await connection.execute(`
      SELECT 
        id, title, content_type, 
        budget, base_amount, content_amount,
        avatar_count, expected_quantity, quantity_per_avatar,
        status
      FROM orders 
      WHERE id = ?
    `, [orderId]);

    if (rows.length === 0) {
      console.log('订单不存在');
      return;
    }

    const order = rows[0];
    console.log('=== 订单数据 ===');
    console.log('ID:', order.id);
    console.log('标题:', order.title);
    console.log('内容类型:', order.content_type);
    console.log('总价:', order.budget, '元');
    console.log('基础费用:', order.base_amount, '元');
    console.log('内容费用:', order.content_amount, '元');
    console.log('分身数:', order.avatar_count || order.expected_quantity);
    console.log('');

    // 计算预计收益
    const baseAmount = Number(order.base_amount || order.budget || 0);
    const avatarCount = Number(order.avatar_count || order.expected_quantity || 1);
    const expectedEarnings = avatarCount > 0 ? Math.round(baseAmount / avatarCount * 100) / 100 : baseAmount;

    console.log('=== 预计收益计算 ===');
    console.log('基础费用:', baseAmount, '元');
    console.log('分身数:', avatarCount);
    console.log('预计收益:', expectedEarnings, '元/分身');
    console.log('');
    console.log('✅ 正确：接单者应该看到', expectedEarnings, '元');
    console.log('❌ 错误：如果看到', (order.budget / avatarCount).toFixed(2), '元，说明还在用总价计算');

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await connection.end();
  }
}

testOrderAPI();
