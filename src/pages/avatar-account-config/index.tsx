/* eslint-disable no-undef */
// @ts-nocheck
import { useLoad, useDidShow, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Picker } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Save, Trash2, ArrowLeft } from 'lucide-react-taro'
import * as Network from '@/network'
import './index.css'

interface AvatarAccount {
  id?: string
  avatar_id: string
  platform: string
  account_name: string
  followers: number
  total_exposure: number
  total_works: number
  avg_likes_per_work: number
  avg_comments_per_work: number
  avg_shares_per_work: number
}

const PLATFORMS = [
  { id: 'douyin', label: '抖音' },
  { id: 'wechat', label: '微信公众号' },
  { id: 'xiaohongshu', label: '小红书' },
  { id: 'bilibili', label: 'B站' },
  { id: 'weibo', label: '微博' },
  { id: 'kuaishou', label: '快手' },
  { id: 'zhihu', label: '知乎' },
]

const PLATFORM_INDEX = PLATFORMS.map(p => p.label)

export default function AvatarAccountConfigPage() {
  const [avatarId, setAvatarId] = useState<string>('')
  const [avatarName, setAvatarName] = useState<string>('')
  const [accounts, setAccounts] = useState<AvatarAccount[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AvatarAccount | null>(null)

  // 表单状态
  const [platformIndex, setPlatformIndex] = useState<number>(0)
  const [accountName, setAccountName] = useState<string>('')
  const [followers, setFollowers] = useState<string>('')
  const [totalExposure, setTotalExposure] = useState<string>('')
  const [totalWorks, setTotalWorks] = useState<string>('')
  const [avgLikes, setAvgLikes] = useState<string>('')
  const [avgComments, setAvgComments] = useState<string>('')
  const [avgShares, setAvgShares] = useState<string>('')

  useLoad((options) => {
    if (options.avatarId) {
      setAvatarId(options.avatarId as string)
      if (options.avatarName) {
        setAvatarName(decodeURIComponent(options.avatarName as string) || '')
      }
    }
  })

  useDidShow(() => {
    if (avatarId) {
      fetchAccounts()
    }
  })

  const fetchAccounts = async () => {
    try {
      const res = await Network.request({
        url: `/api/avatar/${avatarId}/accounts`
      })
      if (res.data?.code === 200) {
        setAccounts(res.data.data || [])
      }
    } catch (error) {
      console.error('获取账号数据失败:', error)
      showToast({ title: '获取账号数据失败', icon: 'none' })
    }
  }

  const openModal = (account?: AvatarAccount) => {
    if (account) {
      setEditingAccount(account)
      setPlatformIndex(PLATFORMS.findIndex(p => p.id === account.platform) || 0)
      setAccountName(account.account_name || '')
      setFollowers(account.followers?.toString() || '')
      setTotalExposure(account.total_exposure?.toString() || '')
      setTotalWorks(account.total_works?.toString() || '')
      setAvgLikes(account.avg_likes_per_work?.toString() || '')
      setAvgComments(account.avg_comments_per_work?.toString() || '')
      setAvgShares(account.avg_shares_per_work?.toString() || '')
    } else {
      setEditingAccount(null)
      setPlatformIndex(0)
      setAccountName('')
      setFollowers('')
      setTotalExposure('')
      setTotalWorks('')
      setAvgLikes('')
      setAvgComments('')
      setAvgShares('')
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingAccount(null)
  }

  const saveAccount = async () => {
    if (!accountName || !followers || !totalExposure) {
      showToast({ title: '请填写必填项', icon: 'none' })
      return
    }

    const data: AvatarAccount = {
      avatar_id: avatarId,
      platform: PLATFORMS[platformIndex].id,
      account_name: accountName,
      followers: parseInt(followers) || 0,
      total_exposure: parseInt(totalExposure) || 0,
      total_works: parseInt(totalWorks) || 0,
      avg_likes_per_work: parseInt(avgLikes) || 0,
      avg_comments_per_work: parseInt(avgComments) || 0,
      avg_shares_per_work: parseInt(avgShares) || 0,
    }

    try {
      const url = editingAccount?.id
        ? `/api/avatar/accounts/${editingAccount.id}`
        : '/api/avatar/accounts'

      const method = editingAccount?.id ? 'PUT' : 'POST'

      const res = await Network.request({
        url,
        method,
        data
      })

      if (res.data?.code === 200) {
        showToast({ title: editingAccount?.id ? '更新成功' : '添加成功', icon: 'success' })
        closeModal()
        fetchAccounts()
      } else {
        showToast({ title: res.data?.message || '保存失败', icon: 'none' })
      }
    } catch (error) {
      console.error('保存账号失败:', error)
      showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const deleteAccount = async (accountId: string) => {
    try {
      const res = await Network.request({
        url: `/api/avatar/accounts/${accountId}`,
        method: 'DELETE'
      })

      if (res.data?.code === 200) {
        showToast({ title: '删除成功', icon: 'success' })
        fetchAccounts()
      } else {
        showToast({ title: res.data?.message || '删除失败', icon: 'none' })
      }
    } catch (error) {
      console.error('删除账号失败:', error)
      showToast({ title: '删除失败', icon: 'none' })
    }
  }

  const onPlatformChange = (e: any) => {
    setPlatformIndex(e.detail.value)
  }

  return (
    <View className="page-container">
      {/* 头部 */}
      <View className="header">
        <View className="header-left" onClick={navigateBack}>
          <ArrowLeft size={20} color="#333" />
        </View>
        <View className="header-title">
          <Text className="header-title-text">{avatarName || '分身'} - 账号配置</Text>
        </View>
        <View className="header-right"></View>
      </View>

      <ScrollView className="content" scrollY>
        {/* 说明 */}
        <View className="info-card">
          <Text className="info-title">为什么要配置账号数据？</Text>
          <Text className="info-text">配置分身在各平台的真实账号数据后，系统可以根据这些数据智能计算分身完成订单的能力，更准确地匹配订单并分配任务。</Text>
        </View>

        {/* 账号列表 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">已配置账号</Text>
            <Button size="sm" className="add-btn" onClick={() => openModal()}>
              <Plus size={16} />
              <Text className="add-btn-text">添加账号</Text>
            </Button>
          </View>

          {accounts.length === 0 ? (
            <View className="empty-state">
              <Text className="empty-text">暂无账号数据，请点击上方按钮添加</Text>
            </View>
          ) : (
            accounts.map((account) => {
              const platformInfo = PLATFORMS.find(p => p.id === account.platform)
              return (
                <View key={account.id} className="account-card">
                  <View className="account-header">
                    <Text className="account-platform">{platformInfo?.label || account.platform}</Text>
                    <Text className="account-name">{account.account_name}</Text>
                  </View>
                  <View className="account-stats">
                    <View className="stat-item">
                      <Text className="stat-label">粉丝数</Text>
                      <Text className="stat-value">{account.followers.toLocaleString()}</Text>
                    </View>
                    <View className="stat-item">
                      <Text className="stat-label">总曝光</Text>
                      <Text className="stat-value">{account.total_exposure.toLocaleString()}</Text>
                    </View>
                    <View className="stat-item">
                      <Text className="stat-label">作品数</Text>
                      <Text className="stat-value">{account.total_works}</Text>
                    </View>
                  </View>
                  <View className="account-actions">
                    <View className="action-btn" onClick={() => openModal(account)}>
                      <Pencil size={16} color="#1890ff" />
                      <Text className="action-text">编辑</Text>
                    </View>
                    <View className="action-btn" onClick={() => deleteAccount(account.id!)}>
                      <Trash2 size={16} color="#ff4d4f" />
                      <Text className="action-text danger">删除</Text>
                    </View>
                  </View>
                </View>
              )
            })
          )}
        </View>
      </ScrollView>

      {/* 添加/编辑弹窗 */}
      {showModal && (
        <View className="modal-overlay" onClick={closeModal}>
          <View className="modal-content" onClick={(e) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">{editingAccount ? '编辑账号' : '添加账号'}</Text>
            </View>
            <ScrollView className="modal-body" scrollY>
              <View className="form-item">
                <Text className="form-label required">平台</Text>
                <Picker
                  mode="selector"
                  range={PLATFORM_INDEX}
                  value={platformIndex}
                  onChange={onPlatformChange}
                >
                  <View className="picker">
                    <Text>{PLATFORMS[platformIndex].label}</Text>
                  </View>
                </Picker>
              </View>

              <View className="form-item">
                <Text className="form-label required">账号名称</Text>
                <Input
                  className="form-input"
                  placeholder="请输入账号名称"
                  value={accountName}
                  onInput={(e) => setAccountName(e.detail.value)}
                />
              </View>

              <View className="form-item">
                <Text className="form-label required">粉丝数</Text>
                <Input
                  className="form-input"
                  type="number"
                  placeholder="请输入粉丝数"
                  value={followers}
                  onInput={(e) => setFollowers(e.detail.value)}
                />
              </View>

              <View className="form-item">
                <Text className="form-label required">总曝光量</Text>
                <Input
                  className="form-input"
                  type="number"
                  placeholder="请输入总曝光量"
                  value={totalExposure}
                  onInput={(e) => setTotalExposure(e.detail.value)}
                />
              </View>

              <View className="form-item">
                <Text className="form-label">作品总数</Text>
                <Input
                  className="form-input"
                  type="number"
                  placeholder="请输入作品总数"
                  value={totalWorks}
                  onInput={(e) => setTotalWorks(e.detail.value)}
                />
              </View>

              <View className="form-item">
                <Text className="form-label">平均点赞数/作品</Text>
                <Input
                  className="form-input"
                  type="number"
                  placeholder="请输入平均点赞数"
                  value={avgLikes}
                  onInput={(e) => setAvgLikes(e.detail.value)}
                />
              </View>

              <View className="form-item">
                <Text className="form-label">平均评论数/作品</Text>
                <Input
                  className="form-input"
                  type="number"
                  placeholder="请输入平均评论数"
                  value={avgComments}
                  onInput={(e) => setAvgComments(e.detail.value)}
                />
              </View>

              <View className="form-item">
                <Text className="form-label">平均转发数/作品</Text>
                <Input
                  className="form-input"
                  type="number"
                  placeholder="请输入平均转发数"
                  value={avgShares}
                  onInput={(e) => setAvgShares(e.detail.value)}
                />
              </View>
            </ScrollView>
            <View className="modal-footer">
              <Button className="modal-btn cancel" onClick={closeModal}>取消</Button>
              <Button className="modal-btn confirm" onClick={saveAccount}>
                <Save size={16} />
                <Text className="btn-text">保存</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
