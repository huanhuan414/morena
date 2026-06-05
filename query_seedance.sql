SELECT id, task_id, status, video_url, error_message, created_at, updated_at
FROM content_generation
WHERE task_id = 'cgt-20260531210604-h6gk9' OR id LIKE '%20260531210604%';

SELECT * FROM content_generation_requests
WHERE task_id = 'cgt-20260531210604-h6gk9' OR id LIKE '%20260531210604%';