import { useMemo, useState, useRef } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { ScrollView, Text, View, Image, Input as TaroInput, Video } from '@tarojs/components'
import { ArrowLeft, Check, GripVertical, Plus, X, Image as ImageIcon, Video as VideoIcon, Play, Users, Sparkles } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import './index.css'

type StepItem = {
  id: string
  group: string
  label: string
  description?: string
  data?: {
    url?: string
    image?: string
    video?: string
    copyData?: string
    exampleImage?: string
    exampleText?: string
    exampleUrl?: string
    materials?: { type: 'text' | 'image' | 'video'; content: string }[]
    distributeMode?: 'shared' | 'exclusive'
    useAiMaterial?: boolean
  }
}

const truncateStr = (str: string | undefined, maxLen = 20) => {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
};

const STEP_GROUPS = [
  {
    title: '任务入口',
    items: ['网址进入', '扫描二维码进入'],
  },
  {
    title: '任务说明',
    items: ['文字说明', '图片说明', '视频说明', '复制数据'],
  },
  {
    title: '发布素材',
    items: ['文字素材', '图片素材', '视频素材'],
  },
  {
    title: '验收内容',
    items: ['收集截图', '收集信息', '收集链接'],
  },
]

const getStepsStorageKey = (orderId: string) => `order_steps_${orderId || 'draft'}`

const isValidUrl = (url: string): boolean => {
  const trimmedUrl = url.trim()
  return trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
}

export default function OrderStepManagement() {
  const router = useRouter()
  const statusBarHeight = getStatusBarHeight()
  const orderId = String(router.params?.orderId || '')
  const storageKey = useMemo(() => getStepsStorageKey(orderId), [orderId])
  const [saveTemplate, setSaveTemplate] = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [steps, setSteps] = useState<StepItem[]>(() => {
    const stored = Taro.getStorageSync(storageKey)
    return Array.isArray(stored) ? stored : []
  })

  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')
  const [modalGroup, setModalGroup] = useState('')
  const [modalLabel, setModalLabel] = useState('')
  const [modalDescription, setModalDescription] = useState('')
  const [modalUrl, setModalUrl] = useState('')
  const [modalImage, setModalImage] = useState('')
  const [modalVideo, setModalVideo] = useState('')
  const [modalCopyData, setModalCopyData] = useState('')
  const [modalExampleText, setModalExampleText] = useState('')
  const [modalMaterials, setModalMaterials] = useState<{ type: 'text' | 'image' | 'video'; content: string }[]>([])
  const [modalMaterialInput, setModalMaterialInput] = useState('')
  const [modalDistributeMode, setModalDistributeMode] = useState<'shared' | 'exclusive'>('shared')
  const [modalUseAiMaterial, setModalUseAiMaterial] = useState(true)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const persistSteps = (nextSteps: StepItem[]) => {
    setSteps(nextSteps)
    Taro.setStorageSync(storageKey, nextSteps)
  }
  const editStep = (step: StepItem) => {
    setEditingStepId(step.id)
    setModalGroup(step.group)
    setModalLabel(step.label)
    setModalDescription(step.description || '')

    if (step.data) {
      setModalUrl(step.data.url || '')
      setModalImage(step.data.image || '')
      setModalVideo(step.data.video || '')
      setModalCopyData(step.data.copyData || '')
      setModalExampleText(step.data.exampleText || '')
      setModalMaterials(step.data.materials || [])
      setModalMaterialInput('')
      setModalDistributeMode(step.data.distributeMode || 'shared')
      setModalUseAiMaterial(step.data.useAiMaterial !== undefined ? step.data.useAiMaterial : true)
    } else {
      setModalUrl('')
      setModalImage('')
      setModalVideo('')
      setModalCopyData('')
      setModalExampleText('')
      setModalMaterials([])
      setModalMaterialInput('')
      setModalDistributeMode('shared')
      setModalUseAiMaterial(true)
    }

    const label = step.label
    if (label === '网址进入') {
      setModalType('url')
    } else if (label === '扫描二维码进入') {
      setModalType('qrcode')
    } else if (label === '文字说明') {
      setModalType('text')
    } else if (label === '图片说明') {
      setModalType('image')
    } else if (label === '视频说明') {
      setModalType('video')
    } else if (label === '复制数据') {
      setModalType('copyData')
    } else if (label === '收集截图') {
      setModalType('collectImage')
    } else if (label === '收集信息') {
      setModalType('collectText')
    } else if (label === '收集链接') {
      setModalType('collectUrl')
    } else if (label === '文字素材') {
      setModalType('materialText')
    } else if (label === '图片素材') {
      setModalType('materialImage')
    } else if (label === '视频素材') {
      setModalType('materialVideo')
    }

    setShowModal(true)
  }

  const addStep = (group: string, label: string) => {
    setEditingStepId(null)
    setModalGroup(group)
    setModalLabel(label)
    setModalDescription('')
    setModalUrl('')
    setModalImage('')
    setModalVideo('')
    setModalCopyData('')
    setModalExampleText('')
    setModalMaterials([])
    setModalMaterialInput('')
    setModalDistributeMode('shared')
    setModalUseAiMaterial(true)

    if (label === '网址进入') {
      setModalType('url')
    } else if (label === '扫描二维码进入') {
      setModalType('qrcode')
    } else if (label === '文字说明') {
      setModalType('text')
    } else if (label === '图片说明') {
      setModalType('image')
    } else if (label === '视频说明') {
      setModalType('video')
    } else if (label === '复制数据') {
      setModalType('copyData')
    } else if (label === '收集截图') {
      setModalType('collectImage')
    } else if (label === '收集信息') {
      setModalType('collectText')
    } else if (label === '收集链接') {
      setModalType('collectUrl')
    } else if (label === '文字素材') {
      setModalType('materialText')
    } else if (label === '图片素材') {
      setModalType('materialImage')
    } else if (label === '视频素材') {
      setModalType('materialVideo')
    } else {
      const nextSteps = [
        ...steps,
        {
          id: `step_${Date.now()}_${steps.length}`,
          group,
          label,
        },
      ]
      persistSteps(nextSteps)
      return
    }
    setShowSheet(false)
    setShowModal(true)
  }

  const handleModalConfirm = () => {
    const data: StepItem['data'] = {}

    if (modalType === 'url') {
      if (!modalUrl.trim()) {
        Taro.showToast({ title: '请输入网址', icon: 'none' })
        return
      }
      if (!isValidUrl(modalUrl.trim())) {
        Taro.showToast({ title: '请输入正确的网址', icon: 'none' })
        return
      }
      data.url = modalUrl.trim()
    } else if (modalType === 'qrcode') {
      if (!modalImage) {
        Taro.showToast({ title: '请上传二维码图片', icon: 'none' })
        return
      }
      data.image = modalImage
    } else if (modalType === 'text') {
      if (!modalDescription.trim()) {
        Taro.showToast({ title: '请输入说明', icon: 'none' })
        return
      }
    } else if (modalType === 'image') {
      if (!modalImage) {
        Taro.showToast({ title: '请上传说明图片', icon: 'none' })
        return
      }
      data.image = modalImage
    } else if (modalType === 'video') {
      if (!modalVideo) {
        Taro.showToast({ title: '请上传视频', icon: 'none' })
        return
      }
      data.video = modalVideo
    } else if (modalType === 'copyData') {
      if (!modalCopyData.trim()) {
        Taro.showToast({ title: '请填写数据', icon: 'none' })
        return
      }
      data.copyData = modalCopyData.trim()
    } else if (modalType === 'collectImage') {
      if (!modalImage) {
        Taro.showToast({ title: '请上传图片示例', icon: 'none' })
        return
      }
      data.exampleImage = modalImage
    } else if (modalType === 'collectText') {
      if (!modalExampleText.trim()) {
        Taro.showToast({ title: '请输入信息示例', icon: 'none' })
        return
      }
      data.exampleText = modalExampleText.trim()
    } else if (modalType === 'collectUrl') {
      if (!modalUrl.trim()) {
        Taro.showToast({ title: '请输入链接地址', icon: 'none' })
        return
      }
      if (!isValidUrl(modalUrl.trim())) {
        Taro.showToast({ title: '请输入正确的链接地址', icon: 'none' })
        return
      }
      data.exampleUrl = modalUrl.trim()
    } else if (modalType === 'materialText' || modalType === 'materialImage' || modalType === 'materialVideo') {
      if (!modalUseAiMaterial && modalMaterials.length === 0) {
        Taro.showToast({ title: '请至少添加一个素材', icon: 'none' })
        return
      }
      data.materials = modalMaterials
      data.distributeMode = modalDistributeMode
      if (modalType === 'materialText') {
        data.useAiMaterial = modalUseAiMaterial
      }
    }

    let nextSteps: StepItem[]
    if (editingStepId) {
      nextSteps = steps.map(step => {
        if (step.id === editingStepId) {
          return {
            ...step,
            group: modalGroup,
            label: modalLabel,
            description: modalDescription,
            data: Object.keys(data).length > 0 ? data : undefined,
          }
        }
        return step
      })
    } else {
      nextSteps = [
        ...steps,
        {
          id: `step_${Date.now()}_${steps.length}`,
          group: modalGroup,
          label: modalLabel,
          description: modalDescription,
          data: Object.keys(data).length > 0 ? data : undefined,
        },
      ]
    }
    persistSteps(nextSteps)
    setShowModal(false)
    setEditingStepId(null)
  }

  const handleChooseImage = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'] })
      if (!res.tempFilePaths.length) return

      Taro.showLoading({ title: '上传中...', mask: true })
      const result = await Network.uploadFile({ url: '/api/upload/image', filePath: res.tempFilePaths[0], name: 'file' })
      Taro.hideLoading()

      let uploadData: any = result?.data
      if (typeof uploadData === 'string') {
        try {
          uploadData = JSON.parse(uploadData)
        } catch {
          uploadData = null
        }
      }

      if (uploadData?.code === 200 && uploadData?.data?.url) {
        setModalImage(uploadData.data.url)
      } else {
        Taro.showToast({ title: '图片上传失败', icon: 'none' })
      }
    } catch (e) {
      Taro.hideLoading()
      console.error('[图片上传] 错误:', e)
      Taro.showToast({ title: '图片上传失败', icon: 'none' })
    }
  }

  const handleChooseVideo = async () => {
    try {
      const res = await Taro.chooseVideo({ sourceType: ['album', 'camera'], compressed: true })
      if (!res.tempFilePath) return

      if (res.size > 50 * 1024 * 1024) {
        Taro.showToast({ title: '视频大小不能超过50MB', icon: 'none' })
        return
      }

      Taro.showLoading({ title: '上传中...', mask: true })

      const result = await Network.uploadFile({
        url: '/api/upload/video',
        filePath: res.tempFilePath,
        name: 'file',
        timeout: 120000
      })
      Taro.hideLoading()

      let uploadData: any = result?.data
      if (typeof uploadData === 'string') {
        try {
          uploadData = JSON.parse(uploadData)
        } catch {
          uploadData = null
        }
      }

      if (uploadData?.code === 200 && uploadData?.data?.url) {
        setModalVideo(uploadData.data.url)
      } else {
        Taro.showToast({ title: '视频上传失败', icon: 'none' })
      }
    } catch (e) {
      Taro.hideLoading()
      console.error('[视频上传] 错误:', e)
      Taro.showToast({ title: '视频上传失败', icon: 'none' })
    }
  }

  const removeStep = (id: string) => {
    persistSteps(steps.filter((item) => item.id !== id))
  }

  const handleAddMaterialText = () => {
    if (!modalMaterialInput.trim()) {
      Taro.showToast({ title: '请输入素材内容', icon: 'none' })
      return
    }
    if (modalMaterials.length >= 20) {
      Taro.showToast({ title: '最多只能添加20个素材', icon: 'none' })
      return
    }
    setModalMaterials(prev => [...prev, { type: 'text', content: modalMaterialInput.trim() }])
    setModalMaterialInput('')
  }

  const handleAddMaterialImage = async () => {
    if (modalMaterials.length >= 20) {
      Taro.showToast({ title: '最多只能添加20个素材', icon: 'none' })
      return
    }
    try {
      const remaining = 20 - modalMaterials.length
      const res = await Taro.chooseMedia({
        count: Math.min(9, remaining),
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
      })
      if (!res.tempFiles?.length) return

      Taro.showLoading({ title: '上传中...', mask: true })
      const newMaterials: { type: 'image'; content: string }[] = []
      for (const media of res.tempFiles) {
        try {
          const result = await Network.uploadFile({ url: '/api/upload/image', filePath: media.tempFilePath, name: 'file' })
          let uploadData: any = result?.data
          if (typeof uploadData === 'string') {
            try { uploadData = JSON.parse(uploadData) } catch { uploadData = null }
          }
          if (uploadData?.code === 200 && uploadData?.data?.url) {
            newMaterials.push({ type: 'image', content: uploadData.data.url })
          }
        } catch (e) { console.error('[图片上传] 错误:', e) }
      }
      Taro.hideLoading()
      if (newMaterials.length > 0) {
        setModalMaterials(prev => [...prev, ...newMaterials])
      }
      if (newMaterials.length < res.tempFiles.length) {
        Taro.showToast({ title: '部分图片上传失败', icon: 'none' })
      }
    } catch (e) {
      Taro.hideLoading()
      console.error('[图片上传] 错误:', e)
    }
  }

  const handleAddMaterialVideo = async () => {
    if (modalMaterials.length >= 20) {
      Taro.showToast({ title: '最多只能添加20个素材', icon: 'none' })
      return
    }
    try {
      const remaining = 20 - modalMaterials.length
      const res = await Taro.chooseMedia({
        count: Math.min(9, remaining),
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 60,
      })
      if (!res.tempFiles?.length) return

      for (const media of res.tempFiles) {
        if (media.size > 50 * 1024 * 1024) {
          Taro.showToast({ title: '视频大小不能超过50MB', icon: 'none' })
          return
        }
      }

      Taro.showLoading({ title: '上传中...', mask: true })
      const newMaterials: { type: 'video'; content: string }[] = []
      for (let i = 0; i < res.tempFiles.length; i++) {
        const media = res.tempFiles[i]
        try {
          const result = await Network.uploadFile({
            url: '/api/upload/video',
            filePath: media.tempFilePath,
            name: 'file',
            timeout: 120000
          })
          let uploadData: any = result?.data
          if (typeof uploadData === 'string') {
            try { uploadData = JSON.parse(uploadData) } catch { uploadData = null }
          }
          if (uploadData?.code === 200 && uploadData?.data?.url) {
            newMaterials.push({ type: 'video', content: uploadData.data.url })
          }
        } catch (e) { console.error('[视频上传] 错误:', e) }
      }
      Taro.hideLoading()
      if (newMaterials.length > 0) {
        setModalMaterials(prev => [...prev, ...newMaterials])
      }
      if (newMaterials.length < res.tempFiles.length) {
        Taro.showToast({ title: '部分视频上传失败', icon: 'none' })
      }
    } catch (e) {
      Taro.hideLoading()
      console.error('[视频上传] 错误:', e)
    }
  }

  const handleRemoveMaterial = (index: number) => {
    setModalMaterials(prev => prev.filter((_, i) => i !== index))
  }

  const handlePreview = () => {
    if (steps.length === 0) {
      Taro.showToast({ title: '请先添加步骤', icon: 'none' })
      return
    }
    Taro.navigateTo({
      url: `/package-order/pages/order-step-preview/index?orderId=${orderId}`,
    })
  }

  const handlePublish = () => {
    if (steps.length === 0) {
      Taro.showToast({ title: '请至少添加一个步骤', icon: 'none' })
      return
    }
    Taro.showToast({ title: '步骤已保存，发布接口待接入', icon: 'none' })
  }

  const getModalTitle = () => {
    if (modalType === 'url') return '输入网址'
    if (modalType === 'qrcode') return '传二维码'
    if (modalType === 'text') return '文字说明'
    if (modalType === 'image') return '图文说明'
    if (modalType === 'video') return '视频说明'
    if (modalType === 'copyData') return '复制数据'
    if (modalType === 'collectImage') return '收集截图'
    if (modalType === 'collectText') return '收集信息'
    if (modalType === 'collectUrl') return '收集链接'
    if (modalType === 'materialText') return '文字素材'
    if (modalType === 'materialImage') return '图片素材'
    if (modalType === 'materialVideo') return '视频素材'
    return ''
  }

  return (
    <View className="step-page">
      <View className="step-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="step-header-decoration">
          <View className="step-deco-circle step-circle-1" />
          <View className="step-deco-circle step-circle-2" />
        </View>
        <View className="step-header-content">
          <View className="step-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="step-header-center">
            <Text className="step-header-title">发布任务</Text>
            <Text className="step-header-desc">AI分身帮你创作，省时省力出爆款</Text>
          </View>
        </View>
      </View>

      <View className="step-toolbar">
        {/* <View className="template-row" onClick={() => setSaveTemplate(!saveTemplate)}> */}
        <View className="template-row">
          {/* <Checkbox checked={saveTemplate} onCheckedChange={setSaveTemplate} /> */}
          <Text className="template-text">设置步骤</Text>
        </View>
        <Button className="add-step-btn" onClick={() => setShowSheet(true)}>
          <Plus size={14} color="#fff" />
          <Text className="add-step-text">添加步骤</Text>
        </Button>
      </View>

      <Text className="drag-hint">长按“≡”拖动可以调整顺序，左滑删除</Text>

      <ScrollView scrollY className="step-content">
        {steps.length === 0 ? (
          <View className="empty-panel">
            <View className="empty-illustration">
              <View className="empty-paper paper-left" />
              <View className="empty-paper paper-main">
                <View className="paper-line short" />
                <View className="paper-line" />
                <View className="paper-line" />
                <View className="paper-line medium" />
              </View>
              <View className="empty-shadow" />
            </View>
            <Text className="empty-text">当前未添加步骤</Text>
          </View>
        ) : (
          <View className="step-list">
            {steps.map((step, index) => (
              <SwipeableStepCard
                key={step.id}
                step={step}
                index={index}
                onEdit={() => editStep(step)}
                onDelete={() => removeStep(step.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View className="step-bottom-bar">
        <Button variant="outline" className="preview-btn" onClick={handlePreview}>
          <Text className="preview-text">预览</Text>
        </Button>
        <Button className="publish-btn" onClick={handlePublish}>
          <Text className="publish-text">申请发布</Text>
        </Button>
      </View>

      {showSheet && (
        <View className="sheet-mask" onClick={() => setShowSheet(false)}>
          <View className="sheet-panel" onClick={(event) => event.stopPropagation()}>
            <View className="sheet-header">
              <Text className="sheet-title">添加步骤</Text>
              <View className="sheet-close" onClick={() => setShowSheet(false)}>
                <X size={18} color="#64748b" />
              </View>
            </View>
            <ScrollView scrollY className="sheet-body">
              {STEP_GROUPS.map((group) => (
                <View key={group.title} className="sheet-group">
                  <Text className="sheet-group-title">{group.title}</Text>
                  <View className="sheet-options">
                    {group.items.map((item) => (
                      <View key={item} className="sheet-option" onClick={() => addStep(group.title, item)}>
                        {/* <View className="sheet-option-icon">
                          <Check size={12} color="#1677ff" />
                        </View> */}
                        <Text className="sheet-option-text">{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {showModal && (
        <View className="step-modal-mask" onClick={() => setShowModal(false)}>
          <View className="step-modal-panel" onClick={(e) => e.stopPropagation()}>
            <View className="step-modal-header">
              <Text className="step-modal-title">{getModalTitle()}</Text>
              <View className="step-modal-close" onClick={() => setShowModal(false)}>
                <X size={18} color="#64748b" />
              </View>
            </View>
            <ScrollView scrollY className="step-modal-body">
              <View className="step-modal-form">
                <View className="step-modal-field">
                  <Text className="step-modal-field-label">步骤说明</Text>
                  <Textarea
                    className="step-modal-textarea"
                    placeholder="请输入说明..."
                    value={modalDescription}
                    onInput={(e) => setModalDescription(e.detail.value)}
                    maxlength={500}
                  />
                </View>

                {(modalType === 'url' || modalType === 'collectUrl') && (
                  <View className="step-modal-field">
                    <Text className="step-modal-field-label">
                      {modalType === 'url' ? '输入网址' : '链接地址'}
                    </Text>
                    <View className="step-modal-input-wrap">
                      <Input
                        className="step-modal-input"
                        placeholder={modalType === 'url' ? '请输入网址' : '请输入链接地址'}
                        value={modalUrl}
                        onInput={(e) => setModalUrl(e.detail.value)}
                      />
                    </View>
                  </View>
                )}

                {(modalType === 'qrcode' || modalType === 'image' || modalType === 'collectImage') && (
                  <View className="step-modal-field">
                    <Text className="step-modal-field-label">
                      {modalType === 'qrcode' ? '二维码图' : modalType === 'image' ? '图文说明' : '图片示例'}
                    </Text>
                    <View className="step-modal-image-picker" onClick={handleChooseImage}>
                      {modalImage ? (
                        <Image src={modalImage} className="step-modal-image-preview" mode="aspectFill" />
                      ) : (
                        <View className="step-modal-image-placeholder">
                          <ImageIcon size={40} color="#9ca3af" />
                          <Text className="step-modal-image-placeholder-text">选择图片</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {modalType === 'video' && (
                  <View className="step-modal-field">
                    <Text className="step-modal-field-label">视频</Text>
                    <View className="step-modal-video-picker" onClick={handleChooseVideo}>
                      {modalVideo ? (
                        <Video src={modalVideo} className="step-modal-video-preview" controls />
                      ) : (
                        <View className="step-modal-video-placeholder">
                          <VideoIcon size={40} color="#9ca3af" />
                          <Text className="step-modal-video-placeholder-text">选择视频</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {modalType === 'copyData' && (
                  <View className="step-modal-field">
                    <Text className="step-modal-field-label">填写数据</Text>
                    <View className="step-modal-input-wrap">
                      <Input
                        className="step-modal-input"
                        placeholder="请输入邀请码,钱包地址之类"
                        value={modalCopyData}
                        onInput={(e) => setModalCopyData(e.detail.value)}
                      />
                    </View>
                  </View>
                )}

                {modalType === 'collectText' && (
                  <View className="step-modal-field">
                    <Text className="step-modal-field-label">信息示例</Text>
                    <View className="step-modal-input-wrap">
                      <Input
                        className="step-modal-input"
                        placeholder="请输入信息示例"
                        value={modalExampleText}
                        onInput={(e) => setModalExampleText(e.detail.value)}
                      />
                    </View>
                  </View>
                )}
                {(modalType === 'materialText') && (
                  <View className="step-modal-field">
                    <View className="step-modal-field-header">
                      <Text className="step-modal-field-label">素材列表</Text>
                      <View
                        className={`material-ai-switch ${modalUseAiMaterial ? '' : 'active'}`}
                        onClick={() => setModalUseAiMaterial(!modalUseAiMaterial)}
                      >
                        <View className={`material-ai-switch-dot ${modalUseAiMaterial ? '' : 'active'}`} />
                      </View>
                    </View>

                    {!modalUseAiMaterial && (<View className="material-ai-toggle-row">
                      <View className="material-ai-toggle-left">
                        <Sparkles size={14} color="#8B5CF6" />
                        <Text className="material-ai-toggle-label">
                          {modalUseAiMaterial ? 'AI生成素材' : '自定义素材'}
                        </Text>
                      </View>

                      <Text className="material-ai-toggle-hint">
                        {/* {modalUseAiMaterial ? '分身接单时AI自动生成' : '使用您输入的素材'} */}
                        {modalMaterials.length === 0 ? '可选，最多上传20个素材' : `已选${modalMaterials.length}个素材，还可上传${20 - modalMaterials.length}个素材`}

                      </Text>
                    </View>)}

                    {!modalUseAiMaterial && (
                      <>
                        {/* 已上传素材缩略图网格 */}
                        {modalMaterials.length > 0 && (
                          <View className="material-upload-grid">
                            {modalMaterials.map((material, idx) => (
                              <View key={idx} className="material-preview-item">
                                <View className="material-preview-text-wrap">
                                  <Text className="material-preview-text" numberOfLines={3}>{material.content}</Text>
                                </View>
                                <View
                                  className="material-remove-btn"
                                  onClick={() => handleRemoveMaterial(idx)}
                                >
                                  <X size={12} color="#fff" />
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* 操作按钮行 */}
                        <View className="material-action-row">
                          <View className="material-input-row">
                            <Input
                              className="step-modal-input material-input"
                              placeholder="请输入素材内容"
                              value={modalMaterialInput}
                              onInput={(e) => setModalMaterialInput(e.detail.value)}
                              onConfirm={handleAddMaterialText}
                            />
                            <View className="material-add-text-btn" onClick={handleAddMaterialText}>
                              <Plus size={14} color="#6366F1" />
                              <Text className="material-add-text-btn-text">添加文字</Text>
                            </View>
                          </View>
                        </View>

                        {/* 素材分配模式 */}
                        <View className="material-distribute-row">
                          <View className="material-distribute-left">
                            <Users size={14} color="#1890ff" />
                            <Text className="material-distribute-label">素材分配</Text>
                          </View>
                          <View className="material-distribute-toggle">
                            <View
                              className={`material-distribute-opt ${modalDistributeMode === 'shared' ? 'active' : ''}`}
                              onClick={() => setModalDistributeMode('shared')}
                            >
                              <Text className={`material-distribute-opt-text ${modalDistributeMode === 'shared' ? 'active' : ''}`}>共享</Text>
                            </View>
                            <View
                              className={`material-distribute-opt ${modalDistributeMode === 'exclusive' ? 'active' : ''}`}
                              onClick={() => setModalDistributeMode('exclusive')}
                            >
                              <Text className={`material-distribute-opt-text ${modalDistributeMode === 'exclusive' ? 'active' : ''}`}>独占</Text>
                            </View>
                          </View>
                        </View>
                        <View className="material-mode-hint">
                          <Text className="material-mode-hint-text">
                            {modalDistributeMode === 'shared' ? '共享模式：所有分身使用相同的素材' : '独占模式：每个分身分配不同素材'}
                          </Text>
                        </View>
                      </>
                    )}

                    {modalUseAiMaterial && (
                      <View className="material-ai-mode-tip">
                        <Sparkles size={24} color="#8B5CF6" />
                        <Text className="material-ai-mode-tip-text">
                          AI分身时自动生成文案内容，无需手动上传
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {(modalType === 'materialImage' || modalType === 'materialVideo') && (
                  <View className="step-modal-field">
                    <View className="step-modal-field-header">
                      <Text className="step-modal-field-label">素材列表</Text>
                      <Text className="step-modal-field-count">
                        {modalMaterials.length === 0 ? '可选，最多上传20个素材' : `已选${modalMaterials.length}个素材，还可上传${20 - modalMaterials.length}个素材`}
                      </Text>
                    </View>

                    {/* 已上传素材缩略图网格 */}
                    {modalMaterials.length > 0 && (
                      <View className="material-upload-grid">
                        {modalMaterials.map((material, idx) => (
                          <View key={idx} className="material-preview-item">
                            {material.type === 'video' ? (
                              <View className="material-preview-video-wrap" onClick={() => Taro.previewMedia({ sources: [{ url: material.content, type: 'video' }], current: 0 })}>
                                <Video
                                  src={material.content}
                                  className="material-preview-video"
                                  muted
                                  autoplay={false}
                                  showPlayBtn={false}
                                  showFullscreenBtn={false}
                                  showCenterPlayBtn={false}
                                  controls={false}
                                  objectFit="cover"
                                />
                                <View className="material-video-play-icon">
                                  <Play size={20} color="#fff" filled />
                                </View>
                                <Text className="material-video-label">视频</Text>
                              </View>
                            ) : material.type === 'image' ? (
                              <Image src={material.content} className="material-preview-img" mode="aspectFill" />
                            ) : (
                              <View className="material-preview-text-wrap">
                                <Text className="material-preview-text" numberOfLines={3}>{material.content}</Text>
                              </View>
                            )}
                            <View
                              className="material-remove-btn"
                              onClick={() => handleRemoveMaterial(idx)}
                            >
                              <X size={12} color="#fff" />
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* 操作按钮行 */}
                    <View className="material-action-row">
                      <View
                        className="material-add-main"
                        onClick={modalType === 'materialImage' ? handleAddMaterialImage : modalType === 'materialVideo' ? handleAddMaterialVideo : handleAddMaterialImage}
                      >
                        <Plus size={16} color="#6366F1" />
                        <Text className="material-add-main-text">
                          {modalType === 'materialVideo' ? '添加视频' : modalType === 'materialImage' ? '添加图片' : '添加图片/视频'}
                        </Text>
                      </View>
                      {/* <View className="material-ai-btn" onClick={handleAiGenerateMaterial}>
                        <Text className="material-ai-btn-text">AI生成</Text>
                      </View> */}
                    </View>

                    {/* 素材分配模式 */}
                    <View className="material-distribute-row">
                      <View className="material-distribute-left">
                        <Users size={14} color="#1890ff" />
                        <Text className="material-distribute-label">素材分配</Text>
                      </View>
                      <View className="material-distribute-toggle">
                        <View
                          className={`material-distribute-opt ${modalDistributeMode === 'shared' ? 'active' : ''}`}
                          onClick={() => setModalDistributeMode('shared')}
                        >
                          <Text className={`material-distribute-opt-text ${modalDistributeMode === 'shared' ? 'active' : ''}`}>共享</Text>
                        </View>
                        <View
                          className={`material-distribute-opt ${modalDistributeMode === 'exclusive' ? 'active' : ''}`}
                          onClick={() => setModalDistributeMode('exclusive')}
                        >
                          <Text className={`material-distribute-opt-text ${modalDistributeMode === 'exclusive' ? 'active' : ''}`}>独占</Text>
                        </View>
                      </View>
                    </View>
                    <View className="material-mode-hint">
                      <Text className="material-mode-hint-text">
                        {modalDistributeMode === 'shared' ? '共享模式：所有分身使用相同的素材' : '独占模式：每个分身分配不同素材'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
            <View className="step-modal-footer">
              <Button className="step-modal-confirm" onClick={handleModalConfirm}>
                <Text className="step-modal-confirm-text">确定</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

interface SwipeableStepCardProps {
  step: StepItem
  index: number
  onEdit: () => void
  onDelete: () => void
}

function SwipeableStepCard({ step, index, onEdit, onDelete }: SwipeableStepCardProps) {
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)

  const deleteBtnWidth = 140

  const onTouchStart = (e: any) => {
    startXRef.current = e.touches[0].clientX
    currentXRef.current = translateX
    setIsDragging(true)
  }

  const onTouchMove = (e: any) => {
    if (!isDragging) return
    const diff = e.touches[0].clientX - startXRef.current
    let newTranslate = currentXRef.current + diff
    if (newTranslate > 0) newTranslate = 0
    if (newTranslate < -deleteBtnWidth) newTranslate = -deleteBtnWidth
    setTranslateX(newTranslate)
  }

  const onTouchEnd = () => {
    setIsDragging(false)
    if (translateX < -deleteBtnWidth / 2) {
      setTranslateX(-deleteBtnWidth)
    } else {
      setTranslateX(0)
    }
  }

  return (
    <View className="swipe-card-wrapper">
      <View className="swipe-card-delete" onClick={onDelete}>
        <Text className="swipe-card-delete-text">删除</Text>
      </View>
      <View
        className="swipe-card-content"
        style={{ transform: `translateX(${translateX}rpx)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onEdit}
      >
        <View className="step-drag">
          <GripVertical size={18} color="#9ca3af" />
        </View>
        <View className="step-index">
          <Text className="step-index-text">{index + 1}</Text>
        </View>
        <View className="step-info">
          <Text className="step-name">【{step.group}-{step.label}】{truncateStr(step.description, 8)}</Text>
          {/* <Text className="step-group">{step.group}</Text> */}
          {/* {step.description && (
            <Text className="step-desc">{truncateStr(step.description, 20)}</Text>
          )} */}
        </View>
      </View>
    </View>
  )
}