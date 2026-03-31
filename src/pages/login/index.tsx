import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { switchTab, showToast } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { Sparkles, Phone, Shield } from 'lucide-react-taro'
import './index.css'

export default function LoginPage() {
  const { setUserInfo } = useUserStore()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const sendCode = async () => {
    if (!phone || phone.length !== 11) {
      showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    if (countdown > 0) return

    setSendingCode(true)
    try {
      const res = await Network.request({
        url: '/api/auth/send-code',
        method: 'POST',
        data: { phone }
      })
      
      if (res.data?.code === 200) {
        showToast({ title: '验证码已发送', icon: 'success' })
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
        showToast({ title: res.data?.message || '发送失败', icon: 'none' })
      }
    } catch (error) {
      console.error('发送验证码失败:', error)
      // 开发环境模拟
      showToast({ title: '验证码已发送（开发模式）', icon: 'success' })
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
    } finally {
      setSendingCode(false)
    }
  }

  const handleLogin = async () => {
    if (!phone || phone.length !== 11) {
      showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!code || code.length !== 6) {
      showToast({ title: '请输入6位验证码', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/auth/phone-login',
        method: 'POST',
        data: { phone, code }
      })
      
      if (res.data?.code === 200) {
        const { user, isNewUser } = res.data.data
        setUserInfo(user)
        showToast({ 
          title: isNewUser ? '注册成功' : '登录成功', 
          icon: 'success' 
        })
        setTimeout(() => {
          switchTab({ url: '/pages/social/index' })
        }, 500)
      } else {
        showToast({ title: res.data?.message || '登录失败', icon: 'none' })
      }
    } catch (error) {
      console.error('登录失败:', error)
      showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const skipLogin = () => {
    setUserInfo({
      id: 'guest-user-id',
      nickname: '游客',
      avatar: '',
      level: 1,
      exp: 0,
      credits: 0
    })
    switchTab({ url: '/pages/social/index' })
  }

  return (
    <View className="login-page">
      {/* 背景装饰 */}
      <View className="bg-grid" />
      <View className="bg-glow" />
      
      {/* Logo区域 */}
      <View className="logo-section">
        <View className="logo-icon">
          <Sparkles size={48} color="#00f5ff" />
        </View>
        <Text className="logo-title">莫瑞娜</Text>
        <Text className="logo-subtitle">AI原生人机共生协同平台</Text>
      </View>

      {/* 登录卡片 */}
      <View className="login-card">
        <View className="card-header">
          <Text className="card-title">手机号登录</Text>
          <Text className="card-desc">未注册手机号将自动创建账号</Text>
        </View>

        <View className="form-section">
          {/* 手机号输入 */}
          <View className="input-wrapper">
            <View className="input-icon">
              <Phone size={20} color="rgba(0, 245, 255, 0.6)" />
            </View>
            <Input
              className="input-field"
              type="number"
              maxlength={11}
              placeholder="请输入手机号"
              value={phone}
              onInput={e => setPhone(e.detail.value)}
            />
          </View>

          {/* 验证码输入 */}
          <View className="input-wrapper code-wrapper">
            <View className="input-icon">
              <Shield size={20} color="rgba(0, 245, 255, 0.6)" />
            </View>
            <Input
              className="input-field code-input"
              type="number"
              maxlength={6}
              placeholder="请输入验证码"
              value={code}
              onInput={e => setCode(e.detail.value)}
            />
            <View 
              className={`code-btn ${countdown > 0 || sendingCode ? 'disabled' : ''}`}
              onClick={countdown > 0 || sendingCode ? undefined : sendCode}
            >
              <Text className="code-btn-text">
                {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Text>
            </View>
          </View>

          {/* 登录按钮 */}
          <Button 
            className="login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            <Text className="login-btn-text">
              {loading ? '登录中...' : '登录 / 注册'}
            </Text>
          </Button>
        </View>

        <View className="card-footer">
          <Text className="footer-text" onClick={skipLogin}>
            暂不登录，先逛逛
          </Text>
        </View>
      </View>

      {/* 底部协议 */}
      <View className="agreement-section">
        <Text className="agreement-text">
          登录即代表同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </View>
  )
}
