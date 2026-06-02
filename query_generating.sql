SELECT id, avatar_id, order_id, platform, status, video_url, seedance_task_id, error, created_at, updated_at
FROM content_generation_requests
WHERE status = 'generating_video'
ORDER BY updated_at DESC
LIMIT 10;