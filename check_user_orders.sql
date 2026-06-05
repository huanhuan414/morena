SELECT sp.max_concurrent_orders, sp.concurrent_order_limit
FROM users u
LEFT JOIN subscription_plans sp ON u.subscription_plan_id = sp.id
WHERE u.id = '8d72ec4e-e1e4-4037-87b0-4877ffa90034';

SELECT COUNT(*) as active_count
FROM order_dispatch_requests
WHERE avatar_id = 'avatar_1779185280881_wtztd5oww'
AND status IN ('pending', 'accepted');

SELECT o.id, o.status, o.publisher_id, o.created_at
FROM orders o
WHERE o.id = '1fb280a3-9a6e-40e8-bff8-15f31272860c';