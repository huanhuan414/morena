import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Network } from '@/network'
import { ArrowLeft, Coins, Check } from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

interface Package {
  id: string
  name: string
  coins: number
  price: number
  bonus: number
  is_active: number
  sort_order: number
}

export default function RechargePage() {
  const statusBarHeight = getStatusBarHeight()
  const [packages, setPackages] = useState<Package[]>([])
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useDidShow(() => {
    loadData()
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const userInfo = Taro.getStorageSync('userInfo')
      const userId = userInfo?.id
      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const [packagesRes, balanceRes] = await Promise.all([
        Network.request({ url: '/api/coin/recharge-packages' }),
        Network.request({ url: `/api/coin/balance?userId=${userId}` })
      ])

      const packagesData = packagesRes.data?.code === 200 ? packagesRes.data.data : []
      setPackages(packagesData || [])

      const balanceData = balanceRes.data?.code === 200 ? balanceRes.data.data : {}
      setBalance(balanceData.balance || 0)

      if (packagesData?.length > 0 && !selectedPackage) {
        setSelectedPackage(packagesData[0].id)
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRecharge = async () => {
    if (!selectedPackage) {
      Taro.showToast({ title: '请选择充值套餐', icon: 'none' })
      return
    }

    try {
      setSubmitting(true)
      const userInfo = Taro.getStorageSync('userInfo')
      const userId = userInfo?.id

      if (!userId) {
        Taro.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      const { code } = await Taro.login()
      const openidRes = await Network.request({
        url: '/api/auth/wechat/get-openid',
        method: 'POST',
        data: { code }
      })

      const openid = openidRes.data?.data?.openid
      if (!openid) {
        Taro.showToast({ title: '获取用户信息失败', icon: 'none' })
        return
      }

      const res = await Network.request({
        url: '/api/payment/coin/recharge',
        method: 'POST',
        data: { userId, openid, packageId: selectedPackage }
      })

      if (res.data?.code === 200) {
        const payParams = res.data.data
        const requestPayParams = {
          timeStamp: String(payParams.timeStamp),
          nonceStr: String(payParams.nonceStr),
          package: payParams.packageValue || `prepay_id=${payParams.prepayId}`,
          signType: (payParams.signType || 'MD5') as 'MD5' | 'RSA',
          paySign: String(payParams.paySign),
        }

        try {
          await Taro.requestPayment(requestPayParams)
          Taro.showToast({ title: `充值成功，获得${payParams.totalCoins}币`, icon: 'success' })
          setTimeout(() => {
            Taro.navigateBack()
          }, 1500)
        } catch (payErr: any) {
          if (payErr?.errMsg?.includes('cancel')) {
            Taro.showToast({ title: '支付已取消', icon: 'none' })
          } else {
            Taro.showToast({ title: '支付失败，请重试', icon: 'none', duration: 3000 })
          }
        }
      } else {
        Taro.showToast({ title: res.data?.msg || res.data?.message || '创建订单失败', icon: 'none' })
      }
    } catch (error: any) {
      console.error('充值失败:', error)
      Taro.showToast({ title: error.message || '充值失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPkg = packages.find(p => p.id === selectedPackage)

  return (
    <View className="recharge-page">
      <View className="recharge-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="recharge-header-bg" />
        <View className="recharge-deco-circle recharge-deco-1" />
        <View className="recharge-deco-circle recharge-deco-2" />
        <View className="recharge-header-content">
          <View className="recharge-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="recharge-header-title">充值</Text>
          <View className="recharge-header-right" />
        </View>
      </View>

      <ScrollView className="recharge-body" scrollY>
        <View className="recharge-balance-section">
          <View className="recharge-balance-icon">
            <Coins size={28} color="#F59E0B" />
          </View>
          <View className="recharge-balance-info">
            <Text className="recharge-balance-label">当前余额</Text>
            <Text className="recharge-balance-value">{balance.toLocaleString()} 币</Text>
          </View>
        </View>

        <View className="recharge-packages-section">
          <View className="recharge-section-header">
            <View className="recharge-title-dot" />
            <Text className="recharge-section-title">选择充值套餐</Text>
          </View>
          <View className="recharge-packages-grid">
            {packages.map((pkg) => {
              const totalCoins = pkg.coins + pkg.bonus
              const isSelected = selectedPackage === pkg.id
              const hasBonus = pkg.bonus > 0

              return (
                <View
                  key={pkg.id}
                  className={`recharge-package-item ${isSelected ? 'selected' : ''} ${hasBonus ? 'hasbonus' : ''}`}
                  onClick={() => setSelectedPackage(pkg.id)}
                >
                  {hasBonus && (
                    <View className="recharge-package-badge">
                      <Text className="recharge-package-badge-text">送{pkg.bonus}币</Text>
                    </View>
                  )}
                  <View className="recharge-package-coins">
                    <Text className="recharge-package-coins-value">{totalCoins}</Text>
                    <Text className="recharge-package-coins-unit">币</Text>
                  </View>
                  <View className="recharge-package-price">
                    <Text className="recharge-package-price-symbol">¥</Text>
                    <Text className="recharge-package-price-value">{pkg.price}</Text>
                  </View>
                  {isSelected && (
                    <View className="recharge-package-check">
                      <Check size={14} color="#fff" />
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </View>

        {selectedPkg && (
          <View className="recharge-summary-section">
            <View className="recharge-summary-row">
              <Text className="recharge-summary-label">充值数量</Text>
              <Text className="recharge-summary-value">{selectedPkg.coins} 币</Text>
            </View>
            {selectedPkg.bonus > 0 && (
              <View className="recharge-summary-row bonus">
                <Text className="recharge-summary-label">赠送数量</Text>
                <Text className="recharge-summary-value">+{selectedPkg.bonus} 币</Text>
              </View>
            )}
            <View className="recharge-summary-row total">
              <Text className="recharge-summary-label">合计获得</Text>
              <Text className="recharge-summary-value">{selectedPkg.coins + selectedPkg.bonus} 币</Text>
            </View>
          </View>
        )}

        <View className="recharge-submit-btn" onClick={handleRecharge}>
          <Text className="recharge-submit-btn-text">
            {submitting ? '处理中...' : selectedPkg ? `支付 ¥${selectedPkg.price}` : '请选择套餐'}
          </Text>
        </View>

        <View className="recharge-tips-section">
          <View className="recharge-tips-header">
            <View className="recharge-title-dot" />
            <Text className="recharge-tips-title">温馨提示</Text>
          </View>
          <View className="recharge-tips-list">
            <Text className="recharge-tips-item">• 充值成功后立即到账</Text>
            <Text className="recharge-tips-item">• 充值金额不支持退款</Text>
            <Text className="recharge-tips-item">• 如有问题请联系客服</Text>
          </View>
        </View>

        <View className="recharge-bottom-placeholder" />
      </ScrollView>
    </View>
  )
}
