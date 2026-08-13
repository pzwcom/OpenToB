// 腰带调香词缀：来源 src/assets/json/装备/调香/调香词缀.json
// 三个分类：中型天赋 / 核心天赋（橙色）、异香天赋（红色）
import perfumeData from '../assets/json/装备/调香/调香词缀.json'

// 分类 → UI 顺序、类型标识
const PERFUME_SECTIONS = [
  { key: '中型天赋', type: 'medium' },
  { key: '核心天赋', type: 'core' },
  { key: '异香天赋', type: 'exotic' },
]

// 调香词缀池：统一为 {名称, 描述, 类型}（中型/核心为纯文本，名称留空；异香天赋为 {名称, 描述}）
export function perfumeAffixPool() {
  const out = []
  for (const { key, type } of PERFUME_SECTIONS) {
    const section = perfumeData[key]
    if (!Array.isArray(section)) continue
    for (const entry of section) {
      if (typeof entry === 'string') {
        out.push({ 名称: '', 描述: entry, 类型: type })
      } else if (entry && typeof entry === 'object') {
        out.push({ 名称: entry.名称 || '', 描述: entry.描述 || '', 类型: type })
      }
    }
  }
  return out
}
