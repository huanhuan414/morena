SELECT 
  'content_generation_requests' as table_name,
  COUNT(*) as total_rows,
  SUM(LENGTH(images)) as images_size,
  SUM(LENGTH(video_url)) as video_size,
  MAX(LENGTH(images)) as max_image_size,
  MAX(LENGTH(video_url)) as max_video_size
FROM content_generation_requests
UNION ALL
SELECT 
  'generated_content' as table_name,
  COUNT(*) as total_rows,
  SUM(LENGTH(images)) as images_size,
  SUM(LENGTH(video_url)) as video_size,
  MAX(LENGTH(images)) as max_image_size,
  MAX(LENGTH(video_url)) as max_video_size
FROM generated_content;
