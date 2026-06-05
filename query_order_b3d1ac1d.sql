-- 查询订单详细信息
SELECT 
  id,
  title,
  content_type,
  budget,
  base_amount,
  content_amount,
  avatar_count,
  quantity_per_avatar,
  expected_quantity,
  status,
  created_at
FROM orders
WHERE id = 'b3d1ac1d-4bf0-425b-abcb-093e5bbdc5b6';
