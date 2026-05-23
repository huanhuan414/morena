#!/bin/bash
sed -i "s/throw new Error('删除账号数据失败: \${error.message}')/throw new Error('Failed to delete account data: ' + error.message)/g" avatar.service.ts
sed -i "s/throw new Error(\`图片上传失败: \${error.message}\`)/throw new Error(\`Failed to upload image: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`生成URL失败: \${error.message}\`)/throw new Error(\`Failed to generate URL: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`图片识别失败: \${error.message}\`)/throw new Error(\`Failed to recognize image: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error('无法获取重定向URL')/throw new Error('Failed to get redirect URL')/g" avatar.service.ts
sed -i "s/throw new Error('无法从重定向URL中提取sec_uid')/throw new Error('Failed to extract sec_uid from redirect URL')/g" avatar.service.ts
sed -i "s/throw new Error('拉黑失败: ' + error.message)/throw new Error('Failed to block: ' + error.message)/g" avatar.service.ts
sed -i "s/throw new Error('解除拉黑失败: ' + error.message)/throw new Error('Failed to unblock: ' + error.message)/g" avatar.service.ts
sed -i "s/throw new Error('获取拉黑列表失败: ' + error.message)/throw new Error('Failed to get blocked list: ' + error.message)/g" avatar.service.ts
