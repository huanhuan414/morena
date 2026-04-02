# build_weapp.sh - 构建微信小程序
# 注意：微信小程序输出目录在 config/index.ts 中定义为 dist-weapp
PID_FILE="/tmp/coze-build_weapp.pid"

# 杀掉上次的构建进程
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "正在终止上次的构建进程 (PID: $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null
        sleep 1
    fi
    rm -f "$PID_FILE"
fi

# 直接执行构建（不使用 setsid，避免进程组问题）
pnpm build:weapp &
BUILD_PID=$!
echo $BUILD_PID > "$PID_FILE"

echo "构建已启动 (PID: $BUILD_PID)"

# 等待构建完成
wait $BUILD_PID
EXIT_CODE=$?

rm -f "$PID_FILE"

# 检查构建结果
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ 构建成功"
    # 验证输出文件
    if [ -f "dist-weapp/app.json" ]; then
        echo "✅ 输出文件验证通过"
    else
        echo "❌ 错误：dist-weapp/app.json 不存在"
        exit 1
    fi
else
    echo "❌ 构建失败，退出码: $EXIT_CODE"
    exit $EXIT_CODE
fi
