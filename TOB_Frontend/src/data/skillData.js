import activeSkillData from '../assets/json/技能/主动技能词缀.json'
import supportSkillData from '../assets/json/技能/辅助技能词缀.json'
import passiveSkillData from '../assets/json/技能/被动技能词缀.json'
import catalystSkillData from '../assets/json/技能/触媒技能词缀.json'
import magnificentSkillData from '../assets/json/技能/华贵技能词缀.json'
import sublimeSkillData from '../assets/json/技能/崇高技能词缀.json'
import modularSkillData from '../assets/json/技能/模组化技能词缀.json'
import modularAffixPoolData from '../assets/json/技能/模组化技能词缀池.json'

export const SKILL_FAMILY = {
  active: 'active',
  passive: 'passive',
  support: 'support',
  catalyst: 'catalyst',
  magnificent: 'magnificent',
  sublime: 'sublime',
  modular: 'modular',
}

// 模组化技能最多可配置词缀条数
export const MODULAR_MAX_AFFIXES = 3

// 辅助技能槽位展示顺序（辅助 → 触媒 → 华贵 → 崇高）
export const SUPPORT_FAMILY_ORDER = [
  SKILL_FAMILY.support,
  SKILL_FAMILY.catalyst,
  SKILL_FAMILY.magnificent,
  SKILL_FAMILY.sublime,
]

function toSkill(key, family, d) {
  return {
    key,
    family,
    name: key,
    tags: Array.isArray(d.标签) ? d.标签 : [],
    intro: d.介绍 || '',
    imgPath: d.图片地址 || '',
    levels: Array.isArray(d.等级词缀) ? d.等级词缀 : [],
    affixes: Array.isArray(d.词缀) ? d.词缀 : [],
    minion: d['minion属性'] && typeof d['minion属性'] === 'object' ? d['minion属性'] : null,
  }
}

const toCatalog = (data, family) =>
  Object.entries(data || {}).map(([key, d]) => toSkill(key, family, d))

export const activeSkills = toCatalog(activeSkillData, SKILL_FAMILY.active)
export const passiveSkills = toCatalog(passiveSkillData, SKILL_FAMILY.passive)
export const supportSkills = toCatalog(supportSkillData, SKILL_FAMILY.support)
export const catalystSkills = toCatalog(catalystSkillData, SKILL_FAMILY.catalyst)
export const magnificentSkills = toCatalog(
  magnificentSkillData,
  SKILL_FAMILY.magnificent
)
export const sublimeSkills = toCatalog(sublimeSkillData, SKILL_FAMILY.sublime)
export const modularSkills = toCatalog(modularSkillData, SKILL_FAMILY.modular)

// 模组化技能词缀池：词缀名 → { 名称, 描述 }
export const modularAffixPool = modularAffixPoolData || {}

const byFamilyName = {}
for (const list of [
  activeSkills,
  passiveSkills,
  supportSkills,
  catalystSkills,
  magnificentSkills,
  sublimeSkills,
  modularSkills,
]) {
  for (const s of list) byFamilyName[`${s.family}:${s.name}`] = s
}

export function skillByFamilyName(family, name) {
  return byFamilyName[`${family}:${name}`] || null
}

// 主动技能某等级「伤害倍率」（%）→ effectiveness；仅 1~20 级有数据，21 级及以上回退到最近可用等级（20 级），无数据返回 0
export function effectivenessAt(skill, level) {
  if (!skill || !Array.isArray(skill.levels)) return 0
  const lv = Number(level || 1)
  const usable = skill.levels
    .filter((e) => e && e['伤害倍率'] != null && String(e['伤害倍率']).trim() !== '')
    .sort((a, b) => Number(a.level) - Number(b.level))
  const entry = usable.filter((e) => Number(e.level) <= lv).pop() || usable[0]
  if (entry && entry['伤害倍率'] != null) {
    const v = parseFloat(String(entry['伤害倍率']))
    if (!Number.isNaN(v)) return v
  }
  return 0
}

// 辅助技能约束标签：排除「辅助」家族标记，其余为可辅助主技能的标签约束
export function supportConstraintTags(support) {
  if (!support || !Array.isArray(support.tags)) return []
  return support.tags.filter((t) => t !== '辅助')
}

// 主技能标签是否包含辅助技能全部约束标签（约束为空 → 可辅助任意技能）
export function matchesSupport(skillTags, support) {
  const need = supportConstraintTags(support)
  if (need.length === 0) return true
  const tags = Array.isArray(skillTags) ? skillTags : []
  return need.every((t) => tags.includes(t))
}

// 华贵/崇高技能只能辅助对应技能：技能名前缀（：前）等于主技能名，或主技能标签包含该前缀
// slotFamily 用于「模组化」前缀匹配模组化技能族（前缀非技能名也非标签）
export function magnificentTargetName(skill) {
  if (!skill || !skill.name) return ''
  return String(skill.name).split(/[：:]/)[0].trim()
}

export function magnificentSupports(slotTags, slotName, skill, slotFamily) {
  const target = magnificentTargetName(skill)
  if (!target) return false
  if (slotName === target) return true
  if (target === '模组化' && slotFamily === SKILL_FAMILY.modular) return true
  if (Array.isArray(slotTags) && slotTags.includes(target)) return true
  return false
}
