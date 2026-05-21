SELECT 
  'content_generation_requests' as table_name,
  COUNT(*) as total_rows,
  ROUND(SUM(LENGTH(images)) / 1024 / 1024, 2) as images_mb,
  ROUND(SUM(LENGTH(video_url)) / 1024 / 1024, 2) as video_mb,
  MAX(LENGTH(images)) as max_image_bytes,
  MAX(LENGTH(video_url)) as max_video_bytes
FROM content_generation_requests
UNION ALL
SELECT 
  'generated_content' as table_name,
  COUNT(*) as total_rows,
  ROUND(SUM(LENGTH(images)) / 1024 / 1024, 2) as images_mb,
  ROUND(SUM(LENGTH(video_url)) / 1024 / 1024, 2) as video_mb,
  MAX(LENGTH(images)) as max_image_bytes,
  MAX(LENGTH(video_url)) as max_video_bytes
FROM generated_content;
