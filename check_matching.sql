SELECT id, order_id, seedance_task_id, status, source, asset_type, updated_at
FROM order_assets
WHERE asset_type = 'video' AND source = 'ai_generated' AND status = 'generating'
AND seedance_task_id IS NOT NULL
ORDER BY updated_at DESC;