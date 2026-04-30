import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter, navigateBack, showToast, useUnload } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, Send, Volume2, Loader, ArrowLeft } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import './index.css'

interface Message {
  role: 'user' | 'assistant'
  content: string
  audioUrl?: string
  timestamp: number
}

export default function VoiceCallPage() {
  const router = useRouter()
  const { avatarId, friendId, friendName } = router.params

  const [connected, setConnected] = useState(false)
  const [callId, setCallId] = useState<string | null>(null)
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [inputText, setInputText] = useState('')
  const [duration, setDuration] = useState(0)
  const [statusBarHeight, setStatusBarHeight] = useState(20)

  const socketRef = useRef<Taro.SocketTask | null>(null)
  const recorderManager = useRef<Taro.RecorderManager | null>(null)
  const audioContext = useRef<Taro.InnerAudioContext | null>(null)
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT

  // 初始化系统信息
  useEffect(() => {
    const info = Taro.getSystemInfoSync()
    setStatusBarHeight(info.statusBarHeight || 20)
  }, [])

  // 连接 WebSocket
  useEffect(() => {
    if (isMiniApp) {
      recorderManager.current = Taro.getRecorderManager()
      recorderManager.current.onStart(() => {
        console.log('[录音] 开始')
      })
      recorderManager.current.onStop((res) => {
        handleRecordingComplete(res.tempFilePath)
      })
      recorderManager.current.onError((err) => {
        console.error('[录音] 错误:', err)
        setIsRecording(false)
      })
    }

    connectSocket()
    return () => {
      if (socketRef.current) socketRef.current.close({})
    }
  }, [])

  const connectSocket = () => {
    const userId = Taro.getStorageSync('userId') || 'guest-user'
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000'
    const serverUrl = `${protocol}//${host}/voice-call`

    console.log('[语音通话] 连接 WebSocket:', serverUrl)

    Taro.connectSocket({ url: `${serverUrl}?userId=${userId}` })
      .then(task => {
        socketRef.current = task
        task.onOpen(() => {
          console.log('[语音通话] WebSocket 已连接')
          setConnected(true)
          startCall()
        })
        task.onMessage((res) => {
          try {
            const data = JSON.parse(res.data as string)
            handleSocketMessage(data)
          } catch (e) {
            console.error('[语音通话] 解析失败:', e)
          }
        })
        task.onClose(() => {
          console.log('[语音通话] 连接关闭')
          setConnected(false)
        })
        task.onError((err) => {
          console.error('[语音通话] 连接错误:', err)
        })
      })
      .catch(err => {
        console.error('[语音通话] 连接失败:', err)
      })
  }

  const handleSocketMessage = (data: any) => {
    console.log('[语音通话] 收到:', data)
    const evt = data.event || data.type

    if (evt === 'call-started') {
      setCallId(data.callId)
      setCallStatus('active')
      const greeting = data.greeting || data.replyText || '你好，有什么可以帮你的？'
      const audioUrl = data.audioUrl
      setMessages([{ role: 'assistant', content: greeting, audioUrl, timestamp: Date.now() }])
      if (audioUrl) playAudio(audioUrl)
      startDurationTimer()
    } else if (evt === 'processing') {
      setIsProcessing(true)
    } else if (evt === 'receive-reply') {
      setIsProcessing(false)
      const reply = data.replyText || ''
      const userText = data.userText || ''
      const audioUrl = data.audioUrl
      if (userText) {
        setMessages(prev => [...prev, { role: 'user', content: userText, timestamp: Date.now() }])
      }
      if (reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: reply, audioUrl, timestamp: Date.now() }])
        if (audioUrl) playAudio(audioUrl)
      }
    } else if (evt === 'call-ended') {
      setCallStatus('ended')
      stopDurationTimer()
      const dur = data.duration || 0
      showToast({ title: `通话结束 ${Math.floor(dur / 1000)}秒`, icon: 'none' })
    } else if (evt === 'error') {
      setCallStatus('idle')
      setIsProcessing(false)
      showToast({ title: data.message || '发生错误', icon: 'none' })
    }
  }

  const emit = (event: string, data: Record<string, unknown>) => {
    if (socketRef.current) {
      socketRef.current.send({ data: JSON.stringify({ event, ...data }) })
    }
  }

  useUnload(() => {
    if (callId) emit('end-call', { callId })
    stopDurationTimer()
    if (socketRef.current) socketRef.current.close({})
  })

  const startDurationTimer = () => {
    durationTimer.current = setInterval(() => setDuration(d => d + 1), 1000)
  }

  const stopDurationTimer = () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current)
      durationTimer.current = null
    }
  }

  const playAudio = (url: string) => {
    if (!audioContext.current) {
      audioContext.current = Taro.createInnerAudioContext()
    }
    audioContext.current.src = url
    audioContext.current.onPlay(() => console.log('[音频] 播放'))
    audioContext.current.onError((err) => console.error('[音频] 错误:', err))
    audioContext.current.play()
  }

  const startCall = () => {
    if (!connected) return
    setCallStatus('connecting')
    console.log('[语音通话] 发起:', { avatarId, friendId })
    emit('start-call', {
      avatarId,
      friendAvatarId: friendId,
      userId: Taro.getStorageSync('userId') || 'guest-user'
    })
  }

  const endCall = () => {
    if (callId) emit('end-call', { callId })
    stopDurationTimer()
    navigateBack()
  }

  const startRecording = () => {
    if (!isMiniApp) { showToast({ title: '录音仅在小程序中可用', icon: 'none' }); return }
    if (!callId || callStatus !== 'active') return
    if (isRecording) return
    setIsRecording(true)
    recorderManager.current?.start({ format: 'mp3', sampleRate: 16000, numberOfChannels: 1 })
  }

  const stopRecording = () => {
    if (!isRecording) return
    setIsRecording(false)
    recorderManager.current?.stop()
  }

  const handleRecordingComplete = async (tempFilePath: string) => {
    try {
      const uploadRes = await Network.uploadFile({
        url: '/api/upload/audio',
        filePath: tempFilePath,
        name: 'file'
      })
      const uploadData = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
      if (uploadData?.code === 200) {
        emit('send-audio', { callId, audioUrl: uploadData.data.url })
      } else {
        showToast({ title: '上传失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[上传]', err)
      showToast({ title: '上传失败', icon: 'none' })
    }
  }

  const sendText = () => {
    if (!inputText.trim() || !callId || callStatus !== 'active') return
    emit('send-text', { callId, text: inputText.trim() })
    setInputText('')
  }

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const decodedName = decodeURIComponent(friendName || '好友')

  return (
    <View className="vc-page">
      {/* 顶部导航栏 */}
      <View className="vc-top-bar" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="vc-nav-row">
          <View className="vc-back" onClick={() => callStatus !== 'idle' ? endCall() : navigateBack()}>
            <ArrowLeft size={20} color="#1A1A2E" />
          </View>
          <View className="vc-nav-center">
            <Text className="vc-nav-title">{decodedName}</Text>
            <Text className="vc-nav-subtitle">
              {callStatus === 'idle' && '准备通话'}
              {callStatus === 'connecting' && '连接中...'}
              {callStatus === 'active' && `通话中 · ${formatDuration(duration)}`}
              {callStatus === 'ended' && '通话已结束'}
            </Text>
          </View>
          {callStatus === 'active' && (
            <View className="vc-duration-tag">
              <Text className="vc-duration-tag-text">{formatDuration(duration)}</Text>
            </View>
          )}
          {callStatus !== 'active' && <View className="vc-nav-placeholder" />}
        </View>
      </View>

      {/* 主体内容 */}
      <View className="vc-content">
        {/* 头像区 */}
        <View className="vc-avatar-zone">
          <View className={`vc-avatar-ring ${callStatus === 'active' ? 'ring-active' : ''}`}>
            <View className="vc-avatar-circle">
              <Image
                src="https://coze-coding-project.tos.coze.site/default-avatar.png"
                className="vc-avatar-img"
              />
            </View>
          </View>
          <Text className="vc-friend-name">{decodedName}</Text>
          <Text className="vc-friend-desc">
            {callStatus === 'idle' && '准备好开始语音通话了吗？'}
            {callStatus === 'connecting' && '正在建立连接，请稍候...'}
            {callStatus === 'active' && '通话正在进行中'}
            {callStatus === 'ended' && '本次通话已结束'}
          </Text>
        </View>

        {/* 消息气泡 */}
        {(callStatus === 'active' || callStatus === 'ended') && messages.length > 0 && (
          <ScrollView className="vc-message-list" scrollY enhanced bounces={false}>
            {messages.map((msg, idx) => (
              <View key={idx} className={`vc-msg-row vc-msg-row-${msg.role}`}>
                {msg.role === 'assistant' && (
                  <View className="vc-msg-avatar">
                    <Image src="https://coze-coding-project.tos.coze.site/default-avatar.png" className="vc-msg-avatar-img" />
                  </View>
                )}
                <View className={`vc-bubble vc-bubble-${msg.role}`}>
                  <Text className="vc-bubble-text">{msg.content}</Text>
                  {msg.audioUrl && (
                    <View className="vc-bubble-play" onClick={() => playAudio(msg.audioUrl!)}>
                      <Volume2 size={13} color={msg.role === 'user' ? '#fff' : '#7B3FE4'} />
                      <Text className="vc-bubble-play-text">播放</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
            {isProcessing && (
              <View className="vc-msg-row vc-msg-row-assistant">
                <View className="vc-msg-avatar">
                  <Image src="https://coze-coding-project.tos.coze.site/default-avatar.png" className="vc-msg-avatar-img" />
                </View>
                <View className="vc-bubble vc-bubble-assistant">
                  <View className="vc-thinking">
                    <Loader size={15} color="#7B3FE4" />
                    <Text className="vc-thinking-text">思考中...</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* 开始通话按钮 */}
        {callStatus === 'idle' && (
          <View className="vc-idle-area">
            <View className="vc-call-main" onClick={startCall}>
              <View className="vc-call-icon">
                <PhoneOff size={30} color="#fff" style={{ transform: 'rotate(135deg)' }} />
              </View>
              <Text className="vc-call-main-text">发起通话</Text>
            </View>
          </View>
        )}

        {/* 等待连接 */}
        {callStatus === 'connecting' && (
          <View className="vc-connecting-area">
            <View className="vc-spinner">
              <Loader size={36} color="#7B3FE4" />
            </View>
            <Text className="vc-connecting-text">正在连接...</Text>
          </View>
        )}
      </View>

      {/* 底部控制栏 */}
      {callStatus === 'active' && (
        <View className="vc-bottom">
          {/* 输入区 */}
          <View className="vc-input-row">
            <View className="vc-input-box">
              <Input
                className="vc-input"
                placeholder="输入消息..."
                value={inputText}
                onInput={(e: any) => setInputText(e.detail.value)}
                onConfirm={sendText}
              />
            </View>
            <View className="vc-send-btn" onClick={sendText}>
              <Send size={18} color="#fff" />
            </View>
          </View>

          {/* 操作按钮 */}
          <View className="vc-action-row">
            <View
              className={`vc-voice-btn ${isRecording ? 'vc-voice-recording' : ''}`}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
            >
              {isRecording ? (
                <MicOff size={22} color="#fff" />
              ) : (
                <Mic size={22} color="#fff" />
              )}
              <Text className="vc-voice-label">{isRecording ? '松开发送' : '按住说话'}</Text>
            </View>

            <View className="vc-hangup" onClick={endCall}>
              <View className="vc-hangup-icon">
                <PhoneOff size={22} color="#fff" style={{ transform: 'rotate(135deg)' }} />
              </View>
              <Text className="vc-hangup-label">挂断</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
