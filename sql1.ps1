$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$sql = "SELECT * FROM content_generation_requests WHERE order_id = 'd6209941-42e2-45c6-8c2c-b52ad48fff5b'"
& $mysql -u root -p123456 mrl -e $sql 2>$null