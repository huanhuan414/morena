SELECT 
  o.id as order_id,
  o.title,
  o.status as order_status,
  o.avatar_count,
  o.expected_quantity,
  GREATEST(COALESCE(NULLIF(o.avatar_count, 0), NULLIF(o.expected_quantity, 0), 1), 1) as required_count,
  (SELECT COUNT(DISTINCT avatar_id) FROM order_dispatch_requests WHERE order_id = o.id AND status IN ('accepted', 'completed')) as accepted_count,
  (SELECT COUNT(DISTINCT avatar_id) FROM order_dispatch_requests WHERE order_id = o.id AND status IN ('pending', 'accepted', 'completed')) as total_dispatch_count,
  (SELECT COUNT(*) FROM order_dispatch_requests WHERE order_id = o.id) as total_requests
FROM orders o
WHERE o.id IN ('a8ef6179-ff4f-45e2-a36d-0d4938097ff0', 'a557e750-c7e1-4639-904d-44fd4ab97766');
