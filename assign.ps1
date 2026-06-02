$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$assetId = "asset_1780037670879"
$requestId = "req_1780038030436_jyoht4szw"

Write-Host "=== Assign video to avatar ===" -ForegroundColor Cyan
$sql = "UPDATE order_assets SET assigned_to = '$requestId' WHERE id = '$assetId'"
& $mysql -u root -p123456 mrl -e $sql 2>$null

Write-Host ""
Write-Host "=== Verify ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, asset_type, assigned_to FROM order_assets WHERE id = '$assetId'" 2>$null

Write-Host ""
Write-Host "Now refresh the page and check status!" -ForegroundColor Yellow