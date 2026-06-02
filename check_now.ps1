$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$orderId = "d6209941-42e2-45c6-8c2c-b52ad48fff5b"

Write-Host "=== Check Content Generation Status ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, status, content, video_url, assigned_video_url FROM content_generation_requests WHERE order_id = '$orderId'" 2>$null

Write-Host ""
Write-Host "=== Check Order Assets ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, asset_type, status, asset_url, assigned_to FROM order_assets WHERE order_id = '$orderId'" 2>$null