$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$orderId = "d6209941-42e2-45c6-8c2c-b52ad48fff5b"
$videoUrl = "https://voicsc.51webjs.com/user%2Fe2d6ad6accbb84fd4222d6208210146a.mp4"

Write-Host "=== Update order_assets with ready video ===" -ForegroundColor Cyan

$sql = "UPDATE order_assets SET asset_url = '$videoUrl', status = 'ready' WHERE order_id = '$orderId'"
& $mysql -u root -p123456 mrl -e $sql 2>$null | Out-Null
Write-Host "Updated asset_url and status=ready" -ForegroundColor Green

Write-Host ""
Write-Host "=== Verify ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, asset_type, status, asset_url FROM order_assets WHERE order_id = '$orderId'" 2>$null

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Video asset is now ready: $videoUrl" -ForegroundColor Yellow
Write-Host "Order should appear in square (status=open, asset=ready)" -ForegroundColor Yellow