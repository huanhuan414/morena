SELECT 
  o.id, 
  o.title, 
  o.status, 
  o.avatar_count, 
  o.expected_quantity,
  (SELECT COUNT(DISTINCT avatar_id) FROM order_dispatch_requests WHERE order_id = o.id AND status IN ('accepted', 'completed')) as accepted_count,
  (SELECT COUNT(DISTINCT avatar_id) FROM order_dispatch_requests WHERE order_id = o.id) as total_dispatch_count
FROM orders o
WHERE o.status IN ('open', 'pending', 'pending_payment', 'created', 'assigned', 'in_progress')
ORDER BY o.created_at DESC 
LIMIT 10;
