SELECT 
  r.id,
  r.order_id,
  r.avatar_id,
  r.status,
  r.created_at,
  a.user_id,
  a.name as avatar_name
FROM order_dispatch_requests r
LEFT JOIN avatars a ON a.id = r.avatar_id
WHERE r.order_id = '49628165-3791-41e7-9cb3-6547338d7b0c';
