-- 查询订单派单记录状态
SELECT 
  dr.id,
  dr.order_id,
  dr.avatar_id,
  dr.status,
  dr.created_at,
  dr.updated_at
FROM order_dispatch_requests dr
WHERE dr.order_id IN (
  '906bf5ac-9dbf-41fd-9f4d-87a11b959627',
  'f567b09d-50f6-46cd-a4eb-e459fcc02801'
);
