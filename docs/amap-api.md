# 高德地图API配置说明

## 概述

本项目集成了高德地图逆地理编码服务，支持将经纬度转换为详细的地理位置信息。系统配置了两个API Key，分别用于不同平台。

## API Key配置

### 1. Web服务Key（后端使用）
- **Key**: `5f5b139f9cce3da88b6813304541b47d`
- **用途**: 后端服务器调用高德API
- **服务类型**: Web服务
- **使用位置**: `server/src/services/reverse-geocoding.service.ts`

### 2. 微信小程序Key（前端使用）
- **Key**: `a2fd21655a31c73e42294c459123adf5`
- **用途**: 微信小程序端直接调用高德API
- **服务类型**: 微信小程序
- **使用位置**: `src/utils/amap.ts`

## 使用场景

### 场景1：后端调用（默认）

当前架构采用后端调用模式，所有地理位置逆地理编码逻辑都在后端完成：

```typescript
// 前端只传递经纬度
const locationData = {
  latitude: 26.414801,
  longitude: 106.641697
}

// 后端自动调用高德API，返回详细地址
const res = await Network.request({
  url: `/api/avatar/${avatarId}`,
  method: 'PUT',
  data: locationData
})

// 后端返回：中国贵州省贵阳市花溪区贵筑街道甲秀南路
```

**优势**：
- ✅ 前端代码简洁，无需处理复杂逻辑
- ✅ 后端统一管理API Key，更安全
- ✅ 支持降级方案，服务更稳定

### 场景2：前端直接调用（可选）

如果需要在微信小程序端直接调用高德API（需在`app.json`中配置域名白名单）：

```typescript
import { reverseGeocodeFromMiniProgram } from '@/utils/amap'

try {
  const result = await reverseGeocodeFromMiniProgram(26.414801, 106.641697)
  console.log('详细地址:', result.formattedAddress)
  console.log('POI:', result.pois)
} catch (error) {
  console.error('获取地址失败:', error)
}
```

**注意**：
- ⚠️ 需要在微信小程序后台配置`https://restapi.amap.com`为合法域名
- ⚠️ 需要在`app.json`中添加域名白名单配置

## 返回数据格式

### 标准返回
```typescript
{
  formatted_address: "中国贵州省贵阳市花溪区贵筑街道甲秀南路",
  full_location_text: "贵州省贵阳市花溪区贵筑街道花燕路",
  country: "中国",
  province: "贵州省",
  city: "贵阳市",
  district: "花溪区",
  street: "甲秀南路",
  adcode: "520111",
  pois: [
    { name: "花溪区政府", address: "花燕路", distance: "100" },
    { name: "花溪公园", address: "花溪大道", distance: "300" },
    // ... 更多POI（最多30个）
  ]
}
```

### 降级返回（API不可用时）
```typescript
{
  formatted_address: "中国 贵州省 贵阳市",
  full_location_text: "中国 贵州省 贵阳市",
  country: "中国",
  province: "贵州省",
  city: "贵阳市",
  district: "",
  street: ""
}
```

## 降级策略

当高德API不可用时，系统会自动降级为本地坐标范围判断，支持以下20个城市：

北京市、上海市、广州市、深圳市、成都市、杭州市、武汉市、西安市、重庆市、南京市、天津市、苏州市、长沙市、郑州市、贵阳市、昆明市、沈阳市、青岛市、大连市、厦门市

## 测试接口

### 后端测试
```bash
curl "http://localhost:3000/api/avatar/test-reverse-geocoding?lat=26.414801&lon=106.641697"
```

### 前端测试
在微信小程序中调用：
```typescript
import { reverseGeocodeFromMiniProgram } from '@/utils/amap'

const result = await reverseGeocodeFromMiniProgram(26.414801, 106.641697)
```

## 高德API官方文档

- Web服务API：https://lbs.amap.com/api/webservice/summary
- 微信小程序SDK：https://lbs.amap.com/api/wx/summary
- 逆地理编码API：https://lbs.amap.com/api/webservice/guide/api/georegeo

## 注意事项

1. **API Key安全**
   - Web服务Key仅在服务器端使用，不要暴露给前端
   - 小程序Key仅用于小程序端，不要用于其他平台

2. **域名白名单**
   - 如果小程序端直接调用，需在微信小程序后台配置域名白名单
   - 域名：`https://restapi.amap.com`

3. **调用频率限制**
   - 高德API有每日调用次数限制，请合理使用
   - 建议在服务端缓存地址信息，减少重复调用

4. **坐标系说明**
   - 小程序获取的经纬度是WGS84坐标系
   - 高德地图使用GCJ02坐标系（火星坐标系）
   - 当前代码直接使用WGS84坐标调用，会有少量偏移但可接受
   - 如需更高精度，可先进行坐标转换

## 故障排查

### 问题1：USERKEY_PLAT_NOMATCH
**原因**：API Key的平台类型不匹配
**解决**：检查使用的Key类型是否正确（Web服务使用Web服务Key）

### 问题2：API返回错误
**原因**：网络问题或API Key配置错误
**解决**：检查API Key是否正确，网络是否正常，系统会自动降级

### 问题3：小程序端调用失败
**原因**：域名未在白名单中
**解决**：在微信小程序后台添加`https://restapi.amap.com`到域名白名单

## 更新日志

- 2026-04-09: 集成高德地图API，支持详细的地址逆地理编码
- 2026-04-09: 配置Web服务Key和小程序Key，双平台兼容
- 2026-04-09: 实现降级策略，支持20个主要城市
