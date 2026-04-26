/* eslint-disable no-undef */
// @ts-nocheck
import { useLoad, useDidShow, navigateBack, showToast, getSystemInfoSync } from '@tarojs/taro'   

// 获取状态栏高度
const systemInfo = getSystemInfoSync()
const statusBarHeight = systemInfo.statusBarHeight || 0
import { useState } from 'react'
import { View, Text, ScrollView, Picker, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Save, Trash2, ArrowLeft, Search, Loader, RefreshCw } from 'lucide-react-taro'
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
  appid?: string        // 微信公众号 appid
  appkey?: string       // 微信公众号 AppKey
  account_url?: string  // 小红书主页链接
  extra_info?: string   // 额外信息（JSON字符串）：nickname, avatar_url, signature 等
}

const PLATFORMS = [
  { id: 'douyin', label: '抖音' },
  { id: 'wechat', label: '微信公众号' },
  { id: 'xiaohongshu', label: '小红书' },
]

const PLATFORM_INDEX = PLATFORMS.map(p => p.label)

export default function AvatarAccountConfigPage() {
  const [avatarId, setAvatarId] = useState<string>('')
  const [avatarName, setAvatarName] = useState<string>('')
  const [accounts, setAccounts] = useState<AvatarAccount[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AvatarAccount | null>(null)
  const [refreshingAccountId, setRefreshingAccountId] = useState<string | null>(null)

  // 表单状态
  const [platformIndex, setPlatformIndex] = useState<number>(0)
  const [accountName, setAccountName] = useState<string>('')

  // 微信公众号专用字段
  const [appid, setAppid] = useState<string>('')
  const [appkey, setAppkey] = useState<string>('')

  // 小红书专用字段
  const [xiaohongshuUrl, setXiaohongshuUrl] = useState<string>('')

  // 获取用户信息相关状态
  const [isFetchingUserInfo, setIsFetchingUserInfo] = useState(false)
  const [fetchedUserInfo, setFetchedUserInfo] = useState<any>(null)

  // 微信公众号验证状态
  const [isValidatingWechat, setIsValidatingWechat] = useState(false)
  const [wechatValidationResult, setWechatValidationResult] = useState<{
    valid: boolean
    message: string
    accountInfo?: any
    serverIp?: string
  } | null>(null)

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
      // 编辑模式
      setEditingAccount(account)
      setPlatformIndex(PLATFORMS.findIndex(p => p.id === account.platform) || 0)
      setAccountName(account.account_name || '')
      setAppid(account.appid || '')
      setAppkey(account.appkey || '')
      setXiaohongshuUrl(account.account_url || '')
    } else {
      // 添加模式
      setEditingAccount(null)
      setPlatformIndex(0)
      setAccountName('')
      setAppid('')
      setAppkey('')
      setXiaohongshuUrl('')
    }
    setFetchedUserInfo(null)
    setWechatValidationResult(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingAccount(null)
    setAppid('')
    setAppkey('')
    setXiaohongshuUrl('')
    setFetchedUserInfo(null)
    setWechatValidationResult(null)
  }

  // 获取用户信息
  const fetchUserInfo = async () => {
    const platformId = PLATFORMS[platformIndex].id

    if (platformId === 'douyin') {
      // 抖音：根据抖音号获取用户信息
      if (!accountName) {
        showToast({ title: '请输入抖音号', icon: 'none' })
        return
      }

      try {
        setIsFetchingUserInfo(true)
        console.log('[AvatarAccountConfig] 开始获取抖音用户信息，抖音号:', accountName)

        const res = await Network.request({
          url: '/api/tikhub/douyin/user-info',
          method: 'POST',
          data: { douyinId: accountName }
        })

        console.log('[AvatarAccountConfig] 抖音用户信息响应:', res.data)

        if (res.data?.code === 200 && res.data?.data) {
          const userInfo = res.data.data
          setFetchedUserInfo(userInfo)
          showToast({ title: '获取成功', icon: 'success' })
        } else {
          showToast({ title: res.data?.message || '获取失败，请检查抖音号/SecUid是否正确', icon: 'none' })
        }
      } catch (error: any) {
        console.error('[AvatarAccountConfig] 获取抖音用户信息失败:', error)
        showToast({ title: `网络请求失败: ${error.message || '请稍后重试'}`, icon: 'none' })
      } finally {
        setIsFetchingUserInfo(false)
      }

    } else if (platformId === 'xiaohongshu') {
      // 小红书：根据分享链接获取用户信息
      if (!xiaohongshuUrl) {
        showToast({ title: '请输入小红书分享链接', icon: 'none' })
        return
      }

      try {
        setIsFetchingUserInfo(true)
        console.log('[AvatarAccountConfig] 开始获取小红书用户信息，分享链接:', xiaohongshuUrl)

        const res = await Network.request({
          url: '/api/tikhub/xiaohongshu/user-info',
          method: 'POST',
          data: { shareUrl: xiaohongshuUrl }
        })

        console.log('[AvatarAccountConfig] 小红书用户信息响应:', res.data)

        if (res.data?.code === 200 && res.data?.data) {
          const userInfo = res.data.data

          // 将小红书的数据结构转换为统一格式
          setFetchedUserInfo({
            nickname: userInfo.nickname,
            avatar_url: userInfo.avatar_url,
            signature: userInfo.desc,
            follower_count: userInfo.follower_count,
            following_count: userInfo.following_count,
            notes_count: userInfo.notes_count,
            total_favorited: userInfo.total_favorited || 0,
            interaction_count: userInfo.interaction_count || 0,
          })
          showToast({ title: '获取成功', icon: 'success' })
        } else {
          // 显示后端返回的具体错误信息
          const errorMsg = res.data?.message || res.data?.msg || '获取失败，请检查分享链接是否正确'
          showToast({ title: errorMsg, icon: 'none', duration: 3000 })
        }
      } catch (error: any) {
        console.error('[AvatarAccountConfig] 获取小红书用户信息失败:', error)
        showToast({ title: `网络请求失败: ${error.message || '请稍后重试'}`, icon: 'none' })
      } finally {
        setIsFetchingUserInfo(false)
      }
    }
  }

  // 验证微信公众号配置
  const validateWechatConfig = async () => {
    if (!appid || !appkey) {
      showToast({ title: '请填写 AppID 和 AppKey', icon: 'none' })
      return
    }

    try {
      setIsValidatingWechat(true)
      setWechatValidationResult(null)

      console.log('[AvatarAccountConfig] 开始验证微信公众号配置，AppID:', appid)

      const res = await Network.request({
        url: `/api/agent/platform-config/wechat/validate`,
        method: 'POST',
        data: { app_id: appid, app_secret: appkey }
      })

      console.log('[AvatarAccountConfig] 微信公众号配置验证响应:', res.data)

      if (res.data?.code === 200) {
        const validation = res.data.data
        setWechatValidationResult({
          valid: validation.valid,
          message: validation.message || (validation.valid ? '验证成功' : '验证失败'),
          accountInfo: validation.accountInfo,
          serverIp: validation.serverIp
        })

        // 如果有账号信息，更新 fetchedUserInfo
        if (validation.accountInfo) {
          setFetchedUserInfo(validation.accountInfo)
        }

        if (validation.valid) {
          showToast({ title: validation.message || '验证成功', icon: 'success' })
        } else {
          showToast({ title: validation.message || '验证失败', icon: 'none', duration: 3000 })
        }
      } else {
        setWechatValidationResult({
          valid: false,
          message: res.data?.message || '验证失败，请稍后重试'
        })
        showToast({ title: res.data?.message || '验证失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('[AvatarAccountConfig] 验证微信公众号配置失败:', error)
      setWechatValidationResult({
        valid: false,
        message: `网络请求失败: ${error.message || '请稍后重试'}`
      })
      showToast({ title: `网络请求失败: ${error.message || '请稍后重试'}`, icon: 'none' })
    } finally {
      setIsValidatingWechat(false)
    }
  }

  const saveAccount = async () => {
    const platformId = PLATFORMS[platformIndex].id

    // 根据平台进行不同的验证
    if (platformId === 'douyin') {
      // 抖音：只需填入抖音号
      if (!accountName) {
        showToast({ title: '请填写抖音号', icon: 'none' })
        return
      }
    } else if (platformId === 'xiaohongshu') {
      // 小红书：只需输入个人主页链接
      if (!xiaohongshuUrl) {
        showToast({ title: '请输入小红书个人主页链接', icon: 'none' })
        return
      }
    } else if (platformId === 'wechat') {
      // 微信公众号：需要填入 appid 和 AppKey
      if (!appid || !appkey) {
        showToast({ title: '请填写 AppID 和 AppKey', icon: 'none' })
        return
      }

      // 检查是否已验证配置
      if (!wechatValidationResult || !wechatValidationResult.valid) {
        showToast({ title: '请先验证配置连通性', icon: 'none' })
        return
      }
    }

    // 构建账号数据
    const data: any = {
      avatar_id: avatarId,
      platform: platformId,
      account_name: accountName || '',
      appid: platformId === 'wechat' ? appid : undefined,
      appkey: platformId === 'wechat' ? appkey : undefined,
      account_url: platformId === 'xiaohongshu' ? xiaohongshuUrl : undefined,
    }

    // 如果获取了用户信息，使用这些数据
    if (fetchedUserInfo) {
      console.log('[AvatarAccountConfig] 使用获取到的用户信息:', fetchedUserInfo)
      data.followers = fetchedUserInfo.follower_count || 0
      data.total_works = fetchedUserInfo.aweme_count || fetchedUserInfo.notes_count || 0

      // 获取总获赞数
      data.total_exposure = fetchedUserInfo.total_favorited || 0

      data.avg_likes_per_work = 0
      data.avg_comments_per_work = 0
      data.avg_shares_per_work = 0

      // 保存额外的用户信息（使用 JSON 字符串）
      data.extra_info = JSON.stringify({
        nickname: fetchedUserInfo.nickname || '',
        avatar_url: fetchedUserInfo.avatar_url || '',
        signature: fetchedUserInfo.signature || '',
        following_count: fetchedUserInfo.following_count || 0,
        sec_uid: fetchedUserInfo.sec_uid || '',
        total_favorited: fetchedUserInfo.total_favorited || 0,
        interaction_count: fetchedUserInfo.interaction_count || 0,
      })
    } else {
      // 没有获取用户信息，使用默认值
      data.followers = 0
      data.total_works = 0
      data.total_exposure = 0
      data.avg_likes_per_work = 0
      data.avg_comments_per_work = 0
      data.avg_shares_per_work = 0
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

  const refreshAccount = async (account: AvatarAccount) => {
    try {
      setRefreshingAccountId(account.id!)
      console.log('[AvatarAccountConfig] 开始刷新账号:', account.platform, account.account_name)

      let userInfo: any = null

      // 根据平台调用不同的 API
      if (account.platform === 'douyin') {
        // 抖音：调用 TikHub API
        const res = await Network.request({
          url: '/api/tikhub/douyin/user-info',
          method: 'POST',
          data: { douyinId: account.account_name }
        })

        if (res.data?.code === 200 && res.data?.data) {
          userInfo = res.data.data
        }
      } else if (account.platform === 'xiaohongshu' && account.account_url) {
        // 小红书：调用 TikHub API
        const res = await Network.request({
          url: '/api/tikhub/xiaohongshu/user-info',
          method: 'POST',
          data: { shareUrl: account.account_url }
        })

        if (res.data?.code === 200 && res.data?.data) {
          userInfo = res.data.data
        }
      }

      if (!userInfo) {
        showToast({ title: '刷新失败，请稍后重试', icon: 'none' })
        return
      }

      // 解析 extra_info
      let extraInfo: any = {}
      if (account.extra_info) {
        try {
          extraInfo = JSON.parse(account.extra_info)
        } catch (e) {
          console.error('[AvatarAccountConfig] 解析 extra_info 失败:', e)
        }
      }

      // 更新 extra_info 中的数据
      const updatedExtraInfo = {
        ...extraInfo,
        nickname: userInfo.nickname || extraInfo.nickname,
        avatar_url: userInfo.avatar_url || extraInfo.avatar_url,
        signature: userInfo.signature || userInfo.desc || extraInfo.signature,
        following_count: userInfo.following_count || extraInfo.following_count || 0,
        sec_uid: userInfo.sec_uid || extraInfo.sec_uid,
        total_favorited: userInfo.total_favorited || extraInfo.total_favorited || 0,
        interaction_count: userInfo.interaction_count || extraInfo.interaction_count || 0,
      }

      // 更新账号数据
      const updateData: any = {
        platform: account.platform,
        account_name: account.account_name,
        followers: userInfo.follower_count || account.followers,
        total_exposure: userInfo.total_favorited || account.total_exposure,
        total_works: userInfo.aweme_count || userInfo.notes_count || account.total_works,
        extra_info: JSON.stringify(updatedExtraInfo),
      }

      const res = await Network.request({
        url: `/api/avatar/accounts/${account.id}`,
        method: 'PUT',
        data: updateData
      })

      if (res.data?.code === 200) {
        showToast({ title: '刷新成功', icon: 'success' })
        fetchAccounts()
      } else {
        showToast({ title: res.data?.message || '刷新失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[AvatarAccountConfig] 刷新账号失败:', error)
      showToast({ title: '刷新失败', icon: 'none' })
    } finally {
      setRefreshingAccountId(null)
    }
  }

  const onPlatformChange = (e: any) => {
    setPlatformIndex(e.detail.value)
  }

  return (
    <View className="page-container">
      {/* 头部 - 适配状态栏 */}
      <View className="header" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
        <View
          className="header-left"
          onClick={() => {
            console.log('[AvatarAccountConfig] 点击返回按钮')
            navigateBack()
          }}
        >
          <ArrowLeft size={26} className="header-back-icon" />
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
            <View
              className="add-btn-wrapper"
              onClick={() => {
                console.log('[AvatarAccountConfig] 打开添加账号弹窗')
                openModal()
              }}
            >
              <Plus size={16} color="#fff" />
              <Text className="add-btn-text">添加账号</Text>
            </View>
          </View>

          {accounts.length === 0 ? (
            <View className="empty-state">
              <Text className="empty-text">暂无账号数据，请点击上方按钮添加</Text>
            </View>
          ) : (
            accounts.map((account) => {
              const platformInfo = PLATFORMS.find(p => p.id === account.platform)

              // 解析 extra_info
              let extraInfo: any = {}
              if (account.extra_info) {
                try {
                  extraInfo = JSON.parse(account.extra_info)
                } catch (e) {
                  console.error('[AvatarAccountConfig] 解析 extra_info 失败:', e)
                }
              }

              // 优先显示 extra_info 中的昵称，否则显示 account_name
              const displayName = extraInfo.nickname || account.account_name
              const avatarUrl = extraInfo.avatar_url || ''

              return (
                <View key={account.id} className="account-card">
                  <View className="account-header">
                    {avatarUrl && (
                      <Image
                        src={avatarUrl}
                        className="account-avatar"
                        mode="aspectFill"
                      />
                    )}
                    <View className="account-info">
                      <View className="account-platform-name">
                        <Text className="account-platform">{platformInfo?.label || account.platform}</Text>
                        <Text className="account-name">{displayName}</Text>
                      </View>
                      {extraInfo.signature && (
                        <Text className="account-signature" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {extraInfo.signature}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* 统计数据 - 微信公众号不显示 */}
                  {account.platform !== 'wechat' && (
                    <View className="account-stats">
                      <View className="stat-item">
                        <Text className="stat-label">粉丝数</Text>
                        <Text className="stat-value">{account.followers.toLocaleString()}</Text>
                      </View>
                      <View className="stat-item">
                        <Text className="stat-label">总获赞</Text>
                        <Text className="stat-value">{account.total_exposure.toLocaleString()}</Text>
                      </View>
                      <View className="stat-item">
                        <Text className="stat-label">作品数</Text>
                        <Text className="stat-value">{account.total_works.toLocaleString()}</Text>
                      </View>
                    </View>
                  )}

                  {/* 微信公众号显示 AppID 和验证状态 */}
                  {account.platform === 'wechat' && (
                    <View className="wechat-config-info">
                      <View className="wechat-config-item">
                        <Text className="wechat-config-label">AppID：</Text>
                        <Text className="wechat-config-value">{account.appid}</Text>
                      </View>
                      <View className="wechat-config-item">
                        <Text className="wechat-config-label">AppSecret：</Text>
                        <Text className={`wechat-config-value ${account.appkey ? 'verified' : ''}`}>
                          {account.appkey ? '已验证 ✓' : '未验证'}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View className="account-actions">
                    <View
                      className="action-btn"
                      onClick={() => refreshAccount(account)}
                    >
                      {refreshingAccountId === account.id ? (
                        <Loader className="animate-spin" size={16} color="#1890ff" />
                      ) : (
                        <RefreshCw size={16} color="#1890ff" />
                      )}
                      <Text className="action-text">刷新</Text>
                    </View>
                    <View
                      className="action-btn"
                      onClick={() => {
                        console.log('[AvatarAccountConfig] 打开编辑账号弹窗')
                        openModal(account)
                      }}
                    >
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

              {/* 根据平台显示不同的表单字段 */}
              {PLATFORMS[platformIndex].id === 'douyin' && (
                <>
                  <View className="form-item">
                    <Text className="form-label required">抖音号/SecUid</Text>
                    <View className="input-with-action">
                      <Input
                        className="form-input"
                        placeholder="请输入抖音号（如：67377862593）或 SecUid"
                        value={accountName}
                        onInput={(e) => setAccountName(e.detail.value)}
                      />
                      <Button
                        className="fetch-info-btn"
                        size="small"
                        onClick={fetchUserInfo}
                        disabled={isFetchingUserInfo || !accountName}
                      >
                        {isFetchingUserInfo ? <Loader className="animate-spin" size={16} /> : <Search size={16} />}
                        <Text>{isFetchingUserInfo ? '获取中...' : '获取信息'}</Text>
                      </Button>
                    </View>
                    <Text className="form-tip">提示：输入抖音号（纯数字）或 SecUid（以 MS4wLjABAAAA 开头）均可</Text>
                  </View>

                  {/* 显示获取到的用户信息 */}
                  {fetchedUserInfo && (
                    <View className="user-info-card">
                      <View className="user-info-header">
                        {fetchedUserInfo.avatar_url && (
                          <Image className="user-avatar" src={fetchedUserInfo.avatar_url} mode="aspectFill" />
                        )}
                        <View className="user-info-content">
                          <Text className="user-name">{fetchedUserInfo.nickname || accountName}</Text>
                          {fetchedUserInfo.signature && (
                            <Text className="user-desc">{fetchedUserInfo.signature}</Text>
                          )}
                        </View>
                      </View>
                      <View className="user-stats">
                        <View className="stat-item">
                          <Text className="stat-value">
                            {fetchedUserInfo.follower_count ? fetchedUserInfo.follower_count.toLocaleString() : 0}
                          </Text>
                          <Text className="stat-label">粉丝</Text>
                        </View>
                        <View className="stat-item">
                          <Text className="stat-value">
                            {fetchedUserInfo.following_count ? fetchedUserInfo.following_count.toLocaleString() : 0}
                          </Text>
                          <Text className="stat-label">关注</Text>
                        </View>
                        <View className="stat-item">
                          <Text className="stat-value">
                            {fetchedUserInfo.total_favorited ? fetchedUserInfo.total_favorited.toLocaleString() : 0}
                          </Text>
                          <Text className="stat-label">总获赞</Text>
                        </View>
                        <View className="stat-item">
                          <Text className="stat-value">
                            {fetchedUserInfo.aweme_count ? fetchedUserInfo.aweme_count.toLocaleString() : 0}
                          </Text>
                          <Text className="stat-label">作品</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              )}

              {PLATFORMS[platformIndex].id === 'xiaohongshu' && (
                <>
                  <View className="form-item">
                    <Text className="form-label required">个人主页链接</Text>
                    <View className="input-with-action">
                      <Input
                        className="form-input"
                        placeholder="请输入小红书个人主页分享的链接"
                        value={xiaohongshuUrl}
                        onInput={(e) => setXiaohongshuUrl(e.detail.value)}
                      />
                      <Button
                        className="fetch-info-btn"
                        size="small"
                        onClick={fetchUserInfo}
                        disabled={isFetchingUserInfo || !xiaohongshuUrl}
                      >
                        {isFetchingUserInfo ? <Loader className="animate-spin" size={16} /> : <Search size={16} />}
                        <Text>{isFetchingUserInfo ? '获取中...' : '获取信息'}</Text>
                      </Button>
                    </View>
                    <Text className="form-tip">提示：请输入小红书个人主页的分享链接（如：http://xhslink.com/xxxxx）</Text>
                  </View>

                  {/* 显示获取到的用户信息 */}
                  {fetchedUserInfo && (
                    <View className="user-info-card">
                      <View className="user-info-header">
                        {fetchedUserInfo.avatar_url && (
                          <Image className="user-avatar" src={fetchedUserInfo.avatar_url} mode="aspectFill" />
                        )}
                        <View className="user-info-content">
                          <Text className="user-name">{fetchedUserInfo.nickname}</Text>
                          {fetchedUserInfo.desc && (
                            <Text className="user-desc">{fetchedUserInfo.desc}</Text>
                          )}
                        </View>
                      </View>
                      <View className="user-stats">
                        <View className="stat-item">
                          <Text className="stat-value">
                            {fetchedUserInfo.follower_count ? fetchedUserInfo.follower_count.toLocaleString() : 0}
                          </Text>
                          <Text className="stat-label">粉丝</Text>
                        </View>
                        <View className="stat-item">
                          <Text className="stat-value">
                            {fetchedUserInfo.following_count ? fetchedUserInfo.following_count.toLocaleString() : 0}
                          </Text>
                          <Text className="stat-label">关注</Text>
                        </View>
                        <View className="stat-item">
                          <Text className="stat-value">
                            {fetchedUserInfo.total_favorited ? fetchedUserInfo.total_favorited.toLocaleString() : 0}
                          </Text>
                          <Text className="stat-label">总获赞</Text>
                        </View>
                        <View className="stat-item">
                          <Text className="stat-value">
                            {fetchedUserInfo.notes_count ? fetchedUserInfo.notes_count.toLocaleString() : 0}
                          </Text>
                          <Text className="stat-label">笔记</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              )}

              {PLATFORMS[platformIndex].id === 'wechat' && (
                <>
                  <View className="form-item">
                    <Text className="form-label required">AppID</Text>
                    <Input
                      className="form-input"
                      placeholder="请输入微信公众号 AppID"
                      value={appid}
                      onInput={(e) => setAppid(e.detail.value)}
                    />
                  </View>
                  <View className="form-item">
                    <Text className="form-label required">AppKey</Text>
                    <View className="input-with-action">
                      <Input
                        className="form-input"
                        placeholder="请输入微信公众号 AppKey"
                        value={appkey}
                        onInput={(e) => setAppkey(e.detail.value)}
                      />
                      <Button
                        className="fetch-info-btn"
                        size="small"
                        onClick={validateWechatConfig}
                        disabled={isValidatingWechat || !appid || !appkey}
                      >
                        {isValidatingWechat ? <Loader className="animate-spin" size={16} /> : <Search size={16} />}
                        <Text>{isValidatingWechat ? '验证中...' : '验证'}</Text>
                      </Button>
                    </View>
                  </View>

                  {/* 验证结果显示 */}
                  {wechatValidationResult && (
                    <View className={`validation-result ${wechatValidationResult.valid ? 'success' : 'error'}`}>
                      <Text className="validation-message">
                        {wechatValidationResult.valid ? '✅ ' : '❌ '}{wechatValidationResult.message}
                      </Text>

                      {/* 如果是 IP 白名单问题，显示配置指引 */}
                      {!wechatValidationResult.valid && wechatValidationResult.serverIp && (
                        <View className="ip-whitelist-guide">
                          <Text className="guide-title">📋 配置 IP 白名单指引：</Text>
                          <Text className="guide-step">1. 登录微信公众平台</Text>
                          <Text className="guide-step">2. 进入「设置与开发」→「基本配置」</Text>
                          <Text className="guide-step">3. 找到「IP白名单」设置</Text>
                          <Text className="guide-step">4. 点击「配置」按钮</Text>
                          <Text className="guide-step highlight">
                            5. 添加服务器 IP：<Text className="ip-address">{wechatValidationResult.serverIp}</Text>
                          </Text>
                          <Text className="guide-step">6. 点击「确定」保存</Text>
                          <Text className="guide-note">配置完成后，再次点击「验证」按钮即可</Text>
                        </View>
                      )}

                      {/* 显示公众号详细信息 */}
                      {wechatValidationResult.valid && wechatValidationResult.accountInfo && (
                        <View className="wechat-account-info">
                          {wechatValidationResult.accountInfo.avatar_url && (
                            <View className="info-item">
                              <Text className="info-label">头像：</Text>
                              <Image
                                className="info-avatar"
                                src={wechatValidationResult.accountInfo.avatar_url}
                                mode="aspectFill"
                              />
                            </View>
                          )}
                          {wechatValidationResult.accountInfo.nickname && (
                            <View className="info-item">
                              <Text className="info-label">名称：</Text>
                              <Text className="info-value">{wechatValidationResult.accountInfo.nickname}</Text>
                            </View>
                          )}
                          {wechatValidationResult.accountInfo.signature && (
                            <View className="info-item">
                              <Text className="info-label">简介：</Text>
                              <Text className="info-value">{wechatValidationResult.accountInfo.signature}</Text>
                            </View>
                          )}
                          {wechatValidationResult.accountInfo.follower_count !== undefined && (
                            <View className="info-item">
                              <Text className="info-label">粉丝数：</Text>
                              <Text className="info-value highlight">
                                {wechatValidationResult.accountInfo.follower_count.toLocaleString()}
                                {wechatValidationResult.accountInfo.follower_note && ` (${wechatValidationResult.accountInfo.follower_note})`}
                              </Text>
                            </View>
                          )}
                          {wechatValidationResult.accountInfo.total_works !== undefined && (
                            <View className="info-item">
                              <Text className="info-label">作品数：</Text>
                              <Text className="info-value highlight">
                                {wechatValidationResult.accountInfo.total_works.toLocaleString()}
                                {wechatValidationResult.accountInfo.works_note && ` (${wechatValidationResult.accountInfo.works_note})`}
                              </Text>
                            </View>
                          )}
                          {/* 如果没有任何详细信息，显示提示 */}
                          {(!wechatValidationResult.accountInfo.avatar_url &&
                           !wechatValidationResult.accountInfo.nickname &&
                           !wechatValidationResult.accountInfo.signature &&
                           wechatValidationResult.accountInfo.follower_count === 0 &&
                           wechatValidationResult.accountInfo.total_works === 0) && (
                            <View className="info-item">
                              <Text className="info-value" style={{ color: '#6b7280' }}>
                                无法获取公众号详细信息，可能是权限不足或 API 限制。但不影响账号配置保存。
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  <View className="form-item">
                    <Text className="form-tip">提示：配置验证通过后才能保存账号信息</Text>
                  </View>
                </>
              )}
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
