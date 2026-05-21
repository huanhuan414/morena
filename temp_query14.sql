SELECT 
  'content_generation_requests' as table_name,
  id,
  LENGTH(images) as images_bytes,
  LENGTH(video_url) as video_bytes,
  created_at
FROM content_generation_requests
WHERE LENGTH(images) > 10240 OR LENGTH(video_url) > 10240
LIMIT 10;
