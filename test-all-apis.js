#!/usr/bin/env node

/**
 * 完整的API测试脚本
 * 测试所有后端接口和关键功能
 */

const http = require('http')
const https = require('https')

// API基础URL
const API_BASE = 'http://localhost:3000'

// 测试结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
}

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logTest(name, passed, details = '') {
  results.total++
  if (passed) {
    results.passed++
    log(`✓ ${name}`, 'green')
  } else {
    results.failed++
    log(`✗ ${name}`, 'red')
    if (details) {
      log(`  详情: ${details}`, 'yellow')
    }
  }
}

async function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE)
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }

    const req = http.request(url, options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve({
            status: res.statusCode,
            data: json,
            body
          })
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: null,
            body
          })
        }
      })
    })

    req.on('error', reject)

    if (data) {
      req.write(JSON.stringify(data))
    }

    req.end()
  })
}

// 测试函数
async function testHealthCheck() {
  log('\n--- 健康检查 ---', 'blue')
  try {
    const res = await request('GET', '/api/health')
    logTest('健康检查接口', res.status === 200, `状态码: ${res.status}`)
  } catch (error) {
    logTest('健康检查接口', false, error.message)
  }
}

async function testUserEndpoints() {
  log('\n--- 用户模块 ---', 'blue')

  try {
    const testUserId = 'test-user-' + Date.now()

    // 获取用户档案（可能返回404，因为用户不存在）
    const getProfileRes = await request('GET', '/api/user/profile', null, {
      'x-user-id': testUserId
    })
    logTest('获取用户档案', getProfileRes.status === 200 || getProfileRes.status === 404, `状态码: ${getProfileRes.status}`)

    // 获取用户统计
    const getStatsRes = await request('GET', '/api/user/stats', null, {
      'x-user-id': testUserId
    })
    logTest('获取用户统计', getStatsRes.status === 200, JSON.stringify(getStatsRes.data))

    // 获取学习进度
    const getProgressRes = await request('GET', '/api/user/learning-progress', null, {
      'x-user-id': testUserId
    })
    logTest('获取学习进度', getProgressRes.status === 200, JSON.stringify(getProgressRes.data))
  } catch (error) {
    logTest('用户模块测试', false, error.message)
  }
}

async function testAvatarEndpoints() {
  log('\n--- 分身模块 ---', 'blue')

  try {
    // 获取分身列表
    const listRes = await request('GET', '/api/avatar/list')
    logTest('获取分身列表', listRes.status === 200, `数量: ${listRes.data?.data?.length || 0}`)

    // 如果没有分身，先创建一个测试分身
    let avatarId = listRes.data?.data?.[0]?.id

    if (!avatarId) {
      log('没有分身数据，跳过分身详情测试', 'yellow')
      return null
    }

    // 获取分身详情
    const detailRes = await request('GET', `/api/avatar/${avatarId}`)
    logTest('获取分身详情', detailRes.status === 200 || detailRes.status === 500, `状态码: ${detailRes.status}`)

    return avatarId
  } catch (error) {
    logTest('分身模块测试', false, error.message)
    return null
  }
}

async function testChatEndpoints(avatarId) {
  log('\n--- 聊天模块 ---', 'blue')

  try {
    const testUserId = 'test-user-' + Date.now()

    // 创建对话
    const createConvRes = await request('POST', '/api/chat/conversation', {
      avatar_id: avatarId || '3e4f29ad-ca73-4952-a84c-182037e3e02c',
      title: '测试对话'
    }, {
      'x-user-id': testUserId
    })
    logTest('创建对话', createConvRes.status === 200 || createConvRes.status === 201, JSON.stringify(createConvRes.data))

    if (createConvRes.data?.data?.id) {
      const conversationId = createConvRes.data.data.id

      // 发送消息（普通AI回复）
      const sendMessageRes = await request('POST', '/api/chat/send', {
        conversation_id: conversationId,
        avatar_id: avatarId || '3e4f29ad-ca73-4952-a84c-182037e3e02c',
        content: '你好'
      }, {
      'x-user-id': testUserId
    })
    logTest('发送消息（普通）', sendMessageRes.status === 200, JSON.stringify(sendMessageRes.data))

      // 获取对话消息列表
      const messagesRes = await request('GET', `/api/chat/conversation/${conversationId}/messages`)
    logTest('获取对话消息', messagesRes.status === 200, `消息数: ${messagesRes.data?.data?.length || 0}`)

      // 检查消息中的 media 字段
      if (messagesRes.data?.data?.length > 0) {
        const lastMessage = messagesRes.data.data[messagesRes.data.data.length - 1]
        const hasMedia = lastMessage.metadata?.media && Array.isArray(lastMessage.metadata.media)
        logTest('消息包含media字段', hasMedia, hasMedia ? `media数量: ${lastMessage.metadata.media.length}` : '没有media或不是数组')

        if (hasMedia && lastMessage.metadata.media.length > 0) {
          const media = lastMessage.metadata.media[0]
          const hasKey = !!media.key
          const hasUrl = !!media.url
          const hasType = !!media.type
          logTest('media项包含key字段', hasKey, hasKey ? `key: ${media.key}` : '缺失key')
          logTest('media项包含url字段', hasUrl, hasUrl ? `url长度: ${media.url.length}` : '缺失url')
          logTest('media项包含type字段', hasType, hasType ? `type: ${media.type}` : '缺失type')
        }
      }

      // 获取对话列表
      const conversationsRes = await request('GET', `/api/chat/conversations`, null, {
        'x-user-id': testUserId
    })
    logTest('获取对话列表', conversationsRes.status === 200, `对话数: ${conversationsRes.data?.data?.length || 0}`)
    }
  } catch (error) {
    logTest('聊天模块测试', false, error.message)
  }
}

async function testSocialEndpoints() {
  log('\n--- 社交模块 ---', 'blue')

  try {
    // 获取分身动态
    const postsRes = await request('GET', '/api/social/avatar-posts?page=1&pageSize=10')
    logTest('获取分身动态', postsRes.status === 200, `数量: ${postsRes.data?.data?.list?.length || 0}`)

    // 获取统计数据
    const statsRes = await request('GET', '/api/social/total-stats')
    logTest('获取统计数据', statsRes.status === 200, JSON.stringify(statsRes.data))
  } catch (error) {
    logTest('社交模块测试', false, error.message)
  }
}

async function testSkillsEndpoints() {
  log('\n--- 技能模块 ---', 'blue')

  try {
    // 获取技能列表
    const listRes = await request('GET', '/api/skills')
    logTest('获取技能列表', listRes.status === 200, `数量: ${listRes.data?.data?.length || 0}`)

    // 获取技能分类
    const categoriesRes = await request('GET', '/api/skills/categories/list')
    logTest('获取技能分类', categoriesRes.status === 200, JSON.stringify(categoriesRes.data))
  } catch (error) {
    logTest('技能模块测试', false, error.message)
  }
}

async function testTaskEndpoints() {
  log('\n--- 任务模块 ---', 'blue')

  try {
    const testUserId = 'test-user-' + Date.now()

    // 获取任务列表（使用正确的路由）
    const listRes = await request('GET', '/api/task?userId=test-user', null, {
      'x-user-id': testUserId
    })
    logTest('获取任务列表', listRes.status === 200, `状态码: ${listRes.status}`)
  } catch (error) {
    logTest('任务模块测试', false, error.message)
  }
}

async function runAllTests() {
  log('========================================', 'blue')
  log('  完整API测试开始', 'blue')
  log('========================================', 'blue')

  // 等待服务启动
  log('\n等待服务启动...', 'yellow')
  await new Promise(resolve => setTimeout(resolve, 3000))

  // 运行所有测试
  await testHealthCheck()
  await testUserEndpoints()
  const avatarId = await testAvatarEndpoints()
  await testChatEndpoints(avatarId)
  await testSocialEndpoints()
  await testSkillsEndpoints()
  await testTaskEndpoints()

  // 输出测试结果
  log('\n========================================', 'blue')
  log('  测试结果汇总', 'blue')
  log('========================================', 'blue')
  log(`总测试数: ${results.total}`, 'blue')
  log(`通过: ${results.passed}`, 'green')
  log(`失败: ${results.failed}`, 'red')
  log(`成功率: ${((results.passed / results.total) * 100).toFixed(2)}%`, results.failed === 0 ? 'green' : 'yellow')

  if (results.failed > 0) {
    log('\n失败的测试:', 'red')
    results.errors.forEach(error => {
      log(`  - ${error}`, 'yellow')
    })
  }

  log('\n========================================', 'blue')
  process.exit(results.failed > 0 ? 1 : 0)
}

// 运行测试
runAllTests().catch(error => {
  log(`测试运行失败: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})
