// 测试前端任务状态判断逻辑

const testCases = [
  {
    name: '任务正在运行，没有内容',
    input: {
      task_state: {
        status: 'running',
        taskId: 'task-123',
        lastProgressMessage: '正在思考第 1 步...'
      },
      content: '',
      metadata: {}
    },
    expected: 'should_restore' // 应该恢复任务状态
  },
  {
    name: '任务状态 running，但有 content',
    input: {
      task_state: {
        status: 'running',
        taskId: 'task-123',
        lastProgressMessage: '正在思考第 1 步...'
      },
      content: '已为您生成图片',
      metadata: {}
    },
    expected: 'should_clear' // 应该清空状态，视为任务完成
  },
  {
    name: '任务状态 running，但有 media',
    input: {
      task_state: {
        status: 'running',
        taskId: 'task-123',
        lastProgressMessage: '正在思考第 1 步...'
      },
      content: '',
      metadata: {
        media: [{ type: 'image', url: 'https://example.com/image.png' }]
      }
    },
    expected: 'should_clear' // 应该清空状态，视为任务完成
  },
  {
    name: '任务状态 running，但有 agent_result',
    input: {
      task_state: {
        status: 'running',
        taskId: 'task-123',
        lastProgressMessage: '正在思考第 1 步...'
      },
      content: '',
      metadata: {
        agent_result: { steps: [] }
      }
    },
    expected: 'should_clear' // 应该清空状态，视为任务完成
  },
  {
    name: '任务状态 completed',
    input: {
      task_state: {
        status: 'completed',
        taskId: 'task-123'
      },
      content: '已为您生成图片',
      metadata: {}
    },
    expected: 'should_clear' // 应该清空状态
  },
  {
    name: '任务状态 failed',
    input: {
      task_state: {
        status: 'failed',
        taskId: 'task-123'
      },
      content: '',
      metadata: {}
    },
    expected: 'should_clear' // 应该清空状态
  },
  {
    name: '真实场景：数据库中的旧数据',
    input: {
      task_state: {
        status: 'running',
        taskId: 'task-1776123605651',
        lastProgressMessage: '正在思考第 18 步...',
        progressHistory: [
          {
            type: 'thinking',
            action: 'thinking',
            status: 'running',
            message: '正在思考第 18 步...'
          }
        ]
      },
      content: '已为您生成一张通用风格的高清竖屏图片，链接如下：https://ark-content-generation-v2-cn-beijing.tos-cn-beijing.volces.com/...',
      metadata: {
        media: [{ type: 'image', url: 'https://ark-content-generation-v2-cn-beijing.tos-cn-beijing.volces.com/...' }]
      }
    },
    expected: 'should_clear' // 应该清空状态，视为任务完成
  }
]

console.log('========================================')
console.log('  前端任务状态判断逻辑测试')
console.log('========================================\n')

let passCount = 0
let failCount = 0

// 模拟前端判断逻辑
function shouldRestoreTaskState(message) {
  const taskState = message.task_state
  const hasContent = !!message.content && message.content.trim().length > 0
  const hasMedia = !!message.metadata?.media && message.metadata.media.length > 0
  const hasAgentResult = !!message.metadata?.agent_result

  // 只对未完成的任务恢复状态，且任务真的没有完成
  if (taskState?.status === 'running' && !hasContent && !hasMedia && !hasAgentResult) {
    return 'should_restore'
  } else {
    return 'should_clear'
  }
}

testCases.forEach((test, index) => {
  const result = shouldRestoreTaskState(test.input)
  const passed = result === test.expected

  console.log(`测试 ${index + 1}: ${test.name}`)
  console.log(`  输入: task_state.status = "${test.input.task_state?.status}"`)
  console.log(`        content.length = ${test.input.content?.length || 0}`)
  console.log(`        media.length = ${test.input.metadata?.media?.length || 0}`)
  console.log(`        agent_result = ${!!test.input.metadata?.agent_result}`)
  console.log(`  结果: ${result}`)
  console.log(`  期望: ${test.expected}`)

  if (passed) {
    console.log('  ✅ 通过\n')
    passCount++
  } else {
    console.log('  ❌ 失败\n')
    failCount++
  }
})

console.log('========================================')
console.log(`  测试结果：${passCount} 通过，${failCount} 失败`)
console.log('========================================')

if (failCount === 0) {
  console.log('\n🎉 所有测试通过！前端任务状态判断逻辑正常工作。')
  process.exit(0)
} else {
  console.log('\n⚠️  存在失败的测试，请检查。')
  process.exit(1)
}
