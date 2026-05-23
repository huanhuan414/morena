import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { adminRequest } from '@/package-admin/utils/request'
import { ADMIN_LOGIN_PATH, hasAdminSession, setAdminSession } from '@/package-admin/utils/session'
import './index.css'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const redirect = decodeURIComponent(Taro.getCurrentInstance().router?.params?.redirect || '')
  const targetPath = redirect && redirect !== ADMIN_LOGIN_PATH
    ? redirect
    : '/package-admin/pages/dashboard/index'

  useEffect(() => {
    if (hasAdminSession()) {
      Taro.redirectTo({ url: targetPath })
    }
  }, [targetPath])

  const handleLogin = async () => {
    if (!username || !password) {
      Taro.showToast({ title: '请输入账号密码', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const res = await adminRequest({
        url: '/login',
        method: 'POST',
        data: { username, password }
      })

      if (res.data.code === 200) {
        setAdminSession({
          token: res.data.data.token,
          admin: res.data.data.admin,
        })
        
        Taro.showToast({ title: '登录成功', icon: 'success' })
        
        setTimeout(() => {
          Taro.redirectTo({ url: targetPath })
        }, 1000)
      } else {
        Taro.showToast({ title: res.data.message || '登录失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '登录失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="admin-login-page">
      <View className="login-box">
        <Text className="login-title">莫瑞娜管理后台</Text>
        <Text className="login-subtitle">Morina Admin System</Text>
        
        <View className="login-form">
          <View className="form-item">
            <Text className="form-label">管理员账号</Text>
            <Input
              className="form-input"
              placeholder="请输入管理员账号"
              value={username}
              onInput={(e: any) => setUsername(e.detail?.value || '')}
            />
          </View>
          
          <View className="form-item">
            <Text className="form-label">登录密码</Text>
            <Input
              className="form-input"
              placeholder="请输入登录密码"
              type="text"
              value={password}
              onInput={(e: any) => setPassword(e.detail?.value || '')}
            />
          </View>
          
          <Button
            className="login-btn w-full"
            onClick={handleLogin}
            disabled={loading}
          >
            <Text className="login-btn-text">{loading ? '登录中...' : '登录'}</Text>
          </Button>
        </View>
        
        <Text className="login-tip">默认账号: admin / 密码: admin123</Text>
      </View>
    </View>
  )
}
