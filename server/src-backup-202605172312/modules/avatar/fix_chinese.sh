#!/bin/bash

# 修复包含中文字符的错误消息
sed -i "s/throw new Error('分身不存在')/throw new Error('Avatar not found')/g" avatar.service.ts
sed -i "s/throw new Error('分身不存在或无权访问')/throw new Error('Avatar not found or no permission')/g" avatar.service.ts
sed -i "s/throw new Error(\`获取分身配置失败\`)/throw new Error(\`Failed to get avatar config\`)/g" avatar.service.ts
sed -i "s/throw new Error('语音回复未开启')/throw new Error('Voice reply not enabled')/g" avatar.service.ts
sed -i "s/throw new Error('好友分身不存在')/throw new Error('Friend avatar not found')/g" avatar.service.ts
sed -i "s/throw new Error('好友关系不存在')/throw new Error('Friend relationship not found')/g" avatar.service.ts
sed -i "s/throw new Error('无法解析返回结果')/throw new Error('Failed to parse response')/g" avatar.service.ts
sed -i "s/throw new Error('图片识别失败，请重试')/throw new Error('Image recognition failed, please retry')/g" avatar.service.ts
sed -i "s/throw new Error('无效的链接格式')/throw new Error('Invalid link format')/g" avatar.service.ts
sed -i "s/throw new Error('无法从该链接获取内容。建议使用截图功能：对账号主页进行截图后，点击\"上传图片识别\"按钮即可。')/throw new Error('Cannot get content from this link. Please use screenshot function: take a screenshot of the account homepage, then click the \"Upload Image Recognition\" button.')/g" avatar.service.ts
sed -i "s/throw new Error('图片识别失败，请重试或使用截图功能')/throw new Error('Image recognition failed, please retry or use screenshot function')/g" avatar.service.ts
sed -i "s/throw new Error('无法从该抖音链接获取用户信息。建议使用截图功能：对账号主页进行截图后，点击\"上传图片识别\"按钮即可。')/throw new Error('Cannot get user info from this Douyin link. Please use screenshot function: take a screenshot of the account homepage, then click the \"Upload Image Recognition\" button.')/g" avatar.service.ts
sed -i "s/throw new Error('请求失败')/throw new Error('Request failed')/g" avatar.service.ts
sed -i "s/name: '未知分身'/name: 'Unknown Avatar'/g" avatar.service.ts
sed -i "s/name: '笒鬼鬼API - userinfo'/name: 'Fenggui API - userinfo'/g" avatar.service.ts
sed -i "s/name: '抖音用户信息API'/name: 'Douyin User Info API'/g" avatar.service.ts

# 修复分析结果中的中文
sed -i "s/impresion: '照片分析失败'/impression: 'Photo analysis failed'/g" avatar.service.ts
sed -i "s/type: '未知'/type: 'Unknown'/g" avatar.service.ts
sed -i "s/description: '无法分析'/description: 'Unable to analyze'/g" avatar.service.ts
sed -i "s/workStyle: '无法分析'/workStyle: 'Unable to analyze'/g" avatar.service.ts
sed -i "s/communicationStyle: '无法分析'/communicationStyle: 'Unable to analyze'/g" avatar.service.ts
sed -i "s/summary: '无法分析照片'/summary: 'Unable to analyze photo'/g" avatar.service.ts
sed -i "s/suggestedName: ''/suggestedName: ''/g"

echo "Fix completed"
