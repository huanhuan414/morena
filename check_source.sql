SELECT id, order_id, asset_type, source, platform, status, seedance_task_id, created_at, updated_at
FROM order_assets
WHERE order_id = '2d7088a7-71da-4d14-bcab-71db0996f947';

SELECT id, order_id, asset_type, source, status, seedance_task_id, created_at, updated_at
FROM order_assets
WHERE seedance_task_id = 'cgt-20260531210604-h6gk9';