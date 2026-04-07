import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter, navigateBack, showToast, useUnload } from '@tarojs/taro'
import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, Send, Volume2, Loader } from 'lucide-react-taro'
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
  
  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  const socketRef = useRef<Taro.SocketTask | null>(null)
  const recorderManager = useRef<Taro.RecorderManager | null>(null)
  const audioContext = useRef<Taro.InnerAudioContext | null>(null)
  const durationTimer = useRef<NodeJS.Timeout | null>(null)

  // 初始化 WebSocket 连接
  const connectWebSocket = () => {
    const userId = Taro.getStorageSync('userId') || 'guest-user'
    const serverUrl = 'ws://localhost:3000/voice-call'
    
    console.log('[语音通话] 连接 WebSocket:', serverUrl)
    
    Taro.connectSocket({
      url: `${serverUrl}?userId=${userId}`,
      success: () => {
        console.log('[语音通话] WebSocket 连接成功')
      },
      fail: (err) => {
        console.error('[语音通话] WebSocket 连接失败:', err)
        showToast({ title: '连接失败', icon: 'none' })
      }
    }).then(task => {
      socketRef.current = task
      
      task.onOpen(() => {
        console.log('[语音通话] WebSocket 已打开')
        setConnected(true)
      })

      task.onMessage((res) => {
        console.log('[语音通话] 收到消息:', res.data)
        try {
          const data = JSON.parse(res.data as string)
          handleSocketMessage(data)
        } catch (e) {
          console.error('[语音通话] 解析消息失败:', e)
        }
      })

      task.onClose(() => {
        console.log('[语音通话] WebSocket 关闭')
        setConnected(false)
      })

      task.onError((err) => {
        console.error('[语音通话] WebSocket 错误:', err)
        showToast({ title: '连接错误', icon: 'none' })
      })
    })
  }

  // 处理 WebSocket 消息
  const handleSocketMessage = (data: any) => {
    switch (data.event || data[0]) {
      case 'call-started':
        setCallId(data.callId || data[1]?.callId)
        setCallStatus('active')
        const startedData = data.callId ? data : data[1]
        setMessages([{
          role: 'assistant',
          content: startedData.greeting,
          audioUrl: startedData.audioUrl,
          timestamp: Date.now()
        }])
        playAudio(startedData.audioUrl)
        startDurationTimer()
        break

      case 'processing':
        setIsProcessing(true)
        break

      case 'receive-reply':
        setIsProcessing(false)
        const replyData = data.userText ? data : data[1]
        setMessages(prev => [
          ...prev,
          { role: 'user', content: replyData.userText, timestamp: Date.now() },
          { role: 'assistant', content: replyData.replyText, audioUrl: replyData.audioUrl, timestamp: Date.now() }
        ])
        playAudio(replyData.audioUrl)
        break

      case 'call-ended':
        setCallStatus('ended')
        stopDurationTimer()
        const endedData = data.duration ? data : data[1]
        showToast({ title: `通话结束，时长 ${Math.floor(endedData.duration / 1000)}秒`, icon: 'none' })
        break
    }
  }

  // 发送 WebSocket 消息
  const emit = (event: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.send({
        data: JSON.stringify({ event, ...data })
      })
    }
  }

  // 初始化录音管理器
  useEffect(() => {
    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }
    
    if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
      recorderManager.current = Taro.getRecorderManager()
      
      recorderManager.current.onStart(() => {
        console.log('[录音] 开始录音')
      })
      
      recorderManager.current.onStop((res) => {
        console.log('[录音] 录音结束:', res)
        handleRecordingComplete(res.tempFilePath)
      })
      
      recorderManager.current.onError((err) => {
        console.error('[录音] 录音错误:', err)
        setIsRecording(false)
        showToast({ title: '录音失败', icon: 'none' })
      })
    }

    // 连接 WebSocket
    connectWebSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.close({})
      }
    }
  }, [])

  // 页面卸载时结束通话
  useUnload(() => {
    if (callId) {
      emit('end-call', { callId })
    }
    stopDurationTimer()
    if (socketRef.current) {
      socketRef.current.close({})
    }
  })

  const startDurationTimer = () => {
    durationTimer.current = setInterval(() => {
      setDuration(prev => prev + 1)
    }, 1000)
  }

  const stopDurationTimer = () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current)
      durationTimer.current = null
    }
  }

  const playAudio = (audioUrl: string) => {
    if (!audioContext.current) {
      audioContext.current = Taro.createInnerAudioContext()
    }
    
    audioContext.current.src = audioUrl
    audioContext.current.onPlay(() => {
      console.log('[音频] 开始播放')
    })
    audioContext.current.onError((err) => {
      console.error('[音频] 播放错误:', err)
    })
    audioContext.current.play()
  }

  const startCall = async () => {
    if (!connected) {
      showToast({ title: '未连接到服务器', icon: 'none' })
      return
    }

    setCallStatus('connecting')
    console.log('[语音通话] 发起通话:', { avatarId, friendId })

    emit('start-call', {
      avatarId,
      friendAvatarId: friendId,
      userId: Taro.getStorageSync('userId') || 'guest-user'
    })
  }

  const endCall = () => {
    if (callId) {
      emit('end-call', { callId })
      stopDurationTimer()
    }
  }

  const startRecording = () => {
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
      showToast({ title: '录音功能仅在小程序中可用', icon: 'none' })
      return
    }

    if (!callId || callStatus !== 'active') {
      showToast({ title: '通话未开始', icon: 'none' })
      return
    }

    if (isRecording) return

    setIsRecording(true)
    recorderManager.current?.start({
      format: 'mp3',
      sampleRate: 16000,
      numberOfChannels: 1
    })
  }

  const stopRecording = () => {
    if (!isRecording) return
    setIsRecording(false)
    recorderManager.current?.stop()
  }

  const handleRecordingComplete = async (tempFilePath: string) => {
    console.log('[语音通话] 上传录音:', tempFilePath)

    try {
      // 上传音频文件
      const uploadRes = await Network.uploadFile({
        url: '/api/upload',
        filePath: tempFilePath,
        name: 'file'
      })

      console.log('[语音通话] 上传结果:', uploadRes)

      const uploadData = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
      if (uploadData?.code === 200) {
        const audioUrl = uploadData.data.url
        
        // 发送语音消息
        emit('send-audio', {
          callId,
          audioUrl
        })
      } else {
        showToast({ title: '上传失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[语音通话] 上传录音失败:', error)
      showToast({ title: '上传失败', icon: 'none' })
    }
  }

  const sendTextMessage = () => {
    if (!inputText.trim() || !callId || callStatus !== 'active') return

    emit('send-text', {
      callId,
      text: inputText.trim()
    })

    setInputText('')
  }

  const handleInputChange = (e: any) => {
    setInputText(e.detail.value)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <View className="vc-page">
      {/* 顶部状态栏 */}
      <View className="vc-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="vc-header-back" onClick={() => navigateBack()}>
          <Text className="vc-back-text">返回</Text>
        </View>
        <Text className="vc-header-title">{decodeURIComponent(friendName || '语音通话')}</Text>
        <View style={{ width: `${capsuleWidth}rpx` }}>
          <Text className="vc-duration">{formatDuration(duration)}</Text>
        </View>
      </View>

      {/* 通话状态显示 */}
      <View className="vc-status-section">
        {callStatus === 'idle' && (
          <View className="vc-idle-status">
            <View className="vc-avatar-circle">
              <Image 
                src="https://coze-coding-project.tos.coze.site/default-avatar.png" 
                className="vc-avatar-img" 
              />
            </View>
            <Text className="vc-status-text">准备与 {decodeURIComponent(friendName || '好友')} 通话</Text>
            <View className="vc-start-btn" onClick={startCall}>
              <PhoneOff size={24} color="#fff" />
              <Text className="vc-start-btn-text">开始通话</Text>
            </View>
          </View>
        )}

        {callStatus === 'connecting' && (
          <View className="vc-connecting-status">
            <View className="vc-spinning">
              <Loader size={48} color="#00f5ff" />
            </View>
            <Text className="vc-status-text">正在连接...</Text>
          </View>
        )}

        {(callStatus === 'active' || callStatus === 'ended') && (
          <ScrollView className="vc-messages" scrollY scrollIntoView={`msg-${messages.length - 1}`}>
            {messages.map((msg, idx) => (
              <View key={idx} id={`msg-${idx}`} className={`vc-message vc-message-${msg.role}`}>
                <View className="vc-message-content">
                  <Text className="vc-message-text">{msg.content}</Text>
                </View>
                {msg.audioUrl && (
                  <View className="vc-message-audio" onClick={() => playAudio(msg.audioUrl!)}>
                    <Volume2 size={16} color={msg.role === 'user' ? '#fff' : '#00f5ff'} />
                    <Text className="vc-audio-text">播放</Text>
                  </View>
                )}
              </View>
            ))}
            {isProcessing && (
              <View className="vc-processing">
                <View className="vc-spinning">
                  <Loader size={20} color="#00f5ff" />
                </View>
                <Text className="vc-processing-text">思考中...</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* 底部控制区 */}
      {callStatus === 'active' && (
        <View className="vc-controls">
          {/* 文本输入 */}
          <View className="vc-input-section">
            <View className="vc-input-wrapper">
              <input
                className="vc-input"
                placeholder="输入消息..."
                value={inputText}
                onInput={handleInputChange}
              />
            </View>
            <View className="vc-send-btn" onClick={sendTextMessage}>
              <Send size={20} color="#00f5ff" />
            </View>
          </View>

          {/* 语音控制 */}
          <View className="vc-voice-controls">
            <View 
              className={`vc-voice-btn ${isRecording ? 'vc-voice-btn-active' : ''}`}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
            >
              {isRecording ? (
                <MicOff size={32} color="#fff" />
              ) : (
                <Mic size={32} color="#fff" />
              )}
              <Text className="vc-voice-btn-text">
                {isRecording ? '松开发送' : '按住说话'}
              </Text>
            </View>

            <View className="vc-end-btn" onClick={endCall}>
              <PhoneOff size={24} color="#fff" />
              <Text className="vc-end-btn-text">结束通话</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
