const mysql = require('mysql2/promise');

// 数据库配置
const config = {
  host: '180.184.205.74',
  port: 16033,
  user: 'mrl',
  password: 'SYDPHJB8aGBn83Eh',
  database: 'mrl'
};

async function analyzeDatabasePerformance() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('='.repeat(80));
    console.log('数据库性能分析 - order_dispatch_requests 表');
    console.log('='.repeat(80));
    console.log('');

    // 1. 查看表结构
    console.log('【1. 表结构分析】');
    const [tableInfo] = await connection.execute('SHOW CREATE TABLE order_dispatch_requests');
    console.log(tableInfo[0]['Create Table']);
    console.log('');

    // 2. 查看表状态
    console.log('【2. 表统计信息】');
    const [tableStatus] = await connection.execute('SHOW TABLE STATUS FROM mrl LIKE ?', ['order_dispatch_requests']);
    if (tableStatus.length > 0) {
      console.log('- 表名:', tableStatus[0]['Name']);
      console.log('- 引擎:', tableStatus[0]['Engine']);
      console.log('- 行数:', tableStatus[0]['Rows']);
      console.log('- 数据大小:', Math.round(tableStatus[0]['Data_length'] / 1024), 'KB');
      console.log('- 索引大小:', Math.round(tableStatus[0]['Index_length'] / 1024), 'KB');
      console.log('- 平均行长度:', tableStatus[0]['Avg_row_length'], 'bytes');
      console.log('');
    }

    // 3. 查看索引
    console.log('【3. 索引分析】');
    const [indexes] = await connection.execute('SHOW INDEX FROM order_dispatch_requests');
    const indexMap = {};
    indexes.forEach(idx => {
      if (!indexMap[idx.Key_name]) {
        indexMap[idx.Key_name] = [];
      }
      indexMap[idx.Key_name].push({
        column: idx.Column_name,
        unique: !idx.Non_unique,
        type: idx.Index_type
      });
    });
    Object.keys(indexMap).forEach(keyName => {
      console.log(`索引: ${keyName}`);
      indexMap[keyName].forEach(idx => {
        console.log(`  - 字段: ${idx.column}, 类型: ${idx.type}, 唯一: ${idx.unique ? '是' : '否'}`);
      });
    });
    console.log('');

    // 4. 查询性能分析
    console.log('【4. 关键查询性能分析】');

    // 查询1: 查找pending的分派记录
    const [query1Explain] = await connection.execute(
      'EXPLAIN SELECT * FROM order_dispatch_requests WHERE order_id = "test-order-id" AND status = "pending" LIMIT 1'
    );
    console.log('查询1: SELECT * FROM order_dispatch_requests WHERE order_id = ? AND status = ? LIMIT 1');
    console.log('  - 使用索引:', query1Explain[0].key || '无索引（全表扫描）');
    console.log('  - 扫描行数:', query1Explain[0].rows || 'N/A');
    console.log('  - 类型:', query1Explain[0].type || 'N/A');
    console.log('');

    // 查询2: 统计已接受的分派数量
    const [query2Explain] = await connection.execute(
      'EXPLAIN SELECT COUNT(*) as count FROM order_dispatch_requests WHERE order_id = "test-order-id" AND status = "accepted"'
    );
    console.log('查询2: SELECT COUNT(*) as count FROM order_dispatch_requests WHERE order_id = ? AND status = ?');
    console.log('  - 使用索引:', query2Explain[0].key || '无索引（全表扫描）');
    console.log('  - 扫描行数:', query2Explain[0].rows || 'N/A');
    console.log('  - 类型:', query2Explain[0].type || 'N/A');
    console.log('');

    // 查询3: 查找最早的pending分派记录
    const [query3Explain] = await connection.execute(
      'EXPLAIN SELECT * FROM order_dispatch_requests WHERE order_id = "test-order-id" AND status = "pending" ORDER BY created_at ASC LIMIT 1'
    );
    console.log('查询3: SELECT * FROM order_dispatch_requests WHERE order_id = ? AND status = ? ORDER BY created_at ASC LIMIT 1');
    console.log('  - 使用索引:', query3Explain[0].key || '无索引（可能filesort）');
    console.log('  - 扫描行数:', query3Explain[0].rows || 'N/A');
    console.log('  - Extra:', query3Explain[0].Extra || 'N/A');
    console.log('');

    // 5. 高并发场景分析
    console.log('【5. 高并发场景性能分析】');
    console.log('acceptOrder 方法涉及的数据库操作:');
    console.log('');
    console.log('  1. SELECT 分派记录 (1次查询)');
    console.log('  2. SELECT orders 表 (1次查询)');
    console.log('  3. SELECT order_dispatch_requests 检查重复 (1次查询)');
    console.log('  4. INSERT 分派记录 (1次插入)');
    console.log('  5. SELECT avatars 检查分身状态 (1次查询)');
    console.log('  6. UPDATE 分派记录为 accepted (1次更新)');
    console.log('  7. SELECT COUNT(*) 统计已接受数 (1次查询)');
    console.log('  8. SELECT COUNT(*) 统计pending数 (1次查询)');
    console.log('  9. SELECT pending分派记录 (1次查询)');
    console.log('  10. UPDATE 踢出分派记录 (1次更新)');
    console.log('  11. SELECT 被踢分身信息 (1次查询)');
    console.log('  12. INSERT 通知 (1次插入)');
    console.log('  13. UPDATE orders 状态 (1次更新)');
    console.log('  14. SELECT accepted分身名称 (1次查询)');
    console.log('  15. INSERT 事件记录 (1次插入)');
    console.log('  16. INSERT 通知 (1次插入)');
    console.log('  17. INSERT 内容生成请求 (1次插入)');
    console.log('  18. SELECT 内容生成请求 (轮询3-5次)');
    console.log('');
    console.log('  总计: 约 17-22 次数据库操作');
    console.log('');

    // 6. 潜在性能问题
    console.log('【6. 潜在性能问题】');
    console.log('');
    console.log('  ❌ 问题1: 缺少高效的复合索引');
    console.log('     - 当前有: idx_order_id, idx_target_avatar_id, idx_target_user_id, idx_status');
    console.log('     - 已存在复合索引: idx_order_status_avatar (order_id, status, avatar_id)');
    console.log('     - ✅ 好的: 已有 (order_id, status) 相关索引');
    console.log('     - ⚠️ 建议: 添加 (order_id, status, created_at) 用于排序查询');
    console.log('');
    console.log('  ❌ 问题2: 连接池配置可能不足');
    console.log('     - 当前连接池大小: 10');
    console.log('     - 高并发场景可能不够用');
    console.log('     - 建议: 根据并发量调整为 20-50');
    console.log('');
    console.log('  ⚠️ 问题3: 轮询机制效率低');
    console.log('     - waitForProcessingRecord 轮询 5 次，每次间隔 150ms');
    console.log('     - 在高并发下可能导致数据库连接占用');
    console.log('     - 建议: 使用事件驱动或消息队列');
    console.log('');
    console.log('  ⚠️ 问题4: 缺少事务保护');
    console.log('     - acceptOrder 方法执行多个关联操作时没有使用事务');
    console.log('     - 如果中途失败,可能造成数据不一致');
    console.log('     - 建议: 使用事务包装关键操作');
    console.log('');

    // 7. 优化建议
    console.log('【7. 性能优化建议】');
    console.log('');
    console.log('  1. 添加排序专用复合索引:');
    console.log('     CREATE INDEX idx_order_status_created ON order_dispatch_requests(order_id, status, created_at);');
    console.log('');
    console.log('  2. 批量操作:');
    console.log('     - 减少单次查询，改用 IN 或批量更新');
    console.log('     - 合并多个 SELECT 为一个复杂查询');
    console.log('');
    console.log('  3. 连接池优化:');
    console.log('     connectionLimit: 20-50 (根据并发量调整)');
    console.log('');
    console.log('  4. 异步处理:');
    console.log('     - 通知创建、内容生成启动改为异步');
    console.log('     - 减少主流程的数据库操作');
    console.log('');
    console.log('  5. 事务处理:');
    console.log('     - 使用事务包装多个关联操作');
    console.log('     - 确保数据一致性');
    console.log('');

    // 8. 并发压力测试预估
    console.log('【8. 并发压力预估】');
    const avgOperationTime = 10; // 假设每次操作平均 10ms
    const totalOperations = 20;
    const singleRequestTime = totalOperations * avgOperationTime; // 200ms
    console.log('  单次 acceptOrder 请求耗时预估: ' + singleRequestTime + 'ms');
    console.log('  100 并发时预估 QPS: ' + Math.round(1000 / singleRequestTime * 100) + ' req/s');
    console.log('  1000 并发时预估 QPS: ' + Math.round(1000 / singleRequestTime * 1000) + ' req/s');
    console.log('  (假设每次 DB 操作 10ms)');
    console.log('');

    // 9. 实际性能测试建议
    console.log('【9. 实际性能测试建议】');
    console.log('');
    console.log('  使用 Apache Bench 或 wrk 进行压力测试:');
    console.log('  ab -n 1000 -c 100 -p post_data.json http://localhost:3000/api/order-dispatch/avatar/xxx/accept/xxx');
    console.log('');
    console.log('  监控指标:');
    console.log('  - 平均响应时间 < 200ms');
    console.log('  - 错误率 < 1%');
    console.log('  - 数据库 CPU 使用率 < 80%');
    console.log('');

  } catch (error) {
    console.error('分析失败:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
    console.log('='.repeat(80));
    console.log('分析完成！');
    console.log('='.repeat(80));
  }
}

analyzeDatabasePerformance();