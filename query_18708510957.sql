-- 查询 18708510957 用户信息
SELECT id, phone, nickname, balance, total_earnings FROM users WHERE phone = '18708510957';

-- 查询该用户的所有订单收益
SELECT e.*, o.title as order_title FROM earnings e
LEFT JOIN orders o ON e.order_id = o.id
WHERE e.user_id IN (SELECT id FROM users WHERE phone = '18708510957')
  AND e.type = 'order_reward'
ORDER BY e.created_at DESC;

-- 统计该用户的收益汇总
SELECT 
  COUNT(*) as total_earnings_count,
  SUM(CASE WHEN status IN ('settled', 'completed') THEN amount ELSE 0 END) as total_earned,
  SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_earnings,
  COUNT(CASE WHEN type = 'order_reward' THEN 1 END) as order_reward_count,
  SUM(CASE WHEN type = 'order_reward' AND status IN ('settled', 'completed') THEN amount ELSE 0 END) as order_reward_total
FROM earnings
WHERE user_id IN (SELECT id FROM users WHERE phone = '18708510957');
