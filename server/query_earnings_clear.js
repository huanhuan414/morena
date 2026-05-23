const mysql = require('mysql2/promise');

// 数据库配置
const config = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '16033', 10),
  user: process.env.MYSQL_USER || 'mrl',
  password: process.env.MYSQL_PASSWORD || 'YOUR_MYSQL_PASSWORD',
  database: process.env.MYSQL_DATABASE || 'mrl'
};

async function queryEarnings() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('=' .repeat(60));
    console.log('查询手机号 18708510957 的用户信息和收益数据');
    console.log('=' .repeat(60));
    console.log('');

    // 1. 查询用户基本信息
    const [users] = await connection.execute(
      'SELECT id, phone, nickname, balance, total_earnings FROM users WHERE phone = ?',
      ['18708510957']
    );

    if (users.length === 0) {
      console.log('未找到手机号为 18708510957 的用户！');
      return;
    }

    const user = users[0];
    console.log('【用户基本信息】');
    console.log('- 用户ID:', user.id);
    console.log('- 手机号:', user.phone);
    console.log('- 昵称:', user.nickname);
    console.log('- 账户余额:', user.balance, '元');
    console.log('- 累计收益:', user.total_earnings, '元');
    console.log('');

    const userId = user.id;

    // 2. 查询该用户的所有订单收益明细
    console.log('【订单收益明细】');
    const [earnings] = await connection.execute(`
      SELECT 
        e.id,
        e.order_id,
        e.avatar_id,
        e.amount,
        e.type,
        e.status,
        e.description,
        e.created_at,
        o.title as order_title
      FROM earnings e
      LEFT JOIN orders o ON e.order_id = o.id
      WHERE e.user_id = ? AND e.type = 'order_reward'
      ORDER BY e.created_at DESC
    `, [userId]);
    
    if (earnings.length > 0) {
      earnings.forEach((e, i) => {
        console.log(`${i + 1}. 订单: ${e.order_title || '未知订单'}`);
        console.log('   金额:', e.amount, '元');
        console.log('   状态:', e.status);
        console.log('   时间:', e.created_at);
        console.log('   订单ID:', e.order_id);
        console.log('');
      });
    } else {
      console.log('暂无订单收益记录');
      console.log('');
    }

    // 3. 统计该用户的收益汇总
    console.log('【收益汇总统计】');
    const [summary] = await connection.execute(`
      SELECT 
        COUNT(*) as total_earnings_count,
        SUM(CASE WHEN status IN ('settled', 'completed') THEN amount ELSE 0 END) as total_earned,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_earnings,
        COUNT(CASE WHEN type = 'order_reward' THEN 1 END) as order_reward_count,
        SUM(CASE WHEN type = 'order_reward' AND status IN ('settled', 'completed') THEN amount ELSE 0 END) as order_reward_total
      FROM earnings
      WHERE user_id = ?
    `, [userId]);
    
    const s = summary[0];
    console.log('- 总收益记录数:', s.total_earnings_count);
    console.log('- 已结算收益:', s.total_earned, '元');
    console.log('- 待结算收益:', s.pending_earnings, '元');
    console.log('- 订单收益记录数:', s.order_reward_count);
    console.log('- 订单收益总额:', s.order_reward_total, '元');

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await connection.end();
    console.log('');
    console.log('=' .repeat(60));
    console.log('查询完成！');
    console.log('=' .repeat(60));
  }
}

queryEarnings();
