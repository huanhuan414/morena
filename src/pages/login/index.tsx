import React, { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { Button as UIButton } from '@/components/ui/button'
import { WeappButton } from '@/components/ui/weapp-button'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { Gift, ChevronLeft } from 'lucide-react-taro'
import './index.css'

const Login: React.FC = () => {
  const [loginTab, setLoginTab] = useState<'account' | 'wechat'>('wechat')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [wechatReferralCode, setWechatReferralCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)
  const [wechatLoading, setWechatLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [showProfilePanel, setShowProfilePanel] = useState(false)
  const [profileNickname, setProfileNickname] = useState('')
  const [profileAvatarTemp, setProfileAvatarTemp] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [loginResult, setLoginResult] = useState<any>(null)
  const { setUserInfo, setToken } = useUserStore(state => state)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const inviteCode = instance?.router?.params?.inviteCode || instance?.router?.params?.referralCode || ''
    if (inviteCode) {
      setReferralCode(inviteCode.toUpperCase())
      setWechatReferralCode(inviteCode.toUpperCase())
    }
  }, [])

  const getRedirectUrl = () => {
    const instance = Taro.getCurrentInstance()
    const redirect = instance?.router?.params?.redirect || ''
    return redirect ? decodeURIComponent(redirect) : ''
  }

  const navigateAfterLogin = (data: any, phoneNum?: string) => {
    if (data.token) {
      setToken(data.token)
    }
    const user = data.user || {}
    setUserInfo({
      id: user.id || data.userId,
      openid: user.openid,
      nickname: user.nickname || `用户${(phoneNum || '').slice(-4)}`,
      avatar: user.avatar || '',
      avatarId: user.avatar_id || user.avatarId,
      phone: user.phone || phoneNum || '',
      bio: user.bio,
      level: user.level,
      exp: user.exp,
      credits: user.credits,
      created_at: user.created_at,
      updated_at: user.updated_at,
    } as any)

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
          Taro.redirectTo({ url: redirect })
        }
      } else {
        Taro.switchTab({ url: '/pages/index/index' })
      }
    }, 1000)
  }

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

      if (res.data?.code === 200) {
        const devCode = res.data?.data?.Code
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
      Taro.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
    } finally {
      setCodeLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!agreed) {
      Taro.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }
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
      if (referralCode.trim()) {
        loginData.referral_code = referralCode.trim()
      }

      const res = await Network.request({
        url: '/api/auth/phone-login',
        method: 'POST',
        data: loginData
      })

      if (res.data?.code === 200 && res.data?.data) {
        navigateAfterLogin(res.data.data, phone)
      } else {
        Taro.showToast({ title: res.data?.message || '登录失败，请重试', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleChooseProfileAvatar = async (e: any) => {
    const tempUrl = e.detail.avatarUrl
    if (!tempUrl) return

    setProfileAvatarTemp(tempUrl)
    setAvatarUploading(true)
    try {
      const uploadRes = await Network.uploadFile({
        url: '/api/upload/image',
        filePath: tempUrl,
        name: 'file',
      })
      let resData = uploadRes.data
      if (typeof resData === 'string') {
        try { resData = JSON.parse(resData) } catch (_) { /* ignore */ }
      }
      const imageUrl = (resData as any)?.data?.url || (resData as any)?.url || ''
      if (imageUrl) {
        setProfileAvatarUrl(imageUrl)
      }
    } catch (err) {
      console.error('[头像上传失败]', err)
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!loginResult) return

    setProfileSaving(true)
    try {
      const userId = loginResult.user?.id || loginResult.userId
      const token = loginResult.token
      const updateData: Record<string, string> = {}
      if (profileNickname.trim()) updateData.nickname = profileNickname.trim()
      if (profileAvatarUrl) updateData.avatar = profileAvatarUrl

      if (Object.keys(updateData).length > 0) {
        await Network.request({
          url: '/api/user/profile',
          method: 'PUT',
          data: updateData,
          header: {
            'x-user-id': userId,
            'Authorization': `Bearer ${token}`,
          },
        })
        if (profileNickname.trim()) {
          loginResult.user.nickname = profileNickname.trim()
        }
        if (profileAvatarUrl) {
          loginResult.user.avatar = profileAvatarUrl
        }
      }

      setShowProfilePanel(false)
      navigateAfterLogin(loginResult)
    } catch (err) {
      console.error('[保存资料失败]', err)
      setShowProfilePanel(false)
      navigateAfterLogin(loginResult)
    } finally {
      setProfileSaving(false)
    }
  }

  const handleSkipProfile = () => {
    setShowProfilePanel(false)
    navigateAfterLogin(loginResult)
  }

  const handleGetPhoneNumber = async (e: any) => {
    if (e.detail.errMsg !== 'getPhoneNumber:ok' || !e.detail.code) {
      Taro.showToast({ title: '获取手机号授权失败', icon: 'none' })
      return
    }

    setWechatLoading(true)
    try {
      const loginRes = await Taro.login()
      if (!loginRes.code) {
        Taro.showToast({ title: '获取授权失败', icon: 'none' })
        return
      }

      const requestData: Record<string, string> = {
        code: loginRes.code,
        phoneCode: e.detail.code,
      }
      if (wechatReferralCode.trim()) {
        requestData.referral_code = wechatReferralCode.trim()
      }

      const res = await Network.request({
        url: '/api/auth/wechat-phone-login',
        method: 'POST',
        data: requestData,
      })

      if (res.data?.code === 200 && res.data?.data) {
        const data = res.data.data
        if (data.isNewUser) {
          setLoginResult(data)
          setShowProfilePanel(true)
        } else {
          navigateAfterLogin(data)
        }
      } else {
        Taro.showToast({ title: res.data?.message || '登录失败', icon: 'none' })
      }
    } catch (error) {
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      setWechatLoading(false)
    }
  }

  const renderAgreement = () => (
    <View className="login-agreement">
      <View className={`login-checkbox ${agreed ? 'checked' : ''}`} onClick={() => setAgreed(!agreed)}>
        {agreed && <Text className="login-checkbox-tick">✓</Text>}
      </View>
      <Text className="login-agreement-text">我已阅读并同意</Text>
      <Text className="login-agreement-link" onClick={() => Taro.navigateTo({ url: '/pages/user-agreement/index' })}>《用户协议》</Text>
      <Text className="login-agreement-text">和</Text>
      <Text className="login-agreement-link" onClick={() => Taro.navigateTo({ url: '/pages/privacy-policy/index' })}>《隐私政策》</Text>
    </View>
  )

  const handleBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
      return
    }

    const redirect = getRedirectUrl()
    if (redirect) {
      const tabbarPages = ['/pages/index/index', '/pages/mind-chat/index', '/package-avatar/pages/generated-content/index', '/pages/profile/index']
      if (tabbarPages.some(p => redirect.startsWith(p))) {
        Taro.switchTab({ url: redirect.split('?')[0] })
      } else {
        Taro.redirectTo({ url: redirect })
      }
    } else {
      Taro.switchTab({ url: '/pages/index/index' })
    }
  }

  return (
    <View className="login-page">
      <View className="login-header">
        <View className="login-header-decor login-header-decor-1" />
        <View className="login-header-decor login-header-decor-2" />
        <View className="login-header-top">
          <View className="login-back-btn" onClick={handleBack}>
            <ChevronLeft size={24} color="#ffffff" />
          </View>
          <Text className="login-app-name block">莫瑞娜</Text>
          <View className="login-back-btn-placeholder" />
        </View>
        <Text className="login-app-slogan block">AI 分身 · 创作无限可能</Text>
      </View>

      <View className="login-card">
        <View className="login-tabs">
          <View
            className={`login-tab ${loginTab === 'wechat' ? 'active' : ''}`}
            onClick={() => setLoginTab('wechat')}
          >
            <Text className={`login-tab-text ${loginTab === 'wechat' ? 'active' : ''}`}>授权登录</Text>
          </View>
          <View
            className={`login-tab ${loginTab === 'account' ? 'active' : ''}`}
            onClick={() => setLoginTab('account')}
          >
            <Text className={`login-tab-text ${loginTab === 'account' ? 'active' : ''}`}>账号登录</Text>
          </View>
        </View>

        {loginTab === 'account' && (
          <View className="login-tab-content">
            <Text className="login-card-title block">手机号登录</Text>
            <Text className="login-card-desc block">验证即登录，未注册将自动创建账号</Text>

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
                  <UIButton
                    variant="outline"
                    size="sm"
                    disabled={countdown > 0 || codeLoading}
                    onClick={sendCode}
                    className="login-code-btn"
                  >
                    <Text className="login-code-btn-text">
                      {codeLoading ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </Text>
                  </UIButton>
                </View>
              </View>
            </View>

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

            <UIButton
              variant="default"
              size="lg"
              disabled={loading}
              onClick={handleLogin}
              // className={`login-submit-btn ${!agreed ? 'btn-disabled' : ''}`}
              className="login-submit-btn"
            >
              <Text className="login-submit-btn-text">{loading ? '登录中...' : '登录'}</Text>
            </UIButton>

            {renderAgreement()}
          </View>
        )}

        {loginTab === 'wechat' && (
          <View className="login-tab-content">
            <Text className="login-card-title block">授权登录</Text>
            <Text className="login-card-desc block">使用绑定手机号快速登录，未注册将自动创建账号</Text>

            <View className="login-field">
              <View className="login-referral-label-row">
                <Gift size={14} color="#8B5CF6" />
                <Text className="login-field-label block">邀请码（选填）</Text>
              </View>
              <View className="login-input-wrap">
                <Input
                  placeholder="输入邀请码可获得额外积分奖励"
                  value={wechatReferralCode}
                  onInput={(e: any) => setWechatReferralCode(e.detail.value.toUpperCase())}
                  className="login-input"
                />
              </View>
            </View>

            <View className="login-btn-group">
              <View className="login-btn-wrapper">
                <WeappButton
                  className="login-primary-btn"
                  open-type="getPhoneNumber"
                  onGetPhoneNumber={handleGetPhoneNumber}
                >
                  <Text className="login-btn-text">{wechatLoading ? '授权中...' : '授权登录'}</Text>
                </WeappButton>
                {!agreed && (
                  <View
                    className="login-btn-overlay"
                    onClick={() => {
                      Taro.showToast({ title: '请先同意用户协议', icon: 'none' })
                    }}
                  />
                )}
              </View>
            </View>

            {renderAgreement()}
          </View>
        )}
      </View>

      {showProfilePanel && (
        <View className="profile-panel-mask" onClick={handleSkipProfile}>
          <View className="profile-panel" onClick={(e) => e.stopPropagation()}>
            <View className="profile-panel-header">
              <Text className="profile-panel-title">完善个人资料</Text>
              <View className="profile-panel-close" onClick={handleSkipProfile}>
                <Text className="profile-panel-close-icon">✕</Text>
              </View>
            </View>
            <View className="profile-panel-body">
              <Text className="profile-panel-desc">设置你的头像和昵称，让大家认识你</Text>

              <View className="profile-avatar-row">
                <WeappButton
                  className="profile-avatar-btn"
                  open-type="chooseAvatar"
                  onChooseAvatar={handleChooseProfileAvatar}
                >
                  <Image
                    className="profile-avatar-img"
                    src={profileAvatarTemp || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI9FhqR6no4pKIrgIbEDk0buZVIu06SsNIoHviaBcE3NPaYQTPHfOqdpJxQO3cTPx5VibeVg/0'}
                    mode="aspectFill"
                  />
                  {avatarUploading && <View className="profile-avatar-loading" />}
                </WeappButton>
                <Text className="profile-avatar-hint">点击选择头像</Text>
              </View>

              <View className="profile-nickname-wrap">
                <Input
                  type="nickname"
                  placeholder="请输入昵称"
                  value={profileNickname}
                  onInput={(e: any) => setProfileNickname(e.detail.value)}
                  className="profile-nickname-input"
                />
              </View>

              <View className="profile-panel-actions">
                <WeappButton
                  className="profile-save-btn"
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                >
                  {profileSaving ? '保存中...' : '保存'}
                </WeappButton>
                <View className="profile-skip-btn" onClick={handleSkipProfile}>
                  <Text className="profile-skip-text">跳过</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default Login
