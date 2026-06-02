$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$requestId = "req_1780038030436_jyoht4szw"

Write-Host "=== 更新 order_title 和 order_description ===" -ForegroundColor Cyan

$sql = "UPDATE content_generation_requests SET order_title = '测试视频', order_description = '好好gt' WHERE id = '$requestId'"
& $mysql -u root -p123456 mrl -e $sql 2>$null

Write-Host ""
Write-Host "=== 验证 ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, status, order_title, order_description, assigned_video_url FROM content_generation_requests WHERE id = '$requestId'" 2>$null

Write-Host ""
Write-Host "=== 现在需要重新触发文案生成 ===" -ForegroundColor Yellow
Write-Host "可以调用 API: POST /api/content-generation/generate" -ForegroundColor Yellow