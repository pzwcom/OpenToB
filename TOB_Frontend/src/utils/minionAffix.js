// 魔灵面板词缀消费判定的单一来源。
// 真正的解析在 minionAffixStats.aggregateMinionAffixStats；
// 本模块只导出「哪些词缀文本参与魔灵面板计算」的判定与解析正则，
// 供 minionAffixStats 与 affixConsumers（词缀统计/未计入面板）复用，避免消费逻辑两处重写。
// 条件词缀按 splitLeadingCondition 门控，条件不满足 → 不消费（进未计入面板）。

import { forEachGatedClause } from './conditionClauses.js'

const RANGE_CHARS = '~〜\\-－—–'
const OPEN = '[(（]'
const CLOSE = '[)）]'
const NUM_RE = `([+-]?)(?:${OPEN}\\s*)?(\\d+(?:\\.\\d+)?)(?:\\s*[${RANGE_CHARS}]\\s*(\\d+(?:\\.\\d+)?)\\s*${CLOSE})?`

export const CRIT_DMG_RE = new RegExp(`${NUM_RE}%召唤物暴击伤害`)
export const CRIT_VALUE_PCT_RE = new RegExp(`${NUM_RE}%召唤物暴击值`)
export const CRIT_VALUE_FLAT_RE = new RegExp(`${NUM_RE}召唤物暴击值`)
export const SPIRIT_SOURCE_RE = new RegExp(`${NUM_RE}%魔灵之源效果`)
export const DOUBLE_DMG_RE = new RegExp(`(?:智械)?召唤物${NUM_RE}%几率造成双倍伤害`)
export const ELEM_PEN_RE = new RegExp(`召唤物${NUM_RE}%([火焰冰冷闪电]+)穿透`)
export const ELEM_CORR_PEN_RE = new RegExp(`召唤物${NUM_RE}%元素和腐蚀抗性穿透`)
export const EROSION_PEN_RE = new RegExp(`召唤物${NUM_RE}%腐蚀穿透`)
export const ARMOR_PEN_RE = new RegExp(`召唤物${NUM_RE}%护甲减伤穿透`)
// 速度词缀为「数值%召唤物攻击速度」等（数值在前、召唤物在后），如 +36%召唤物攻击速度
export const ATK_SPEED_RE = new RegExp(`${NUM_RE}%召唤物攻击速度`)
export const CAST_SPEED_RE = new RegExp(`${NUM_RE}%召唤物施法速度`)
export const DUAL_SPEED_RE = new RegExp(`${NUM_RE}%召唤物攻击[与和]施法速度`)

export const CAP_GLOBAL_RE = /([+-]\s*\d+)\s*魔灵最大数量上限/
export const CAP_SKILL_RE = /([+-]\s*\d+)\s*魔灵技能召唤的数量上限/
export const CAP_FIXED_RE = /魔灵最大数量上限为(\d+)/

const MINION_PARSE_RES = [
  CRIT_DMG_RE,
  CRIT_VALUE_PCT_RE,
  CRIT_VALUE_FLAT_RE,
  SPIRIT_SOURCE_RE,
  DOUBLE_DMG_RE,
  ELEM_PEN_RE,
  ELEM_CORR_PEN_RE,
  EROSION_PEN_RE,
  ARMOR_PEN_RE,
  ATK_SPEED_RE,
  CAST_SPEED_RE,
  DUAL_SPEED_RE,
  CAP_GLOBAL_RE,
  CAP_SKILL_RE,
  CAP_FIXED_RE,
]

// 判定一条子句是否被魔灵面板计算计入：命中任一解析正则即视为消费。
function consumesMinionClause(clause) {
  return MINION_PARSE_RES.some((re) => re.test(clause))
}

// 判定一条词缀文本是否被魔灵面板计算计入（与 aggregateMinionAffixStats 同门控）。
export function consumesMinionAffix(text, states) {
  let hit = false
  forEachGatedClause(text, states, (clause) => {
    if (!hit && consumesMinionClause(clause)) hit = true
  })
  return hit
}
