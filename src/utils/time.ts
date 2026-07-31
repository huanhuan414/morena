/**
 * 格式化时间为友好显示
 * @param dateString 时间字符串或Date对象
 * @returns 友好的时间显示
 */
export function formatTime(dateString: string | Date | null | undefined): string {
  if (!dateString) {
    return '未知时间'
  }
  
  const date = new Date(dateString)
  
  // 检查是否为有效日期
  if (Number.isNaN(date.getTime())) {
    return '未知时间'
  }
  
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hoursTotal = Math.floor(minutes / 60)
  const days = Math.floor(hoursTotal / 24)
  
  // 刚刚（1分钟内）
  if (seconds < 60) {
    return '刚刚'
  }
  
  // X分钟前（1小时内）
  if (minutes < 60) {
    return `${minutes}分钟前`
  }
  
  // 今天（显示具体时间）
  if (days < 1) {
    const hoursStr = date.getHours().toString().padStart(2, '0')
    const minutesStr = date.getMinutes().toString().padStart(2, '0')
    return `今天 ${hoursStr}:${minutesStr}`
  }
  
  // 昨天（显示具体时间）
  if (days < 2) {
    const hoursStr = date.getHours().toString().padStart(2, '0')
    const minutesStr = date.getMinutes().toString().padStart(2, '0')
    return `昨天 ${hoursStr}:${minutesStr}`
  }
  
  // 本周内（显示星期几）
  if (days < 7) {
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekDay = weekDays[date.getDay()]
    const hoursStr = date.getHours().toString().padStart(2, '0')
    const minutesStr = date.getMinutes().toString().padStart(2, '0')
    return `${weekDay} ${hoursStr}:${minutesStr}`
  }
  
  // 今年（显示月-日）
  if (date.getFullYear() === now.getFullYear()) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${month}月${day}日`
  }
  
  // 往年（显示年-月-日）
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}/${month}/${day}`
}

/**
 * 格式化日期为完整格式
 * @param dateString 时间字符串或Date对象
 * @returns 完整的日期时间
 */
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) {
    return '未知时间'
  }
  
  const date = new Date(dateString)
  
  // 检查是否为有效日期
  if (Number.isNaN(date.getTime())) {
    return '未知时间'
  }
  
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  
  return `${year}/${month}/${day} ${hours}:${minutes}`
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) {
    return '未知时间'
  }
  
  const date = new Date(dateString)
  
  // 检查是否为有效日期
  if (Number.isNaN(date.getTime())) {
    return '未知时间'
  }
  
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  
  return `${year}/${month}/${day}`
}
