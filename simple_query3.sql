-- 查询最近的派单记录
SELECT o.id, o.title, o.status as order_status, odr.status as dispatch_status, odr.created_at 
FROM orders o
INNER JOIN order_dispatch_requests odr ON o.id = odr.order_id
WHERE o.user_id = '0e238fc5-105a-4714-a2db-56fb8b00bead'
ORDER BY odr.created_at DESC
LIMIT 10;
