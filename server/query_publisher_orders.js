const mysql = require('mysql2/promise');

// 数据库配置
const config = {
  host: '180.184.205.74',
  port: 16033,
  user: 'mrl',
  password: 'SYDPHJB8aGBn83Eh',
  database: 'mrl'
};

async function queryPublisherOrders() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('='.repeat(80));
    console.log('查询手机号 13595193172 的发单情况');
    console.log('='.repeat(80));
    console.log('');

    // 1. 查询用户基本信息
    console.log('【1. 用户基本信息】');
    const [users] = await connection.execute(
      'SELECT id, phone, nickname, avatar, balance, total_earnings, level, experience, created_at FROM users WHERE phone = ?',
      ['13595193172']
    );

    if (users.length === 0) {
      console.log('未找到手机号为 13595193172 的用户！');
      return;
    }

    const user = users[0];
    console.log('- 用户ID:', user.id);
    console.log('- 手机号:', user.phone);
    console.log('- 昵称:', user.nickname || '未设置');
    console.log('- 账户余额:', user.balance || 0, '元');
    console.log('- 累计收益:', user.total_earnings || 0, '元');
    console.log('- 等级:', user.level || 1);
    console.log('- 注册时间:', user.created_at);
    console.log('');

    const userId = user.id;

    // 2. 查询发起的所有订单
    console.log('【2. 发起的订单列表】');
    const [orders] = await connection.execute(`
      SELECT 
        o.id,
        o.title,
        o.budget,
        o.status,
        o.expected_quantity,
        o.avatar_count,
        o.content_type,
        o.platforms,
        o.created_at,
        o.updated_at,
        o.completed_at,
        (SELECT COUNT(DISTINCT avatar_id) FROM order_dispatch_requests WHERE order_id = o.id AND status IN ('accepted', 'in_progress', 'completed')) as accept_count,
        (SELECT COUNT(*) FROM order_dispatch_requests WHERE order_id = o.id) as total_dispatch
      FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [userId]);

    if (orders.length === 0) {
      console.log('该用户暂无发起的订单');
    } else {
      console.log('共发起', orders.length, '个订单：');
      console.log('');
      
      // 按状态分组统计
      const statusCount = {};
      const totalBudget = orders.reduce((sum, o) => sum + Number(o.budget || 0), 0);
      
      orders.forEach((o, i) => {
        const status = o.status;
        statusCount[status] = (statusCount[status] || 0) + 1;
        
        const platforms = typeof o.platforms === 'string' ? JSON.parse(o.platforms) : (o.platforms || []);
        const acceptCount = Number(o.accept_count || 0);
        const requiredCount = Number(o.expected_quantity || o.avatar_count || 1);
        const fillRate = requiredCount > 0 ? ((acceptCount / requiredCount) * 100).toFixed(0) : 0;
        
        console.log(`${i + 1}. 订单: ${o.title || '未命名订单'}`);
        console.log(`   订单ID: ${o.id}`);
        console.log(`   预算: ${o.budget} 元`);
        console.log(`   状态: ${o.status}`);
        console.log(`   需要分身: ${requiredCount} 个`);
        console.log(`   已接受: ${acceptCount} 个 (${fillRate}%)`);
        console.log(`   派单次数: ${o.total_dispatch} 次`);
        console.log(`   内容类型: ${o.content_type}`);
        console.log(`   平台: ${platforms.join(', ') || '未指定'}`);
        console.log(`   创建时间: ${o.created_at}`);
        console.log(`   更新时间: ${o.updated_at}`);
        if (o.completed_at) {
          console.log(`   完成时间: ${o.completed_at}`);
        }
        console.log('');
      });

      console.log('【订单统计】');
      console.log('- 总订单数:', orders.length);
      console.log('- 总预算:', totalBudget, '元');
      console.log('- 按状态分布:');
      Object.keys(statusCount).forEach(status => {
        console.log(`  - ${status}: ${statusCount[status]} 个`);
      });
      console.log('');
    }

    // 3. 查询订单的分派详情
    console.log('【3. 订单分派详情】');
    const [dispatches] = await connection.execute(`
      SELECT 
        d.id as dispatch_id,
        d.order_id,
        d.avatar_id,
        d.user_id as executor_user_id,
        d.status as dispatch_status,
        d.platform as dispatch_platform,
        d.created_at as dispatch_created_at,
        d.responded_at,
        o.title as order_title,
        o.budget as order_budget,
        a.name as avatar_name,
        u.nickname as executor_nickname
      FROM order_dispatch_requests d
      INNER JOIN orders o ON d.order_id = o.id
      LEFT JOIN avatars a ON d.avatar_id = a.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE o.user_id = ?
      ORDER BY d.created_at DESC
      LIMIT 20
    `, [userId]);

    if (dispatches.length === 0) {
      console.log('暂无分派记录');
    } else {
      console.log('最近 20 条分派记录：');
      console.log('');
      
      // 按状态分组统计
      const dispatchStatusCount = {};
      
      dispatches.forEach((d, i) => {
        const status = d.dispatch_status;
        dispatchStatusCount[status] = (dispatchStatusCount[status] || 0) + 1;
        
        console.log(`${i + 1}. 分派记录`);
        console.log(`   分派ID: ${d.dispatch_id}`);
        console.log(`   订单: ${d.order_title}`);
        console.log(`   执行分身: ${d.avatar_name || '未知分身'}`);
        console.log(`   执行用户: ${d.executor_nickname || '未知用户'}`);
        console.log(`   状态: ${d.dispatch_status}`);
        console.log(`   派单方式: ${d.dispatch_platform}`);
        console.log(`   派单时间: ${d.dispatch_created_at}`);
        if (d.responded_at) {
          console.log(`   响应时间: ${d.responded_at}`);
        }
        console.log('');
      });

      console.log('【分派统计】');
      console.log('- 最近分派总数:', dispatches.length);
      console.log('- 按状态分布:');
      Object.keys(dispatchStatusCount).forEach(status => {
        console.log(`  - ${status}: ${dispatchStatusCount[status]} 次`);
      });
      console.log('');
    }

    // 4. 查询收益记录（该用户作为发单者的支出）
    console.log('【4. 订单结算收益记录】');
    const [earnings] = await connection.execute(`
      SELECT 
        e.id,
        e.order_id,
        e.user_id as earner_user_id,
        e.amount,
        e.type,
        e.status,
        e.description,
        e.created_at,
        o.title as order_title,
        o.budget as order_budget,
        u.nickname as earner_nickname
      FROM earnings e
      INNER JOIN orders o ON e.order_id = o.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE o.user_id = ?
      ORDER BY e.created_at DESC
      LIMIT 10
    `, [userId]);

    if (earnings.length === 0) {
      console.log('暂无收益记录（该用户作为发单者，支出在其他地方记录）');
    } else {
      console.log('最近 10 条收益记录（接单者获得的收益）：');
      console.log('');
      
      const totalPaid = earnings.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      
      earnings.forEach((e, i) => {
        console.log(`${i + 1}. 收益记录`);
        console.log(`   收益ID: ${e.id}`);
        console.log(`   订单: ${e.order_title}`);
        console.log(`   接单者: ${e.earner_nickname || '未知用户'}`);
        console.log(`   收益金额: ${e.amount} 元`);
        console.log(`   收益类型: ${e.type}`);
        console.log(`   状态: ${e.status}`);
        console.log(`   描述: ${e.description || '无'}`);
        console.log(`   时间: ${e.created_at}`);
        console.log('');
      });

      console.log('- 累计已结算收益（接单者获得）:', totalPaid, '元');
      console.log('');
    }

    // 5. 计算发单者的总支出
    console.log('【5. 发单者支出估算】');
    const [settlementSummary] = await connection.execute(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(o.budget) as total_budget,
        SUM(
          (SELECT COUNT(*) FROM order_dispatch_requests WHERE order_id = o.id AND status IN ('completed', 'settled'))
        ) as completed_dispatches,
        SUM(
          (SELECT SUM(amount) FROM earnings WHERE order_id = o.id AND status IN ('settled', 'completed'))
        ) as total_settled
      FROM orders o
      WHERE o.user_id = ?
    `, [userId]);

    if (settlementSummary.length > 0) {
      const summary = settlementSummary[0];
      console.log('- 发单总数:', summary.total_orders || 0, '个');
      console.log('- 订单总预算:', summary.total_budget || 0, '元');
      console.log('- 已完成分派:', summary.completed_dispatches || 0, '次');
      console.log('- 实际结算金额:', summary.total_settled || 0, '元');
      console.log('- 预估待结算:', (summary.total_budget || 0) - (summary.total_settled || 0), '元');
    }

  } catch (error) {
    console.error('查询失败:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
    console.log('');
    console.log('='.repeat(80));
    console.log('查询完成！');
    console.log('='.repeat(80));
  }
}

queryPublisherOrders();
