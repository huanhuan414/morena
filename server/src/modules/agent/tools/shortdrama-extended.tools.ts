/**
 * 短剧扩展工具
 * 多集连续短剧、配音生成、视频剪辑、字幕生成、配乐推荐
 */

import { Injectable } from '@nestjs/common'
import { LLMClient, Config, TTSClient, VideoEditClient, SubtitleConfig, TextItem } from 'coze-coding-dev-sdk'
import { ITool, ToolContext, ToolDefinition } from './tool.interface'
import { ToolResult } from '../agent.types'

/**
 * 多集连续短剧生成工具
 * 根据主题生成连续的多集短剧剧本
 */
@Injectable()
export class GenerateMultiEpisodeDramaTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'generate_multi_episode_drama',
    displayName: '生成多集连续短剧',
    description: '根据主题生成连续的多集短剧剧本，每集都有独立的剧情但整体形成连续故事线。支持生成 3-10 集连续短剧。',
    category: 'content_creation',
    paramsSchema: {
      theme: { type: 'string', description: '短剧主题/故事梗概', required: true },
      genre: { type: 'string', enum: ['爱情', '悬疑', '喜剧', '剧情', '都市', '古装', '科幻', '青春'], default: '剧情' },
      episode_count: { type: 'number', description: '集数（3-10集）', default: 5 },
      episode_duration: { type: 'number', description: '每集时长（分钟）', default: 3 },
      style: { type: 'string', enum: ['轻松', '紧张', '温馨', '励志', '治愈', '搞笑'], default: '轻松' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const client = new LLMClient(config)

      const emotionTone = {
        轻松: '轻快、愉悦、放松',
        紧张: '紧凑、刺激、压迫感',
        温馨: '温暖、感人、治愈',
        励志: '积极、向上、充满正能量',
        治愈: '柔和、舒缓、抚慰心灵',
        搞笑: '幽默、诙谐、轻松愉快'
      }

      const prompt = `你是一位专业的连续剧编剧大师。请为以下主题创作一部连续短剧：

【创作要求】
主题：${params.theme}
类型：${params.genre}
集数：${params.episode_count}集
每集时长：${params.episode_duration || 3}分钟
情感基调：${emotionTone[params.style] || emotionTone.轻松}

【整体故事架构】
请先设计整体故事线，包括：
- 核心冲突
- 主要人物关系
- 故事主线
- 故事结局

【分集剧本】

请按照以下格式为每一集生成剧本：

## 第1集：集名

### 集情概述
（本集主要剧情，100字以内）

### 场景列表
1. 场景名 - 时段 - 场地描述
2. ...

### 剧本正文
（共2-3场戏，每场包含场景、人物、剧情、对白）
- 第1场：场景名 - 时段
【场景】
【人物】
【剧情】
【对白】

- 第2场：...

### 集末悬念
（结尾设置悬念，吸引看下一集）

---

## 第2集：集名
（重复以上格式）

...

【创作要点】
1. 每集都要独立完整，同时推动整体剧情
2. 集末要有悬念或转折
3. 人物关系要在每集中逐步展开
4. 整体故事要有起承转合
5. 人物性格要保持一致

现在开始创作连续剧：`

      const response = await client.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      const scriptContent = response.content.trim()

      // 提取集名列表
      const episodeTitles: string[] = []
      const titleRegex = /第\d+集[：:]\s*(.+?)(?:\n|$)/g
      let match
      while ((match = titleRegex.exec(scriptContent)) !== null) {
        episodeTitles.push(match[1].trim())
      }

      return {
        success: true,
        data: {
          theme: params.theme,
          genre: params.genre,
          episode_count: params.episode_count,
          episode_duration: params.episode_duration || 3,
          episodes: episodeTitles,
          script: scriptContent,
          total_duration: (params.episode_count || 5) * (params.episode_duration || 3),
          message: `已生成${params.episode_count}集连续短剧剧本，共${(params.episode_count || 5) * (params.episode_duration || 3)}分钟`
        }
      }
    } catch (err: any) {
      return { success: false, error: `生成多集短剧失败: ${err.message}` }
    }
  }
}

/**
 * 配音生成工具
 * 为短剧对白生成 TTS 配音
 */
@Injectable()
export class GenerateDramaVoiceoverTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'generate_drama_voiceover',
    displayName: '生成短剧配音',
    description: '为短剧剧本中的对白生成 TTS 配音，支持多个角色使用不同声音。自动识别角色对白并生成对应的音频文件。',
    category: 'content_creation',
    paramsSchema: {
      script_content: { type: 'string', description: '剧本内容（包含角色对白）', required: true },
      voice_mapping: { type: 'object', description: '角色到声音的映射（可选），如 {\"主角1\": \"zh_female_xiaohe_uranus_bigtts\", \"主角2\": \"zh_male_m191_uranus_bigtts\"}' },
      emotion: { type: 'string', enum: ['自然', '激情', '悲伤', '愤怒', '温柔', '紧张'], default: '自然' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const ttsClient = new TTSClient(config)

      // 默认声音映射
      const defaultVoiceMapping = {
        主角1: 'zh_female_xiaohe_uranus_bigtts',
        主角2: 'zh_male_m191_uranus_bigtts',
        男主角: 'zh_male_dayi_saturn_bigtts',
        女主角: 'zh_female_xiaohe_uranus_bigtts'
      }

      const voiceMapping = { ...defaultVoiceMapping, ...params.voice_mapping }

      // 提取对白
      const dialogues: Array<{ character: string; text: string; line_number: number }> = []
      const dialogueRegex = /(.+?)[：:]\s*「(.+?)」|(.+?)[：:]\s*"(.+?)"|(.+?)[：:]\s*'(.+?)'/g
      let match
      let lineNum = 0

      while ((match = dialogueRegex.exec(params.script_content)) !== null) {
        lineNum++
        const character = (match[1] || match[3] || match[5]).trim()
        const text = (match[2] || match[4] || match[6]).trim()
        if (character && text) {
          dialogues.push({ character, text, line_number: lineNum })
        }
      }

      console.log(`[配音生成] 提取到 ${dialogues.length} 条对白`)

      // 为每条对白生成语音
      const voiceoverFiles: any[] = []

      for (let i = 0; i < Math.min(dialogues.length, 20); i++) {
        const dialogue = dialogues[i]
        const speaker = voiceMapping[dialogue.character] || voiceMapping['主角1']

        try {
          const response = await ttsClient.synthesize({
            uid: `user_${Date.now()}`,
            text: dialogue.text,
            speaker,
            audioFormat: 'mp3',
            sampleRate: 24000
          })

          voiceoverFiles.push({
            character: dialogue.character,
            line_number: dialogue.line_number,
            text: dialogue.text,
            audio_url: response.audioUri,
            speaker
          })

          console.log(`[配音生成] 已生成第 ${i + 1} 条对白: ${dialogue.character}`)
        } catch (err) {
          console.error(`[配音生成] 生成对白失败:`, err)
        }
      }

      return {
        success: true,
        data: {
          dialogues_extracted: dialogues.length,
          voiceovers_generated: voiceoverFiles.length,
          voiceover_files: voiceoverFiles,
          voice_mapping: voiceMapping,
          message: `已为 ${dialogues.length} 条对白中的 ${voiceoverFiles.length} 条生成配音`
        }
      }
    } catch (err: any) {
      return { success: false, error: `生成配音失败: ${err.message}` }
    }
  }
}

/**
 * 视频剪辑工具
 * 将多个镜头视频剪辑成完整短剧
 */
@Injectable()
export class EditShortDramaVideoTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'edit_shortdrama_video',
    displayName: '剪辑短剧视频',
    description: '将多个镜头视频剪辑成完整的短剧视频，支持添加转场效果。自动按顺序拼接多个视频片段，并添加专业转场。',
    category: 'content_creation',
    paramsSchema: {
      video_clips: { type: 'array', items: { type: 'string' }, description: '视频片段URL列表', required: true },
      transitions: { type: 'boolean', description: '是否添加转场效果', default: true },
      transition_style: { type: 'string', enum: ['圆形打开', '百叶窗', '风吹', '旋转放大', '梦幻放大', '故障转换'], default: '圆形打开' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const videoEditClient = new VideoEditClient(config)

      // 转场ID映射
      const transitionIds: { [key: string]: string } = {
        '圆形打开': '1182376',
        '百叶窗': '1182356',
        '风吹': '1182357',
        '旋转放大': '1182360',
        '梦幻放大': '1182369',
        '故障转换': '1182367'
      }

      const videoClips = params.video_clips || []

      if (videoClips.length < 2) {
        return {
          success: false,
          error: '至少需要2个视频片段才能剪辑'
        }
      }

      console.log(`[视频剪辑] 开始剪辑 ${videoClips.length} 个视频片段`)

      // 准备转场列表
      let transitions: string[] = []
      if (params.transitions) {
        const transitionId = transitionIds[params.transition_style] || transitionIds['圆形打开']
        transitions = new Array(videoClips.length - 1).fill(transitionId)
      }

      // 拼接视频
      const response = await videoEditClient.concatVideos(videoClips, {
        transitions: transitions.length > 0 ? transitions : undefined
      })

      console.log(`[视频剪辑] 剪辑完成，输出视频: ${response.url}`)

      return {
        success: true,
        data: {
          input_clips_count: videoClips.length,
          output_video_url: response.url,
          video_meta: response.video_meta,
          transitions_used: transitions.length,
          transition_style: params.transition_style,
          message: `已将 ${videoClips.length} 个视频片段剪辑成完整短剧`
        }
      }
    } catch (err: any) {
      return { success: false, error: `剪辑视频失败: ${err.message}` }
    }
  }
}

/**
 * 字幕生成工具
 * 为短剧视频生成字幕
 */
@Injectable()
export class GenerateSubtitleTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'generate_subtitle',
    displayName: '生成短剧字幕',
    description: '为短剧视频生成字幕，支持从对白文本生成时间轴字幕或从视频音频自动识别生成字幕。',
    category: 'content_creation',
    paramsSchema: {
      video_url: { type: 'string', description: '视频URL', required: true },
      dialogues: { type: 'array', items: { type: 'object' }, description: '对白列表（可选），格式: [{character, text, start_time, end_time}]' },
      subtitle_style: { type: 'string', enum: ['简洁', '专业', '彩色'], default: '简洁' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const videoEditClient = new VideoEditClient(config)

      // 字幕样式配置
      const subtitleStyles = {
        简洁: {
          font_size: 36,
          font_color: '#FFFFFFFF',
          background_color: '#00000000',
          border_width: 0
        },
        专业: {
          font_size: 36,
          font_color: '#FFFFFFFF',
          background_color: '#00000088',
          border_width: 1,
          border_color: '#00000088'
        },
        彩色: {
          font_size: 40,
          font_color: '#FFFF00FF',
          background_color: '#00000066',
          border_width: 2,
          border_color: '#FFFFFF88'
        }
      }

      const style = subtitleStyles[params.subtitle_style] || subtitleStyles.简洁

      const subtitleConfig: SubtitleConfig = {
        font_pos_config: {
          pos_x: '0',
          pos_y: '90%',
          width: '100%',
          height: '10%'
        },
        font_size: style.font_size,
        font_color: style.font_color,
        font_type: '1525745',
        background_color: style.background_color,
        border_width: style.border_width,
        border_color: style.border_color || '#00000088'
      }

      let textList: TextItem[] = []

      // 如果提供了对白列表，使用对白生成字幕
      if (params.dialogues && Array.isArray(params.dialogues) && params.dialogues.length > 0) {
        const dialogues = params.dialogues
        const avgDuration = 30 / dialogues.length // 假设视频30秒，平均分配时长

        textList = dialogues.map((d: any, index: number) => ({
          start_time: d.start_time || index * avgDuration,
          end_time: d.end_time || (index + 1) * avgDuration,
          text: d.text || ''
        }))
      } else {
        // 否则从视频音频自动识别字幕
        console.log('[字幕生成] 从视频音频自动识别字幕...')
        const subtitleResponse = await videoEditClient.audioToSubtitle(params.video_url, {
          subtitleType: 'srt'
        })

        console.log('[字幕生成] 字幕文件已生成')

        return {
          success: true,
          data: {
            subtitle_file_url: subtitleResponse.url,
            subtitle_format: 'srt',
            method: 'audio_recognition',
            message: '已从视频音频自动生成字幕文件（SRT格式）'
          }
        }
      }

      // 添加字幕到视频
      const response = await videoEditClient.addSubtitles(params.video_url, subtitleConfig, {
        textList
      })

      console.log(`[字幕生成] 字幕已添加到视频: ${response.url}`)

      return {
        success: true,
        data: {
          video_with_subtitle_url: response.url,
          subtitle_lines_count: textList.length,
          subtitle_style: params.subtitle_style,
          method: 'text_list',
          message: `已为视频添加 ${textList.length} 条字幕`
        }
      }
    } catch (err: any) {
      return { success: false, error: `生成字幕失败: ${err.message}` }
    }
  }
}

/**
 * 配乐推荐工具
 * 根据情感基调推荐合适的背景音乐
 */
@Injectable()
export class RecommendBGMTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'recommend_bgm',
    displayName: '推荐短剧配乐',
    description: '根据短剧的情感基调推荐合适的背景音乐类型和风格，提供音乐选择建议。',
    category: 'content_creation',
    paramsSchema: {
      emotion: { type: 'string', enum: ['轻松', '紧张', '温馨', '励志', '治愈', '搞笑', '悲伤', '悬疑'], required: true },
      genre: { type: 'string', enum: ['爱情', '悬疑', '喜剧', '剧情', '都市', '古装', '科幻', '青春'], default: '剧情' },
      scene_type: { type: 'string', enum: ['开场', '高潮', '转折', '结局', '日常'], default: '日常' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const client = new LLMClient(config)

      const emotion = params.emotion
      const genre = params.genre
      const sceneType = params.scene_type

      const prompt = `你是一位专业的配乐师。请为以下短剧场景推荐合适的背景音乐：

【场景信息】
情感基调：${emotion}
类型：${genre}
场景类型：${sceneType}

【配乐建议格式】
请按照以下格式输出：

## 推荐配乐风格
（描述适合的音乐风格，如：轻快流行、抒情钢琴、紧张管弦乐等）

## 推荐乐器
（列出推荐的乐器组合，如：钢琴+小提琴、电子合成器、吉他等）

## 节奏与速度
（描述音乐的节奏和速度，如：中速 120BPM、慢速 60-80BPM、快速 140BPM+）

## 音乐结构建议
（描述音乐的结构，如：主歌-副歌-桥段、渐强-高潮-渐弱等）

## 具体曲目风格描述
（用3-5句话描述音乐的听感，方便寻找类似的配乐）

## 情感对应
（说明这种音乐如何配合场景的情感基调）

---

现在开始推荐配乐：`

      const response = await client.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.7
      })

      const bgmRecommendation = response.content.trim()

      // 提取关键词
      const keywords = [
        emotion,
        genre,
        sceneType,
        bgmRecommendation.substring(0, 100)
      ].join(', ')

      return {
        success: true,
        data: {
          emotion,
          genre,
          scene_type: sceneType,
          recommendation: bgmRecommendation,
          search_keywords: keywords,
          message: `已为 ${emotion} 风格的 ${genre} 短剧推荐配乐`
        }
      }
    } catch (err: any) {
      return { success: false, error: `推荐配乐失败: ${err.message}` }
    }
  }
}

// 导出所有短剧扩展工具
export {
  GenerateMultiEpisodeDramaTool,
  GenerateDramaVoiceoverTool,
  EditShortDramaVideoTool,
  GenerateSubtitleTool,
  RecommendBGMTool
}
