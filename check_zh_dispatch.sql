-- 查询周航分身的派单记录
SELECT o.id as order_id, o.title, o.status as order_status, odr.status as dispatch_status, odr.created_at, odr.updated_at
FROM order_dispatch_requests odr
INNER JOIN orders o ON o.id = odr.order_id
WHERE odr.avatar_id = 'avatar_1779185280881_wtztd5oww'
ORDER BY odr.created_at DESC
LIMIT 20;
