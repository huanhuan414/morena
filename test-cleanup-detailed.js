// 详细测试清理逻辑

// 后端清理逻辑（从 agent.service.ts 复制）
function cleanDebugInfo(content) {
  if (!content || typeof content !== 'string') return content

  let cleaned = content

  // 🔴 优先处理：移除"Image: [URL]"格式（包含中英文）- 匹配整行
  cleaned = cleaned.replace(/^Image[图片]?\s*[:：].*$/gim, '')

  // 🔴 优先处理：移除"Video: [URL]"格式（包含中英文）- 匹配整行
  cleaned = cleaned.replace(/^Video[视频]?\s*[:：].*$/gim, '')

  // 🔴 优先处理：移除"图片：[URL]"和"图片:[URL]"格式 - 匹配整行
  cleaned = cleaned.replace(/^图片\s*[:：].*$/gim, '')

  // 🔴 优先处理：移除"视频：[URL]"和"视频:[URL]"格式 - 匹配整行
  cleaned = cleaned.replace(/^视频\s*[:：].*$/gim, '')

  // 移除 Coze 临时文件代理链接（包含 file_path 参数的链接）
  cleaned = cleaned.replace(/https?:\/\/code\.coze\.cn\/api\/sandbox\/[^\s\n]+/gi, '')

  // 移除所有 TOS 对象存储链接（ark-content-generation-v2）
  cleaned = cleaned.replace(/https?:\/\/ark-content-generation-v2[\w-]+\.tos-cn-[\w-]+\.volces\.com\/[^\s\n]*/gi, '')

  // 移除"已为您生成.*链接如下："模式
  cleaned = cleaned.replace(/已为您?生成.*?[，,]?\s*链接如下[::：][\s\S]*?(?=\n\n|\n[A-Z\u4e00-\u9fa5]|$)/gi, '')

  // 移除"已为你生成.*链接如下："模式
  cleaned = cleaned.replace(/已为你生成.*?[，,]?\s*链接如下[::：][\s\S]*?(?=\n\n|\n[A-Z\u4e00-\u9fa5]|$)/gi, '')

  // 移除"图片链接如下："模式
  cleaned = cleaned.replace(/图片链接如下[::：]\s*\d*[\.、]?\s*https?:\/\/[^\s\n]+/gi, '')

  // 移除"视频链接如下："模式
  cleaned = cleaned.replace(/视频链接如下[::：]\s*\d*[\.、]?\s*https?:\/\/[^\s\n]+/gi, '')

  // 移除"已为你生成.*配图"模式
  cleaned = cleaned.replace(/已为你生成.*配图[，,]\s*图片链接如下[::：]\s*https?:\/\/[^\s\n]+/gi, '')

  // 移除独立的链接行
  cleaned = cleaned.replace(/^\s*\d+[\.、]\s*https?:\/\/[^\s\n]+$/gm, '')

  // 移除"链接如下："引导的多链接列表
  cleaned = cleaned.replace(/链接如下[::：][\s\S]*?(?=\n\n|\n[A-Z\u4e00-\u9fa5]|$)/gi, '')

  // 移除多余的空行
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')

  return cleaned.trim()
}

// 测试用例
const testCases = [
  {
    name: 'Image: [URL] 格式（英文）',
    input: `Image: [https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Fimage.png&nonce=9387bdbf-b25e-495c-b703-d16e2119560b&project_id=7621774494511808538&sign=fd211f422fabfae6a39cebf94fcabbf8881532dd4b210f7009be7e97945133c3]

已为你生成图片，请查看！`,
    expected: '已为你生成图片，请查看！'
  },
  {
    name: '图片：[URL] 格式（中文）',
    input: `图片：[https://code.coze.cn/api/sandbox/coze_coding/file/proxy?file_path=assets%2Fimage.png]

生成的图片展示效果很好。`,
    expected: '生成的图片展示效果很好。'
  },
  {
    name: 'Video: [URL] 格式（英文）',
    input: `Video: [https://code.coze.cn/api/sandbox/coze_coding/file/proxy?file_path=assets%2Fvideo.mp4]

视频已生成完毕。`,
    expected: '视频已生成完毕。'
  },
  {
    name: '视频：[URL] 格式（中文）',
    input: `视频：[https://code.coze.cn/api/sandbox/coze_coding/file/proxy?file_path=assets%2Fvideo.mp4]

视频生成成功！`,
    expected: '视频生成成功！'
  },
  {
    name: 'Image: URL（无方括号）',
    input: `Image: https://code.coze.cn/api/sandbox/coze_coding/file/proxy?file_path=assets%2Fimage.png

图片生成完成。`,
    expected: '图片生成完成。'
  },
  {
    name: '图片: URL（无方括号）',
    input: `图片: https://code.coze.cn/api/sandbox/coze_coding/file/proxy?file_path=assets%2Fimage.png

图片生成完成。`,
    expected: '图片生成完成。'
  },
  {
    name: '混合格式测试',
    input: `已为你生成一张图片
Image: [https://code.coze.cn/api/sandbox/coze_coding/file/proxy?file_path=assets%2Fimage.png]

这张图片展示了美丽的风景。`,
    expected: '已为你生成一张图片\n\n这张图片展示了美丽的风景。'
  },
  {
    name: '多行文本中间包含 Image: [URL]',
    input: `这是第一段内容。

Image: [https://code.coze.cn/api/sandbox/coze_coding/file/proxy?file_path=assets%2Fimage.png]

这是第二段内容。`,
    expected: '这是第一段内容。\n\n这是第二段内容。'
  }
]

console.log('========================================')
console.log('  清理逻辑详细测试')
console.log('========================================\n')

let passCount = 0
let failCount = 0

testCases.forEach((test, index) => {
  const result = cleanDebugInfo(test.input)
  const passed = result === test.expected

  console.log(`测试 ${index + 1}: ${test.name}`)

  if (passed) {
    console.log('✅ 通过\n')
    passCount++
  } else {
    console.log('❌ 失败')
    console.log(`期望: ${JSON.stringify(test.expected)}`)
    console.log(`实际: ${JSON.stringify(result)}\n`)
    failCount++
  }
})

console.log('========================================')
console.log(`  测试结果：${passCount} 通过，${failCount} 失败`)
console.log('========================================')

if (failCount === 0) {
  console.log('\n🎉 所有测试通过！清理逻辑正常工作。')
  process.exit(0)
} else {
  console.log('\n⚠️  存在失败的测试，请检查。')
  process.exit(1)
}
