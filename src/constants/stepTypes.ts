/**
 * 步骤类型配置 - 公共配置，供多个页面共享
 */

// 步骤分组配置
export const STEP_GROUPS = [
  {
    title: '任务说明',
    items: [
      { label: '输入网址', type: 'input_url' },
      { label: '传二维码', type: 'upload_qrcode' },
      { label: '文字说明', type: 'text_instruction' },
      { label: '图片说明', type: 'image_instruction' },
      { label: '视频说明', type: 'video_instruction' },
      { label: '复制数据', type: 'copy_data' },
    ],
  },
  {
    title: '发布素材',
    items: [
      { label: '文字素材', type: 'material_text' },
      { label: '图片素材', type: 'material_image' },
      { label: '视频素材', type: 'material_video' },
    ],
  },
  {
    title: '验收内容',
    items: [
      { label: '收集截图', type: 'collect_image' },
      { label: '收集信息', type: 'collect_info' },
      { label: '收集链接', type: 'collect_url' },
    ],
  },
]

// 步骤类型颜色配置
export const STEP_TYPE_COLORS: Record<string, { color: string; bgColor: string }> = {
  // 任务说明 - 绿色
  input_url: { color: '#16a34a', bgColor: '#dcfce7' },
  upload_qrcode: { color: '#16a34a', bgColor: '#dcfce7' },
  text_instruction: { color: '#16a34a', bgColor: '#dcfce7' },
  image_instruction: { color: '#16a34a', bgColor: '#dcfce7' },
  video_instruction: { color: '#16a34a', bgColor: '#dcfce7' },
  copy_data: { color: '#16a34a', bgColor: '#dcfce7' },
  // 发布素材 - 蓝色
  material_text: { color: '#2563eb', bgColor: '#dbeafe' },
  material_image: { color: '#2563eb', bgColor: '#dbeafe' },
  material_video: { color: '#2563eb', bgColor: '#dbeafe' },
  // 验收内容 - 红色
  collect_image: { color: '#dc2626', bgColor: '#fee2e2' },
  collect_info: { color: '#dc2626', bgColor: '#fee2e2' },
  collect_url: { color: '#dc2626', bgColor: '#fee2e2' },
}

// 获取步骤类型的颜色配置
export const getStepTypeColor = (stepType: string): { color: string; bgColor: string } => {
  return STEP_TYPE_COLORS[stepType] || { color: '#6b7280', bgColor: '#f3f4f6' }
}

// 判断步骤类型属于哪个分组
export const getStepGroup = (stepType: string): string => {
  for (const group of STEP_GROUPS) {
    if (group.items.some(item => item.type === stepType)) {
      return group.title
    }
  }
  return '其他'
}

// 判断是否为素材类型
export const MATERIAL_TYPES = ['material_text', 'material_image', 'material_video']

// 判断是否为素材类型
export const isMaterialType = (type: string): boolean => {
  return MATERIAL_TYPES.includes(type)
}
