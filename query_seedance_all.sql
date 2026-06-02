SELECT id, avatar_id, order_id, platform, status, video_url, seedance_task_id, error, created_at, updated_at
FROM content_generation_requests
WHERE seedance_task_id IS NOT NULL AND seedance_task_id != ''
ORDER BY updated_at DESC
LIMIT 20;