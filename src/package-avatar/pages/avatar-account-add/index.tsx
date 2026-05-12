/* eslint-disable no-undef */
// @ts-nocheck
import { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Picker, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Search, Loader, Save } from 'lucide-react-taro'
import * as Network from '@/network'
import './index.css'

const PLATFORMS = [
  { id: 'douyin', label: '抖音' },
  { id: 'wechat', label: '微信公众号' },
  { id: 'xiaohongshu', label: '小红书' },
]

const PLATFORM_INDEX = PLATFORMS.map(p => p.label)

export default function AvatarAccountAddPage() {
  const router = useRouter()
  const avatarId = router.params.avatarId
  const accountId = router.params.accountId

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

  useLoad((options) => {
    if (options.accountId) {
      // 编辑模式，加载账号信息
      loadAccountInfo(options.accountId as string)
    }
  })

  const loadAccountInfo = async (id: string) => {
    try {
      const res = await Network.request({
        url: `/api/avatar/accounts/${id}`
      })
      if (res.data?.code === 200) {
        const account = res.data.data
        setPlatformIndex(PLATFORMS.findIndex(p => p.id === account.platform) || 0)
        setAccountName(account.account_name || '')
        setAppid(account.appid || '')
        setAppkey(account.appkey || '')
        setXiaohongshuUrl(account.account_url || '')
      }
    } catch (error) {
      console.error('加载账号信息失败:', error)
    }
  }

  // 获取用户信息
  const fetchUserInfo = async () => {
    const platformId = PLATFORMS[platformIndex].id

    if (platformId === 'douyin') {
      // 抖音：根据抖音号获取用户信息
      if (!accountName.trim()) {
        showToast({ title: '请输入抖音号', icon: 'none' })
        return
      }

      setIsFetchingUserInfo(true)
      try {
        const res = await Network.request({
          url: '/api/tikhub/douyin/user',
          method: 'POST',
          data: { sec_user_id: accountName.trim() }
        })

        console.log('抖音用户信息响应:', res.data)

        if (res.data?.code === 200 && res.data.data) {
          const userData = res.data.data
          setFetchedUserInfo({
            nickname: userData.nickname,
            avatar_url: userData.avatar_url,
            signature: userData.signature,
            followers_count: userData.followers_count,
            following_count: userData.following_count,
            aweme_count: userData.aweme_count
          })
          showToast({ title: '获取成功', icon: 'success' })
        } else {
          showToast({ title: res.data?.message || '获取失败', icon: 'none' })
        }
      } catch (error) {
        console.error('获取抖音用户信息失败:', error)
        showToast({ title: '获取失败', icon: 'none' })
      } finally {
        setIsFetchingUserInfo(false)
      }

    } else if (platformId === 'xiaohongshu') {
      // 小红书：根据分享链接获取用户信息
      if (!xiaohongshuUrl.trim()) {
        showToast({ title: '请输入小红书主页链接', icon: 'none' })
        return
      }

      setIsFetchingUserInfo(true)
      try {
        const res = await Network.request({
          url: '/api/tikhub/xiaohongshu/user',
          method: 'POST',
          data: { share_url: xiaohongshuUrl.trim() }
        })

        console.log('小红书用户信息响应:', res.data)

        if (res.data?.code === 200 && res.data.data) {
          const userData = res.data.data
          setFetchedUserInfo({
            nickname: userData.nickname,
            avatar_url: userData.avatar_url,
            signature: userData.desc,
            followers_count: userData.followers,
            following_count: userData.follows,
            aweme_count: userData.notes
          })
          showToast({ title: '获取成功', icon: 'success' })
        } else {
          showToast({ title: res.data?.message || '获取失败', icon: 'none' })
        }
      } catch (error) {
        console.error('获取小红书用户信息失败:', error)
        showToast({ title: '获取失败', icon: 'none' })
      } finally {
        setIsFetchingUserInfo(false)
      }
    }
  }

  const onSave = async () => {
    const platformId = PLATFORMS[platformIndex].id

    // 基本验证
    if (!accountName.trim()) {
      showToast({ title: '请输入账号名称', icon: 'none' })
      return
    }

    // 根据平台进行额外验证
    if (platformId === 'wechat') {
      if (!appid.trim()) {
        showToast({ title: '请输入 AppID', icon: 'none' })
        return
      }
      if (!appkey.trim()) {
        showToast({ title: '请输入 AppKey', icon: 'none' })
        return
      }
    } else if (platformId === 'xiaohongshu') {
      if (!xiaohongshuUrl.trim()) {
        showToast({ title: '请输入小红书主页链接', icon: 'none' })
        return
      }
    }

    // 构建账号数据
    const accountData: any = {
      avatar_id: avatarId,
      platform: platformId,
      account_name: accountName.trim(),
      followers: fetchedUserInfo?.followers_count || 0,
      total_exposure: 0,
      total_works: fetchedUserInfo?.aweme_count || 0,
      avg_likes_per_work: 0,
      avg_comments_per_work: 0,
      avg_shares_per_work: 0
    }

    // 平台专用字段
    if (platformId === 'wechat') {
      accountData.appid = appid.trim()
      accountData.appkey = appkey.trim()
    } else if (platformId === 'xiaohongshu') {
      accountData.account_url = xiaohongshuUrl.trim()
    }

    try {
      const url = accountId ? `/api/avatar/accounts/${accountId}` : '/api/avatar/accounts'
      const method = accountId ? 'PUT' : 'POST'

      const res = await Network.request({
        url,
        method,
        data: accountData
      })

      if (res.data?.code === 200) {
        showToast({ title: accountId ? '更新成功' : '添加成功', icon: 'success' })
        setTimeout(() => {
          navigateBack()
        }, 1500)
      } else {
        showToast({ title: res.data?.message || '保存失败', icon: 'none' })
      }
    } catch (error) {
      console.error('保存账号失败:', error)
      showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const onPlatformChange = (e: any) => {
    setPlatformIndex(e.detail.value)
    // 清空用户信息
    setFetchedUserInfo(null)
  }

  return (
    <View className="page-container">
      {/* 头部 */}
      <View className="header">
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#333" />
        </View>
        <View className="header-title">
          <Text className="header-title-text">{accountId ? '编辑账号' : '添加账号'}</Text>
        </View>
        <View className="header-right"></View>
      </View>

      <ScrollView className="content" scrollY>
        {/* 平台选择 */}
        <View className="form-section">
          <Text className="section-label">平台选择</Text>
          <Picker
            mode="selector"
            range={PLATFORM_INDEX}
            value={platformIndex}
            onChange={onPlatformChange}
          >
            <View className="picker-box">
              <Text className="picker-text">{PLATFORMS[platformIndex].label}</Text>
              <View className="picker-arrow">›</View>
            </View>
          </Picker>
        </View>

        {/* 抖音账号信息 */}
        {PLATFORMS[platformIndex].id === 'douyin' && (
          <>
            <View className="form-section">
              <Text className="section-label">抖音号</Text>
              <View className="input-wrapper">
                <Input
                  className="form-input"
                  placeholder="请输入抖音号或sec_user_id"
                  value={accountName}
                  onInput={(e) => setAccountName(e.detail.value)}
                />
              </View>
              <Button className="fetch-btn" onClick={fetchUserInfo} disabled={isFetchingUserInfo}>
                {isFetchingUserInfo ? (
                  <Loader size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                <Text className="fetch-btn-text">获取用户信息</Text>
              </Button>
            </View>
          </>
        )}

        {/* 微信公众号信息 */}
        {PLATFORMS[platformIndex].id === 'wechat' && (
          <>
            <View className="form-section">
              <Text className="section-label">公众号名称</Text>
              <View className="input-wrapper">
                <Input
                  className="form-input"
                  placeholder="请输入公众号名称"
                  value={accountName}
                  onInput={(e) => setAccountName(e.detail.value)}
                />
              </View>
            </View>

            <View className="form-section">
              <Text className="section-label">AppID</Text>
              <View className="input-wrapper">
                <Input
                  className="form-input"
                  placeholder="请输入微信公众号 AppID"
                  value={appid}
                  onInput={(e) => setAppid(e.detail.value)}
                />
              </View>
            </View>

            <View className="form-section">
              <Text className="section-label">AppKey</Text>
              <View className="input-wrapper">
                <Input
                  className="form-input"
                  placeholder="请输入微信公众号 AppKey"
                  value={appkey}
                  onInput={(e) => setAppkey(e.detail.value)}
                />
              </View>
            </View>
          </>
        )}

        {/* 小红书账号信息 */}
        {PLATFORMS[platformIndex].id === 'xiaohongshu' && (
          <>
            <View className="form-section">
              <Text className="section-label">账号名称</Text>
              <View className="input-wrapper">
                <Input
                  className="form-input"
                  placeholder="请输入小红书账号名称"
                  value={accountName}
                  onInput={(e) => setAccountName(e.detail.value)}
                />
              </View>
            </View>

            <View className="form-section">
              <Text className="section-label">主页链接</Text>
              <View className="input-wrapper">
                <Input
                  className="form-input"
                  placeholder="请输入小红书个人主页分享的链接"
                  value={xiaohongshuUrl}
                  onInput={(e) => setXiaohongshuUrl(e.detail.value)}
                />
              </View>
              <Button className="fetch-btn" onClick={fetchUserInfo} disabled={isFetchingUserInfo}>
                {isFetchingUserInfo ? (
                  <Loader size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                <Text className="fetch-btn-text">获取用户信息</Text>
              </Button>
            </View>
          </>
        )}

        {/* 用户信息展示 */}
        {fetchedUserInfo && (
          <View className="user-info-card">
            <View className="user-info-header">
              <Image
                src={fetchedUserInfo.avatar_url}
                className="user-avatar"
                mode="aspectFill"
              />
              <View className="user-info-content">
                <Text className="user-nickname">{fetchedUserInfo.nickname}</Text>
                <Text className="user-signature">{fetchedUserInfo.signature}</Text>
              </View>
            </View>
            <View className="user-stats">
              <View className="stat-item">
                <Text className="stat-value">{fetchedUserInfo.followers_count?.toLocaleString() || 0}</Text>
                <Text className="stat-label">粉丝</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-value">{fetchedUserInfo.following_count?.toLocaleString() || 0}</Text>
                <Text className="stat-label">关注</Text>
              </View>
              <View className="stat-item">
                <Text className="stat-value">{fetchedUserInfo.aweme_count?.toLocaleString() || 0}</Text>
                <Text className="stat-label">作品</Text>
              </View>
            </View>
          </View>
        )}

        {/* 保存按钮 */}
        <View className="save-section">
          <Button className="save-btn" onClick={onSave}>
            <Save size={18} />
            <Text className="save-btn-text">保存</Text>
          </Button>
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
