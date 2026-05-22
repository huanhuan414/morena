SELECT 
  'content_generation_requests' as table_name,
  COUNT(*) as total_rows,
  SUM(LENGTH(images)) / 1024 / 1024 as images_mb,
  SUM(LENGTH(video_url)) / 1024 / 1024 as video_mb,
  SUM(LENGTH(content)) / 1024 / 1024 as content_mb,
  MAX(LENGTH(images)) as max_image_bytes,
  MAX(LENGTH(video_url)) as max_video_bytes
FROM content_generation_requests
UNION ALL
SELECT 
  'generated_content' as table_name,
  COUNT(*) as total_rows,
  SUM(LENGTH(images)) / 1024 / 1024 as images_mb,
  SUM(LENGTH(video_url)) / 1024 / 1024 as video_mb,
  SUM(LENGTH(content)) / 1024 / 1024 as content_mb,
  MAX(LENGTH(images)) as max_image_bytes,
  MAX(LENGTH(video_url)) as max_video_bytes
FROM generated_content
UNION ALL
SELECT 
  'avatars' as table_name,
  COUNT(*) as total_rows,
  SUM(LENGTH(avatar_url)) / 1024 / 1024 as images_mb,
  0 as video_mb,
  SUM(LENGTH(personality)) / 1024 / 1024 as content_mb,
  MAX(LENGTH(avatar_url)) as max_image_bytes,
  0 as max_video_bytes
FROM avatars;
