SELECT id, order_number, status, content_type, publisher_id, assigned_avatar_id, created_at, updated_at
FROM orders
WHERE id = '2d7088a7-71da-4d14-bcab-71db0996f947';

SELECT id, avatar_id, status, accepted_at, created_at, updated_at
FROM order_dispatch_requests
WHERE order_id = '2d7088a7-71da-4d14-bcab-71db0996f947';

SELECT id, status, video_url, video_path, error_message, created_at, updated_at
FROM content_generations
WHERE order_id = '2d7088a7-71da-4d14-bcab-71db0996f947';

SELECT id, avatar_id, status, is_hosted, created_at
FROM avatars
WHERE avatar_id LIKE '%1779185280881%' OR user_id = '8d72ec4e-e1e4-4037-87b0-4877ffa90034';