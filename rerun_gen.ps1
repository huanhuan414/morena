$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$requestId = "req_1780038030436_jyoht4szw"
$videoUrl = "https://voicsc.51webjs.com/user%2Fe2d6ad6accbb84fd4222d6208210146a.mp4"

Write-Host "=== 重新触发：更新状态为 processing ===" -ForegroundColor Cyan

$sql = "UPDATE content_generation_requests SET status = 'processing' WHERE id = '$requestId'"
& $mysql -u root -p123456 mrl -e $sql 2>$null

Write-Host "已重置状态" -ForegroundColor Green

Write-Host ""
Write-Host "=== 调用 API 重新生成 ===" -ForegroundColor Cyan
Write-Host "请在浏览器或 Postman 中调用：" -ForegroundColor Yellow
Write-Host ""
Write-Host "POST http://localhost:3000/api/content-generation/generate" -ForegroundColor White
Write-Host "Headers: x-user-id: 8d72ec4e-e1e4-4037-87b0-4877ffa90034" -ForegroundColor White
Write-Host "Body:" -ForegroundColor White
Write-Host '{
  "orderId": "d6209941-42e2-45c6-8c2c-b52ad48fff5b",
  "avatarId": "avatar_1779766422213_ogvkmpgyd",
  "orderTitle": "测试视频",
  "orderDescription": "好好gt",
  "platforms": ["douyin"],
  "contentType": "video",
  "assignedVideoUrl": "https://voicsc.51webjs.com/user%2Fe2d6ad6accbb84fd4222d6208210146a.mp4"
}' -ForegroundColor White