SELECT 
  o.id,
  o.title,
  o.status,
  o.avatar_count,
  o.expected_quantity,
  GREATEST(COALESCE(NULLIF(o.avatar_count, 0), NULLIF(o.expected_quantity, 0), 1), 1) as required_count,
  (SELECT COUNT(DISTINCT avatar_id) FROM order_dispatch_requests WHERE order_id = o.id AND status IN ('accepted', 'completed')) as accept_count,
  (SELECT COUNT(DISTINCT avatar_id) FROM order_dispatch_requests WHERE order_id = o.id AND status IN ('accepted', 'in_progress', 'completed')) as accept_count_v2
FROM orders o
WHERE o.status IN ('open', 'pending_dispatch', 'pending', 'pending_acceptance', 'created', 'assigned')
ORDER BY o.created_at DESC
LIMIT 10;
