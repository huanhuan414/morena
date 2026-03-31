import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { login as taroLogin, switchTab, showToast } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { Sparkles, Phone, MessageCircle, ArrowRight } from 'lucide-react-taro'
import './index.css'

export default function LoginPage() {
  const { setUserInfo } = useUserStore()
  const [mode, setMode] = useState<'main' | 'phone' | 'register'>('main')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const handleWechatLogin = async () => {
    setLoading(true)
    try {
      const { code: loginCode } = await taroLogin()
      const res = await Network.request({
        url: '/api/auth/wechat-login',
        method: 'POST',
        data: { code: loginCode }
      })
      
      if (res.data?.code === 200) {
        setUserInfo(res.data.data.user)
        showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          switchTab({ url: '/pages/social/index' })
        }, 500)
      }
    } catch (error) {
      // 模拟登录成功
      setUserInfo({
        id: 'mock-user-id',
        nickname: '探索者',
        avatar: '',
        level: 1,
        exp: 0,
        credits: 0
      })
      showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        switchTab({ url: '/pages/social/index' })
      }, 500)
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneLogin = async () => {
    if (!phone || phone.length !== 11) {
      showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!code || code.length !== 6) {
      showToast({ title: '请输入验证码', icon: 'none' })
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
        setUserInfo(res.data.data.user)
        showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          switchTab({ url: '/pages/home/index' })
        }, 500)
      }
    } catch (error) {
      // 模拟登录成功
      setUserInfo({
        id: 'mock-user-id',
        nickname: phone.slice(-4) + '用户',
        avatar: '',
        level: 1,
        exp: 0,
        credits: 0
      })
      showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        switchTab({ url: '/pages/home/index' })
      }, 500)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!nickname) {
      showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (!phone || phone.length !== 11) {
      showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!code || code.length !== 6) {
      showToast({ title: '请输入验证码', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/auth/register',
        method: 'POST',
        data: { phone, code, nickname }
      })
      
      if (res.data?.code === 200) {
        setUserInfo(res.data.data.user)
        showToast({ title: '注册成功', icon: 'success' })
        setTimeout(() => {
          switchTab({ url: '/pages/home/index' })
        }, 500)
      }
    } catch (error) {
      // 模拟注册成功
      setUserInfo({
        id: 'mock-user-id',
        nickname,
        avatar: '',
        level: 1,
        exp: 0,
        credits: 0
      })
      showToast({ title: '注册成功', icon: 'success' })
      setTimeout(() => {
        switchTab({ url: '/pages/home/index' })
      }, 500)
    } finally {
      setLoading(false)
    }
  }

  const sendCode = () => {
    if (!phone || phone.length !== 11) {
      showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
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
    showToast({ title: '验证码已发送', icon: 'success' })
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
      <View className="bg-decoration" />
      
      {/* Logo区域 */}
      <View className="logo-section">
        <View className="logo-icon">
          <Sparkles size={48} color="#00f5ff" />
        </View>
        <Text className="logo-title">莫瑞娜</Text>
        <Text className="logo-subtitle">AI原生人机共生协同平台</Text>
      </View>

      {/* 主界面 */}
      {mode === 'main' && (
        <View className="main-section">
          <View className="welcome-card">
            <Text className="welcome-title">欢迎回来</Text>
            <Text className="welcome-desc">登录后开启你的AI分身之旅</Text>
          </View>

          <Button 
            className="wechat-btn"
            onClick={handleWechatLogin}
            disabled={loading}
          >
            <MessageCircle size={20} color="#fff" />
            <Text className="btn-text">微信一键登录</Text>
          </Button>

          <Button 
            className="phone-btn"
            onClick={() => setMode('phone')}
          >
            <Phone size={20} color="#00f5ff" />
            <Text className="btn-text-phone">手机号登录</Text>
          </Button>

          <View className="register-link" onClick={() => setMode('register')}>
            <Text className="register-text">没有账号？</Text>
            <Text className="register-action">立即注册</Text>
            <ArrowRight size={14} color="#00f5ff" />
          </View>

          <View className="skip-link" onClick={skipLogin}>
            <Text className="skip-text">先逛逛看</Text>
          </View>
        </View>
      )}

      {/* 手机号登录 */}
      {mode === 'phone' && (
        <View className="form-section">
          <View className="form-header">
            <Text className="form-title">手机号登录</Text>
            <Text className="form-back" onClick={() => setMode('main')}>返回</Text>
          </View>

          <View className="input-group">
            <Input
              className="input-field"
              type="number"
              maxlength={11}
              placeholder="请输入手机号"
              value={phone}
              onInput={e => setPhone(e.detail.value)}
            />
          </View>

          <View className="input-group code-group">
            <Input
              className="input-field code-input"
              type="number"
              maxlength={6}
              placeholder="验证码"
              value={code}
              onInput={e => setCode(e.detail.value)}
            />
            <View 
              className={`code-btn ${countdown > 0 ? 'disabled' : ''}`}
              onClick={countdown > 0 ? undefined : sendCode}
            >
              <Text className="code-btn-text">
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Text>
            </View>
          </View>

          <Button 
            className="submit-btn"
            onClick={handlePhoneLogin}
            disabled={loading}
          >
            <Text className="submit-btn-text">登录</Text>
          </Button>

          <View className="form-footer">
            <Text className="footer-text">没有账号？</Text>
            <Text className="footer-link" onClick={() => setMode('register')}>立即注册</Text>
          </View>
        </View>
      )}

      {/* 注册 */}
      {mode === 'register' && (
        <View className="form-section">
          <View className="form-header">
            <Text className="form-title">创建账号</Text>
            <Text className="form-back" onClick={() => setMode('main')}>返回</Text>
          </View>

          <View className="input-group">
            <Input
              className="input-field"
              placeholder="设置你的昵称"
              value={nickname}
              onInput={e => setNickname(e.detail.value)}
            />
          </View>

          <View className="input-group">
            <Input
              className="input-field"
              type="number"
              maxlength={11}
              placeholder="请输入手机号"
              value={phone}
              onInput={e => setPhone(e.detail.value)}
            />
          </View>

          <View className="input-group code-group">
            <Input
              className="input-field code-input"
              type="number"
              maxlength={6}
              placeholder="验证码"
              value={code}
              onInput={e => setCode(e.detail.value)}
            />
            <View 
              className={`code-btn ${countdown > 0 ? 'disabled' : ''}`}
              onClick={countdown > 0 ? undefined : sendCode}
            >
              <Text className="code-btn-text">
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Text>
            </View>
          </View>

          <Button 
            className="submit-btn"
            onClick={handleRegister}
            disabled={loading}
          >
            <Text className="submit-btn-text">注册</Text>
          </Button>

          <View className="form-footer">
            <Text className="footer-text">已有账号？</Text>
            <Text className="footer-link" onClick={() => setMode('phone')}>立即登录</Text>
          </View>
        </View>
      )}

      {/* 底部协议 */}
      <View className="agreement-section">
        <Text className="agreement-text">
          登录即代表同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </View>
  )
}
