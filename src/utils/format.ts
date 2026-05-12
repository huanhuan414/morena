/**
 * 安全格式化数字为固定小数位
 * 防止后端返回 string / null / undefined 时 toFixed 报错
 */
export function formatNum(value: unknown, digits = 2): string {
  const num = Number(value)
  if (Number.isNaN(num)) return '0.' + '0'.repeat(digits)
  return num.toFixed(digits)
}

/**
 * 安全格式化数字为本地化字符串
 */
export function formatLocal(value: unknown): string {
  const num = Number(value)
  if (Number.isNaN(num)) return '0'
  return num.toLocaleString()
}

/**
 * 安全获取数字，非数字返回默认值
 */
export function toNumber(value: unknown, defaultValue = 0): number {
  const num = Number(value)
  return Number.isNaN(num) ? defaultValue : num
}
