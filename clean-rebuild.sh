#!/bin/bash
# 彻底清理并重新构建微信小程序

echo "=== 步骤 1: 删除旧的编译产物 ==="
rm -rf /workspace/projects/dist-weapp
echo "✓ 已删除 dist-weapp"

echo ""
echo "=== 步骤 2: 清理 Vite 缓存 ==="
rm -rf /workspace/projects/node_modules/.vite
echo "✓ 已清理 node_modules/.vite"

echo ""
echo "=== 步骤 3: 重新构建 ==="
cd /workspace/projects && pnpm build:weapp

echo ""
echo "=== 步骤 4: 验证构建产物无哈希模块 ==="
python3 -c "
import os, re
hash_found = False
for root, dirs, files in os.walk('/workspace/projects/dist-weapp'):
    for fname in files:
        if fname.endswith('.js'):
            fpath = os.path.join(root, fname)
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            # Check for any hash-like require patterns
            hash_requires = re.findall(r'require\([\"\']([0-9a-fA-F]{20,})[\"\']\)', content)
            if hash_requires:
                print(f'⚠️  发现哈希模块: {fpath}: {hash_requires}')
                hash_found = True
            if 'CC96F827C8A734BFAAF09020DB1AFC74' in content or 'D6E272F5C8A734BFB0841AF2B7C31122' in content:
                print(f'⚠️  发现旧哈希: {fpath}')
                hash_found = True
if not hash_found:
    print('✓ 验证通过: 编译产物中无哈希模块引用')
"

echo ""
echo "=== 构建完成 ==="
echo "请在微信开发者工具中执行以下操作:"
echo "1. 点击顶部菜单: 项目 -> 重新初始化此项目"
echo "2. 或者: 点击顶部菜单: 项目 -> 清除缓存 -> 清除全部"
echo "3. 关闭微信开发者工具"
echo "4. 重新打开项目, 导入 dist-weapp 目录"
