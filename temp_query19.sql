SELECT 
  o.id,
  o.title,
  o.status,
  o.is_paid,
  o.avatar_count,
  o.expected_quantity,
  GREATEST(COALESCE(NULLIF(o.avatar_count, 0), NULLIF(o.expected_quantity, 0), 1), 1) as required_count,
  o.created_at
FROM orders o
WHERE o.title = '禁止接单';
