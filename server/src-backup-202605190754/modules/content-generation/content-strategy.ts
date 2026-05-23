/**
 * Content Strategy Engine — 内容策略引擎
 * 
 * 从高级架构师 + 爆款内容运营总监视角设计
 * 核心理念：不同技能 × 不同平台 × 不同订单 = 不同的内容策略
 * 
 * 三个维度：
 * 1. 技能维度：每个技能有专属的内容生成模板和策略
 * 2. 平台维度：每个平台有爆款规则、算法偏好、互动机制
 * 3. 质量维度：生成后自检，低于阈值自动重试
 */

// ============================================================
// 一、技能专属内容策略
// ============================================================

export interface SkillStrategy {
  /** 技能ID */
  skillId: string
  /** 技能名称 */
  skillName: string
  /** 该技能适用的内容类型 */
  contentTypes: string[]
  /** 该技能的核心能力描述（注入到LLM提示词） */
  coreCapability: string
  /** 该技能的内容生成策略（注入到LLM提示词） */
  generationStrategy: string
  /** 该技能特有的内容结构模板 */
  contentTemplate: string
  /** 该技能的爆款要素 */
  viralElements: string[]
  /** 该技能的配图策略 */
  imageStrategy: string
  /** 该技能的视频策略（如果有） */
  videoStrategy?: string
}

export const SKILL_STRATEGIES: Record<string, SkillStrategy> = {
  'skill_001': {
    skillId: 'skill_001',
    skillName: '图文爆款生成',
    contentTypes: ['image_text', 'text', 'image'],
    coreCapability: '你是顶级新媒体爆款写手，精通各平台的内容算法和用户心理，擅长制造情绪共鸣和传播裂变',
    generationStrategy: `【图文爆款核心策略】
1. 标题即流量：用数字+痛点+悬念制造点击欲，如"3个被忽视的XX真相，第2个扎心了"
2. 开头3秒定生死：第一句话必须直击痛点或制造强烈好奇
3. 内容节奏：每2-3行一个小刺激点（金句/数据/反转/共鸣），避免平铺直叙
4. 情绪曲线：好奇→共鸣→惊喜→行动，像坐过山车一样带读者走
5. 互动钩子：自然嵌入"你觉得呢？""评论区告诉我""收藏慢慢看"等互动引导
6. 收藏价值：至少包含1个实用清单/对比表/步骤总结，让读者想收藏
7. 转发诱因：加入"帮XX看看""发给需要的人"等社交货币`,
    contentTemplate: `【标题】数字+痛点/悬念型标题
【开头】3秒hook：直击痛点/制造悬念/抛出反常识
【核心内容】
  要点1：数据/案例引入 → 展开 → 小结
  要点2：情感共鸣 → 场景代入 → 金句收尾
  要点3：实用干货 → 步骤/清单 → 行动指引
【互动引导】提问/投票/评论区话题
【标签】3-5个精准话题标签`,
    viralElements: ['情绪共鸣', '实用收藏价值', '社交货币', '争议性观点', '反常识信息'],
    imageStrategy: '生成3-6张高质量配图：第1张封面图要视觉冲击力强（大字报/对比图/场景图），后续配图围绕内容要点，每张图要有信息量不是纯装饰',
  },

  'skill_002': {
    skillId: 'skill_002',
    skillName: '图片生成',
    contentTypes: ['image'],
    coreCapability: '你是顶级视觉设计师和AI绘图专家，擅长创作具有极强视觉冲击力和传播力的图片内容',
    generationStrategy: `【图片爆款核心策略】
1. 视觉优先：图片本身就是内容主体，不是文字的配角
2. 第一张图定调：封面图/首图必须3秒内抓住眼球（对比/冲突/惊艳/好奇）
3. 信息密度：每张图都要有信息量，纯装饰图浪费传播机会
4. 品牌植入自然：产品/品牌元素要融入场景，不是硬贴logo
5. 尺寸适配：不同平台不同比例（小红书3:4/抖音9:16/微博16:9）
6. 系列感：多张图之间要有视觉连贯性，形成系列感增加收藏`,
    contentTemplate: `【封面图】视觉冲击力最强的主图
  - 大字报/对比图/场景代入图/惊艳效果图
【内容图2-3】展开核心卖点
  - 细节展示/使用场景/效果对比
【结尾图】行动引导
  - 总结/优惠信息/关注引导`,
    viralElements: ['视觉冲击力', '对比效果', '创意构图', '情绪画面', '审美价值'],
    imageStrategy: '生成4-9张精品图片：封面图要极致冲击力，内容图围绕产品/服务核心卖点，每张图构图精美色彩和谐，整体有系列感。优先考虑该平台的最佳图片比例',
  },

  'skill_003': {
    skillId: 'skill_003',
    skillName: '视频生成',
    contentTypes: ['video'],
    coreCapability: '你是顶级短视频导演和脚本写手，深谙各视频平台的算法机制和用户停留逻辑',
    generationStrategy: `【视频爆款核心策略】
1. 前3秒是生死线：开场必须强hook（悬念/冲突/惊喜/反转/痛点）
2. 节奏要快：每3-5秒一个小刺激点，防止划走
3. 口播+画面双驱动：文案要口语化，画面要配合文案节奏
4. 情绪递进：开头好奇→中间共鸣/惊喜→结尾行动
5. 引导完播：信息在最后揭晓/彩蛋，提高完播率
6. 评论诱饵：故意留悬念/争议点，引导评论区讨论
7. 二次传播：加入"转发给XX看"的社交货币`,
    contentTemplate: `【3秒Hook】制造强悬念/痛点/反常识
  "你绝对不知道的XX"/"99%的人都做错了"
【5秒引入】快速建立场景/问题
  展示痛点场景，让观众代入
【主体内容】核心价值输出
  要点1+画面切换 → 要点2+画面切换 → 要点3+画面切换
  节奏：每3-5秒一个信息点，画面不断变化
【结尾CTA】互动+关注引导
  "你觉得呢？评论区见"/"关注我了解更多"`,
    viralElements: ['前3秒hook', '节奏感', '情绪递进', '完播率', '评论区诱饵', '社交货币'],
    imageStrategy: '生成视频封面图（thumbmail）：极致视觉冲击+大字标题，让人忍不住点进来',
    videoStrategy: '先生成视频脚本（含分镜描述），再根据分镜逐段生成视频素材',
  },

  'skill_004': {
    skillId: 'skill_004',
    skillName: '看手相',
    contentTypes: ['image_text', 'image'],
    coreCapability: '你是神秘的AI手相大师，融合传统手相学与现代心理学，用趣味解读吸引用户互动和分享',
    generationStrategy: `【看手相爆款核心策略】
1. 神秘感+趣味性：不是严肃算命，是"有趣的手相解读"，避免封建迷信
2. 互动钩子：引导用户"伸出手看看""评论区晒手相"等参与行为
3. 正向解读：所有解读都偏向积极正面，让人看了开心想分享
4. 个性化体验：让每个人觉得"说的就是我"，巴纳姆效应
5. 社交货币：设计"测一测你的XX手相""转发给好友看看"等传播机制
6. 品牌植入：可以"手相看XX运（财运/桃花/事业）"自然关联品牌
7. 系列内容：可以做成系列"手相看财运""手相看爱情"增加回访`,
    contentTemplate: `【标题】"手相看XX！你的手掌藏着这个秘密..."
【开场】制造神秘感："你知道吗？手掌的纹路藏着人生的密码"
【互动引导】"伸出手看看你的XX线/XX丘"
【解读内容】
  1. 教用户看自己的手相特征（增加互动和参与感）
  2. 给出有趣的解读（积极正面，让人开心）
  3. 关联品牌/产品（如"手相说你近期财运旺，正好XX产品帮你旺上加旺"）
【社交引导】"转发给好友也测测""评论区晒手相看解读"`,
    viralElements: ['神秘感', '互动参与', '巴纳姆效应', '正向情绪', '社交分享', '趣味性'],
    imageStrategy: '生成手相相关的精美配图：手相图解、手部特写、命运线纹路示意、神秘感氛围图。风格偏神秘优雅，深色背景+金色线条',
  },

  'skill_005': {
    skillId: 'skill_005',
    skillName: '衣品改造',
    contentTypes: ['image_text', 'image'],
    coreCapability: '你是顶级时尚造型师和穿搭博主，擅长用对比改造的方式展示穿搭蜕变，制造视觉冲击',
    generationStrategy: `【衣品改造爆款核心策略】
1. Before/After对比：这是最强的视觉冲击方式，改造前后的对比图天然吸引眼球
2. 场景代入："微胖女生""小个子""上班族"等精准人群标签
3. 穿搭公式：给出具体可复制的穿搭公式，增加收藏价值
4. 单品推荐：自然植入品牌产品，"这件XX就是点睛之笔"
5. 身材包容：不贩卖身材焦虑，强调"每个人都能穿出自己的风格"
6. 实用干货：配色法则、比例技巧、场景穿搭清单
7. 互动话题："你是什么身材？评论区帮你搭"`,
    contentTemplate: `【标题】"XX身材怎么穿？Before/After对比太绝了"
【Before痛点】展示常见穿搭误区/普通搭配
  "你是不是也这样穿？看着显矮10cm"
【改造方案】具体穿搭步骤
  1. 上装选择：XX风格+XX颜色 → 视觉效果
  2. 下装搭配：XX版型+XX长度 → 比例优化
  3. 配饰点睛：XX单品提升整体质感
【After展示】改造后效果图+穿搭公式总结
  "记住这个公式：XX+XX+XX=高级感"
【品牌植入】"这件XX单品就是关键，点击了解"
【互动引导】"你是什么身材？评论区帮你定制穿搭"`,
    viralElements: ['Before/After对比', '穿搭公式', '身材包容', '单品推荐', '场景代入', '实用收藏'],
    imageStrategy: '生成穿搭改造对比图：Before图展示普通搭配/常见误区，After图展示改造后的惊艳效果。还要生成单品细节图和整体搭配效果图。风格：时尚杂志质感，色彩和谐高级',
  },
}

// ============================================================
// 二、平台爆款规则（深入各平台算法机制）
// ============================================================

export interface PlatformViralRule {
  /** 平台标识 */
  platform: string
  /** 平台中文名 */
  platformName: string
  /** 平台最佳内容比例 */
  bestImageRatio: string
  /** 最佳发布时间 */
  bestPostTimes: string[]
  /** 算法偏好权重 */
  algorithmWeights: {
    engagement: number  // 互动率权重
    completion: number // 完播/完读率权重
    share: number      // 分享率权重
    save: number       // 收藏率权重
  }
  /** 爆款标题公式 */
  titleFormulas: string[]
  /** 互动诱导技巧 */
  engagementHooks: string[]
  /** 话题标签策略 */
  hashtagStrategy: string
  /** 禁忌事项 */
  taboos: string[]
  /** 文案风格要求 */
  copyStyle: string
  /** 图片风格要求 */
  imageStyle: string
  /** 该平台特有的爆款要素 */
  specialViralElements: string[]
}

export const PLATFORM_VIRAL_RULES: Record<string, PlatformViralRule> = {
  xiaohongshu: {
    platform: 'xiaohongshu',
    platformName: '小红书',
    bestImageRatio: '3:4',
    bestPostTimes: ['7:00-9:00', '12:00-14:00', '18:00-22:00'],
    algorithmWeights: { engagement: 0.35, completion: 0.2, share: 0.2, save: 0.25 },
    titleFormulas: [
      '{数字}个{痛点解决方案}，{第N个}绝了',
      '{人群}必看！{效果}的{方法/产品}',
      '后悔没早知道！{效果描述}',
      '{效果}亲测有效✅{具体方法}',
      '被问爆了❗{产品/方法}{效果}',
    ],
    engagementHooks: [
      '评论区告诉我你的选择👇',
      '收藏慢慢看📌',
      '姐妹们冲！',
      '亲测有效，不是广告！',
      '留言区帮你选款式',
    ],
    hashtagStrategy: '3-5个标签：1个大流量标签+2个精准标签+1个长尾标签+1个品牌标签。格式：#标签名。避免用#推荐 等泛标签',
    taboos: [
      '禁止出现"最""第一"等绝对化用语（广告法）',
      '禁止硬广感太强的表述',
      '禁止无emoji纯文字（小红书必须有emoji点缀）',
      '禁止超过20个话题标签（会被限流）',
      '禁止出现"点击链接"等导流话术',
    ],
    copyStyle: `小红书文案风格：
- 第一人称分享视角，像闺蜜在推荐
- emoji要丰富但不堆砌（每段2-3个）
- 必须有真实体验感，不说空话
- 开头制造好奇/痛点共鸣
- 分点用emoji编号：1️⃣2️⃣3️⃣
- 关键词加粗或用【】框起来
- 结尾必须3-5个话题标签
- 整体语调：真诚+热情+有料`,
    imageStyle: 'aesthetic flat lay, trendy pastel tones or warm tones, clean minimal composition, soft natural light, lifestyle inspiration, Instagram-worthy, high-end magazine feel, 4K',
    specialViralElements: ['封面图必须加文字标题', '图片要有系列感', '配色统一不杂乱', '真实使用场景优于棚拍'],
  },

  douyin: {
    platform: 'douyin',
    platformName: '抖音',
    bestImageRatio: '9:16',
    bestPostTimes: ['7:00-9:00', '11:30-13:00', '18:00-21:00', '22:00-24:00'],
    algorithmWeights: { engagement: 0.4, completion: 0.35, share: 0.15, save: 0.1 },
    titleFormulas: [
      '{反常识}，{后果}',
      '你绝对不知道的{领域}真相',
      '{人群}注意！{紧迫感描述}',
      '我花了{时间/金钱}才搞明白的{事}',
    ],
    engagementHooks: [
      '看到最后有惊喜',
      '第X个你一定不知道',
      '评论区告诉我你选哪个',
      '双击屏幕看看会发生什么',
      '关注我，明天更新下集',
    ],
    hashtagStrategy: '2-4个标签：1个热门话题+1个领域标签+1个品牌标签。用@功能@品牌账号',
    taboos: [
      '前3秒不能无聊否则直接划走',
      '禁止拖沓节奏，每3秒要有信息点',
      '禁止硬广植入太明显',
      '禁止低质搬运感',
      '禁止诱导关注（"关注看更多"可以，"不关注就看不到"不行）',
    ],
    copyStyle: `抖音文案风格：
- 口语化、节奏快、信息密度高
- 开头3秒必须炸裂：悬念/冲突/惊喜/反常识
- 像在对朋友说话，不是在念稿
- 适当用网络热词和梗
- 每3-5秒一个小刺激点
- 结尾要引导互动（点赞/评论/关注）
- 适合短视频脚本的节奏感`,
    imageStyle: 'vibrant eye-catching, dynamic composition, high contrast colors, trending visual style, thumb-stopping thumbnail, bold and fresh, 9:16 vertical format optimized, 4K',
    specialViralElements: ['前3秒hook决定生死', '节奏快信息密', 'BGM配合画面', '评论区诱饵设计', '完播率是核心指标'],
  },

  wechat: {
    platform: 'wechat',
    platformName: '微信朋友圈',
    bestImageRatio: '1:1',
    bestPostTimes: ['7:30-9:00', '12:00-13:30', '20:00-22:30'],
    algorithmWeights: { engagement: 0.3, completion: 0.2, share: 0.35, save: 0.15 },
    titleFormulas: [
      '{感叹/反问}，{效果/发现}',
      '终于{达成某事}了！{简述过程}',
      '被{人/事}种草了{产品}',
    ],
    engagementHooks: [
      '有没有同款的？',
      '太香了，忍不住分享',
      '你们试试看！',
      '链接私我',
    ],
    hashtagStrategy: '朋友圈不用话题标签',
    taboos: [
      '禁止超过5行（折叠后看不到）',
      '禁止广告腔太重（朋友圈是熟人社交）',
      '禁止长篇大论',
      '禁止过度营销感',
    ],
    copyStyle: `微信朋友圈风格：
- 像朋友在聊天一样自然亲切
- 开头要抓眼球，让人忍不住点全文
- 适当用emoji点缀，但不要堆砌
- 控制在3-5行以内
- 可以制造悬念或引发共鸣
- 结尾自然带出产品，不要硬广`,
    imageStyle: 'warm lifestyle photo, natural lighting, cozy and intimate atmosphere, like a friend sharing on moments, high quality mobile photo, 1:1 square format, 4K',
    specialViralElements: ['3行折叠策略（重要信息放前3行）', '真实分享感', '配图质量要高', '私域转化力强'],
  },

  weibo: {
    platform: 'weibo',
    platformName: '微博',
    bestImageRatio: '16:9',
    bestPostTimes: ['8:00-10:00', '12:00-14:00', '20:00-23:00'],
    algorithmWeights: { engagement: 0.3, completion: 0.15, share: 0.35, save: 0.2 },
    titleFormulas: [
      '#话题# {观点/发现}',
      '{争议性观点}，不服来辩',
      '刚知道{信息}，{反应}',
    ],
    engagementHooks: [
      '你怎么看？',
      '同意的转起',
      '评论区见',
      '转给需要的人',
    ],
    hashtagStrategy: '1-2个热搜话题标签+1个品牌话题，格式：#话题名#',
    taboos: [
      '禁止超过140字核心信息',
      '禁止无话题标签',
      '禁止过度水帖',
      '禁止敏感话题',
    ],
    copyStyle: `微博风格：
- 第一句话就要炸裂，引发讨论
- 简洁有力，140字以内核心信息
- 带热门话题标签
- 适当用emoji
- 结尾引导转发评论
- 可以有观点有态度`,
    imageStyle: 'bold modern design, clean professional look, striking visual impact, celebrity endorsement style, 16:9 widescreen, 4K',
    specialViralElements: ['热搜蹭热度', '观点鲜明引发讨论', '大V转发', '话题标签是流量入口'],
  },

  bilibili: {
    platform: 'bilibili',
    platformName: 'B站',
    bestImageRatio: '16:9',
    bestPostTimes: ['12:00-14:00', '18:00-22:00', '周末全天'],
    algorithmWeights: { engagement: 0.3, completion: 0.35, share: 0.15, save: 0.2 },
    titleFormulas: [
      '{梗/趣味}｜{内容主题}',
      '关于{主题}你必须知道的{数字}件事',
      '{领域}入门/进阶指南',
    ],
    engagementHooks: [
      '三连支持一下',
      '弹幕告诉我你的选择',
      '下期想看什么？评论区告诉我',
      '关注不迷路',
    ],
    hashtagStrategy: '2-3个标签+1个分区标签，不用太多',
    taboos: [
      '禁止纯广告无内容',
      '禁止标题党（B站用户反感）',
      '禁止水时长',
      '禁止不专业的内容（B站用户挑剔）',
    ],
    copyStyle: `B站风格：
- 标题要有梗，吸引点击
- 内容专业有趣并重
- 可以适当二次元用语和梗
- 详细但不啰嗦
- 结尾求三连
- 有深度有态度`,
    imageStyle: 'creative playful, colorful, anime-inspired elements, fun and imaginative, youth culture, 16:9 widescreen, 4K',
    specialViralElements: ['专业+趣味并重', '弹幕互动设计', '系列内容增加回访', 'UP主人设', '梗和二次元文化'],
  },

  kuaishou: {
    platform: 'kuaishou',
    platformName: '快手',
    bestImageRatio: '9:16',
    bestPostTimes: ['6:00-8:00', '11:30-13:00', '19:00-22:00'],
    algorithmWeights: { engagement: 0.35, completion: 0.3, share: 0.2, save: 0.15 },
    titleFormulas: [
      '{接地气描述}，{效果}',
      '老铁们{推荐/避雷}',
      '{真实体验}分享',
    ],
    engagementHooks: [
      '老铁们点个赞',
      '双击666',
      '关注不迷路',
      '评论区告诉我',
    ],
    hashtagStrategy: '1-2个热门话题标签，简洁直接',
    taboos: [
      '禁止装腔作势',
      '禁止过度包装',
      '禁止假大空',
      '禁止脱离生活的内容',
    ],
    copyStyle: `快手风格：
- 接地气，说人话
- 生活化场景感强
- 真实不做作
- 适当用方言感表达
- 结尾引导关注
- 要有"老铁"的亲切感`,
    imageStyle: 'authentic real-life, down-to-earth, natural unposed, relatable everyday scene, warm and genuine, 9:16 vertical, 4K',
    specialViralElements: ['真实接地气', '老铁文化', '生活化场景', '朴实真诚', '互动参与感'],
  },

  wechat_mp: {
    platform: 'wechat_mp',
    platformName: '微信公众号',
    bestImageRatio: '2.35:1（封面）',
    bestPostTimes: ['7:30-9:00', '12:00-13:30', '20:00-22:00'],
    algorithmWeights: { engagement: 0.25, completion: 0.25, share: 0.3, save: 0.2 },
    titleFormulas: [
      '{数字}个{方法/真相}，{第N个}太{形容词}',
      '为什么{反常识现象}？真相是...',
      '{人群}必读：{核心价值}',
      '深度｜{主题}的底层逻辑',
    ],
    engagementHooks: [
      '点"在看"让更多人看到',
      '分享到朋友圈帮助更多人',
      '后台回复XX获取更多',
      '觉得有用就收藏',
    ],
    hashtagStrategy: '文末1-2个标签即可，公众号主要靠标题和封面传播',
    taboos: [
      '禁止标题党过度（影响打开率信任度）',
      '禁止排版混乱',
      '禁止太短没价值（公众号读者期待深度）',
      '禁止无图纯文字长文',
    ],
    copyStyle: `微信公众号图文风格：
- 标题要有吸引力，让人想点进来
- 开头用一段引人入胜的导语，制造悬念或痛点共鸣
- 正文分段清晰，每段2-4句话，用小标题分隔
- 语言像朋友在分享，不要广告腔
- 结尾加互动引导：点赞/在看/关注
- 整体字数800-1500字
- 图片插入自然，配合文字节奏`,
    imageStyle: 'professional editorial photo, magazine quality, clean composition, warm and inviting, high-end feel, 4K',
    specialViralElements: ['标题决定打开率', '封面图决定点击', '在看/分享决定传播', '深度内容增加收藏', '系列内容增加关注'],
  },

  toutiao: {
    platform: 'toutiao',
    platformName: '今日头条',
    bestImageRatio: '16:9',
    bestPostTimes: ['7:00-9:00', '12:00-14:00', '18:00-22:00'],
    algorithmWeights: { engagement: 0.25, completion: 0.3, share: 0.25, save: 0.2 },
    titleFormulas: [
      '{信息差标题}，{补充}',
      '最新！{事件/发现}',
      '{数字}个{知识点}，{评价}',
    ],
    engagementHooks: [
      '你怎么看？',
      '评论区留言讨论',
      '转发让更多人知道',
      '关注获取最新资讯',
    ],
    hashtagStrategy: '2-3个标签，偏新闻资讯类',
    taboos: [
      '禁止无信息量的标题党',
      '禁止假新闻',
      '禁止抄袭',
      '禁止低质内容',
    ],
    copyStyle: `今日头条风格：
- 标题要有信息量和吸引力
- 内容详实有深度，数据支撑
- 图文结合，图片前有引导性描述
- 观点鲜明，逻辑清晰
- 结尾引导讨论
- 偏资讯/知识型内容`,
    imageStyle: 'professional news style photo, informative and clear, editorial quality, 16:9, 4K',
    specialViralElements: ['信息量大', '时效性强', '数据支撑', '观点鲜明', '推荐算法流量大'],
  },
}

// ============================================================
// 三、内容质量评分标准
// ============================================================

export interface ContentQualityCheck {
  /** 维度 */
  dimension: string
  /** 权重 */
  weight: number
  /** 评分描述 */
  description: string
  /** 评分提示词片段 */
  checkPrompt: string
}

export const CONTENT_QUALITY_CHECKS: ContentQualityCheck[] = [
  {
    dimension: 'brand_relevance',
    weight: 0.25,
    description: '品牌相关性：内容是否紧扣品牌/产品核心卖点',
    checkPrompt: '内容是否紧密围绕品牌/产品展开？核心卖点是否被充分体现？读者看完是否清楚这是关于什么的？',
  },
  {
    dimension: 'engagement_hook',
    weight: 0.2,
    description: '互动诱导力：是否有足够的互动引导和参与机制',
    checkPrompt: '是否有明确的互动引导？读者是否有点赞/评论/收藏/转发的冲动？是否设计了参与感？',
  },
  {
    dimension: 'viral_potential',
    weight: 0.2,
    description: '传播潜力：内容是否有自发传播的动力',
    checkPrompt: '读者是否愿意转发给朋友？是否有社交货币价值？是否有情感共鸣点？',
  },
  {
    dimension: 'platform_fit',
    weight: 0.15,
    description: '平台适配度：内容风格是否符合目标平台的算法偏好',
    checkPrompt: '内容风格是否符合该平台的用户习惯？是否遵循了该平台的爆款规律？',
  },
  {
    dimension: 'ai_trace_removal',
    weight: 0.1,
    description: 'AI痕迹清除：是否有明显的AI生成痕迹',
    checkPrompt: '是否有"作为AI""我是一个"等AI痕迹？是否有过于模板化的表述？读起来是否像真人写的？',
  },
  {
    dimension: 'action_drive',
    weight: 0.1,
    description: '行动驱动力：是否能驱动读者产生购买/了解/关注行为',
    checkPrompt: '读者看完是否有了解/购买产品的冲动？是否有明确的行动引导？转化路径是否清晰？',
  },
]

// 质量自检的LLM提示词模板
export const QUALITY_CHECK_PROMPT = `你是一个严格的内容质量审核专家。请对以下内容进行质量评分。

【内容信息】
平台：{platform}
品牌/产品：{brand}
目标受众：{audience}
技能类型：{skillType}

【待审核内容】
{content}

【评分维度】（每项1-10分）
{checkDimensions}

【评分要求】
1. 严格评分，不要给面子分
2. 如果品牌相关性<7分，内容需要重写
3. 如果AI痕迹>7分（1=无痕迹，10=全是痕迹），内容需要重写
4. 给出每个维度的分数和简短改进建议

请用以下JSON格式输出：
{
  "scores": {
    "brand_relevance": 分数,
    "engagement_hook": 分数,
    "viral_potential": 分数,
    "platform_fit": 分数,
    "ai_trace_removal": 分数,
    "action_drive": 分数
  },
  "total_score": 加权总分,
  "pass": 总分是否>=7,
  "suggestions": ["改进建议1", "改进建议2"],
  "rewrite_hints": "如果需要重写，给出具体的重写方向"
}`

// ============================================================
// 四、辅助函数
// ============================================================

/**
 * 根据技能ID获取技能策略
 */
export function getSkillStrategy(skillId: string): SkillStrategy | undefined {
  return SKILL_STRATEGIES[skillId]
}

/**
 * 根据平台名获取平台爆款规则
 */
export function getPlatformRule(platform: string): PlatformViralRule {
  return getPlatformViralRule(platform)
}

/**
 * 根据内容类型推断技能ID
 */
export function detectSkillFromOrder(contentType: string): string {
  const typeMap: Record<string, string> = {
    'image_text': 'skill_001',
    'text': 'skill_001',
    'image': 'skill_002',
    'video': 'skill_003',
  }
  return typeMap[contentType] || 'skill_001'
}

/**
 * 获取内容风格指令
 */
export function getStyleInstruction(styles: string[]): string {
  if (!styles || styles.length === 0) return ''
  const styleGuideMap: Record<string, string> = {
    '幽默风趣': '用幽默诙谐的方式表达，适当玩梗和自嘲，让读者笑着看完还想分享',
    '温暖治愈': '走心温暖路线，用情感打动读者，营造被理解和被关怀的感觉',
    '犀利毒舌': '观点犀利，一针见血，敢说真话，制造反差感和冲击力',
    '文艺清新': '文字优美有画面感，善用比喻和意境，营造高品质感',
    '专业严谨': '数据支撑，逻辑严密，权威可信，引用专业术语和行业标准',
    '活泼元气': '活力四射，节奏轻快，用感叹号和短句营造兴奋感',
    '知性优雅': '沉稳大方，娓娓道来，有教养感和高级感',
    '潮流前卫': '紧跟潮流，用语新颖，体现时尚态度和先锋感',
  }
  return styles
    .map(s => styleGuideMap[s] || s)
    .filter(Boolean)
    .join('；')
}

/**
 * 获取专业领域指令
 */
export function getNicheInstruction(tags: string[]): string {
  if (!tags || tags.length === 0) return ''
  const nicheGuideMap: Record<string, string> = {
    '美妆时尚': '必须体现专业的美妆知识和时尚审美，使用专业术语如"色号""质地""上脸效果"',
    '美食探店': '描述要让人看了就馋，突出味道、口感、颜值，场景感要强',
    '旅行出行': '营造身临其境的旅行感，突出攻略价值和体验感，给出实用建议',
    '数码科技': '体现科技专业度，用数据和对比说话，突出产品参数和实际体验',
    '母婴育儿': '安全感和信任感最重要，用专业知识和妈妈经验双重视角',
    '健康养生': '科学严谨，引用研究数据，避免夸大宣传，注重长期效果',
    '金融财经': '专业可信，数据驱动，逻辑清晰，风险提示到位',
    '生活方式': '营造理想生活感，注重品质和品味，有仪式感和审美感',
  }
  return tags
    .map(t => nicheGuideMap[t] || t)
    .filter(Boolean)
    .join('；')
}

/**
 * 根据分身技能列表确定主技能策略
 * 优先级：如果有多个技能，选择与订单内容类型最匹配的
 */
export function getPrimarySkillStrategy(
  avatarSkills: string[],
  contentType: string
): SkillStrategy {
  // 优先匹配内容类型
  const typeMap: Record<string, string[]> = {
    'image_text': ['skill_001', 'skill_004', 'skill_005'],
    'text': ['skill_001'],
    'image': ['skill_002', 'skill_004', 'skill_005'],
    'video': ['skill_003'],
  }

  const preferredSkills = typeMap[contentType] || typeMap['image_text']
  
  // 先找分身技能中与内容类型匹配的
  for (const skillId of preferredSkills) {
    if (avatarSkills.includes(skillId)) {
      return SKILL_STRATEGIES[skillId]
    }
  }

  // 没有匹配的，用分身的第一个技能
  if (avatarSkills.length > 0 && SKILL_STRATEGIES[avatarSkills[0]]) {
    return SKILL_STRATEGIES[avatarSkills[0]]
  }

  // 兜底：图文爆款
  return SKILL_STRATEGIES['skill_001']
}

/**
 * 获取平台爆款规则
 */
export function getPlatformViralRule(platform: string): PlatformViralRule {
  // 平台名映射（处理不同的命名方式）
  const platformMap: Record<string, string> = {
    'wechat': 'wechat',
    'wechat_mp': 'wechat_mp',
    'wechat_official': 'wechat_mp',
    'wechat_channel': 'wechat',
    'xiaohongshu': 'xiaohongshu',
    'xhs': 'xiaohongshu',
    'douyin': 'douyin',
    'tiktok': 'douyin',
    'weibo': 'weibo',
    'bilibili': 'bilibili',
    'b站': 'bilibili',
    'kuaishou': 'kuaishou',
    '快手': 'kuaishou',
    'toutiao': 'toutiao',
    '头条': 'toutiao',
    'zhihu': 'toutiao',  // 知乎偏深度，类似头条
  }

  const mapped = platformMap[platform] || platform
  return PLATFORM_VIRAL_RULES[mapped] || PLATFORM_VIRAL_RULES['xiaohongshu']
}

/**
 * 根据订单内容类型确定生成策略
 */
export function determineContentType(
  orderContentType: string,
  skillStrategy: SkillStrategy
): string {
  // 如果订单指定了内容类型，优先使用
  if (orderContentType && orderContentType !== 'image_text') {
    // 检查技能是否支持该内容类型
    if (skillStrategy.contentTypes.includes(orderContentType)) {
      return orderContentType
    }
  }

  // 使用技能的首选内容类型
  return skillStrategy.contentTypes[0]
}

/**
 * 构建完整的爆款内容提示词
 * 核心方法：将技能策略 + 平台规则 + 订单要求 + 分身人设 融合为一个超级提示词
 */
export function buildViralContentPrompt(params: {
  skillStrategy: SkillStrategy
  platformRule: PlatformViralRule
  orderTitle: string
  orderDescription: string
  targetAudience: string
  avatarName?: string
  avatarPersonality?: string
  contentStyles?: string[]
  nicheTags?: string[]
  preferredStyles?: string[]
  industryTags?: string[]
  contentQuantity?: number
}): string {
  const { skillStrategy, platformRule } = params

  return `你是一个顶级新媒体内容创作高手，同时精通${skillStrategy.skillName}和${platformRule.platformName}的运营玩法。

${skillStrategy.coreCapability}

【商单任务 - 必须严格围绕以下信息创作】
品牌/产品名：${params.orderTitle}
详细创作要求：
${params.orderDescription}
目标平台：${platformRule.platformName}（${params.platformRule.platform}）
目标受众：${params.targetAudience || '年轻用户'}
${params.avatarName ? `分身人设：${params.avatarName}，${params.avatarPersonality || '专业有趣'}` : ''}
${params.contentStyles?.length ? `内容风格：${params.contentStyles.join('、')}` : ''}
${params.nicheTags?.length ? `专业领域：${params.nicheTags.join('、')}` : ''}
${params.preferredStyles?.length ? `偏好风格：${params.preferredStyles.join('、')}` : ''}
${params.industryTags?.length ? `行业标签：${params.industryTags.join('、')}` : ''}

${skillStrategy.generationStrategy}

【${platformRule.copyStyle}】

【爆款标题公式 - 从中选一个最适合的】
${platformRule.titleFormulas.map((f, i) => `${i + 1}. ${f}`).join('\n')}

【互动诱导 - 至少嵌入2个】
${platformRule.engagementHooks.join(' / ')}

【话题标签策略】
${platformRule.hashtagStrategy}

【绝对红线 - 必须遵守】
1. 文案必须围绕"${params.orderTitle}"这个品牌/产品来写，不是泛泛而谈
2. 必须体现订单要求中的核心卖点，不能偏离
3. 要让读者看完就想了解/购买这个产品
4. 禁止出现"作为AI"、"我是一个"等AI痕迹
5. 直接输出文案内容，不要输出任何创作说明或注释
6. 如果订单要求中提到具体卖点，必须详细阐述
${platformRule.taboos.map((t, i) => `${7 + i}. ${t}`).join('\n')}

【内容结构模板】
${skillStrategy.contentTemplate}

${skillStrategy.viralElements.length ? `【爆款要素 - 至少包含3个】\n${skillStrategy.viralElements.join(' / ')}` : ''}

请创作一条紧扣品牌/产品、有感染力、具备爆款潜质的高质量推广文案：`
}

/**
 * 构建图片生成提示词
 * 融合技能策略 + 平台规则 + 订单信息
 */
export function buildViralImagePrompt(params: {
  skillStrategy: SkillStrategy
  platformRule: PlatformViralRule
  orderTitle: string
  orderDescription: string
  imageIndex: number  // 第几张图（0=封面图）
  totalImages: number
  textContext?: string  // 前后文文字内容
}): string {
  const { skillStrategy, platformRule, imageIndex } = params

  // 从订单中提取产品关键词
  const productDesc = `${params.orderTitle} ${params.orderDescription}`.substring(0, 100)

  if (imageIndex === 0) {
    // 封面图 - 最重要
    return `Viral cover image for social media post about ${productDesc}, ${platformRule.imageStyle}, ${skillStrategy.imageStrategy}, thumb-stopping, extremely eye-catching, optimized for ${platformRule.platformName}, professional quality, 4K`
  } else {
    // 内容配图
    const contextHint = params.textContext ? `, context: ${params.textContext.substring(0, 80)}` : ''
    return `Supporting image ${imageIndex + 1} for social media post about ${productDesc}${contextHint}, ${platformRule.imageStyle}, relevant and engaging, professional quality, 4K`
  }
}
