SELECT id, avatar_id, platform, status, video_url, seedance_task_id, error, created_at, updated_at
FROM content_generation_requests
WHERE order_id = '2d7088a7-71da-4d14-bcab-71db0996f947'
ORDER BY created_at DESC
LIMIT 10;

SELECT id, avatar_id, status, created_at, updated_at
FROM order_dispatch_requests
WHERE order_id = '2d7088a7-71da-4d14-bcab-71db0996f947'
ORDER BY created_at DESC
LIMIT 10;