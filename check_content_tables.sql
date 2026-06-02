SELECT id, order_id, status, video_url, error_message, created_at, updated_at
FROM content_generation
WHERE order_id = '2d7088a7-71da-4d14-bcab-71db0996f947';

SELECT id, order_id, status, video_url, error_message, created_at, updated_at
FROM content_generation_requests
WHERE order_id = '2d7088a7-71da-4d14-bcab-71db0996f947';

SELECT id, order_id, status, video_url, video_path, error_message, created_at, updated_at
FROM generated_content
WHERE order_id = '2d7088a7-71da-4d14-bcab-71db0996f947';