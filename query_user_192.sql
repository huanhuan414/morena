SELECT id, phone, nickname, balance FROM users WHERE phone = '19236415655';
SELECT u.id, u.phone, a.id as avatar_id, a.name as avatar_name 
FROM users u 
LEFT JOIN avatars a ON a.user_id = u.id 
WHERE u.phone = '19236415655';
SELECT r.id, r.order_id, r.avatar_id, r.status, r.created_at 
FROM order_dispatch_requests r 
JOIN users u ON r.user_id = u.id 
WHERE u.phone = '19236415655' 
ORDER BY r.created_at DESC LIMIT 10;
