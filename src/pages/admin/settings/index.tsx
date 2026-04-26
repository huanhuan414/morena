import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Shield, UserPlus, Trash2, Plus, Key } from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import './index.css'

interface AdminUser {
  id: string
  username: string
  role: string
  last_login: string
  created_at: string
}

interface SystemConfig {
  siteName: string
  siteDescription: string
  maintenanceMode: boolean
  registerEnabled: boolean
  maxAvatarsPerUser: number
}

export default function SystemSettings() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [config, setConfig] = useState<SystemConfig>({
    siteName: 'AI分身平台',
    siteDescription: '创建你的专属AI分身',
    maintenanceMode: false,
    registerEnabled: true,
    maxAvatarsPerUser: 5
  })
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newAdminForm, setNewAdminForm] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  })
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    fetchAdmins()
    fetchConfig()
  }, [])

  const fetchAdmins = async () => {
    try {
      const res = await Network.request({ url: '/api/admin/settings/admins' })
      if (res.data.code === 200) {
        setAdmins(res.data.data)
      }
    } catch (err) {
      console.error('获取管理员列表失败:', err)
    }
  }

  const fetchConfig = async () => {
    try {
      const res = await Network.request({ url: '/api/admin/settings/config' })
      if (res.data.code === 200) {
        setConfig(res.data.data)
      }
    } catch (err) {
      console.error('获取系统配置失败:', err)
    }
  }

  const handleAddAdmin = async () => {
    if (!newAdminForm.username || !newAdminForm.password) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    if (newAdminForm.password !== newAdminForm.confirmPassword) {
      Taro.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: '/api/admin/settings/admins',
        method: 'POST',
        data: {
          username: newAdminForm.username,
          password: newAdminForm.password
        }
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '添加成功', icon: 'success' })
        setShowAddAdmin(false)
        setNewAdminForm({ username: '', password: '', confirmPassword: '' })
        fetchAdmins()
      }
    } catch (err) {
      Taro.showToast({ title: '添加失败', icon: 'none' })
    }
  }

  const handleDeleteAdmin = (adminId: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除该管理员吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await Network.request({
              url: `/api/admin/settings/admins/${adminId}`,
              method: 'DELETE'
            })
            if (result.data.code === 200) {
              Taro.showToast({ title: '删除成功', icon: 'success' })
              fetchAdmins()
            }
          } catch (err) {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Taro.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: '/api/admin/settings/password',
        method: 'PUT',
        data: {
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        }
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '密码修改成功', icon: 'success' })
        setShowChangePassword(false)
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
      }
    } catch (err) {
      Taro.showToast({ title: '修改失败', icon: 'none' })
    }
  }

  const handleSaveConfig = async () => {
    try {
      const res = await Network.request({
        url: '/api/admin/settings/config',
        method: 'PUT',
        data: config
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
      }
    } catch (err) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  return (
    <AdminLayout title="系统设置">
      <ScrollView className="settings-page" scrollY>
        {/* 站点配置 */}
        <View className="section">
          <Text className="section-title">站点配置</Text>
          <View className="form-card">
            <View className="form-group">
              <Text className="form-label">站点名称</Text>
              <Input
                className="form-input"
                value={config.siteName}
                onInput={(e: any) => setConfig({...config, siteName: e.detail?.value || ''})}
              />
            </View>
            
            <View className="form-group">
              <Text className="form-label">站点描述</Text>
              <Input
                className="form-input"
                value={config.siteDescription}
                onInput={(e: any) => setConfig({...config, siteDescription: e.detail?.value || ''})}
              />
            </View>
            
            <View className="form-group">
              <Text className="form-label">每用户最多分身数</Text>
              <Input
                className="form-input"
                type="number"
                value={String(config.maxAvatarsPerUser)}
                onInput={(e: any) => setConfig({...config, maxAvatarsPerUser: parseInt(e.detail?.value) || 5})}
              />
            </View>
            
            <Button className="save-btn" onClick={handleSaveConfig}>
              <Text>保存配置</Text>
            </Button>
          </View>
        </View>

        {/* 管理员管理 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">管理员管理</Text>
            <View className="header-actions">
              <Button className="action-btn" onClick={() => setShowAddAdmin(true)}>
                <Plus size={16} color="#fff" />
                <Text>添加管理员</Text>
              </Button>
              <Button className="action-btn secondary" onClick={() => setShowChangePassword(true)}>
                <Key size={16} color="#fff" />
                <Text>修改密码</Text>
              </Button>
            </View>
          </View>
          
          <View className="admin-list">
            {admins.map(admin => (
              <View key={admin.id} className="admin-card">
                <View className="admin-info">
                  <View className="admin-avatar">
                    <Shield size={20} color="#3b82f6" />
                  </View>
                  <View className="admin-meta">
                    <Text className="admin-name">{admin.username}</Text>
                    <Text className="admin-role">{admin.role === 'super' ? '超级管理员' : '管理员'}</Text>
                  </View>
                </View>
                <View className="admin-extra">
                  <Text className="last-login">最后登录: {admin.last_login || '从未'}</Text>
                  {admin.role !== 'super' && (
                    <View className="delete-btn" onClick={() => handleDeleteAdmin(admin.id)}>
                      <Trash2 size={16} color="#ef4444" />
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 添加管理员弹窗 */}
        {showAddAdmin && (
          <View className="modal-overlay">
            <View className="modal-content">
              <Text className="modal-title">添加管理员</Text>
              
              <View className="form-group">
                <Text className="form-label">用户名</Text>
                <Input
                  className="form-input"
                  placeholder="请输入用户名"
                  value={newAdminForm.username}
                  onInput={(e: any) => setNewAdminForm({...newAdminForm, username: e.detail?.value || ''})}
                />
              </View>
              
              <View className="form-group">
                <Text className="form-label">密码</Text>
                <Input
                  className="form-input"
                  placeholder="请输入密码"
                  value={newAdminForm.password}
                  onInput={(e: any) => setNewAdminForm({...newAdminForm, password: e.detail?.value || ''})}
                />
              </View>
              
              <View className="form-group">
                <Text className="form-label">确认密码</Text>
                <Input
                  className="form-input"
                  placeholder="请再次输入密码"
                  value={newAdminForm.confirmPassword}
                  onInput={(e: any) => setNewAdminForm({...newAdminForm, confirmPassword: e.detail?.value || ''})}
                />
              </View>
              
              <View className="modal-actions">
                <Button className="btn-cancel" onClick={() => setShowAddAdmin(false)}>
                  <Text>取消</Text>
                </Button>
                <Button className="btn-confirm" onClick={handleAddAdmin}>
                  <UserPlus size={16} color="#fff" />
                  <Text>添加</Text>
                </Button>
              </View>
            </View>
          </View>
        )}

        {/* 修改密码弹窗 */}
        {showChangePassword && (
          <View className="modal-overlay">
            <View className="modal-content">
              <Text className="modal-title">修改密码</Text>
              
              <View className="form-group">
                <Text className="form-label">原密码</Text>
                <Input
                  className="form-input"
                  placeholder="请输入原密码"
                  value={passwordForm.oldPassword}
                  onInput={(e: any) => setPasswordForm({...passwordForm, oldPassword: e.detail?.value || ''})}
                />
              </View>
              
              <View className="form-group">
                <Text className="form-label">新密码</Text>
                <Input
                  className="form-input"
                  placeholder="请输入新密码"
                  value={passwordForm.newPassword}
                  onInput={(e: any) => setPasswordForm({...passwordForm, newPassword: e.detail?.value || ''})}
                />
              </View>
              
              <View className="form-group">
                <Text className="form-label">确认新密码</Text>
                <Input
                  className="form-input"
                  placeholder="请再次输入新密码"
                  value={passwordForm.confirmPassword}
                  onInput={(e: any) => setPasswordForm({...passwordForm, confirmPassword: e.detail?.value || ''})}
                />
              </View>
              
              <View className="modal-actions">
                <Button className="btn-cancel" onClick={() => setShowChangePassword(false)}>
                  <Text>取消</Text>
                </Button>
                <Button className="btn-confirm" onClick={handleChangePassword}>
                  <Key size={16} color="#fff" />
                  <Text>修改</Text>
                </Button>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </AdminLayout>
  )
}
