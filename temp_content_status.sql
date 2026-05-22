-- 查询订单内容生成记录状态
SELECT 
  c.id,
  c.order_id,
  c.avatar_id,
  c.status,
  c.created_at,
  c.updated_at
FROM content_generation_requests c
WHERE c.order_id IN (
  '906bf5ac-9dbf-41fd-9f4d-87a11b959627',
  'f567b09d-50f6-46cd-a4eb-e459fcc02801'
);
