/**
 * 测试数据生成脚本
 * 生成100个测试账号，每个账号下创建一个分身，并开启托管功能
 * 
 * 使用方法: node scripts/generate-test-data.js
 */

// 从环境变量获取 Supabase 配置
const supabaseUrl = process.env.COZE_SUPABASE_URL || 'https://br-valid-clam-7ee7b870.supabase2.aidap-global.cn-beijing.volces.com'
const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY || ''

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(supabaseUrl, supabaseKey)

// 测试数据配置
const AVATAR_COUNT = 100

// 头像URL列表（使用公开可用的头像图片）
const AVATAR_URLS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=3',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=4',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=5',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=6',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=7',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=8',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=9',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=10',
]

// 分身名字前缀
const NAME_PREFIXES = [
  '小', '萌', '酷', '帅', '智', '慧', '星', '月', '阳光', '清风',
  '晨', '夜', '云', '雨', '风', '雷', '电', '火', '水', '土',
  '梦', '幻', '灵', '仙', '魔', '龙', '凤', '麒麟', '白虎', '玄武'
]

// 分身名字后缀
const NAME_SUFFIXES = [
  'AI', '助手', '伙伴', '精灵', '守护者', '小天使', '小恶魔', '小仙',
  '同学', '老师', '达人', '专家', '达人', '酱', '仔', '哥', '姐', '妹', '宝'
]

// 个性类型
const PERSONALITIES = [
  '阳光活力型', '沉稳内敛型', '创意艺术型', '专业精英型', '温暖治愈型',
  '幽默风趣型', '理性分析型', '感性表达型', '活力四射型', '低调奢华型'
]

// 技能列表
const SKILLS_POOL = [
  '写作', '绘画', '摄影', '视频制作', '音乐', '舞蹈', '编程', '设计',
  '营销', '运营', '产品', '数据分析', '客服', '销售', '教育', '咨询',
  '健身', '美食', '旅行', '时尚', '美妆', '科技', '财经', '娱乐',
  '体育', '游戏', '动漫', '读书', '写作', '演讲', '翻译', '主持'
]

// 生成随机分数
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 生成随机ID
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// 生成随机邀请码
function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// 随机选择数组元素
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// 随机选择多个不重复的元素
function randomChoices(arr, count) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

// 生成随机手机号
function generatePhoneNumber() {
  const prefixes = ['130', '131', '132', '133', '134', '135', '136', '137', '138', '139',
    '150', '151', '152', '153', '155', '156', '157', '158', '159',
    '170', '171', '172', '173', '175', '176', '177', '178',
    '180', '181', '182', '183', '184', '185', '186', '187', '188', '189']
  const prefix = randomChoice(prefixes)
  const suffix = String(Math.floor(Math.random() * 100000000)).padStart(8, '0')
  return prefix + suffix
}

// 生成分身名
function generateAvatarName(index) {
  const prefix = randomChoice(NAME_PREFIXES)
  const suffix = randomChoice(NAME_SUFFIXES)
  return `${prefix}${suffix}${String(index).padStart(3, '0')}`
}

// 生成用户昵称
function generateNickname(index) {
  const adjectives = ['快乐', '聪明', '可爱', '活泼', '勇敢', '温柔', '帅气', '美丽', '热情', '冷静']
  const nouns = ['用户', '玩家', '达人', '伙伴', '朋友', '粉丝', '会员', '游客', '新手', '专家']
  return `${randomChoice(adjectives)}${randomChoice(nouns)}${String(index).padStart(3, '0')}`
}

async function generateTestData() {
  console.log('='.repeat(60))
  console.log('开始生成测试数据...')
  console.log('='.repeat(60))
  
  const startTime = Date.now()
  
  // 检查是否已连接 Supabase
  if (!supabaseKey) {
    console.error('错误: 未设置 SUPABASE_SERVICE_ROLE_KEY 或 SUPABASE_ANON_KEY 环境变量')
    console.log('请设置环境变量后重试')
    return
  }
  
  let createdUsers = 0
  let createdAvatars = 0
  let enabledHosting = 0
  let errors = 0
  
  // 存储已生成的手机号，避免重复
  const usedPhones = new Set()
  
  for (let i = 1; i <= AVATAR_COUNT; i++) {
    try {
      // 生成唯一手机号
      let phone
      do {
        phone = generatePhoneNumber()
      } while (usedPhones.has(phone))
      usedPhones.add(phone)
      
      // 生成用户ID
      const userId = generateId()
      
      // 1. 创建用户
      const nickname = generateNickname(i)
      const userReferralCode = generateReferralCode()
      
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          openid: `test_${phone}`,
          nickname: nickname,
          avatar: randomChoice(AVATAR_URLS),
          phone: phone,
          bio: `这是测试用户 ${nickname} 的简介`,
          level: randomInt(1, 10),
          exp: randomInt(0, 1000),
          credits: randomInt(0, 500),
          referral_code: userReferralCode,
          balance: randomInt(0, 1000),
          total_earnings: randomInt(0, 5000),
        })
      
      if (userError) {
        console.error(`创建用户 ${i} 失败:`, userError.message)
        errors++
        continue
      }
      createdUsers++
      
      // 2. 为用户创建分身
      const avatarName = generateAvatarName(i)
      const personality = randomChoice(PERSONALITIES)
      const avatarSkills = randomChoices(SKILLS_POOL, randomInt(3, 6))
      const level = randomInt(1, 20)
      
      // 托管配置
      const hostingSettings = {
        auto_post: Math.random() > 0.2,  // 80%概率开启自动发帖
        auto_comment: Math.random() > 0.1,  // 90%概率开启自动评论
        auto_like: Math.random() > 0.1,  // 90%概率开启自动点赞
        auto_friend: Math.random() > 0.15,  // 85%概率开启自动交友
        post_frequency: randomChoice(['low', 'medium', 'high']),
        active_hours: ['08:00-12:00', '14:00-18:00', '20:00-22:00'],
      }
      
      const avatarConfig = {
        style: randomChoice(['tech', 'art', 'business', 'lifestyle']),
        temperament: personality,
        communicationStyle: randomChoice(['direct', 'gentle', 'humorous', 'professional']),
        strengths: avatarSkills,
        hosting_settings: hostingSettings,
        night_mode: true,
      }
      
      const { error: avatarError } = await supabase
        .from('avatars')
        .insert({
          id: generateId(),
          user_id: userId,
          name: avatarName,
          description: `气质类型：${personality} | 擅长：${avatarSkills.join('、')}`,
          avatar_url: randomChoice(AVATAR_URLS),
          personality: personality,
          skills: avatarSkills,
          config: avatarConfig,
          level: level,
          exp: randomInt(0, level * 100),
          status: 'active',
          is_hosted: true,  // 默认开启托管
          completion_rate: String(randomInt(70, 100)),
          total_orders: randomInt(0, 50),
          completed_orders: randomInt(0, 30),
        })
      
      if (avatarError) {
        console.error(`创建分身 ${i} 失败:`, avatarError.message)
        errors++
        continue
      }
      createdAvatars++
      enabledHosting++
      
      // 进度输出
      if (i % 10 === 0 || i === AVATAR_COUNT) {
        const progress = ((i / AVATAR_COUNT) * 100).toFixed(1)
        console.log(`进度: ${i}/${AVATAR_COUNT} (${progress}%) - 已创建 ${createdUsers} 用户, ${createdAvatars} 分身, ${enabledHosting} 托管`)
      }
      
    } catch (err) {
      console.error(`处理第 ${i} 条数据时出错:`, err.message)
      errors++
    }
    
    // 添加小延迟避免请求过快
    if (i % 20 === 0) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000).toFixed(2)
  
  console.log('='.repeat(60))
  console.log('测试数据生成完成!')
  console.log('='.repeat(60))
  console.log(`总耗时: ${duration} 秒`)
  console.log(`创建用户: ${createdUsers}`)
  console.log(`创建分身: ${createdAvatars}`)
  console.log(`开启托管: ${enabledHosting}`)
  console.log(`错误数: ${errors}`)
  console.log('='.repeat(60))
}

// 执行生成
generateTestData()
  .then(() => {
    console.log('脚本执行成功')
    process.exit(0)
  })
  .catch(err => {
    console.error('脚本执行失败:', err)
    process.exit(1)
  })
