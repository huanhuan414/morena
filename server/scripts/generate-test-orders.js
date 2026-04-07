/**
 * 测试订单生成脚本
 * 生成一些测试订单，用于测试订单分配算法
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.COZE_SUPABASE_URL || 'https://br-valid-clam-7ee7b870.supabase2.aidap-global.cn-beijing.volces.com'
const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

const ORDER_COUNT = 20

// 订单类型
const ORDER_TYPES = [
  { title: '小红书种草文案', desc: '需要撰写一篇小红书种草文案，风格活泼可爱，适合年轻女性用户', skills: ['写作', '营销', '时尚'] },
  { title: '抖音短视频脚本', desc: '需要撰写一个30秒抖音短视频脚本，包含开场、转折、高潮结尾', skills: ['视频制作', '写作', '娱乐'] },
  { title: '朋友圈营销文案', desc: '需要撰写一组朋友圈营销文案，共5条，配合产品图片发布', skills: ['营销', '写作'] },
  { title: '微信公众号推文', desc: '需要撰写一篇微信公众号推文，主题关于职场成长，字数1500字', skills: ['写作', '职场', '教育'] },
  { title: '微博话题营销', desc: '需要策划一个微博话题，配合海报和文案，预热期3天', skills: ['营销', '设计', '运营'] },
  { title: '产品介绍视频脚本', desc: '需要为某款智能手表撰写产品介绍视频脚本，时长2分钟', skills: ['视频制作', '写作', '科技'] },
  { title: '知乎回答', desc: '需要在知乎回答3个关于健身的问题，每个回答500字以上', skills: ['健身', '教育', '写作'] },
  { title: '电商详情页文案', desc: '需要为某款护肤品撰写电商详情页文案，突出产品卖点', skills: ['写作', '美妆', '营销'] },
  { title: '直播带货话术', desc: '需要撰写一场2小时直播的完整话术脚本，包含开场、互动、产品介绍、促单', skills: ['销售', '演讲', '营销'] },
  { title: '品牌故事文案', desc: '需要为一个新锐咖啡品牌撰写品牌故事，突出文艺氛围', skills: ['写作', '美食', '设计'] },
]

// 预算范围
const BUDGET_RANGES = [
  { min: 50, max: 200 },
  { min: 100, max: 500 },
  { min: 200, max: 1000 },
  { min: 500, max: 2000 },
  { min: 1000, max: 5000 },
]

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

async function generateTestOrders() {
  console.log('开始生成测试订单...')
  
  let createdOrders = 0
  
  // 获取所有用户
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .limit(100)
  
  if (!users || users.length === 0) {
    console.error('未找到用户')
    return
  }
  
  for (let i = 1; i <= ORDER_COUNT; i++) {
    try {
      const orderType = randomChoice(ORDER_TYPES)
      const budget = randomChoice(BUDGET_RANGES)
      const user = randomChoice(users)
      
      const { error } = await supabase
        .from('orders')
        .insert({
          id: generateId(),
          user_id: user.id,
          title: orderType.title + ` #${i}`,
          description: orderType.desc,
          requirements: {
            contentType: randomChoice(['图文', '视频', '纯文字', '海报']),
            platforms: randomChoice([['小红书'], ['抖音'], ['微信'], ['微博'], ['小红书', '微博'], ['全平台']]),
            targetAudience: randomChoice(['年轻女性', '职场白领', '大学生', '宝爸宝妈', '中老年']),
            expectedResults: randomChoice(['1000+曝光', '500+点赞', '100+评论', '50+转化']),
            deadline: new Date(Date.now() + randomInt(1, 7) * 24 * 60 * 60 * 1000).toISOString(),
            skills: orderType.skills,
          },
          budget: randomInt(budget.min, budget.max),
          status: 'pending',
        })
      
      if (error) {
        console.error(`创建订单 ${i} 失败:`, error.message)
        continue
      }
      
      createdOrders++
      
      if (i % 5 === 0) {
        console.log(`已创建 ${i} 个订单...`)
      }
      
    } catch (err) {
      console.error(`处理订单 ${i} 时出错:`, err.message)
    }
  }
  
  console.log(`测试订单生成完成! 共创建 ${createdOrders} 个订单`)
}

generateTestOrders()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error('脚本执行失败:', err)
    process.exit(1)
  })
