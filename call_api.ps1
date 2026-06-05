Write-Host "=== Check current status ===" -ForegroundColor Cyan
& "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe" -u root -p123456 mrl -e "SELECT id, status, order_title, order_description FROM content_generation_requests WHERE order_id = 'd6209941-42e2-45c6-8c2c-b52ad48fff5b'" 2>$null

Write-Host ""
Write-Host "=== API call command ===" -ForegroundColor Yellow
Write-Host "Please run this in your terminal or use curl:" -ForegroundColor White
Write-Host ""
Write-Host 'curl -X POST http://localhost:3000/api/content-generation/generate -H "Content-Type: application/json" -H "x-user-id: 8d72ec4e-e1e4-4037-87b0-4877ffa90034" -d "{\"orderId\":\"d6209941-42e2-45c6-8c2c-b52ad48fff5b\",\"avatarId\":\"avatar_1779766422213_ogvkmpgyd\",\"orderTitle\":\"测试视频\",\"orderDescription\":\"好好gt\",\"platforms\":[\"douyin\"],\"contentType\":\"video\",\"assignedVideoUrl\":\"https://voicsc.51webjs.com/user%2Fe2d6ad6accbb84fd4222d6208210146a.mp4\"}"' -ForegroundColor White