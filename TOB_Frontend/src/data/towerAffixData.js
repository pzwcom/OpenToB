// 高塔序列词缀：来源 src/assets/json/装备/高塔序列/高塔序列词缀.json
// key 为武器细分类（匕首/单手剑/...），value 为 [[词缀, 系列], ...]
import towerData from '../assets/json/装备/高塔序列/高塔序列词缀.json'

// 某武器细分类是否有高塔词缀池
export function isTowerSubCategory(subCategory) {
  return !!subCategory && Object.prototype.hasOwnProperty.call(towerData, subCategory)
}

// 某武器细分类的高塔词缀池（[[词缀, 系列], ...]）
export function towerAffixPoolOf(subCategory) {
  return Array.isArray(towerData[subCategory]) ? towerData[subCategory] : []
}
