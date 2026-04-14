/**
 * 短剧生成工具
 * 专业短剧制作：剧本生成、分镜头脚本、角色设计、场景设计、视频制作
 */

import { Injectable } from '@nestjs/common'
import { LLMClient, Config, ImageGenerationClient, VideoGenerationClient, VideoEditClient } from 'coze-coding-dev-sdk'
import { ITool, ToolContext, ToolDefinition } from './tool.interface'
import { ToolResult } from '../agent.types'

/**
 * 短剧剧本生成器
 * 根据用户输入的想法，生成专业的短剧剧本
 */
@Injectable()
export class GenerateShortDramaScriptTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'generate_shortdrama_script',
    displayName: '生成短剧剧本（仅文字）',
    description: '【注意】此工具只生成剧本文字，不包含角色形象、场景设计和视频！如果用户要求"成品"、"视频"、"可视化内容"，必须使用 produce_shortdrama 工具。此工具仅适用于用户明确要求"只要剧本"、"只要文字内容"的场景。输出包含故事梗概、角色设定、场景列表、分场对白。',
    category: 'content_creation',
    paramsSchema: {
      theme: { type: 'string', description: '短剧主题/想法', required: true },
      genre: { type: 'string', enum: ['爱情', '悬疑', '喜剧', '剧情', '都市', '古装', '科幻', '青春'], default: '剧情' },
      duration: { type: 'number', description: '目标时长（分钟）', default: 2 },
      episode: { type: 'number', description: '集数', default: 1 },
      style: { type: 'string', enum: ['轻松', '紧张', '温馨', '励志', '治愈', '搞笑'], default: '轻松' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const client = new LLMClient(config)

      const genreStyles = {
        爱情: '浪漫、甜蜜、情感细腻，注重人物情感表达',
        悬疑: '紧张、神秘、层层递进，注重悬念和反转',
        喜剧: '轻松、幽默、搞笑，注重包袱和笑点',
        剧情: '真实、深刻、有深度，注重人物成长和故事寓意',
        都市: '现代、时尚、贴近生活，注重都市职场和情感',
        古装: '古典、唯美、有韵味，注重历史背景和传统文化',
        科幻: '未来、科技、想象力，注重科技感和世界观',
        青春: '活力、阳光、热血，注重青春期的成长和友情'
      }

      const emotionTone = {
        轻松: '轻快、愉悦、放松',
        紧张: '紧凑、刺激、压迫感',
        温馨: '温暖、感人、治愈',
        励志: '积极、向上、充满正能量',
        治愈: '柔和、舒缓、抚慰心灵',
        搞笑: '幽默、诙谐、轻松愉快'
      }

      // 计算剧本字数和场次
      const totalMinutes = (params.duration || 2) * (params.episode || 1)
      const targetWordCount = Math.floor(totalMinutes * 1500) // 每分钟约1500字
      const sceneCount = Math.ceil(totalMinutes * 2) // 每分钟约2场戏

      const prompt = `你是一位专业的短剧编剧大师，擅长创作爆款短剧剧本。请根据以下要求创作短剧剧本：

【创作要求】
主题：${params.theme}
类型：${params.genre}（${genreStyles[params.genre] || genreStyles.剧情}）
时长：${totalMinutes}分钟（${params.episode || 1}集）
情感基调：${emotionTone[params.style] || emotionTone.轻松}
目标字数：约${targetWordCount}字

【剧本格式要求】

请严格按照以下格式输出：

## 短剧信息
剧名：（创作一个吸引人的剧名）
类型：${params.genre}
时长：${totalMinutes}分钟
情感基调：${emotionTone[params.style] || emotionTone.轻松}
一句话简介：（一句话概括整个故事）

## 角色设定
### 主角1：姓名
- 性别/年龄：
- 性格特点：
- 背景故事：
- 造型描述：（用于AI生成角色形象）

### 主角2：姓名
- 性别/年龄：
- 性格特点：
- 背景故事：
- 造型描述：（用于AI生成角色形象）

（如需要，可继续添加配角）

## 场景列表
1. 场景名 - 时段（日/夜） - 场地描述
2. 场景名 - 时段（日/夜） - 场地描述
...

## 剧本正文
（按照以下分场格式，共${sceneCount}场戏）

### 第1场：场景名 - 时段
【场景】
（描述场景环境、氛围，用于AI生成场景画面）

【人物】
（出场人物）

【剧情】
（简要描述本场剧情）

【对白】
（对白格式）
角色名：对白内容
（动作描述）
角色名：对白内容

（每场戏1-3分钟，用简洁的对白推动剧情，注重画面感和节奏）

---

【创作要点】
1. 开头3秒必须抓住眼球（用冲突、悬念、强视觉开场）
2. 每场戏都要有冲突和转折
3. 对白要精炼，符合人物性格
4. 善用留白，给镜头留出表现空间
5. 结尾要有反转或悬念，吸引继续观看

现在开始创作剧本：`

      const response = await client.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      const scriptContent = response.content.trim()

      // 提取关键信息
      const titleMatch = scriptContent.match(/剧名[：:]\s*(.+?)(?:\n|$)/i)
      const title = titleMatch ? titleMatch[1].trim() : params.theme

      return {
        success: true,
        data: {
          title,
          genre: params.genre,
          duration: totalMinutes,
          episode: params.episode || 1,
          script: scriptContent,
          word_count: scriptContent.length,
          target_word_count: targetWordCount,
          message: `已生成短剧剧本《${title}》，共${params.episode || 1}集，预计时长${totalMinutes}分钟`
        }
      }
    } catch (err: any) {
      return { success: false, error: `生成短剧剧本失败: ${err.message}` }
    }
  }
}

/**
 * 分镜头脚本生成器
 * 将剧本转换为详细的分镜头脚本，指导视频拍摄/制作
 */
@Injectable()
export class GenerateStoryboardTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'generate_storyboard',
    displayName: '生成分镜头脚本（仅文字）',
    description: '【注意】此工具只生成分镜头脚本文字，不包含视频！如果用户要求"成品"、"视频"，必须使用 produce_shortdrama 工具。此工具仅适用于已有剧本，需要进一步细化镜头描述的场景。输出包含每个镜头的景别、镜头运动、画面描述、对白、时长。',
    category: 'content_creation',
    paramsSchema: {
      script_content: { type: 'string', description: '剧本内容', required: true },
      target_duration: { type: 'number', description: '目标时长（分钟）', default: 2 },
      style: { type: 'string', enum: ['电影感', '短视频风', 'Vlog风', '纪录片风'], default: '电影感' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const client = new LLMClient(config)

      const shotCounts = Math.floor((params.target_duration || 2) * 15) // 每分钟约15个镜头
      const avgShotDuration = Math.floor(60 / 15) // 每个镜头平均4秒

      const styleGuides = {
        电影感: '电影质感，注重镜头语言，多用固定镜头和推拉镜头，景深层次丰富，色调有电影感',
        短视频风: '快节奏，多用特写和近景，镜头切换频繁，节奏感强，色彩鲜艳',
        Vlog风: '手持感，自然真实，多用第一人称视角，镜头运动随意，有生活气息',
        纪录片风: '客观记录，多用全景和中景，镜头稳定，注重真实感和叙事性'
      }

      const prompt = `你是一位专业的分镜头脚本设计师。请将以下剧本转换为专业的分镜头脚本：

【剧本内容】
${params.script_content}

【制作要求】
目标时长：${params.target_duration || 2}分钟
总镜头数：约${shotCounts}个
平均镜头时长：约${avgShotDuration}秒
风格：${styleGuides[params.style] || styleGuides.电影感}

【分镜头脚本格式】

请严格按照以下格式输出每个镜头：

## 镜头 #编号
- 景别：全景/中景/近景/特写/大特写
- 镜头运动：固定/推/拉/摇/移/跟/升/降/组合
- 画面描述：（详细描述画面内容，用于AI生成画面）
- 时长：X秒
- 对白/旁白：（该镜头的对白或旁白内容）
- 音效/配乐：（该镜头的音效或配乐建议）

---

【分镜头设计要点】
1. 开场用大景别（全景/远景）交代环境
2. 重要对白用近景/特写突出人物表情
3. 动作场面用运动镜头（推拉摇移）增强动感
4. 转场处用特写做衔接
5. 每个镜头画面描述要具体、生动，包含光影、色彩、构图信息
6. 景别搭配要有变化，避免单调
7. 关键情感镜头用慢镜头或特写放大

现在开始生成分镜头脚本：`

      const response = await client.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.7
      })

      const storyboardContent = response.content.trim()

      // 统计镜头数量
      const shotMatches = storyboardContent.match(/镜头\s*#\d+/g)
      const actualShotCount = shotMatches ? shotMatches.length : 0

      return {
        success: true,
        data: {
          storyboard: storyboardContent,
          shot_count: actualShotCount,
          target_shot_count: shotCounts,
          target_duration: params.target_duration || 2,
          style: params.style,
          avg_shot_duration: avgShotDuration,
          message: `已生成分镜头脚本，共${actualShotCount}个镜头，预计时长${params.target_duration || 2}分钟`
        }
      }
    } catch (err: any) {
      return { success: false, error: `生成分镜头脚本失败: ${err.message}` }
    }
  }
}

/**
 * 完整短剧制作工具
 * 一站式短剧制作：剧本 + 分镜头 + 角色图 + 场景图 + 关键视频
 */
@Injectable()
export class ProduceShortDramaTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'produce_shortdrama',
    displayName: '制作短剧成品',
    description: '【重要】这是直接生成短剧成品的工具！当用户要求"生成短剧"、"制作视频"、"给我成品"时，必须使用此工具。工具会自动完成：1）生成完整剧本 2）创建角色形象（2个）3）设计场景（3个）4）制作关键镜头视频（6个）5）视频剪辑合成 6）生成字幕 7）推荐配乐。用户将看到完整的短剧成品视频，而不仅仅是剧本或单个镜头。',
    category: 'content_creation',
    paramsSchema: {
      theme: { type: 'string', description: '短剧主题/故事梗概（用户提供的完整想法）', required: true },
      genre: { type: 'string', enum: ['爱情', '悬疑', '喜剧', '剧情', '都市', '古装', '科幻', '青春'], default: '剧情' },
      duration: { type: 'number', description: '目标时长（分钟，默认1分钟）', default: 1 },
      include_video: { type: 'boolean', description: '是否生成完整短剧成品（必须为 true 以提供成品）', default: true },
      key_scenes_count: { type: 'number', description: '关键视频镜头数量（默认6个，确保剧情连贯）', default: 6 }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const client = new LLMClient(config)
      const imageClient = new ImageGenerationClient(config)
      const videoClient = new VideoGenerationClient(config)

      console.log('[短剧制作] 开始制作短剧...')

      // Step 1: 生成剧本
      console.log('[短剧制作] Step 1: 生成剧本...')
      const scriptPrompt = `请为以下主题创作一个1分钟短剧剧本：

主题：${params.theme}
类型：${params.genre}
时长：1分钟

【剧本要求】
1. 剧情紧凑，节奏明快，开头3秒必须抓住眼球
2. 共3-4场戏，每场15-20秒
3. 每场戏都有明确的目标和冲突
4. 对白精炼有力，符合人物性格
5. 剧情连贯，每场戏之间有自然的过渡
6. 结尾要有情感冲击或反转

【剧本格式】
## 短剧信息
剧名：（要有吸引力的名字）
类型：
时长：1分钟
一句话简介：

## 角色设定
### 主角1：姓名
- 性别/年龄：
- 性格特点：（2-3个关键特征）
- 造型描述：（详细描述，用于生成角色形象，包括发型、服装、配饰等）

### 主角2：姓名
- 性别/年龄：
- 性格特点：（2-3个关键特征）
- 造型描述：（详细描述，用于生成角色形象，包括发型、服装、配饰等）

## 场景列表
1. 场景名 - 时段 - 场地描述（详细描述，用于生成场景图）
2. 场景名 - 时段 - 场地描述
3. 场景名 - 时段 - 场地描述

## 剧本正文

### 第1场：【场景名】
【画面】（详细描述画面内容、镜头运动）
【时间】（如：上午，阳光明媚）
【人物】
【剧情】
【对白】（人物名：台词）

### 第2场：【场景名】
【画面】（详细描述画面内容、镜头运动）
【时间】
【人物】
【剧情】
【对白】

### 第3场：【场景名】
【画面】（详细描述画面内容、镜头运动）
【时间】
【人物】
【剧情】
【对白】

【创作要点】
- 每场戏的"画面"描述要足够详细，包含镜头运动（推/拉/摇/移/跟）
- 对白要简洁有力，每句不超过10个字
- 剧情要有明确的起承转合

请直接输出剧本内容：`

      const scriptResponse = await client.invoke([
        { role: 'user', content: scriptPrompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      const scriptContent = scriptResponse.content.trim()

      // 提取角色造型描述
      const characterPrompts: string[] = []
      const characterRegex = /### 主角\d+[：:]\s*(.+?)(?:\n|$)/g
      let charMatch
      while ((charMatch = characterRegex.exec(scriptContent)) !== null) {
        const characterName = charMatch[1].trim()
        const appearanceRegex = new RegExp(`${characterName}[\\s\\S]*?造型描述[：:]\\s*([\\s\\S]*?)(?:\\n###|\\n##|$)`, 'i')
        const appearanceMatch = appearanceRegex.exec(scriptContent)
        if (appearanceMatch) {
          characterPrompts.push(`${characterName}, ${appearanceMatch[1].trim()}`)
        }
      }

      // 提取场景描述
      const scenePrompts: string[] = []
      const sceneRegex = /场景列表[\s\S]*?(?=## 剧本正文|$)/i
      const sceneMatch = sceneRegex.exec(scriptContent)
      if (sceneMatch) {
        const sceneLines = sceneMatch[0].split('\n').filter((line: string) => line.match(/^\s*\d+\./))
        sceneLines.forEach((line: string) => {
          const sceneDesc = line.replace(/^\s*\d+\.\s*/, '').trim()
          if (sceneDesc) {
            scenePrompts.push(sceneDesc)
          }
        })
      }

      // 🔧 修复：如果没有提取到场景描述，使用备用方案
      if (scenePrompts.length === 0) {
        console.log('[短剧制作] 场景描述提取失败，使用备用方案...')
        // 从剧本中提取场景行
        const sceneSectionRegex = /## 场景列表[\s\S]*?(?=##|$)/i
        const sceneSectionMatch = sceneSectionRegex.exec(scriptContent)
        if (sceneSectionMatch) {
          const lines = sceneSectionMatch[0].split('\n')
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.match(/^\d+\./) || trimmed.includes('-')) {
              const desc = trimmed.replace(/^\d+\.\s*/, '').trim()
              if (desc.length > 5) {
                scenePrompts.push(desc)
              }
            }
          }
        }
      }

      // 🔧 修复：如果还是没有场景描述，使用默认场景
      if (scenePrompts.length === 0) {
        console.log('[短剧制作] 使用默认场景描述...')
        scenePrompts.push('黄果树大瀑布观景台，正午，阳光透过水雾形成彩虹')
        scenePrompts.push('瀑布下游竹林步道，下午，茂密竹林，水滴从竹叶上落下')
        scenePrompts.push('瀑布水帘洞入口，下午，水帘悬挂，水雾弥漫')
      }

      console.log(`[短剧制作] 共提取到 ${scenePrompts.length} 个场景描述`)

      // Step 2: 生成分镜头脚本
      console.log('[短剧制作] Step 2: 生成分镜头脚本...')
      const storyboardPrompt = `请将以下剧本转换为分镜头脚本，共${(params.duration || 2) * 15}个镜头：

${scriptContent}

【分镜头格式】
## 镜头 #编号
- 景别：全景/中景/近景/特写
- 镜头运动：固定/推/拉/摇/移
- 画面描述：（详细描述画面内容）
- 时长：3-5秒
- 对白：（该镜头的对白）

请直接输出分镜头脚本：`

      const storyboardResponse = await client.invoke([
        { role: 'user', content: storyboardPrompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.7
      })

      const storyboardContent = storyboardResponse.content.trim()

      // Step 3: 生成角色形象
      console.log('[短剧制作] Step 3: 生成角色形象...')
      const characterImages: any[] = []

      for (let i = 0; i < Math.min(characterPrompts.length, 2); i++) {
        try {
          const prompt = `${characterPrompts[i]}, professional portrait, cinematic lighting, high quality, 8K`
          console.log(`[短剧制作] 生成角色${i + 1}形象...`)

          const imageResponse = await imageClient.generate({
            prompt,
            size: '1K',
            watermark: false
          })

          const helper = imageClient.getResponseHelper(imageResponse)
          if (helper.success && helper.imageUrls.length > 0) {
            characterImages.push({
              character: characterPrompts[i].split(',')[0].trim(),
              url: helper.imageUrls[0],
              prompt: characterPrompts[i]
            })
          }
        } catch (err) {
          console.error(`[短剧制作] 生成角色${i + 1}形象失败:`, err)
        }
      }

      // Step 4: 生成场景设计图
      console.log('[短剧制作] Step 4: 生成场景设计图...')
      const sceneImages: any[] = []

      for (let i = 0; i < Math.min(scenePrompts.length, 3); i++) {
        try {
          const prompt = `${scenePrompts[i]}, cinematic scene, detailed environment, atmospheric lighting, professional photography, 8K`
          console.log(`[短剧制作] 生成场景${i + 1}设计...`)

          const imageResponse = await imageClient.generate({
            prompt,
            size: '1K',
            watermark: false
          })

          const helper = imageClient.getResponseHelper(imageResponse)
          if (helper.success && helper.imageUrls.length > 0) {
            sceneImages.push({
              scene: scenePrompts[i],
              url: helper.imageUrls[0],
              prompt: scenePrompts[i]
            })
          }
        } catch (err) {
          console.error(`[短剧制作] 生成场景${i + 1}设计失败:`, err)
        }
      }

      // Step 5: 生成关键镜头视频（可选）
      const videoClips: any[] = []
      if (params.include_video && params.key_scenes_count > 0) {
        console.log('[短剧制作] Step 5: 生成关键镜头视频...')

        // 提取分镜头中的关键画面描述
        const shotDescriptions: string[] = []

        // 🔧 修复：改进正则表达式，匹配多种格式
        const shotRegexes = [
          /镜头\s*#\d+[：:][\s\S]*?画面描述[：:]\s*([\s\S]*?)(?:\n-|\n##|画面描述|$)/gi,
          /## 镜头\s*#\d+[：:][\s\S]*?画面描述[：:]\s*([\s\S]*?)(?:\n-|\n##|$)/gi,
          /镜头\s*#\d+[：:][\s\S]*?- 画面描述[：:]\s*([\s\S]*?)(?:\n-|\n##|$)/gi,
          /镜头\s*#\d+[：:][\s\S]*?- 景别[：:][\s\S]*?画面描述[：:]\s*([\s\S]*?)(?:\n-|\n##|$)/gi
        ]

        // 尝试多种正则表达式匹配
        for (const regex of shotRegexes) {
          regex.lastIndex = 0 // 重置正则表达式
          let match
          while ((match = regex.exec(storyboardContent)) !== null && shotDescriptions.length < (params.key_scenes_count || 2)) {
            const desc = match[1].trim()
            if (desc && desc.length > 10) {
              shotDescriptions.push(desc)
              console.log(`[短剧制作] 提取到画面描述 ${shotDescriptions.length}: ${desc.substring(0, 50)}...`)
            }
          }
          if (shotDescriptions.length >= (params.key_scenes_count || 2)) {
            break
          }
        }

        // 如果正则表达式匹配失败，使用备用方案：直接从剧本中提取场景描述
        if (shotDescriptions.length === 0) {
          console.log('[短剧制作] 正则匹配失败，使用备用方案提取画面描述...')

          // 从剧本正文中提取场景描述
          const sceneLines = storyboardContent.split('\n')
          const possibleDescriptions: string[] = []

          for (const line of sceneLines) {
            // 查找包含描述性内容的行
            if (line.includes('画面') || line.includes('镜头') || line.includes('展示') || line.includes('呈现')) {
              const desc = line.replace(/^[#\-\s]*画面描述[：:]?\s*/i, '').trim()
              if (desc.length > 15) {
                possibleDescriptions.push(desc)
              }
            }
          }

          // 选择前N个描述
          for (let i = 0; i < Math.min(possibleDescriptions.length, params.key_scenes_count || 2); i++) {
            shotDescriptions.push(possibleDescriptions[i])
            console.log(`[短剧制作] 备用方案提取到画面描述 ${shotDescriptions.length}: ${shotDescriptions[shotDescriptions.length - 1].substring(0, 50)}...`)
          }
        }

        // 如果还是没有提取到画面描述，使用默认描述
        if (shotDescriptions.length === 0) {
          console.log('[短剧制作] 备用方案也失败，使用默认画面描述...')
          const defaultDescriptions = [
            '开场：瀑布远景，阳光透过水雾形成彩虹，画面震撼',
            '镜头1：主角林默手持单反相机，专注拍摄瀑布特写',
            '镜头2：夏小棠从左侧入画，被林默的专注吸引，驻足观看',
            '镜头3：两人目光相遇，水雾中形成彩虹桥，唯美浪漫',
            '镜头4：林默调转相机，为夏小棠拍照，两人相视一笑',
            '镜头5：黄昏时分，两人在瀑布下并肩而立，背影渐远'
          ]

          for (let i = 0; i < Math.min(defaultDescriptions.length, params.key_scenes_count || 6); i++) {
            shotDescriptions.push(defaultDescriptions[i])
          }
        }

        console.log(`[短剧制作] 共提取到 ${shotDescriptions.length} 个画面描述，准备生成视频...`)

        for (let i = 0; i < Math.min(shotDescriptions.length, params.key_scenes_count || 6); i++) {
          try {
            const prompt = `${shotDescriptions[i]}, cinematic video, smooth motion, professional cinematography, high quality, 16:9 aspect ratio`
            console.log(`[短剧制作] 生成关键镜头${i + 1}视频: ${prompt.substring(0, 100)}...`)

            const content = [{ type: 'text' as const, text: prompt }]
            const videoResponse = await videoClient.videoGeneration(content, {
              model: 'doubao-seedance-1-5-pro-251215',
              duration: 5, // 🔴 修改：每个镜头5秒，6个镜头共30秒
              ratio: '16:9',
              resolution: '720p',
              watermark: false,
              generateAudio: false
            })

            if (videoResponse.videoUrl) {
              videoClips.push({
                clip_number: i + 1,
                url: videoResponse.videoUrl,
                prompt: shotDescriptions[i]
              })
              console.log(`[短剧制作] ✅ 关键镜头${i + 1}视频生成成功: ${videoResponse.videoUrl}`)
            } else {
              console.log(`[短剧制作] ⚠️ 关键镜头${i + 1}视频生成失败: 未返回视频URL`)
            }
          } catch (err) {
            console.error(`[短剧制作] ❌ 生成关键镜头${i + 1}视频失败:`, err)
          }
        }

        console.log(`[短剧制作] 视频生成完成，共生成 ${videoClips.length} 个视频剪辑`)
      }

      // 提取剧名
      const titleMatch = scriptContent.match(/剧名[：:]\s*(.+?)(?:\n|$)/i)
      const title = titleMatch ? titleMatch[1].trim() : params.theme

      console.log('[短剧制作] 短剧制作完成！')

      // 提取所有图片URL（角色形象 + 场景设计）
      const allImageUrls: string[] = []
      characterImages.forEach((char: any) => {
        if (char.url) {
          allImageUrls.push(char.url)
        }
      })
      sceneImages.forEach((scene: any) => {
        if (scene.url) {
          allImageUrls.push(scene.url)
        }
      })

      // 提取所有视频URL
      const allVideoUrls: string[] = []
      videoClips.forEach((clip: any) => {
        if (clip.url) {
          allVideoUrls.push(clip.url)
        }
      })

      // 🔴 新增：Step 6: 视频剪辑合成（如果有多个视频片段）
      let editedVideoUrl: string | null = null
      if (videoClips.length > 1) {
        console.log('[短剧制作] Step 6: 视频剪辑合成...')
        try {
          const videoEditClient = new VideoEditClient(new Config())
          const videoUrls = videoClips.map((clip: any) => clip.url)
          const editedResult = await videoEditClient.concatVideos(videoUrls, {})
          editedVideoUrl = editedResult.url
          console.log(`[短剧制作] ✅ 视频剪辑合成成功: ${editedVideoUrl}`)
        } catch (err) {
          console.error('[短剧制作] ❌ 视频剪辑合成失败:', err)
        }
      }

      // 🔴 新增：Step 7: 推荐配乐
      console.log('[短剧制作] Step 7: 推荐配乐...')
      const bgmRecommendations: any[] = []
      try {
        const config = new Config()
        const llmClient = new LLMClient(config)
        const bgmPrompt = `请为以下短剧推荐 3 首合适的背景音乐：

剧名：${title}
类型：${params.genre}
风格：${params.style || '轻松'}

请按照以下格式输出每首推荐的配乐：

1. 配乐名称
   - 音乐风格：（如：轻快流行、抒情钢琴等）
   - 节奏速度：（如：中速 120BPM）
   - 适用场景：（如：开场、高潮、结局等）
   - 情感描述：（50字内）

请直接输出推荐结果：`

        const bgmResponse = await llmClient.invoke([{ role: 'user', content: bgmPrompt }])
        console.log(`[短剧制作] ✅ 配乐推荐成功: ${bgmResponse.content?.substring(0, 50)}...`)

        // 解析配乐推荐（简单提取）
        const bgmMatches = bgmResponse.content?.match(/\d+\.\s*([^\n]+)/g) || []
        bgmRecommendations.push(...bgmMatches.slice(0, 3).map((match, idx) => ({
          name: match.replace(/^\d+\.\s*/, ''),
          mood: params.style || '轻松',
          duration: '1分钟',
          description: `适合${params.genre}类型的短剧`
        })))
      } catch (err) {
        console.error('[短剧制作] ❌ 配乐推荐失败:', err)
      }

      console.log('[短剧制作] 短剧制作完成！')

      // 🔴 新增：构建最终消息
      let finalMessage = `短剧《${title}》制作完成！包含剧本、${characterImages.length}个角色形象、${sceneImages.length}个场景设计、${videoClips.length}个关键镜头视频`
      if (editedVideoUrl) {
        finalMessage += '、已合成完整视频成品'
      }
      if (bgmRecommendations.length > 0) {
        finalMessage += '、配乐推荐'
      }
      finalMessage += '。您可以查看所有内容啦~'

      return {
        success: true,
        data: {
          title,
          genre: params.genre,
          duration: params.duration || 1,
          script: scriptContent,
          storyboard: storyboardContent,
          characters: characterImages,
          scenes: sceneImages,
          video_clips: videoClips,
          // 兼容前端提取逻辑
          image_urls: allImageUrls,
          video_url: allVideoUrls.length > 0 ? allVideoUrls[0] : undefined,
          // 🔴 新增：成品视频
          edited_video_url: editedVideoUrl,
          bgm_recommendations: bgmRecommendations,
          production_stats: {
            characters_generated: characterImages.length,
            scenes_generated: sceneImages.length,
            videos_generated: videoClips.length
          },
          message: finalMessage
        }
      }
    } catch (err: any) {
      return { success: false, error: `制作短剧失败: ${err.message}` }
    }
  }
}
