import { parseAffixRanges } from './affixRange.js'
import destinyData from '../assets/json/命运/命运词缀.json'

// 6 级契灵大点天赋（核心天赋）效果 +33%：词缀文本中的效果数值 ×1.33
export const CORE_BOOST_LEVEL = 6
export const CORE_BOOST_FACTOR = 1.33

// 数值后跟随的量词/单位：时长（秒/时间）、距离（米）、层数（层/次/个/级/点/种/量）等不随效果提升，保持原样
const NON_SCALE_TAIL = /[\u4e00-\u9fa5]{0,10}(?:米|秒|层|次|个|级|点|种|量|上限|间隔|范围|时间)/

export function scaleAffixNumbers(text, factor) {
  if (!text || !factor || factor === 1) return text
  return text.replace(/(\d+(?:\.\d+)?)(%|(?=[^\d.%]))/g, (m, n, pct, offset) => {
    if (pct === '%') {
      return String(Math.round(parseFloat(n) * factor)) + '%'
    }
    const tail = text.slice(offset + m.length, offset + m.length + 14)
    if (NON_SCALE_TAIL.test(tail)) return m
    return String(Math.round(parseFloat(n) * factor))
  })
}

// 命运词缀类型：仅「小型宿命」为小型，其余（中型宿命/天命/双生天命）均为中型
export function destinyType(name) {
  return name.startsWith('小型宿命') ? 'small' : 'medium'
}

// 命运词缀首个数值范围（滑动块用）：desc 中第一个 (min–max)
export function firstAffixRange(desc) {
  const ranges = parseAffixRanges(desc || '')
  return ranges.length > 0 ? ranges[0] : null
}

// 把 desc 中的首个数值范围替换为所选值（如 +(5–7)% 选 6 显示为 +6%）
export function affixDescWithValue(desc, value) {
  if (!desc || typeof value !== 'number' || !Number.isFinite(value)) return desc
  const range = firstAffixRange(desc)
  if (!range) return desc
  let start = range.index
  let end = range.index + range.raw.length
  if (desc[start - 1] === '(' && desc[end] === ')') {
    start -= 1
    end += 1
  }
  return desc.slice(0, start) + String(value) + desc.slice(end)
}

// 命运词缀带数值的展示文本：desc 范围替换为所选值
export function destinyDisplayText(name, value) {
  const info = destinyData[name]
  if (!info || !info.desc) return name
  const text = affixDescWithValue(info.desc, value)
  return text || name
}
