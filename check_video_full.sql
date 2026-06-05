SELECT 
  o.id as order_id,
  o.title,
  o.status as order_status,
  o.content_type,
  a.id as asset_id,
  a.asset_type,
  a.source,
  a.status as asset_status,
  a.seedance_task_id,
  a.asset_url,
  a.prompt,
  a.created_at as asset_created_at,
  a.updated_at as asset_updated_at
FROM orders o
LEFT JOIN order_assets a ON o.id = a.order_id AND a.asset_type = 'video'
WHERE o.id = '2d7088a7-71da-4d14-bcab-71db0996f947';

SELECT 
  c.id as request_id,
  c.avatar_id,
  c.platform,
  c.status as request_status,
  c.seedance_task_id,
  c.video_url,
  c.assigned_video_url,
  c.error,
  c.created_at,
  c.updated_at
FROM content_generation_requests c
WHERE c.order_id = '2d7088a7-71da-4d14-bcab-71db0996f947';