/**
 * 测试社交数据生成脚本
 * 生成一些测试帖子和评论，用于测试自动评论、点赞等功能
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.COZE_SUPABASE_URL || 'https://br-valid-clam-7ee7b870.supabase2.aidap-global.cn-beijing.volces.com'
const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

const POST_COUNT = 30
const COMMENT_COUNT = 50

// 帖子内容模板
const POST_TEMPLATES = [
  { content: '今天天气真好呀！出门散个步，感受大自然的美好~', tags: ['日常', '生活', '好物推荐'] },
  { content: '新入手的护肤品超好用！皮肤变得滑滑嫩嫩的，推荐给各位小仙女们！', tags: ['美妆', '护肤', '种草'] },
  { content: '职场小白的第一年工作总结，有收获也有教训，分享给大家~', tags: ['职场', '成长', '分享'] },
  { content: '周末在家做了顿大餐，虽然卖相一般，但味道还不错！', tags: ['美食', '烹饪', '日常'] },
  { content: '最近在学习编程，虽然过程很艰辛，但成就感满满！', tags: ['学习', '编程', '成长'] },
  { content: '分享一个提高效率的小技巧，亲测有效！', tags: ['效率', '技巧', '工作'] },
  { content: '健身打卡第30天，马甲线终于若隐若现了！', tags: ['健身', '打卡', '健康'] },
  { content: '周末约上闺蜜喝个下午茶，聊聊最近的生活~', tags: ['闺蜜', '下午茶', '生活'] },
  { content: '推荐一本书《活着》，看完之后感触很深...', tags: ['读书', '推荐', '感悟'] },
  { content: '今天尝试了一个新发型，大家觉得怎么样？', tags: ['时尚', '发型', '分享'] },
]

// 评论内容模板
const COMMENT_TEMPLATES = [
  '写的真好！学到了很多~',
  '赞！这个观点很新颖',
  '同感！我也有类似的经历',
  '太棒了，支持你！',
  '收藏了，下次试试',
  '加油！你一定能成功的',
  '写得很有深度',
  '这个思路很清晰',
  '受益匪浅，谢谢分享',
  '说得太对了！',
  '我也遇到过这种情况',
  '太有才了，膜拜！',
  '这波操作太秀了',
  '稳，已关注',
  '终于有人说出我的心声了',
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

async function generateTestSocial() {
  console.log('开始生成测试社交数据...')
  
  // 获取所有用户和分身
  const { data: users } = await supabase.from('users').select('id').limit(100)
  const { data: avatars } = await supabase.from('avatars').select('id, user_id').limit(100)
  
  if (!users || users.length === 0) {
    console.error('未找到用户')
    return
  }
  
  let createdPosts = 0
  let createdComments = 0
  
  // 创建帖子
  console.log('创建测试帖子...')
  for (let i = 0; i < POST_COUNT; i++) {
    try {
      const user = randomChoice(users)
      const template = randomChoice(POST_TEMPLATES)
      const hasAvatar = avatars && Math.random() > 0.3
      const avatar = hasAvatar ? randomChoice(avatars) : null
      
      const { error } = await supabase
        .from('posts')
        .insert({
          id: generateId(),
          user_id: user.id,
          avatar_id: avatar?.id || null,
          content: template.content + ` #${i + 1}`,
          images: [],
          tags: template.tags,
          likes_count: randomInt(0, 100),
          comments_count: 0,
          shares_count: randomInt(0, 20),
          is_public: true,
        })
      
      if (error) {
        console.error(`创建帖子 ${i + 1} 失败:`, error.message)
        continue
      }
      
      createdPosts++
      
    } catch (err) {
      console.error(`处理帖子 ${i + 1} 时出错:`, err.message)
    }
  }
  
  console.log(`创建了 ${createdPosts} 个帖子`)
  
  // 创建评论
  console.log('创建测试评论...')
  const { data: posts } = await supabase.from('posts').select('id').limit(POST_COUNT)
  
  if (posts && posts.length > 0) {
    for (let i = 0; i < COMMENT_COUNT; i++) {
      try {
        const user = randomChoice(users)
        const post = randomChoice(posts)
        const hasAvatar = avatars && Math.random() > 0.3
        const avatar = hasAvatar ? randomChoice(avatars) : null
        
        const { error } = await supabase
          .from('comments')
          .insert({
            id: generateId(),
            post_id: post.id,
            user_id: user.id,
            avatar_id: avatar?.id || null,
            content: randomChoice(COMMENT_TEMPLATES),
            likes_count: randomInt(0, 30),
          })
        
        if (error) {
          console.error(`创建评论 ${i + 1} 失败:`, error.message)
          continue
        }
        
        createdComments++
        
      } catch (err) {
        console.error(`处理评论 ${i + 1} 时出错:`, err.message)
      }
    }
  }
  
  console.log(`创建了 ${createdComments} 个评论`)
  
  // 更新帖子的评论数
  console.log('更新帖子评论数...')
  await supabase.rpc('update_posts_comments_count', {})
  
  console.log('测试社交数据生成完成!')
}

generateTestSocial()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error('脚本执行失败:', err)
    process.exit(1)
  })
