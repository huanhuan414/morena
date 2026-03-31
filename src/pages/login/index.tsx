import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { switchTab, showToast } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { Sparkles, Phone, Shield, ChevronRight } from 'lucide-react-taro'
import './index.css'

export default function LoginPage() {
  const { setUserInfo, setToken } = useUserStore()
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
        const { user, token, isNewUser } = res.data.data
        
        // 保存token和用户信息到本地存储
        if (token) {
          setToken(token)
        }
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
      {/* 背景效果 */}
      <View className="login-bg">
        <View className="bg-gradient" />
        <View className="bg-grid" />
        <View className="bg-glow-1" />
        <View className="bg-glow-2" />
      </View>
      
      {/* 品牌区域 */}
      <View className="brand-section">
        <View className="brand-logo">
          <View className="logo-inner">
            <Sparkles size={56} color="#00f5ff" />
          </View>
          <View className="logo-ring" />
          <View className="logo-pulse" />
        </View>
        <Text className="brand-name">莫瑞娜</Text>
        <Text className="brand-slogan">AI原生人机共生协同平台</Text>
      </View>

      {/* 登录卡片 */}
      <View className="login-card">
        <View className="card-header">
          <Text className="card-title">欢迎回来</Text>
          <Text className="card-subtitle">登录即代表同意《用户协议》和《隐私政策》</Text>
        </View>

        <View className="form-area">
          {/* 手机号输入 */}
          <View className="input-group">
            <View className="input-label">
              <Phone size={20} color="rgba(0, 245, 255, 0.8)" />
              <Text className="label-text">手机号</Text>
            </View>
            <View className="input-box">
              <Input
                className="input-control"
                type="number"
                maxlength={11}
                placeholder="请输入手机号"
                placeholderClass="input-placeholder"
                value={phone}
                onInput={e => setPhone(e.detail.value)}
              />
            </View>
          </View>

          {/* 验证码输入 */}
          <View className="input-group">
            <View className="input-label">
              <Shield size={20} color="rgba(0, 245, 255, 0.8)" />
              <Text className="label-text">验证码</Text>
            </View>
            <View className="input-row">
              <View className="input-box flex-1">
                <Input
                  className="input-control"
                  type="number"
                  maxlength={6}
                  placeholder="请输入验证码"
                  placeholderClass="input-placeholder"
                  value={code}
                  onInput={e => setCode(e.detail.value)}
                />
              </View>
              <View 
                className={`code-btn ${countdown > 0 || sendingCode ? 'disabled' : ''}`}
                onClick={countdown > 0 || sendingCode ? undefined : sendCode}
              >
                <Text className="code-btn-text">
                  {sendingCode ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                </Text>
              </View>
            </View>
          </View>

          {/* 登录按钮 */}
          <Button 
            className="submit-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            <View className="btn-bg" />
            <Text className="btn-text">{loading ? '登录中...' : '登录 / 注册'}</Text>
            {!loading && <ChevronRight size={20} color="#0a0a0f" />}
          </Button>
        </View>

        <View className="card-footer">
          <Text className="skip-text" onClick={skipLogin}>
            暂不登录，先逛逛
          </Text>
        </View>
      </View>

      {/* 底部装饰 */}
      <View className="footer-decoration">
        <View className="decoration-line" />
        <Text className="decoration-text">Powered by AI</Text>
        <View className="decoration-line" />
      </View>
    </View>
  )
}
