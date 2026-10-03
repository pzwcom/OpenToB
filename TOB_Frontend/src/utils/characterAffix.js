// 角色杂项统计词缀消费判定的单一来源。
// 真正的解析在 characterStats.aggregateCharacterStats；
// 本模块只导出「哪些词缀文本参与角色统计计算」的判定与共享正则，
// 供 characterStats 与 affixConsumers（词缀统计/未计入面板）复用，避免消费逻辑两处重写。
// 条件词缀按 splitLeadingCondition 门控，条件不满足 → 不消费（进未计入面板）。

import { forEachGatedClause } from './conditionClauses.js'

// 移动速度：支持范围 `(-20–-10)%移动速度`（归一后取中值）；「移动速度固定为基础值的X%」为全局改值类，
// 不算常规移动速度加成，由 affixConsumers.moveSpeedFixed 单独分类消费，此处排除避免错误加算。
export const MOVE_SPEED_RE =
  /([+-]?\d+(?:\.\d+)?)(?:\s*[~〜\-－—–]\s*([+-]?\d+(?:\.\d+)?))?\s*%\s*移动速度/
// 你和周围友军移动速度：`+(30–35)%你和周围友军移动速度`（含自身，计入移动速度）
export const ALLY_MOVE_SPEED_RE =
  /([+-]?\d+(?:\.\d+)?)(?:\s*[~〜\-－—–]\s*([+-]?\d+(?:\.\d+)?))?\s*%\s*你和周围友军移动速度/
export const SKILL_DURATION_RE =
  /([+-]?\d+(?:\.\d+)?)\s*%[^，,;；。]*?技能(?:效果)?持续时间/
export const SEAL_COMP_RE = /([+-]?\d+(?:\.\d+)?)\s*%\s*魔力封印补偿/
// 全域召唤数量上限：魔灵「最大数量上限」、智械「召唤物数量上限」；「每个智械技能/魔灵技能召唤的」为单技能上限，不计入
export const MECH_CAP_RE = /([+-]\s*\d+)\s*智械召唤物数量上限/
export const MINION_CAP_RE = /([+-]\s*\d+)\s*魔灵最大数量上限/
export const PER_SKILL_RE = /每个智械技能|魔灵技能召唤的数量上限/

export function moveSpeedValue(text) {
  // 「移动速度固定为基础值的X%」为全局改值类，不算常规移动速度加成（affixConsumers.moveSpeedFixed 单独分类）
  if (/固定/.test(text)) return null
  const m = text.match(MOVE_SPEED_RE) || text.match(ALLY_MOVE_SPEED_RE)
  if (!m) return null
  return m[2] != null ? (parseFloat(m[1]) + parseFloat(m[2])) / 2 : parseFloat(m[1])
}

// 判定一条子句是否被角色统计计算计入（与 aggregateCharacterStats 各分支一致）：
// 移动速度、技能效果持续时间、魔力封印补偿、智械/魔灵数量上限（排除单技能上限）。
function consumesCharacterClause(clause) {
  if (moveSpeedValue(clause) != null) return true
  if (SKILL_DURATION_RE.test(clause)) return true
  if (SEAL_COMP_RE.test(clause)) return true
  if (PER_SKILL_RE.test(clause)) return false
  return MECH_CAP_RE.test(clause) || MINION_CAP_RE.test(clause)
}

// 判定一条词缀文本是否被角色统计计算计入（与 aggregateCharacterStats 同门控）。
export function consumesCharacterAffix(text, states) {
  let hit = false
  forEachGatedClause(text, states, (clause) => {
    if (!hit && consumesCharacterClause(clause)) hit = true
  })
  return hit
}
