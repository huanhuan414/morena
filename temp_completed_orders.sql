-- 查询最近完成的订单
SELECT 
  o.id as order_id,
  o.title,
  o.status as order_status,
  o.is_paid,
  o.budget,
  o.avatar_count,
  o.expected_quantity,
  o.completed_at,
  (SELECT COUNT(*) FROM order_dispatch_requests dr WHERE dr.order_id = o.id AND dr.status = 'completed') as completed_dispatch_count,
  (SELECT COUNT(*) FROM earnings e WHERE e.order_id = o.id AND e.type = 'order_reward') as earning_count
FROM orders o
WHERE o.status = 'completed'
ORDER BY o.completed_at DESC
LIMIT 10;
