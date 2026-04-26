# 数据清理说明

## 已清理的测试数据

### 后端服务 (server/src/modules/admin/admin.service.ts)

| 模块 | 清理前 | 清理后 |
|------|--------|--------|
| **技能管理** | 使用内存 Map 存储 | 改为 Supabase 数据库存储 |
| **内容管理** | 使用内存 Map 存储 | 改为 Supabase 数据库存储 |
| **财务管理** | 返回固定 0 值 | 改为数据库实时统计 |
| **推广管理** | 返回空数组 | 改为数据库查询 |

### 具体变更

#### 1. 技能管理
```typescript
// 清理前
private skills: Map<string, any> = new Map()  // 内存存储

// 清理后  
从 supabase.from('skills') 查询  // 数据库存储
```

#### 2. 内容管理（帖子审核）
```typescript
// 清理前
private posts: Map<string, any> = new Map()  // 内存存储

// 清理后
从 supabase.from('posts') 查询  // 数据库存储
```

#### 3. 财务管理
```typescript
// 清理前
return {
  totalRecharge: 0,    // 固定值
  totalWithdraw: 0,    // 固定值
  totalCommission: 0,  // 固定值
  balance: 0,
  pendingWithdraw: 0
}

// 清理后
实时统计 transactions 和 earnings 表数据
```

#### 4. 推广管理
```typescript
// 清理前
return []  // 空数组

// 清理后
从 supabase.from('referrals') 查询
```

#### 5. 交易记录
```typescript
// 清理前
private transactions: any[] = []  // 空数组

// 清理后
从 supabase.from('transactions') 查询
```

---

## 需要创建的数据库表

为了使用清理后的功能，需要在 Supabase 中创建以下表：

### 1. skills 表（技能）
```sql
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT '🔧',
    category VARCHAR(50) DEFAULT 'general',
    price DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    order_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. posts 表（帖子）
```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    content TEXT,
    images TEXT[],
    status VARCHAR(20) DEFAULT 'pending',  -- pending/approved/rejected
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. referrals 表（推广）
```sql
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    code VARCHAR(50) UNIQUE,
    referred_count INTEGER DEFAULT 0,
    commission_earned DECIMAL(10,2) DEFAULT 0,
    commission_paid DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. settings 表（系统设置）
```sql
CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 插入默认分佣比例
INSERT INTO settings (key, value) VALUES ('commission_rate', '10');
```

### 5. transactions 表（交易记录）
```sql
-- 确保已有 transactions 表
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50),  -- recharge/withdraw/commission/order
    amount DECIMAL(10,2),
    status VARCHAR(20),  -- pending/completed/rejected
    description TEXT,
    reject_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 验证结果

- ✅ 前端 TypeScript 检查通过
- ✅ 前端 ESLint 检查通过
- ✅ 后端 NestJS 构建成功

---

## 注意事项

1. **数据库表需自行创建** - 上述SQL需在Supabase中执行
2. **现有数据** - 用户、分身、订单等核心数据仍从数据库读取，未受影响
3. **新功能** - 技能管理、内容审核、财务管理等功能现在需要数据库支持
