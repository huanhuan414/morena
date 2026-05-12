import React, { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { Gift } from 'lucide-react-taro'
import './index.css'

const Login: React.FC = () => {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)
  const { setUserInfo, setToken } = useUserStore(state => state)

  // 获取重定向地址
  const getRedirectUrl = () => {
    const instance = Taro.getCurrentInstance()
    const redirect = instance?.router?.params?.redirect || ''
    return redirect ? decodeURIComponent(redirect) : ''
  }

  const sendCode = async () => {
    if (!phone || phone.length !== 11) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (countdown > 0) return

    setCodeLoading(true)
    try {
      console.log('[登录] 发送验证码请求:', { url: '/api/auth/send-code', method: 'POST', data: { phone } })
      const res = await Network.request({
        url: '/api/auth/send-code',
        method: 'POST',
        data: { phone }
      })
      console.log('[登录] 发送验证码响应:', res.data)

      if (res.data?.code === 200) {
        // 如果后端返回了验证码（开发模式），显示给用户
        const devCode = res.data?.data?.code
        const isDev = res.data?.data?.isDev
        if (devCode && isDev) {
          Taro.showToast({ title: `验证码: ${devCode}`, icon: 'none', duration: 5000 })
        } else {
          Taro.showToast({ title: '验证码已发送', icon: 'success' })
        }
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        Taro.showToast({ title: res.data?.message || '发送失败，请稍后重试', icon: 'none' })
      }
    } catch (error) {
      console.error('[登录] 发送验证码失败:', error)
      Taro.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
    } finally {
      setCodeLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!phone || phone.length !== 11) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!code || code.length < 4) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const loginData: Record<string, string> = { phone, code }
      // 如果有邀请码，传给后端
      if (referralCode.trim()) {
        loginData.referral_code = referralCode.trim()
      }

      console.log('[登录] 登录请求:', { url: '/api/auth/phone-login', method: 'POST', data: loginData })
      const res = await Network.request({
        url: '/api/auth/phone-login',
        method: 'POST',
        data: loginData
      })
      console.log('[登录] 登录响应:', res.data)

      if (res.data?.code === 200 && res.data?.data) {
        const data = res.data.data
        // 保存 token
        if (data.token) {
          setToken(data.token)
        }
        // 保存完整的用户信息
        const user = data.user || {}
        setUserInfo({
          id: user.id || data.userId,
          openid: user.openid,
          nickname: user.nickname || `用户${phone.slice(-4)}`,
          avatar: user.avatar || '',
          avatarId: user.avatar_id || user.avatarId,
          phone: user.phone || phone,
          bio: user.bio,
          level: user.level,
          exp: user.exp,
          credits: user.credits,
          created_at: user.created_at,
          updated_at: user.updated_at,
        } as any)

        // 如果有邀请奖励，提示用户
        if (data.referralReward && data.referralReward > 0) {
          Taro.showToast({ title: `注册成功，获得邀请奖励 ${data.referralReward} 积分`, icon: 'none', duration: 3000 })
        } else {
          Taro.showToast({ title: data.isNewUser ? '注册成功' : '登录成功', icon: 'success' })
        }

        setTimeout(() => {
          const redirect = getRedirectUrl()
          if (redirect) {
            const tabbarPages = ['/pages/index/index', '/pages/mind-chat/index', '/package-avatar/pages/generated-content/index', '/pages/profile/index']
            if (tabbarPages.some(p => redirect.startsWith(p))) {
              Taro.switchTab({ url: redirect.split('?')[0] })
            } else {
              Taro.navigateTo({ url: redirect })
            }
          } else {
            Taro.switchTab({ url: '/pages/index/index' })
          }
        }, 1000)
      } else {
        Taro.showToast({ title: res.data?.message || '登录失败，请重试', icon: 'none' })
      }
    } catch (error) {
      console.error('[登录] 登录失败:', error)
      Taro.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="login-page">
      {/* 顶部渐变区域 */}
      <View className="login-header">
        <View className="login-header-decor login-header-decor-1" />
        <View className="login-header-decor login-header-decor-2" />
        <Text className="login-app-name block">莫瑞娜</Text>
        <Text className="login-app-slogan block">AI 分身 · 创作无限可能</Text>
      </View>

      {/* 表单区域 */}
      <View className="login-card">
        <Text className="login-card-title block">手机号登录</Text>
        <Text className="login-card-desc block">验证即登录，未注册将自动创建账号</Text>

        {/* 手机号输入 */}
        <View className="login-field">
          <Text className="login-field-label block">手机号</Text>
          <View className="login-input-wrap">
            <Input
              type="number"
              maxlength={11}
              placeholder="请输入手机号"
              value={phone}
              onInput={(e: any) => setPhone(e.detail.value)}
              className="login-input"
            />
          </View>
        </View>

        {/* 验证码输入 */}
        <View className="login-field">
          <Text className="login-field-label block">验证码</Text>
          <View className="login-code-row">
            <View className="login-input-wrap login-code-input">
              <Input
                type="number"
                maxlength={6}
                placeholder="请输入验证码"
                value={code}
                onInput={(e: any) => setCode(e.detail.value)}
                className="login-input"
              />
            </View>
            <View className="login-code-btn-wrap">
              <Button
                variant="outline"
                size="sm"
                disabled={countdown > 0 || codeLoading}
                onClick={sendCode}
                className="login-code-btn"
              >
                <Text className="login-code-btn-text">
                  {codeLoading ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                </Text>
              </Button>
            </View>
          </View>
        </View>

        {/* 邀请码输入 */}
        <View className="login-field">
          <View className="login-referral-label-row">
            <Gift size={14} color="#8B5CF6" />
            <Text className="login-field-label block">邀请码（选填）</Text>
          </View>
          <View className="login-input-wrap">
            <Input
              placeholder="输入邀请码可获得额外积分奖励"
              value={referralCode}
              onInput={(e: any) => setReferralCode(e.detail.value.toUpperCase())}
              className="login-input"
            />
          </View>
        </View>

        {/* 登录按钮 */}
        <Button
          variant="default"
          size="lg"
          disabled={loading}
          onClick={handleLogin}
          className="login-submit-btn"
        >
          <Text className="login-submit-btn-text">{loading ? '登录中...' : '登录'}</Text>
        </Button>

        {/* 协议 */}
        <View className="login-agreement">
          <Text className="login-agreement-text">
            登录即表示同意
          </Text>
          <Text className="login-agreement-link">《用户协议》</Text>
          <Text className="login-agreement-text">和</Text>
          <Text className="login-agreement-link">《隐私政策》</Text>
        </View>
      </View>
    </View>
  )
}

export default Login
