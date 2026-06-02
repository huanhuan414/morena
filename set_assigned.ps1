$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$requestId = "req_1780038030436_jyoht4szw"
$videoUrl = "https://voicsc.51webjs.com/user%2Fe2d6ad6accbb84fd4222d6208210146a.mp4"

Write-Host "=== Set assigned_video_url manually ===" -ForegroundColor Cyan
$sql = "UPDATE content_generation_requests SET assigned_video_url = '$videoUrl' WHERE id = '$requestId'"
& $mysql -u root -p123456 mrl -e $sql 2>$null

Write-Host ""
Write-Host "=== Verify ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, status, assigned_video_url, video_url FROM content_generation_requests WHERE id = '$requestId'" 2>$null

Write-Host ""
Write-Host "Now the content generation should use the pre-generated video!" -ForegroundColor Yellow