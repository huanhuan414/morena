$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$assetId = "asset_1780037670879"
$requestId = "req_1780038030436_jyoht4szw"

Write-Host "=== 分配视频给分身 ===" -ForegroundColor Cyan
$sql = "UPDATE order_assets SET assigned_to = '$requestId' WHERE id = '$assetId'"
& $mysql -u root -p123456 mrl -e $sql 2>$null | Out-Null
Write-Host "已分配" -ForegroundColor Green

Write-Host ""
Write-Host "=== 验证 ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, asset_type, status, asset_url, assigned_to FROM order_assets WHERE id = '$assetId'" 2>$null