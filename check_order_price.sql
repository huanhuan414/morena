SELECT 
  id, 
  title, 
  budget,
  base_amount,
  content_amount,
  price,
  avatar_count,
  expected_quantity,
  quantity_per_avatar,
  ROUND(base_amount / GREATEST(avatar_count, 1), 2) as calculated_earning,
  ROUND(budget / GREATEST(avatar_count, 1), 2) as budget_per_avatar,
  status,
  created_at,
  updated_at
FROM orders 
WHERE id = 'fac4ed73-855c-4e00-8f31-669b8c66db66';
