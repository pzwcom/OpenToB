// 普通装备词缀池：基础词缀 + 打造词缀（前缀/后缀）
// 来源：src/assets/json/装备/普通装备/{基础词缀,打造词缀}.json，key 为装备细分类（如 力量头盔）
import normalBaseData from '../assets/json/装备/普通装备/基础词缀.json'
import normalCraftData from '../assets/json/装备/普通装备/打造词缀.json'

// 该细分类是否有对应词缀池（普通装备可打造）
export function isNormalSubCategory(subCategory) {
  return !!subCategory && Object.prototype.hasOwnProperty.call(normalBaseData, subCategory)
}

// 某细分类的基础词缀池（基底词缀候选）
export function normalBasePoolOf(subCategory) {
  return Array.isArray(normalBaseData[subCategory]) ? normalBaseData[subCategory] : []
}

// 某细分类的打造词缀池（前缀/后缀）
export function normalCraftPoolOf(subCategory) {
  const raw = normalCraftData[subCategory] || {}
  return {
    prefix: Array.isArray(raw.前缀) ? raw.前缀 : [],
    suffix: Array.isArray(raw.后缀) ? raw.后缀 : [],
  }
}
