/**
 * Agent 消息渲染组件
 * 显示 Agent 执行过程、步骤和结果
 */

import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlatformType, PLATFORM_TEMPLATES } from './PlatformConfigDialog'

// 执行步骤
interface ReActStep {
  step_index: number
  thought: string
  action?: string
  action_input?: any
  observation?: any
  requires_config?: boolean
  config_platform?: PlatformType
  config_fields?: any[]
}

// Agent 执行结果
interface AgentResult {
  success: boolean
  finalAnswer: string
  steps: ReActStep[]
  requiresConfig: boolean
  configPlatform?: PlatformType
  configFields?: any[]
}

interface AgentMessageViewProps {
  result: AgentResult
  onConfigurePlatform?: (platform: PlatformType) => void
}

// 工具名称映射
const TOOL_NAMES: Record<string, string> = {
  app_create_task: '创建任务',
  app_update_task: '更新任务',
  app_delete_task: '删除任务',
  app_list_tasks: '查看任务列表',
  app_create_order: '创建订单',
  app_create_post: '发布帖子',
  app_update_avatar: '更新分身',
  write_article: '撰写文章',
  generate_image: '生成图片',
  generate_video: '生成视频',
  check_platform_config: '检查平台配置',
  publish_wechat_mp: '发布公众号',
  publish_xiaohongshu: '发布小红书',
  publish_bilibili: '发布B站',
  publish_weibo: '发布微博',
  publish_douyin: '发布抖音',
  publish_wechat_video: '发布视频号'
}

export function AgentMessageView({ result, onConfigurePlatform }: AgentMessageViewProps) {
  const { success, finalAnswer, steps, requiresConfig, configPlatform } = result

  // 处理配置平台
  const handleConfigure = () => {
    if (configPlatform && onConfigurePlatform) {
      onConfigurePlatform(configPlatform)
    }
  }

  return (
    <View className="space-y-3">
      {/* 执行步骤 */}
      {steps.length > 0 && (
        <View className="space-y-2">
          {steps.map((step, index) => (
            <Card key={index} className="bg-gray-50">
              <CardContent className="p-3">
                {/* 步骤标题 */}
                <View className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    <Text>步骤 {step.step_index}</Text>
                  </Badge>
                  {step.action && TOOL_NAMES[step.action] && (
                    <Badge variant="secondary" className="text-xs">
                      <Text>{TOOL_NAMES[step.action]}</Text>
                    </Badge>
                  )}
                </View>

                {/* 思考内容 */}
                <View className="text-sm text-gray-700 mb-2">
                  <Text className="font-medium">💭 思考: </Text>
                  <Text>{step.thought.substring(0, 200)}{step.thought.length > 200 ? '...' : ''}</Text>
                </View>

                {/* 行动信息 */}
                {step.action && (
                  <View className="text-sm text-gray-600 mb-2">
                    <Text className="font-medium">🔧 行动: </Text>
                    <Text>{step.action}</Text>
                    {step.action_input && Object.keys(step.action_input).length > 0 && (
                      <View className="ml-4 mt-1 text-xs text-gray-500">
                        <Text>{JSON.stringify(step.action_input, null, 2).substring(0, 100)}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* 观察结果 */}
                {step.observation && (
                  <View className="text-sm">
                    <Text className="font-medium">👁️ 结果: </Text>
                    {step.observation.success ? (
                      <Text className="text-green-600">✓ 成功</Text>
                    ) : (
                      <Text className="text-red-600">✗ {step.observation.error || '失败'}</Text>
                    )}
                  </View>
                )}

                {/* 需要配置提示 */}
                {step.requires_config && step.config_platform && (
                  <View className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                    <Text className="text-sm text-yellow-800">
                      ⚠️ 需要配置 {PLATFORM_TEMPLATES[step.config_platform]?.name || step.config_platform}
                    </Text>
                    <View
                      className="mt-2 text-sm text-blue-600 underline"
                      onClick={handleConfigure}
                    >
                      <Text>点击配置</Text>
                    </View>
                  </View>
                )}
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* 最终答案 */}
      <Card className={success ? 'bg-green-50 border-green-200' : requiresConfig ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}>
        <CardContent className="p-3">
          <View className="flex items-start gap-2">
            {success ? (
              <Text className="text-green-500">✅</Text>
            ) : requiresConfig ? (
              <Text className="text-yellow-500">⚠️</Text>
            ) : (
              <Text className="text-gray-500">📋</Text>
            )}
            <View className="flex-1">
              <Text className="text-sm font-medium">
                {success ? '任务完成' : requiresConfig ? '需要配置' : '执行结果'}
              </Text>
              <Text className="text-sm text-gray-700 mt-1">{finalAnswer}</Text>
            </View>
          </View>

          {/* 配置按钮 */}
          {requiresConfig && configPlatform && onConfigurePlatform && (
            <View className="mt-3 flex justify-end">
              <Badge
                className="bg-blue-500 text-white px-3 py-1"
                onClick={handleConfigure}
              >
                <Text>配置 {PLATFORM_TEMPLATES[configPlatform]?.name}</Text>
              </Badge>
            </View>
          )}
        </CardContent>
      </Card>
    </View>
  )
}

// 导出类型供其他组件使用
export type { AgentResult, ReActStep }
