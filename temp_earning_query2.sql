-- 查询所有收益记录
SELECT 
  e.id,
  e.user_id,
  e.type,
  e.amount,
  e.status,
  e.order_id,
  e.avatar_id,
  e.created_at,
  e.updated_at
FROM earnings e
ORDER BY e.created_at DESC
LIMIT 20;
