// @ts-nocheck
import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { VoiceCloneService } from './voice-clone.service'

@Controller('voice-clone')
export class VoiceCloneController {
  constructor(private readonly voiceCloneService: VoiceCloneService) {}

  /**
   * 获取预设音色列表
   */
  @Get('presets')
  @HttpCode(HttpStatus.OK)
  async getPresetVoices() {
    const result = this.voiceCloneService.getPresetVoices()
    return { code: 200, msg: 'success', data: result.data }
  }

  /**
   * 开始声音复刻训练
   * @param body 包含 audio_url 和 user_id
   */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  async startVoiceClone(@Body() body: { audio_url: string; user_id: string }) {
    console.log('[VoiceCloneController] 开始声音复刻:', body)
    
    if (!body.audio_url) {
      return { code: 400, msg: '音频文件不能为空', data: null }
    }

    const result = await this.voiceCloneService.startVoiceClone(
      body.audio_url,
      body.user_id || 'anonymous'
    )

    if (result.success) {
      return { code: 200, msg: 'success', data: result.data }
    } else {
      return { code: 500, msg: result.error || '声音复刻失败', data: null }
    }
  }

  /**
   * 查询声音复刻状态
   * @param voiceId 复刻声音ID
   */
  @Get('status/:voiceId')
  @HttpCode(HttpStatus.OK)
  async getVoiceCloneStatus(@Param('voiceId') voiceId: string) {
    console.log('[VoiceCloneController] 查询复刻状态:', voiceId)
    
    const result = await this.voiceCloneService.queryVoiceClone(voiceId)

    if (result.success) {
      return { code: 200, msg: 'success', data: result.data }
    } else {
      return { code: 500, msg: result.error || '查询失败', data: null }
    }
  }

  /**
   * 使用复刻声音进行TTS合成
   * @param body 包含 voice_id 和 text
   */
  @Post('synthesize')
  @HttpCode(HttpStatus.OK)
  async synthesizeSpeech(@Body() body: { voice_id: string; text: string }) {
    console.log('[VoiceCloneController] TTS合成:', body)
    
    if (!body.voice_id || !body.text) {
      return { code: 400, msg: 'voice_id 和 text 不能为空', data: null }
    }

    const result = await this.voiceCloneService.synthesizeSpeech(body.voice_id, body.text)

    if (result.success) {
      return { code: 200, msg: 'success', data: result.data }
    } else {
      return { code: 500, msg: result.error || 'TTS合成失败', data: null }
    }
  }
}
