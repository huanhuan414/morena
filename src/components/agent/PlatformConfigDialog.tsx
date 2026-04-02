/**
 * 平台配置弹窗组件
 * 用于 Agent 需要平台配置时引导用户完成配置
 */

import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import Taro from '@tarojs/taro'
import * as Network from '@/network'

// 平台类型
export type PlatformType = 
  | 'wechat_mp' 
  | 'xiaohongshu' 
  | 'bilibili' 
  | 'weibo' 
  | 'douyin' 
  | 'wechat_video'

// 配置字段
interface ConfigField {
  name: string
  label: string
  type: 'text' | 'password' | 'textarea'
  required: boolean
  placeholder?: string
  description?: string
}

// 前置条件
interface Prerequisite {
  text: string
  required: boolean
  helpText?: string
}

// 平台配置模板
const PLATFORM_TEMPLATES: Record<PlatformType, {
  name: string
  icon: string
  fields: ConfigField[]
  instructions: string
  steps: string[]
  prerequisites: Prerequisite[]
  helpUrl?: string
  notes?: string[]
  apiWarning?: string
}> = {
  wechat_mp: {
    name: '微信公众号',
    icon: '📱',
    fields: [
      { 
        name: 'app_id', 
        label: 'AppID (应用ID)', 
        type: 'text', 
        required: true, 
        placeholder: 'wx开头的字符串，如 wx1234567890abcdef',
        description: '在微信公众平台 → 开发 → 基本配置中获取'
      },
      { 
        name: 'app_secret', 
        label: 'AppSecret (应用密钥)', 
        type: 'password', 
        required: true, 
        placeholder: '32位字符串，如 1234567890abcdef1234567890abcdef',
        description: '需要管理员扫码确认后才能查看，请妥善保管'
      }
    ],
    prerequisites: [
      { text: '已认证的服务号', required: true, helpText: '订阅号和未认证账号无法使用发布接口' },
      { text: '服务器IP已加入白名单', required: true, helpText: '在公众平台后台 → 开发 → 基本配置 → IP白名单中添加' },
      { text: '已开通素材管理接口权限', required: true, helpText: '需要联系微信开通或申请' },
    ],
    instructions: '请前往微信公众平台获取AppID和AppSecret',
    steps: [
      '1. 登录微信公众平台 (mp.weixin.qq.com)',
      '2. 点击左侧菜单「开发」→「基本配置」',
      '3. 复制「开发者ID(AppID)」',
      '4. 点击「AppSecret(应用密钥)」旁边的查看按钮（需管理员扫码）',
      '5. 复制AppSecret并妥善保管',
      '6. 将服务器IP添加到「IP白名单」中',
    ],
    helpUrl: 'https://mp.weixin.qq.com',
    notes: [
      '⚠️ AppSecret只在创建时显示一次，请务必保存',
      '⚠️ IP白名单必须配置，否则API调用会返回40164错误',
      '⚠️ 订阅号暂时不支持自动发布，只能生成内容后手动复制',
    ],
    apiWarning: '自动发布功能需要已认证的服务号，如果您的账号不满足条件，可以先使用内容生成功能，然后手动复制到公众号后台发布。'
  },
  xiaohongshu: {
    name: '小红书',
    icon: '📕',
    fields: [
      { 
        name: 'cookie', 
        label: 'Cookie', 
        type: 'textarea', 
        required: true, 
        placeholder: '请粘贴完整的Cookie字符串',
        description: '从浏览器开发者工具中复制'
      }
    ],
    prerequisites: [
      { text: '已登录小红书网页版', required: true },
      { text: '使用Chrome/Edge浏览器', required: false, helpText: '推荐使用Chrome或Edge浏览器' },
      { text: '账号状态正常', required: true, helpText: '未被封禁或限制' },
    ],
    instructions: '请登录小红书网页版，获取Cookie',
    steps: [
      '1. 打开小红书网页版 (www.xiaohongshu.com) 并登录',
      '2. 按F12打开开发者工具',
      '3. 切换到「Network」(网络)标签',
      '4. 刷新页面，在请求列表中点击任意请求',
      '5. 在右侧找到「Request Headers」→「Cookie」',
      '6. 复制完整的Cookie值',
    ],
    helpUrl: 'https://www.xiaohongshu.com',
    notes: [
      '⚠️ Cookie包含登录信息，请勿泄露给他人',
      '⚠️ Cookie有效期有限，过期后需要重新获取',
      '⚠️ 建议使用隐私模式获取Cookie，避免其他网站干扰',
    ],
    apiWarning: '小红书暂无官方开放API，使用Cookie发布存在一定风险。建议仅用于个人账号，发布频率不宜过高。'
  },
  bilibili: {
    name: 'B站',
    icon: '📺',
    fields: [
      { 
        name: 'sessdata', 
        label: 'SESSDATA', 
        type: 'password', 
        required: true, 
        placeholder: '请输入SESSDATA',
        description: 'B站登录凭证之一'
      },
      { 
        name: 'bili_jct', 
        label: 'bili_jct (CSRF Token)', 
        type: 'password', 
        required: true, 
        placeholder: '请输入bili_jct',
        description: '用于API请求验证'
      }
    ],
    prerequisites: [
      { text: '已登录B站网页版', required: true },
      { text: '账号已通过实名认证', required: false, helpText: '发布内容需要实名认证' },
    ],
    instructions: '请登录B站网页版，获取SESSDATA和bili_jct',
    steps: [
      '1. 打开B站网页版 (www.bilibili.com) 并登录',
      '2. 按F12打开开发者工具',
      '3. 切换到「Application」(应用)标签',
      '4. 左侧展开「Cookies」→点击「https://www.bilibili.com」',
      '5. 找到「SESSDATA」并复制其值',
      '6. 找到「bili_jct」并复制其值',
    ],
    helpUrl: 'https://www.bilibili.com',
    notes: [
      '⚠️ SESSDATA是登录凭证，请勿泄露',
      '⚠️ bili_jct用于CSRF验证，发布内容时必须',
      '⚠️ Cookie过期后需要重新获取',
    ],
    apiWarning: 'B站暂无官方内容发布API，使用Cookie方式发布存在一定风险。'
  },
  weibo: {
    name: '微博',
    icon: '🐦',
    fields: [
      { 
        name: 'cookie', 
        label: 'Cookie', 
        type: 'textarea', 
        required: true, 
        placeholder: '请粘贴完整的Cookie字符串',
        description: '从浏览器开发者工具中复制'
      }
    ],
    prerequisites: [
      { text: '已登录微博网页版', required: true },
      { text: '账号状态正常', required: true },
    ],
    instructions: '请登录微博网页版，获取Cookie',
    steps: [
      '1. 打开微博网页版 (weibo.com) 并登录',
      '2. 按F12打开开发者工具',
      '3. 切换到「Network」(网络)标签',
      '4. 刷新页面，在请求列表中点击任意请求',
      '5. 在右侧找到「Request Headers」→「Cookie」',
      '6. 复制完整的Cookie值',
    ],
    helpUrl: 'https://weibo.com',
    notes: [
      '⚠️ Cookie包含登录信息，请勿泄露',
      '⚠️ 微博有发布频率限制，过于频繁可能被限流',
    ],
    apiWarning: '微博暂无官方开放API，使用Cookie发布存在一定风险。'
  },
  douyin: {
    name: '抖音',
    icon: '🎵',
    fields: [
      { 
        name: 'cookie', 
        label: 'Cookie', 
        type: 'textarea', 
        required: true, 
        placeholder: '请粘贴完整的Cookie字符串',
        description: '从抖音创作者平台获取'
      }
    ],
    prerequisites: [
      { text: '已登录抖音创作者平台', required: true },
      { text: '账号已实名认证', required: true, helpText: '发布视频需要实名认证' },
    ],
    instructions: '请登录抖音创作者平台，获取Cookie',
    steps: [
      '1. 打开抖音创作者平台 (creator.douyin.com) 并登录',
      '2. 按F12打开开发者工具',
      '3. 切换到「Network」(网络)标签',
      '4. 刷新页面，在请求列表中点击任意请求',
      '5. 在右侧找到「Request Headers」→「Cookie」',
      '6. 复制完整的Cookie值',
    ],
    helpUrl: 'https://creator.douyin.com',
    notes: [
      '⚠️ Cookie包含登录信息，请勿泄露',
      '⚠️ 抖音对视频内容审核较严，请确保内容合规',
    ],
    apiWarning: '抖音暂无官方开放API，使用Cookie发布存在一定风险。建议使用官方创作者平台发布。'
  },
  wechat_video: {
    name: '微信视频号',
    icon: '🎬',
    fields: [
      { 
        name: 'app_id', 
        label: 'AppID', 
        type: 'text', 
        required: true, 
        placeholder: '请输入视频号AppID',
        description: '在视频号创作者平台获取'
      },
      { 
        name: 'app_secret', 
        label: 'AppSecret', 
        type: 'password', 
        required: true, 
        placeholder: '请输入视频号AppSecret',
        description: '需要管理员权限才能查看'
      }
    ],
    prerequisites: [
      { text: '已认证的视频号', required: true },
      { text: '已开通视频号小店或直播权限', required: false },
    ],
    instructions: '请前往微信视频号创作者平台获取AppID和AppSecret',
    steps: [
      '1. 打开视频号创作者平台 (channels.weixin.qq.com)',
      '2. 登录并绑定视频号',
      '3. 在设置中找到开发者配置',
      '4. 获取AppID和AppSecret',
    ],
    helpUrl: 'https://channels.weixin.qq.com',
    notes: [
      '⚠️ 视频号API权限需要申请',
      '⚠️ 自动发布功能需要平台审核通过',
    ],
    apiWarning: '视频号API目前处于内测阶段，需要申请开通。建议使用官方创作者平台手动发布。'
  }
}

interface PlatformConfigDialogProps {
  open: boolean
  platform: PlatformType
  onClose: () => void
  onSuccess: () => void
}

export function PlatformConfigDialog({ 
  open, 
  platform, 
  onClose, 
  onSuccess 
}: PlatformConfigDialogProps) {
  const template = PLATFORM_TEMPLATES[platform]
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSteps, setShowSteps] = useState(true)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    message: string
  } | null>(null)

  // 更新表单值
  const updateField = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    // 清除错误和验证结果
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
    setValidationResult(null)
  }

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    template.fields.forEach(field => {
      if (field.required && !formData[field.name]?.trim()) {
        newErrors[field.name] = `${field.label}不能为空`
      }
    })

    // 特定平台的格式验证
    if (platform === 'wechat_mp') {
      if (formData.app_id && !formData.app_id.startsWith('wx')) {
        newErrors.app_id = 'AppID格式错误，应以wx开头'
      }
      if (formData.app_secret && formData.app_secret.length !== 32) {
        newErrors.app_secret = 'AppSecret格式错误，应为32位字符'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 验证配置（调用微信API测试）
  const validateConfig = async (): Promise<boolean> => {
    if (platform === 'wechat_mp') {
      // 调用后端接口验证微信配置
      try {
        const res = await Network.request({
          url: `/api/agent/platform-config/${platform}/validate`,
          method: 'POST',
          data: formData
        })

        if (res.data?.code === 200 && res.data?.data?.valid) {
          setValidationResult({ valid: true, message: '配置验证成功！' })
          return true
        } else {
          const errorMsg = res.data?.data?.error || '配置验证失败'
          setValidationResult({ valid: false, message: errorMsg })
          return false
        }
      } catch (err: any) {
        setValidationResult({ valid: false, message: '验证请求失败，请稍后重试' })
        return false
      }
    }
    return true
  }

  // 提交配置
  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      // 先验证配置
      const isValid = await validateConfig()
      if (!isValid) {
        setLoading(false)
        return
      }

      const res = await Network.request({
        url: `/api/agent/platform-config/${platform}`,
        method: 'POST',
        data: formData
      })

      console.log('保存平台配置:', res)

      if (res.data?.code === 200) {
        Taro.showToast({ title: '配置成功', icon: 'success' })
        onSuccess()
        onClose()
      } else {
        Taro.showToast({ title: res.data?.message || '配置失败', icon: 'error' })
      }
    } catch (err: any) {
      console.error('保存配置失败:', err)
      Taro.showToast({ title: '配置失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // 打开帮助链接
  const openHelpUrl = () => {
    if (template.helpUrl) {
      Taro.setClipboardData({
        data: template.helpUrl,
        success: () => {
          Taro.showToast({ title: '链接已复制', icon: 'success' })
        }
      })
    }
  }

  if (!template) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Text className="text-xl">{template.icon}</Text>
            <Text>配置 {template.name}</Text>
          </DialogTitle>
        </DialogHeader>

        {/* 前置条件 */}
        <View className="bg-orange-50 rounded-lg p-3 mb-4">
          <Text className="text-sm font-medium text-orange-800 mb-2">📋 配置前请确认：</Text>
          {template.prerequisites.map((item, index) => (
            <View key={index} className="flex items-start mb-1">
              <Text className={`text-sm ${item.required ? 'text-orange-700' : 'text-orange-600'}`}>
                {item.required ? '✓' : '○'} {item.text}
              </Text>
              {item.helpText && (
                <Text className="text-xs text-orange-500 ml-1">({item.helpText})</Text>
              )}
            </View>
          ))}
        </View>

        {/* 获取步骤 */}
        {showSteps && (
          <View className="bg-blue-50 rounded-lg p-3 mb-4">
            <View 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowSteps(!showSteps)}
            >
              <Text className="text-sm font-medium text-blue-800">📖 获取步骤</Text>
              <Text className="text-blue-600 text-xs">{showSteps ? '收起' : '展开'}</Text>
            </View>
            {template.steps.map((step, index) => (
              <Text key={index} className="block text-sm text-blue-700 mt-1">{step}</Text>
            ))}
            {template.helpUrl && (
              <View 
                className="mt-2 text-blue-600 text-sm underline"
                onClick={openHelpUrl}
              >
                <Text>🔗 点击复制链接前往 {template.name}</Text>
              </View>
            )}
          </View>
        )}

        {/* 注意事项 */}
        {template.notes && (
          <View className="bg-yellow-50 rounded-lg p-3 mb-4">
            {template.notes.map((note, index) => (
              <Text key={index} className="block text-sm text-yellow-800 mb-1">{note}</Text>
            ))}
          </View>
        )}

        {/* API警告 */}
        {template.apiWarning && (
          <View className="bg-gray-100 rounded-lg p-3 mb-4">
            <Text className="text-sm text-gray-600">💡 {template.apiWarning}</Text>
          </View>
        )}

        {/* 表单字段 */}
        <View className="space-y-4">
          {template.fields.map(field => (
            <View key={field.name}>
              <Label className="mb-2 block">
                <Text>{field.label}</Text>
                {field.required && <Text className="text-red-500 ml-1">*</Text>}
              </Label>
              
              {field.type === 'textarea' ? (
                <Textarea
                  className="w-full min-h-[80px]"
                  placeholder={field.placeholder}
                  value={formData[field.name] || ''}
                  onInput={(e) => updateField(field.name, e.detail.value)}
                />
              ) : (
                <Input
                  password={field.type === 'password'}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ''}
                  onInput={(e) => updateField(field.name, e.detail.value)}
                />
              )}
              
              {field.description && (
                <Text className="text-xs text-gray-500 mt-1">{field.description}</Text>
              )}
              
              {errors[field.name] && (
                <Text className="text-red-500 text-xs mt-1">{errors[field.name]}</Text>
              )}
            </View>
          ))}
        </View>

        {/* 验证结果 */}
        {validationResult && (
          <View className={`rounded-lg p-3 mt-4 ${validationResult.valid ? 'bg-green-50' : 'bg-red-50'}`}>
            <Text className={`text-sm ${validationResult.valid ? 'text-green-700' : 'text-red-700'}`}>
              {validationResult.valid ? '✅' : '❌'} {validationResult.message}
            </Text>
          </View>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} className="mr-2">
            <Text>取消</Text>
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Text>{loading ? '验证并保存...' : '验证并保存'}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 导出平台模板供其他组件使用
export { PLATFORM_TEMPLATES }
