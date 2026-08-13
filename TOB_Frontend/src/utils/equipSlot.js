const isShield = (subCategory) => /盾牌$/.test(subCategory || '')

// 槽位-类别匹配规则（装备 JSON「类别」值域：头盔/胸甲/手套/靴子/饰品/单手武器/双手武器；
// 饰品按「细分类」区分项链/戒指/腰带，盾牌在「单手武器」类别下按细分类归入副手）
const SLOT_CATEGORY_RULES = {
  mainHand: (item) =>
    ['单手武器', '双手武器'].includes(item.category) && !isShield(item.subCategory),
  offHand: (item) => isShield(item.subCategory),
  helmet: (item) => item.category === '头盔',
  armor: (item) => item.category === '胸甲',
  gloves: (item) => item.category === '手套',
  boots: (item) => item.category === '靴子',
  necklace: (item) => item.subCategory === '项链',
  ring1: (item) => ['戒指', '灵魂戒指'].includes(item.subCategory),
  ring2: (item) => ['戒指', '灵魂戒指'].includes(item.subCategory),
  belt: (item) => item.subCategory === '腰带',
}

// 渴瘾装备（身体部位）→ 槽位映射：按部位名匹配
const GRAFT_SLOT_REGIONS = {
  helmet: ['脑部'],
  armor: ['胸部'],
  gloves: ['手部'],
  boots: ['腿部'],
  necklace: ['颈部'],
  ring1: ['指部'],
  ring2: ['指部'],
  belt: ['腰部'],
}

const graftMatchesSlot = (item, slotKey) => {
  if (!item || item.category !== '渴瘾装备') return false
  const regions = GRAFT_SLOT_REGIONS[slotKey]
  return !!regions && regions.some((r) => (item.name || '').includes(r))
}

function itemMatchesSlot(item, slotKey) {
  if (graftMatchesSlot(item, slotKey)) return true
  const match = SLOT_CATEGORY_RULES[slotKey]
  return !!match && !!item && match(item)
}

const isGraftItem = (it) => !!it && (it.category === '渴瘾装备' || !!it.isGraft)

const isTwoHanded = (it) => !!it && it.category === '双手武器'

// 某装备条目含有的「传奇移植词缀」来源（legend 词缀的 graftItem = 传奇装备名）
const graftLegendSourcesOf = (it) => {
  if (!isGraftItem(it)) return []
  const set = new Set()
  for (const a of Array.isArray(it.affixes) ? it.affixes : []) {
    if (a && a.graftSource === 'legend' && a.graftItem) set.add(a.graftItem)
  }
  return [...set]
}

// 装备组合规则校验：返回错误文案 key 数组（空数组 = 通过）。
// item 为目标槽位将装备的条目（可为尚未入库的对象），slotKey 为槽位；
// isLegendName(name) 用于判断某装备名是否为传奇装备。
function validateEquipRules({ equipment, inventory, item, slotKey, isLegendName }) {
  const errors = []
  if (!item || !slotKey) return errors
  const itemOf = (id) => (id ? inventory.find((it) => it.id === id) || null : null)

  // 目标槽位将被 item 替换，其余槽位保持现状
  const equippedMap = Object.fromEntries(
    Object.entries(equipment || {}).map(([k, id]) => [k, k === slotKey ? item : itemOf(id)])
  )
  if (!(slotKey in equippedMap)) equippedMap[slotKey] = item

  // 规则一：渴瘾装备只能穿戴 1 件
  if (Object.values(equippedMap).filter(isGraftItem).length > 1) {
    errors.push('equip.ruleGraftOnlyOne')
  }

  // 规则二：双手武器占用副手，主手为双手武器时副手不能再装备
  const main = equippedMap.mainHand
  const off = equippedMap.offHand
  if (isTwoHanded(main) && off) {
    errors.push('equip.ruleTwoHandConflict')
  }

  // 规则三：不能同时穿戴传奇装备与含其已穿戴传奇词缀的渴瘾装备
  const legendNames = new Set()
  const graftSources = new Set()
  for (const it of Object.values(equippedMap)) {
    if (!it) continue
    if (isGraftItem(it)) {
      for (const s of graftLegendSourcesOf(it)) graftSources.add(s)
    } else if (isLegendName && isLegendName(it.name)) {
      legendNames.add(it.name)
    }
  }
  for (const s of graftSources) {
    if (legendNames.has(s)) {
      errors.push('equip.ruleLegendGraftConflict')
      break
    }
  }

  return errors
}

export {
  isShield,
  SLOT_CATEGORY_RULES,
  itemMatchesSlot,
  graftMatchesSlot,
  isGraftItem,
  isTwoHanded,
  graftLegendSourcesOf,
  validateEquipRules,
}
