SELECT id, user_id, title, status, content_type, is_paid, created_at, updated_at
FROM orders
WHERE id = '2d7088a7-71da-4d14-bcab-71db0996f947';

SELECT id, avatar_id, status, created_at, updated_at
FROM order_dispatch_requests
WHERE order_id = '2d7088a7-71da-4d14-bcab-71db0996f947';

SELECT * FROM content_generation_requests
WHERE order_id = '2d7088a7-71da-4d14-bcab-71db0996f947';