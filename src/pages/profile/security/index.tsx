import Taro, { useLoad, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import { useUserStore } from '@/stores/user'
import { Shield, Lock, Smartphone, Mail, ChevronRight, Check } from 'lucide-react-taro'
import './security.css'

interface SecurityStatus {
  hasPassword: boolean
  hasPhone: boolean
  hasEmail: boolean
  lastLoginTime: string
  loginDevice: string
}

export default function SecurityPage() {
  const { userInfo } = useUserStore()
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    hasPassword: true,
    hasPhone: false,
    hasEmail: false,
    lastLoginTime: '刚刚',
    loginDevice: '微信小程序'
  })
  
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  
  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useLoad(() => {
    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }
    
    fetchSecurityStatus()
  })

  const fetchSecurityStatus = async () => {
    try {
      const res = await Network.request({ url: '/api/user/security-status' })
      if (res.data?.code === 200) {
        setSecurityStatus(res.data.data)
      }
    } catch (error) {
      console.error('获取安全状态失败:', error)
    }
  }

  const changePassword = async () => {
    if (!oldPassword || !newPassword) {
      showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    
    if (newPassword.length < 6) {
      showToast({ title: '密码至少6位', icon: 'none' })
      return
    }
    
    try {
      const res = await Network.request({
        url: '/api/user/change-password',
        method: 'POST',
        data: { oldPassword, newPassword }
      })
      
      if (res.data?.code === 200) {
        showToast({ title: '密码修改成功', icon: 'success' })
        setShowPasswordModal(false)
        setOldPassword('')
        setNewPassword('')
      } else {
        showToast({ title: res.data?.message || '修改失败', icon: 'none' })
      }
    } catch (error) {
      console.error('修改密码失败:', error)
      showToast({ title: '修改失败', icon: 'none' })
    }
  }

  const bindPhone = () => {
    showToast({ title: '请在微信中绑定手机号', icon: 'none' })
  }

  const bindEmail = () => {
    showToast({ title: '功能开发中', icon: 'none' })
  }

  const securityItems = [
    { 
      title: '登录密码', 
      desc: securityStatus.hasPassword ? '已设置' : '未设置',
      icon: Lock, 
      color: '#00f5ff',
      action: () => setShowPasswordModal(true)
    },
    { 
      title: '手机绑定', 
      desc: securityStatus.hasPhone ? userInfo?.phone || '已绑定' : '未绑定',
      icon: Smartphone, 
      color: '#bf00ff',
      action: bindPhone
    },
    { 
      title: '邮箱绑定', 
      desc: securityStatus.hasEmail ? '已绑定' : '未绑定',
      icon: Mail, 
      color: '#00ff88',
      action: bindEmail
    }
  ]

  return (
    <View className="security-page">
      {/* 顶部导航 */}
      <View className="security-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-back" onClick={() => navigateBack()}>
          <Text className="back-text">← 返回</Text>
        </View>
        <Text className="header-title">账户安全</Text>
        <View className="header-placeholder" style={{ width: `${capsuleWidth}rpx` }} />
      </View>

      <ScrollView className="security-scroll" scrollY>
        {/* 安全评分 */}
        <View className="security-score-section">
          <View className="score-card">
            <View className="score-icon">
              <Shield size={32} color="#00f5ff" />
            </View>
            <View className="score-info">
              <Text className="score-label">安全评分</Text>
              <Text className="score-value">
                {securityStatus.hasPassword && securityStatus.hasPhone ? '高' : 
                 securityStatus.hasPassword ? '中' : '低'}
              </Text>
            </View>
            <View className="score-bar">
              <View 
                className="score-fill" 
                style={{ 
                  width: `${(securityStatus.hasPassword ? 40 : 0) + (securityStatus.hasPhone ? 30 : 0) + (securityStatus.hasEmail ? 30 : 0)}%` 
                }}
              />
            </View>
          </View>
        </View>

        {/* 安全设置 */}
        <View className="settings-section">
          <Text className="section-title">安全设置</Text>
          
          {securityItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <View 
                key={idx}
                className="security-item"
                onClick={item.action}
              >
                <View className="item-left">
                  <View className="item-icon" style={{ background: `${item.color}20` }}>
                    <Icon size={20} color={item.color} />
                  </View>
                  <View className="item-info">
                    <Text className="item-title">{item.title}</Text>
                    <Text className="item-desc">{item.desc}</Text>
                  </View>
                </View>
                <ChevronRight size={18} color="rgba(255,255,255,0.2)" />
              </View>
            )
          })}
        </View>

        {/* 登录信息 */}
        <View className="login-section">
          <Text className="section-title">登录信息</Text>
          
          <View className="login-info-card">
            <View className="login-item">
              <Text className="login-label">最近登录</Text>
              <Text className="login-value">{securityStatus.lastLoginTime}</Text>
            </View>
            <View className="login-divider" />
            <View className="login-item">
              <Text className="login-label">登录设备</Text>
              <Text className="login-value">{securityStatus.loginDevice}</Text>
            </View>
          </View>
        </View>

        {/* 安全提示 */}
        <View className="tips-section">
          <Text className="section-title">安全提示</Text>
          <View className="tips-card">
            <View className="tip-item">
              <Check size={16} color="#00ff88" />
              <Text className="tip-text">定期更换密码，提高账户安全性</Text>
            </View>
            <View className="tip-item">
              <Check size={16} color="#00ff88" />
              <Text className="tip-text">绑定手机号可找回账户</Text>
            </View>
            <View className="tip-item">
              <Check size={16} color="#00ff88" />
              <Text className="tip-text">不要将密码告诉他人</Text>
            </View>
          </View>
        </View>

        <View className="bottom-space" />
      </ScrollView>

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <View className="modal-mask" onClick={() => setShowPasswordModal(false)}>
          <View className="modal-content" onClick={e => e.stopPropagation()}>
            <Text className="modal-title">修改密码</Text>
            
            <View className="modal-input-wrap">
              <Input 
                className="modal-input"
                placeholder="请输入原密码"
                value={oldPassword}
                onInput={e => setOldPassword(e.detail.value)}
              />
            </View>
            
            <View className="modal-input-wrap">
              <Input 
                className="modal-input"
                placeholder="请输入新密码"
                value={newPassword}
                onInput={e => setNewPassword(e.detail.value)}
              />
            </View>
            
            <View className="modal-actions">
              <Button className="modal-btn cancel" onClick={() => setShowPasswordModal(false)}>
                <Text className="btn-text">取消</Text>
              </Button>
              <Button className="modal-btn confirm" onClick={changePassword}>
                <Text className="btn-text">确认</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
