#!/bin/bash
cd /workspace/projects

# 杀掉旧的SSH隧道
pkill -f "ssh -L.*16033" 2>/dev/null
sleep 1

# 建立新的SSH隧道
echo "建立SSH隧道..."
sshpass -f /tmp/pwd.txt ssh -L 3306:127.0.0.1:16033 -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -N root@180.184.205.74 &
TUNNEL_PID=$!
echo "SSH Tunnel PID: $TUNNEL_PID"

# 等待隧道建立
sleep 3

# 测试MySQL连接
mysql -h 127.0.0.1 -P 3306 -u mrl -pSYDPHJB8aGBn83Eh -e "SELECT 1" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "MySQL连接成功"
else
    echo "MySQL连接失败，退出"
    kill $TUNNEL_PID 2>/dev/null
    exit 1
fi

# 启动开发服务
echo "启动开发服务..."
pnpm dev
