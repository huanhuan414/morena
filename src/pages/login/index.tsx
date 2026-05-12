import React, { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import './index.css'

const Login: React.FC = () => {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)
  const { setUserInfo, setToken } = useUserStore(state => state)

  const sendCode = async () => {
    if (!phone || phone.length !== 11) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (countdown > 0) return

    setCodeLoading(true)
    try {
      const res = await Network.request({
        url: '/api/auth/send-code',
        method: 'POST',
        data: { phone }
      })
      console.log('[登录] 发送验证码响应:', res.data)

      if (res.data?.code === 200) {
        // 如果后端返回了验证码（开发模式），显示给用户
        const devCode = res.data?.data?.code
        if (devCode) {
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
      const res = await Network.request({
        url: '/api/auth/phone-login',
        method: 'POST',
        data: { phone, code }
      })
      console.log('[登录] 登录响应:', res.data)

      if (res.data?.code === 200 && res.data?.data) {
        const userData = res.data.data
        if (userData.token) {
          setToken(userData.token)
        }
        setUserInfo({
          id: userData.userId || userData.id,
          nickname: userData.nickname || phone,
          avatar: userData.avatar || '',
          phone: userData.phone || phone,
        })
        Taro.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/index/index' })
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
