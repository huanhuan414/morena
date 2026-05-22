-- 查询已完成但未结算的订单
SELECT 
  o.id as order_id,
  o.title,
  o.status as order_status,
  o.is_paid,
  o.budget,
  o.avatar_count,
  o.expected_quantity,
  o.completed_at
FROM orders o
WHERE o.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM earnings e 
    WHERE e.order_id = o.id 
    AND e.type = 'order_reward'
    AND e.status IN ('settled', 'completed')
  )
ORDER BY o.completed_at DESC
LIMIT 10;
