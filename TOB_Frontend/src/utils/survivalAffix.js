// 生存板块词缀消费判定的单一来源。
// 真正的解析在 survivalStats.aggregateSurvivalStats；
// 本模块只导出「哪些词缀文本参与生存板块计算」的判定与共享正则，
// 供 survivalStats 与 affixConsumers（词缀统计/未计入面板）复用，避免消费逻辑两处重写。
// 条件词缀按 splitLeadingCondition 门控，条件不满足 → 不消费（进未计入面板）。

import { forEachGatedClause } from './conditionClauses.js'

const RANGE_RE = /([+-]?\d+(?:\.\d+)?)\s*[~〜\-－—–]\s*([+-]?\d+(?:\.\d+)?)/
const VALUE_RE = /([+-]?\d+(?:\.\d+)?)\s*%/

// 百分比数值：范围取中值，单值取自身（与 survivalStats 口径一致）
export function pctValue(text) {
  const rm = text.match(RANGE_RE)
  if (rm) return (parseFloat(rm[1]) + parseFloat(rm[2])) / 2
  const m = text.match(VALUE_RE)
  return m ? parseFloat(m[1]) : null
}

// 每秒自然回复魔力：`每秒自然回复3%魔力` 的 % 在数值与魔力之间（50 级基准为固定值，% 为按最大值比例）
export const MANA_REGEN_RE = /每秒(?:自然)?回复(\d+(?:\.\d+)?)%?(?:点)?魔力/

// 局部「该装备…」基底不参与生存板块加算（由装备面板/护盾模块消费）
export const LOCAL_BASE_RE = /该装备/

// 局部「+X该装备护甲值」/「+X该装备闪避值」平值（范围取中值）：
// 这是装备护甲/闪避的绝对数值来源（item 只存 baseAffix 字符串，无 armor/evasion 数字字段），
// 由各计算端（survivalStats.baseArmorEvasion / damageEngine.baseDefenseStats）解析计入基底，
// 与 shield 模块的 equipmentShieldBase 同构。
export function localArmorEvasionValue(item) {
  const texts = []
  if (item.baseAffix) texts.push(item.baseAffix)
  for (const a of Array.isArray(item.affixes) ? item.affixes : []) {
    if (!a) continue
    if (typeof a === 'string') texts.push(a)
    else if (typeof a === 'object' && a.text) texts.push(a.text)
  }
  let armor = 0
  let evasion = 0
  for (const t of texts) {
    for (const seg of String(t).split(/[;；]/)) {
      const segText = seg.trim()
      if (segText.includes('该装备护甲值')) {
        const rm = segText.match(RANGE_RE)
        if (rm) armor += (parseFloat(rm[1]) + parseFloat(rm[2])) / 2
        else {
          const vm = segText.match(/[+-]?\d+(?:\.\d+)?/)
          if (vm) armor += parseFloat(vm[0])
        }
      } else if (segText.includes('该装备闪避值')) {
        const rm = segText.match(RANGE_RE)
        if (rm) evasion += (parseFloat(rm[1]) + parseFloat(rm[2])) / 2
        else {
          const vm = segText.match(/[+-]?\d+(?:\.\d+)?/)
          if (vm) evasion += parseFloat(vm[0])
        }
      }
    }
  }
  return { armor, evasion }
}

// 以下细分判定为护甲/闪避/返还/充能等分支的单一来源，
// 供 survivalStats（计算端）与 consumesSurvivalClause（消费端）复用，避免两处维护。

export function isArmorText(text) {
  return text.includes('护甲值') && !text.includes('减伤穿透')
}

export function isEvasionText(text) {
  return text.includes('闪避值')
}

// 「+X%生命返还与护盾返还」组合词缀（优先于单项判定，避免重复计数）
export function isCombinedReturnText(text) {
  return text.includes('生命返还与护盾返还')
}

export function isLifeReturnText(text) {
  return text.includes('生命返还') && !text.includes('间隔')
}

export function isShieldReturnText(text) {
  return text.includes('护盾返还') && !text.includes('间隔')
}

export function isLifeReturnIntervalText(text) {
  return text.includes('生命返还间隔')
}

export function isShieldReturnIntervalText(text) {
  return text.includes('护盾返还间隔')
}

export function isReturnIntervalText(text) {
  return text.includes('返还间隔')
}

export function isShieldChargeSpeedText(text) {
  return text.includes('护盾充能速度')
}

// 攻击/法术格挡率：`+X%攻击格挡率` / `+X%法术格挡率`；组合词缀「攻击和/与/或法术格挡率」同时计入两者。
export function isAttackBlockText(text) {
  return text.includes('攻击格挡率')
}

export function isSpellBlockText(text) {
  return text.includes('法术格挡率')
}

export function isCombinedBlockText(text) {
  return /攻击[和与或]法术格挡率/.test(text)
}

// 判定一条子句是否被生存板块计算计入（与 aggregateSurvivalStats 各分支一致）：
// 护甲值/闪避值（乘区或加算）、生命/护盾返还及返还间隔、魔力回复、护盾充能速度。
// 局部「该装备护甲值/闪避值」由 baseArmorEvasion 解析计入基底，算消费；
// 其余「该装备…」（附加伤害/物理伤害/攻速等）不属于生存板块，不算消费。
function consumesSurvivalClause(clause) {
  if (clause.includes('该装备护甲值')) return true
  if (clause.includes('该装备闪避值')) return true
  if (LOCAL_BASE_RE.test(clause)) return false
  if (isArmorText(clause)) return true
  if (isEvasionText(clause)) return true
  if (clause.includes('返还')) return true
  if (MANA_REGEN_RE.test(clause)) return true
  if (isShieldChargeSpeedText(clause)) return true
  if (isCombinedBlockText(clause)) return true
  if (isAttackBlockText(clause)) return true
  if (isSpellBlockText(clause)) return true
  return false
}

// 判定一条词缀文本是否被生存板块计算计入（与 aggregateSurvivalStats 同门控）。
export function consumesSurvivalAffix(text, states) {
  let hit = false
  forEachGatedClause(text, states, (clause) => {
    if (!hit && consumesSurvivalClause(clause)) hit = true
  })
  return hit
}
