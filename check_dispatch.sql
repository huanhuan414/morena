SELECT 
  order_id,
  avatar_id,
  status,
  created_at,
  accepted_at
FROM order_dispatch_requests 
WHERE order_id = '4b6f4df4-2921-4891-af45-a79fc94a7ca2'
ORDER BY created_at DESC;
