// 调试正则表达式

const testInput = 'Image: [https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Fimage.png&nonce=9387bdbf-b25e-495c-b703-d16e2119560b&project_id=7621774494511808538&sign=fd211f422fabfae6a39cebf94fcabbf8881532dd4b210f7009be7e97945133c3]\n\n已为你生成图片，请查看！'

console.log('原始输入:')
console.log(JSON.stringify(testInput))
console.log('\n')

// 测试不同的正则表达式
const regex1 = /^Image[图片]?\s*[:：]\s*(\[https?:\/\/[^\]]+\]|https?:\/\/\S+)$/gim
console.log('正则 1: /^Image[图片]?\\s*[:：]\\s*(\\[https?:\\/\\/[^\\]]+\\]|https?:\\/\\/\\S+)$/gim')
console.log('匹配结果:', regex1.test(testInput))
console.log('替换结果:', testInput.replace(regex1, ''))
console.log('\n')

const regex2 = /^Image[图片]?\s*[:：]\s*\[.*\]$/gim
console.log('正则 2: /^Image[图片]?\\s*[:：]\\s*\\[.*\\]$/gim')
console.log('匹配结果:', regex2.test(testInput))
console.log('替换结果:', testInput.replace(regex2, ''))
console.log('\n')

const regex3 = /^Image[图片]?\s*[:：].*$/gim
console.log('正则 3: /^Image[图片]?\\s*[:：].*$/gim')
console.log('匹配结果:', regex3.test(testInput))
console.log('替换结果:', testInput.replace(regex3, ''))
console.log('\n')

// 测试单行
const singleLineInput = 'Image: [https://code.coze.cn/api/sandbox/coze_coding/file/proxy?file_path=assets%2Fimage.png]'
console.log('单行输入:')
console.log(JSON.stringify(singleLineInput))
console.log('\n')

console.log('正则 1 匹配结果:', regex1.test(singleLineInput))
console.log('正则 1 替换结果:', singleLineInput.replace(regex1, ''))
console.log('\n')

console.log('正则 2 匹配结果:', regex2.test(singleLineInput))
console.log('正则 2 替换结果:', singleLineInput.replace(regex2, ''))
console.log('\n')

console.log('正则 3 匹配结果:', regex3.test(singleLineInput))
console.log('正则 3 替换结果:', singleLineInput.replace(regex3, ''))
