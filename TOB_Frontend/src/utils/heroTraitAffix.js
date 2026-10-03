import heroTraitData from '../assets/json/角色/角色特性.json'
import { cleanAffixText } from './affixText.js'
import { affixTextOf } from './affixRange.js'
import { getTraitEffectAtLevel, parseTraitDesc } from './heroTraitDesc.js'

// 特性档位（1 级基础特性 / 45 / 60 / 75 档特性）：由 level_up_time 解析
export function getTraitTier(levelUpTime) {
  const m = (levelUpTime || '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 1
}

// 某档位追忆槽已装备的追忆提供的特性等级加成：
// 强化等级 ≥50 → +2、≥30 → +1（30/40 归 +1，50 归 +2，10/20 不加）；
// 固有词缀含 "+2英雄特性等级"（清洗后精确匹配）→ +2；两者可叠加。
// 45/60/75 档取对应槽位追忆；1 级特性取全部特殊追忆槽（复苏词缀生成）的追忆。
export function memoryTraitBonusOf(memorySlots, memoryInventory, tier) {
  let items = []
  if (tier === 1) {
    items = (memorySlots || [])
      .filter((s) => s.tier === 'special' && s.memoryId)
      .map((s) => (memoryInventory || []).find((it) => it.id === s.memoryId))
      .filter(Boolean)
  } else {
    const slot = (memorySlots || []).find((s) => s.tier === tier)
    if (!slot || !slot.memoryId) return { enhance: 0, inherent: 0 }
    const item = (memoryInventory || []).find((it) => it.id === slot.memoryId)
    if (item) items.push(item)
  }
  if (items.length === 0) return { enhance: 0, inherent: 0 }
  let enhance = 0
  let inherent = 0
  for (const item of items) {
    enhance += item.enhanceLevel >= 50 ? 2 : item.enhanceLevel >= 30 ? 1 : 0
    const inherentAffixes = Array.isArray(item.inherentAffixes)
      ? item.inherentAffixes
      : [item.inherentAffix]
    if (
      inherentAffixes
        .filter(Boolean)
        .some((a) => cleanAffixText(affixTextOf(a)).replace(/\s+/g, '') === '+2英雄特性等级')
    ) {
      inherent += 2
    }
  }
  return { enhance, inherent }
}

// 收集英雄已选特性在其生效等级下的词缀文本，作为计算引擎的新源（英雄特性）。
// 生效等级 = 基础 1 + 追忆加成（强化 + 固有，上限 5）；「人造月亮」段仅在满级 5 解锁时计入。
export function collectHeroTraitAffixTexts(build) {
  const heroTraits = build && build.heroTraits
  const heroName = heroTraits && heroTraits.name
  if (!heroName) return []
  const data = heroTraitData[heroName] || {}
  const inventory = Array.isArray(build && build.memoryInventory) ? build.memoryInventory : []
  const texts = []
  for (const t of Array.isArray(heroTraits.traits) ? heroTraits.traits : []) {
    const info = data[t.name]
    if (!info || !info.desc) continue
    const tier = getTraitTier(info.level_up_time)
    const bonus = memoryTraitBonusOf(heroTraits.memorySlots, inventory, tier)
    const effectiveLevel = Math.max(
      1,
      Math.min(5, 1 + bonus.enhance + bonus.inherent)
    )
    const seg = getTraitEffectAtLevel(info.desc, t.name, effectiveLevel)
    if (seg) texts.push(seg)
    if (effectiveLevel >= 5) {
      const moon = parseTraitDesc(info.desc, t.name).moon
      if (moon) texts.push(moon)
    }
  }
  return texts
}
