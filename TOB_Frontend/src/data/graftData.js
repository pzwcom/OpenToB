// 渴瘾装备数据：身体部位 + 传奇词缀池 + 打造词缀池 + 基础词缀池
// 来源：src/assets/json/装备/渴瘾装备/{传奇词缀,打造词缀,基础词缀}.json
import graftLegendData from '../assets/json/装备/渴瘾装备/传奇词缀.json'
import graftCraftData from '../assets/json/装备/渴瘾装备/打造词缀.json'
import graftBaseData from '../assets/json/装备/渴瘾装备/基础词缀.json'

// 10 个身体部位（三个 JSON 的 key 完全一致）
export const GRAFT_PARTS = Object.keys(graftLegendData)

export const isGraftPart = (name) => GRAFT_PARTS.includes(name)

// 身体部位归属：渴瘾肢体 / 渴瘾异肢
export const graftSubCategory = (part) => (part.includes('异肢') ? '渴瘾异肢' : '渴瘾肢体')

export const graftImgPath = (part) => `/图片/装备/渴瘾装备/${part}/${part}.webp`

// 某部位的传奇物品池（词缀可被移植到该部位）
export function graftLegendPoolOf(part) {
  const raw = graftLegendData[part] || {}
  return Object.entries(raw).map(([key, d]) => ({
    key,
    name: d.物品名称 || key,
    requiredLevel: d.需求等级 || '',
    affixes: Array.isArray(d.词条) ? d.词条 : [],
  }))
}

// 某部位的打造词缀池（前缀/后缀）
export function graftCraftPoolOf(part) {
  const raw = graftCraftData[part] || {}
  return {
    prefix: Array.isArray(raw.前缀) ? raw.前缀 : [],
    suffix: Array.isArray(raw.后缀) ? raw.后缀 : [],
  }
}

// 某部位的基础词缀池（基底词缀候选）
export function graftBasePoolOf(part) {
  return Array.isArray(graftBaseData[part]) ? graftBaseData[part] : []
}
