SELECT
    odr.id,
    odr.avatar_id,
    o.order_number,
    o.status as order_status,
    odr.status as dispatch_status,
    odr.created_at,
    odr.updated_at
FROM order_dispatch_requests odr
LEFT JOIN orders o ON odr.order_id = o.id
WHERE odr.avatar_id = 'avatar_1779185280881_wtztd5oww'
ORDER BY odr.created_at DESC
LIMIT 10;