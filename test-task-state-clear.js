// 测试 task_state 清除逻辑

const testCases = [
  {
    name: '正常情况：任务完成后清除 task_state',
    input: {
      metadata: {
        task_state: {
          status: 'running',
          taskId: 'task-123'
        },
        agent_result: {
          steps: [{ action: 'step1' }]
        },
        media: [{ type: 'image', url: 'https://example.com/image.png' }]
      }
    },
    expected: {
      metadata: {
        agent_result: {
          steps: [{ action: 'step1' }]
        },
        media: [{ type: 'image', url: 'https://example.com/image.png' }]
      }
    }
  },
  {
    name: '边界情况：没有 task_state',
    input: {
      metadata: {
        agent_result: {
          steps: [{ action: 'step1' }]
        },
        media: [{ type: 'image', url: 'https://example.com/image.png' }]
      }
    },
    expected: {
      metadata: {
        agent_result: {
          steps: [{ action: 'step1' }]
        },
        media: [{ type: 'image', url: 'https://example.com/image.png' }]
      }
    }
  },
  {
    name: '边界情况：空的 metadata',
    input: {
      metadata: {}
    },
    expected: {
      metadata: {}
    }
  }
]

console.log('========================================')
console.log('  task_state 清除逻辑测试')
console.log('========================================\n')

let passCount = 0
let failCount = 0

// 模拟后端 updateAssistantMessage 方法中的清理逻辑
function clearTaskState(input) {
  const metadata = input.metadata || {}

  // 如果 metadata 中还有 task_state，显式删除它
  if (metadata.task_state) {
    delete metadata.task_state
  }

  return { metadata }
}

testCases.forEach((test, index) => {
  const result = clearTaskState(test.input)
  const passed = JSON.stringify(result) === JSON.stringify(test.expected)

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
  console.log('\n🎉 所有测试通过！task_state 清除逻辑正常工作。')
  process.exit(0)
} else {
  console.log('\n⚠️  存在失败的测试，请检查。')
  process.exit(1)
}
