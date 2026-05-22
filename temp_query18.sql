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
WHERE r.order_id = 'b906ef26-62e8-4274-8938-36b54e9f2bb4';
