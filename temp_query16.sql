SELECT 
  o.id,
  o.user_id,
  o.title,
  o.status,
  o.is_paid,
  o.priority,
  o.avatar_count,
  o.expected_quantity,
  o.created_at,
  u.phone,
  u.nickname
FROM orders o
LEFT JOIN users u ON u.id = o.user_id
WHERE u.phone = '13043522122' OR o.title LIKE '%测试人员测试%';
