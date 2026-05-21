SELECT 
  o.id as order_id,
  o.title,
  o.avatar_count,
  o.expected_quantity,
  GREATEST(COALESCE(NULLIF(o.avatar_count, 0), NULLIF(o.expected_quantity, 0), 1), 1) as required_count,
  (SELECT COUNT(DISTINCT avatar_id) FROM order_dispatch_requests WHERE order_id = o.id AND status IN ('accepted', 'completed')) as accepted_count,
  CASE 
    WHEN (SELECT COUNT(DISTINCT avatar_id) FROM order_dispatch_requests WHERE order_id = o.id AND status IN ('accepted', 'completed')) > GREATEST(COALESCE(NULLIF(o.avatar_count, 0), NULLIF(o.expected_quantity, 0), 1), 1)
    THEN '超过上限'
    ELSE '正常'
  END as status
FROM orders o
HAVING status = '超过上限'
LIMIT 10;
