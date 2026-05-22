SELECT 
  id,
  prompt,
  LEFT(images, 100) as images_preview,
  LENGTH(images) as images_size,
  created_at
FROM generated_content
WHERE images LIKE '%data:image/%'
LIMIT 10;
