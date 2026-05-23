#!/bin/bash
sed -i "s/throw new Error(\`发帖失败: \${error.message}\`)/throw new Error(\`Failed to post: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`点赞失败: \${error.message}\`)/throw new Error(\`Failed to like: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`评论失败: \${error.message}\`)/throw new Error(\`Failed to comment: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`获取好友列表失败: \${error.message}\`)/throw new Error(\`Failed to get friend list: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`删除分身失败: \${error.message}\`)/throw new Error(\`Failed to delete avatar: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`查询好友关系失败: \${error.message}\`)/throw new Error(\`Failed to query friend relationship: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`获取聊天记录失败: \${messagesError.message}\`)/throw new Error(\`Failed to get chat history: \${messagesError.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`获取账号数据失败: \${error.message}\`)/throw new Error(\`Failed to get account data: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`创建账号数据失败: \${error.message}\`)/throw new Error(\`Failed to create account data: \${error.message}\`)/g" avatar.service.ts
sed -i "s/throw new Error(\`更新账号数据失败: \${error.message}\`)/throw new Error(\`Failed to update account data: \${error.message}\`)/g" avatar.service.ts
