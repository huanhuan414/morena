// 测试特定正则表达式

const testInput = `Image: [https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Fimage.png&nonce=9387bdbf-b25e-495c-b703-d16e2119560b&project_id=7621774494511808538&sign=fd211f422fabfae6a39cebf94fcabbf8881532dd4b210f7009be7e97945133c3]`

console.log('测试输入（单行）:')
console.log(JSON.stringify(testInput))
console.log('输入长度:', testInput.length)
console.log('\n')

// 测试正则表达式
const regex1 = /^Image[图片]?\s*[:：]\s*(?:\[https?:\/\/[^\]]+\]|https?:\/\/\S+)$/
console.log('正则: /^Image[图片]?\\s*[:：]\\s*(?:\\[https?:\\/\\/[^]]+\\]|https?:\\/\\/\\S+)$/')
console.log('匹配结果:', regex1.test(testInput))
console.log('替换结果:', testInput.replace(regex1, ''))
console.log('\n')

// 测试不同的正则表达式
const regex2 = /^Image[图片]?\s*[:：].*$/
console.log('正则: /^Image[图片]?\\s*[:：].*$/')
console.log('匹配结果:', regex2.test(testInput))
console.log('替换结果:', testInput.replace(regex2, ''))
console.log('\n')

// 测试多行
const multiLineInput = `Image: [https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Fimage.png&nonce=9387bdbf-b25e-495c-b703-d16e2119560b&project_id=7621774494511808538&sign=fd211f422fabfae6a39cebf94fcabbf8881532dd4b210f7009be7e97945133c3]

已为你生成图片，请查看！`

console.log('测试输入（多行）:')
console.log(JSON.stringify(multiLineInput))
console.log('\n')

console.log('正则 1 匹配结果（多行）:', regex1.test(multiLineInput))
console.log('正则 1 替换结果（多行）:', multiLineInput.replace(regex1, ''))
console.log('\n')

console.log('正则 2 匹配结果（多行）:', regex2.test(multiLineInput))
console.log('正则 2 替换结果（多行）:', multiLineInput.replace(regex2, ''))
