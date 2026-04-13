// 测试正则表达式的顺序和匹配

const testInput = `Image: [https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Fimage.png&nonce=9387bdbf-b25e-495c-b703-d16e2119560b&project_id=7621774494511808538&sign=fd211f422fabfae6a39cebf94fcabbf8881532dd4b210f7009be7e97945133c3]

已为你生成图片，请查看！`

console.log('原始输入:')
console.log(JSON.stringify(testInput))
console.log('\n')

// 模拟 cleanDebugInfo 函数的执行过程
let cleaned = testInput

console.log('步骤 1: 移除 Image: [URL] 格式')
const regex1 = /^Image[图片]?\s*[:：]\s*(?:\[https?:\/\/[^]]+\]|https?:\/\/\S+)$/gim
console.log('正则:', regex1)
console.log('匹配结果:', regex1.test(cleaned))
console.log('替换结果:', cleaned.replace(regex1, ''))
console.log('当前内容:', JSON.stringify(cleaned.replace(regex1, '')))
console.log('\n')

// 应用替换
cleaned = cleaned.replace(regex1, '')
console.log('步骤 1 执行后的内容:', JSON.stringify(cleaned))
console.log('\n')

console.log('步骤 2: 移除 Coze 临时文件代理链接')
const regex2 = /https?:\/\/code\.coze\.cn\/api\/sandbox\/[^\s\n]+/gi
console.log('正则:', regex2)
console.log('匹配结果:', regex2.test(cleaned))
console.log('替换结果:', cleaned.replace(regex2, ''))
console.log('\n')

// 应用替换
cleaned = cleaned.replace(regex2, '')
console.log('步骤 2 执行后的内容:', JSON.stringify(cleaned))
console.log('\n')

console.log('步骤 3: 移除多余的空行')
const regex3 = /\n\s*\n\s*\n/g
console.log('正则:', regex3)
console.log('匹配结果:', regex3.test(cleaned))
console.log('替换结果:', cleaned.replace(regex3, '\n\n'))
console.log('\n')

// 应用替换
cleaned = cleaned.replace(regex3, '\n\n')
cleaned = cleaned.trim()
console.log('步骤 3 执行后的内容:', JSON.stringify(cleaned))
console.log('\n')

console.log('最终结果:', cleaned)
console.log('期望结果:', '已为你生成图片，请查看！')
console.log('匹配:', cleaned === '已为你生成图片，请查看！' ? '✅' : '❌')
