SELECT 
  o.id,
  o.status,
  o.is_paid,
  o.avatar_count,
  o.expected_quantity,
  GREATEST(COALESCE(NULLIF(o.avatar_count, 0), NULLIF(o.expected_quantity, 0), 1), 1) as required_count,
  o.created_at
FROM orders o
WHERE o.id = 'b906ef26-62e8-4274-8938-36b54e9f2bb4';
