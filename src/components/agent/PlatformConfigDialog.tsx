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
import { Network } from '@/network'

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

// 平台配置模板
const PLATFORM_TEMPLATES: Record<PlatformType, {
  name: string
  icon: string
  fields: ConfigField[]
  instructions: string
  helpUrl?: string
}> = {
  wechat_mp: {
    name: '微信公众号',
    icon: '📱',
    fields: [
      { name: 'app_id', label: 'AppID', type: 'text', required: true, placeholder: '请输入公众号AppID' },
      { name: 'app_secret', label: 'AppSecret', type: 'password', required: true, placeholder: '请输入公众号AppSecret' }
    ],
    instructions: '请前往微信公众平台 → 开发 → 基本配置获取AppID和AppSecret',
    helpUrl: 'https://mp.weixin.qq.com'
  },
  xiaohongshu: {
    name: '小红书',
    icon: '📕',
    fields: [
      { name: 'cookie', label: 'Cookie', type: 'textarea', required: true, placeholder: '请输入小红书网页版Cookie' }
    ],
    instructions: '请登录小红书网页版，按F12打开开发者工具，在Network中找到请求头中的Cookie',
    helpUrl: 'https://www.xiaohongshu.com'
  },
  bilibili: {
    name: 'B站',
    icon: '📺',
    fields: [
      { name: 'sessdata', label: 'SESSDATA', type: 'password', required: true, placeholder: '请输入SESSDATA' },
      { name: 'bili_jct', label: 'bili_jct', type: 'password', required: true, placeholder: '请输入bili_jct' }
    ],
    instructions: '请登录B站网页版，按F12打开开发者工具，在Application → Cookies中找到SESSDATA和bili_jct',
    helpUrl: 'https://www.bilibili.com'
  },
  weibo: {
    name: '微博',
    icon: '🐦',
    fields: [
      { name: 'cookie', label: 'Cookie', type: 'textarea', required: true, placeholder: '请输入微博网页版Cookie' }
    ],
    instructions: '请登录微博网页版，按F12打开开发者工具，在Network中找到请求头中的Cookie',
    helpUrl: 'https://weibo.com'
  },
  douyin: {
    name: '抖音',
    icon: '🎵',
    fields: [
      { name: 'cookie', label: 'Cookie', type: 'textarea', required: true, placeholder: '请输入抖音创作者平台Cookie' }
    ],
    instructions: '请登录抖音创作者平台，按F12打开开发者工具，在Network中找到请求头中的Cookie',
    helpUrl: 'https://creator.douyin.com'
  },
  wechat_video: {
    name: '微信视频号',
    icon: '🎬',
    fields: [
      { name: 'app_id', label: 'AppID', type: 'text', required: true, placeholder: '请输入视频号AppID' },
      { name: 'app_secret', label: 'AppSecret', type: 'password', required: true, placeholder: '请输入视频号AppSecret' }
    ],
    instructions: '请前往微信视频号创作者平台获取AppID和AppSecret',
    helpUrl: 'https://channels.weixin.qq.com'
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

  // 更新表单值
  const updateField = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    // 清除错误
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    template.fields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label}不能为空`
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 提交配置
  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Text className="text-xl">{template.icon}</Text>
            <Text>配置 {template.name}</Text>
          </DialogTitle>
        </DialogHeader>

        {/* 说明 */}
        <View className="bg-blue-50 rounded-lg p-3 mb-4">
          <Text className="text-sm text-blue-700">{template.instructions}</Text>
          {template.helpUrl && (
            <View 
              className="mt-2 text-blue-600 text-sm underline"
              onClick={openHelpUrl}
            >
              <Text>点击复制链接前往配置页面</Text>
            </View>
          )}
        </View>

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
                  placeholder={field.placeholder}
                  value={formData[field.name] || ''}
                  onInput={(e) => updateField(field.name, e.detail.value)}
                />
              )}
              
              {errors[field.name] && (
                <Text className="text-red-500 text-xs mt-1">{errors[field.name]}</Text>
              )}
            </View>
          ))}
        </View>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} className="mr-2">
            <Text>取消</Text>
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Text>{loading ? '保存中...' : '保存配置'}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 导出平台模板供其他组件使用
export { PLATFORM_TEMPLATES }
