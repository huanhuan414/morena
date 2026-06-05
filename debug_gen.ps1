$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$orderId = "d6209941-42e2-45c6-8c2c-b52ad48fff5b"

Write-Host "=== 1. Order Status ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, status, is_paid, avatar_count FROM orders WHERE id = '$orderId'" 2>$null

Write-Host ""
Write-Host "=== 2. Dispatch Records ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, avatar_id, status, created_at FROM order_dispatch_requests WHERE order_id = '$orderId'" 2>$null

Write-Host ""
Write-Host "=== 3. Content Generation Requests ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, status, content, images, video_url, assigned_video_url, error, created_at, updated_at FROM content_generation_requests WHERE order_id = '$orderId'" 2>$null

Write-Host ""
Write-Host "=== 4. Order Assets ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, asset_type, status, asset_url, assigned_to FROM order_assets WHERE order_id = '$orderId'" 2>$null