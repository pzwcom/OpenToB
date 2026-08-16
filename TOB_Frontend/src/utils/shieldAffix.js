// 护盾（能量护盾）词缀消费判定的单一来源。
// 真正的护盾计算在 damageEngine.computeShield / equipmentShieldBase；
// 本模块只导出「哪些词缀文本参与护盾计算」的判定与相关正则，
// 供 damageEngine 与 affixConsumers（词缀统计/未计入面板）复用，避免消费逻辑两处重写。
// 条件词缀（满血时+%最大护盾 等）按 splitLeadingCondition 门控，条件不满足 → 不消费（进未计入面板）。

import { forEachGatedClause } from './conditionClauses.js'

// 局部「%该装备护盾」：`+X%该装备护盾` / `+(50–60)%该装备护盾`（局部增加，按装备分别折算）
const LOCAL_SHIELD_PCT_RE =
  /([+-]?\d+(?:\.\d+)?)(?:\s*[~〜\-－—–]\s*([+-]?\d+(?:\.\d+)?))?\s*\)?\s*%\s*该装备护盾/

// 局部「+X该装备护盾」平值：`+X该装备护盾` / `+(170–238)该装备护盾`（范围取中值）
const LOCAL_SHIELD_FLAT_RE = /([+-]?\d+(?:\.\d+)?)\s*\)?\s*该装备护盾/

// 不参与护盾计算的句式：附加/相当于/伤害/回复/返还/充能/恢复/治愈/抵挡/屏障
const SHIELD_SKIP_RE = /附加|相当于|伤害|回复|返还|充能|恢复|治愈|抵挡|屏障/

// 判定一条词缀文本是否被护盾计算计入（与 computeShield / equipmentShieldBase 同门控）：
// 局部「该装备护盾」由 equipmentShieldBase 无条件消费（不经过条件门控）；
// 全局「最大护盾」由 computeShield 消费，条件词缀按战斗状态门控。
export function consumesShieldAffix(text, states) {
  const t = String(text || '')
  if (t.includes('该装备护盾')) return true
  let hit = false
  forEachGatedClause(t, states, (clause) => {
    if (!hit && clause.includes('最大护盾') && !SHIELD_SKIP_RE.test(clause)) hit = true
  })
  return hit
}

export const shieldAffixRe = { LOCAL_SHIELD_PCT_RE, LOCAL_SHIELD_FLAT_RE, SHIELD_SKIP_RE }
