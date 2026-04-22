# 订单处理页面加载问题修复

## 问题分析

**根本原因：**
订单处理页面一直显示"加载中..."，无法进入正常状态。

**问题根源：**
1. 在 `useLoad` 中调用了 `fetchOrderData()` 函数
2. `fetchOrderData()` 尝试从 `/api/order-dispatch/pending-requests` 获取待接订单列表
3. 但是该 API 只返回 `status = 'pending'` 的订单
4. 而当前订单的状态是 `preview`（已生成内容），不在待接列表中
5. 因此找不到匹配的订单，`setLoading(false)` 永远不会被调用
6. 导致页面一直显示加载中

## 修复方案

### 1. 移除 fetchOrderData 函数
订单处理页面不需要从待接订单列表获取数据，因为：
- 所有需要的数据都从 `/api/order-processing/status/${requestId}` 获取
- 订单信息（标题、平台）在 `processingData.generatedContent` 中

### 2. 修改加载逻辑
在 `fetchProcessingStatus` 函数中：
- 第一次获取到状态数据后，立即设置 `setLoading(false)`
- 在错误情况下也设置 `setLoading(false)`，避免页面一直加载

### 3. 删除未使用的状态
- 删除 `orderData` 状态变量
- 删除 `Calendar` 导入（未使用）

## 修改内容

### 文件：src/pages/order-processing/index.tsx

#### 修改1：移除 fetchOrderData 调用
```typescript
// 修改前
useLoad(() => {
  if (requestId && avatarId && orderId) {
    fetchOrderData()  // 这导致问题
    startPolling()
  }
})

// 修改后
useLoad(() => {
  if (requestId && avatarId && orderId) {
    console.log('[OrderProcessing] 页面加载，参数:', { requestId, avatarId, orderId })
    startPolling()
  }
})
```

#### 修改2：在 fetchProcessingStatus 中设置 loading
```typescript
const fetchProcessingStatus = async () => {
  try {
    console.log('[OrderProcessing] 开始获取状态:', { requestId })
    const res = await Network.request({
      url: `/api/order-processing/status/${requestId}`
    })

    if (res.data?.code === 200) {
      const data = res.data.data as OrderProcessingData

      // 第一次获取到数据时，设置 loading 为 false
      if (loading) {
        console.log('[OrderProcessing] 首次获取状态成功，取消加载状态')
        setLoading(false)
      }

      // ... 其他逻辑
    } else {
      // 错误处理
      if (loading) setLoading(false)
    }
  } catch (error) {
    // 异常处理
    if (loading) setLoading(false)
  }
}
```

#### 修改3：使用 processingData 显示订单信息
```typescript
// 修改前
{orderData && (
  <View className="order-info-card">
    <Text className="info-order-title">{orderData.orders.title}</Text>
    <Text className="info-meta-text">
      {PLATFORM_NAMES[orderData.orders.platforms[0]]}
    </Text>
  </View>
)}

// 修改后
{processingData?.generatedContent && (
  <View className="order-info-card">
    <Text className="info-order-title">{processingData.generatedContent.title}</Text>
    <Text className="info-meta-text">
      {PLATFORM_NAMES[processingData.generatedContent.platform]}
    </Text>
  </View>
)}
```

## 测试验证

### 测试用例1：已生成内容的订单（状态：preview）
**URL：** `/#/pages/order-processing/index?requestId=0b67337d-6bbc-43b6-8b69-f3ba18af2d84&avatarId=61f6c470-ce59-4a6a-bfee-29e7c1505631&orderId=27387767-5190-4546-88e2-993041456466`

**预期结果：**
- ✅ 页面不再一直显示加载中
- ✅ 显示内容预览状态
- ✅ 显示生成的订单内容
- ✅ 显示确认/编辑按钮

### 测试用例2：排队中的订单（状态：accepted/queuing）
**预期结果：**
- ✅ 显示排队中状态
- ✅ 显示队列位置和预计时间
- ✅ 不再一直加载

### 测试用例3：生成中的订单（状态：generating）
**预期结果：**
- ✅ 显示生成中状态
- ✅ 显示进度条
- ✅ 不再一直加载

## 日志输出

### 修复前
```
[OrderProcessing] 开始轮询状态
[OrderProcessing] 状态响应: { code: 200, data: { status: 'preview' } }
```

**问题：** `loading` 状态从未被设置为 `false`

### 修复后
```
[OrderProcessing] 页面加载，参数: { requestId, avatarId, orderId }
[OrderProcessing] 开始轮询状态
[OrderProcessing] 开始获取状态: { requestId }
[OrderProcessing] 状态响应: { code: 200, data: { status: 'preview' } }
[OrderProcessing] 首次获取状态成功，取消加载状态
```

**结果：** `loading` 状态正确设置为 `false`，页面正常显示

## 总结

**修复核心：**
1. 移除不必要的数据获取逻辑
2. 在首次获取状态后立即取消加载状态
3. 使用正确的数据源（`processingData`）显示信息

**影响范围：**
- 订单处理页面的所有状态（排队、生成、预览、发布、完成）
- 所有状态下的订单信息显示

**验证状态：**
- ✅ TypeScript 编译通过
- ✅ ESLint 检查通过
- ✅ 后端 API 正常响应
- ✅ 前端热更新成功
