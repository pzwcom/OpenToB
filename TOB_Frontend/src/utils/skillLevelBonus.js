import {
  collectDivinityAffixTexts,
  collectTalentAffixTexts,
  collectEquipmentAffixTexts,
  collectMemoryAffixTexts,
  collectPactAffixTexts,
  collectSkillAffixTexts,
} from './affixAggregation.js'
import { SKILL_LEVEL_SEG_RE } from './skillLevelAffix.js'

// 技能等级词缀的段分割与段正则统一在 skillLevelAffix.js（与 affixConsumers 消费判定同源）
const SEG_SPLIT_RE = /[;；]/

// 辅助系技能家族（+辅助技能等级 适用）
const SUPPORT_FAMILIES = new Set(['support', 'catalyst', 'magnificent', 'sublime'])

// 无法直接按标签匹配、需特殊处理的词缀标签
const SKIP_TAGS = new Set(['对应元素', '对应元素的'])

// 汇总构建内所有「技能等级±N」词缀（含负值），按 段首数字 提取，过滤条件句式。
// 返回 [{ value, tag }]，value 为技能等级增减值，tag 为词缀标签（如 魔灵/闪电/全部/主动…）。
export function collectSkillLevelAffixes(build) {
  const texts = [
    ...collectDivinityAffixTexts(build),
    ...collectTalentAffixTexts(build),
    ...collectEquipmentAffixTexts(build),
    ...collectMemoryAffixTexts(build),
    ...collectPactAffixTexts(build),
    ...collectSkillAffixTexts(build),
  ]
  const affixes = []
  for (const raw of texts) {
    if (!raw) continue
    for (const seg of String(raw).split(SEG_SPLIT_RE)) {
      const s = seg.trim()
      const m = s.match(SKILL_LEVEL_SEG_RE)
      if (!m) continue
      const value = Math.round(parseFloat(m[1]))
      if (value === 0) continue
      affixes.push({ value, tag: m[2] })
    }
  }
  return affixes
}

// 词缀标签 → 是否作用于该技能槽（按槽位 group/index/family 与技能标签匹配）
export function skillLevelApplies(affix, slot) {
  if (!affix || !slot) return false
  const tag = affix.tag
  if (SKIP_TAGS.has(tag)) return false
  const tags = Array.isArray(slot.tags) ? slot.tags : []
  if (tag === '全部') return true
  if (tag === '主动') return slot.group === 'main'
  if (tag === '被动') return slot.group === 'passive'
  if (tag === '核心') return slot.group === 'main' && slot.index === 1
  if (tag === '辅助') return SUPPORT_FAMILIES.has(slot.family)
  if (tag === '召唤召唤物的' || tag === '召唤召唤物') return tags.includes('召唤')
  if (tag === '攻击投射物') return tags.includes('攻击') && tags.includes('投射物')
  if (tag === '直射投射物') return tags.includes('直射') && tags.includes('投射物')
  return tags.includes(tag)
}

// 计算某技能槽的等级加成：所有适用词缀 value 求和
export function skillLevelBonusFor(slot, affixes) {
  if (!slot || !slot.name) return 0
  let total = 0
  for (const a of affixes) {
    if (skillLevelApplies(a, slot)) total += a.value
  }
  return total
}
