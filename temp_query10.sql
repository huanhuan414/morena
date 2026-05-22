SELECT 
  id,
  LEFT(content, 50) as content_preview,
  LENGTH(images) as images_size,
  LENGTH(video_url) as video_size,
  created_at
FROM content_generation_requests
WHERE images LIKE '%data:image/%' OR video_url LIKE '%data:video/%'
LIMIT 10;
