#!/bin/bash
sed -i "s/throw new Error(\`更新分身失败: \${error.message}\`)/throw new Error(\`Failed to update avatar: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`更新分身经验失败: \${error.message}\`)/throw new Error(\`Failed to update avatar exp: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`托管设置失败: \${error.message}\`)/throw new Error(\`Failed to set hosting: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error('无权修改此分身的设置')/throw new Error('No permission to modify this avatar')/g" avatar.service.ts
sed -i "s/throw new Error(\`更新托管设置失败: \${error.message}\`)/throw new Error(\`Failed to update hosting settings: \${error.message}\`)/g" avatar.service.ts
