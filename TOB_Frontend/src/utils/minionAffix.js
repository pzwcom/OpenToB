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

// ===== 纽带（Tether）相关词缀 =====
// 纽带机制：每层纽带 +40% 召唤物伤害、+10% 召唤物攻/施/移速、召唤物额外 -50% 受到伤害；初始上限 3 层。
// 相关词缀：`+N纽带层数上限`（提高上限）、`+X%纽带获得速度`、`可以获得纽带`（启用机制）、
// `拥有纽带时，额外+X%召唤物伤害`（条件，层数>0）、`纽带达到上限时，额外+X%召唤物伤害`（条件，层数>=上限）、
// `每拥有1层纽带，+X%召唤物暴击值` / `每拥有1层纽带，额外+X%召唤物伤害`（每层折算，×当前层数）。
export const TETHER_CAP_RE = /([+-]\s*\d+)\s*纽带层数上限/
export const TETHER_GAIN_SPEED_RE = new RegExp(`${NUM_RE}%纽带获得速度`)
export const TETHER_GAINABLE_RE = /可以获得纽带/
export const TETHER_HAVE_MORE_RE = new RegExp(`拥有纽带时，?(?:额外)?${NUM_RE}%召唤物伤害`)
export const TETHER_AT_CAP_MORE_RE = new RegExp(`纽带达到上限时，?(?:额外)?${NUM_RE}%召唤物伤害`)
export const TETHER_PER_CRIT_RE = new RegExp(`每拥有1层纽带，?${NUM_RE}%召唤物暴击值`)
export const TETHER_PER_MORE_RE = new RegExp(`每拥有1层纽带，?(?:额外)?${NUM_RE}%召唤物伤害`)

// 条件前缀后数值子句的取值正则（不含条件前缀，前缀由 extractTether 的模式追踪处理）
const TETHER_HAVE_VAL_RE = new RegExp(`(?:额外)?${NUM_RE}%召唤物伤害`)
const TETHER_PER_CRIT_VAL_RE = new RegExp(`${NUM_RE}%召唤物暴击值`)
const TETHER_PER_MORE_VAL_RE = new RegExp(`(?:额外)?${NUM_RE}%召唤物伤害`)

function matchTetherValue(m) {
  if (!m) return null
  const num = m[3] != null ? (parseFloat(m[2]) + parseFloat(m[3])) / 2 : parseFloat(m[2])
  if (Number.isNaN(num)) return null
  return m[1] === '-' ? -num : num
}

// 提取文本中的纽带词缀贡献（按「；」段 + 「，,」子句，跟踪条件门控）。
// 返回 { contributions, rest }：
//   contributions — 已按当前层数折算、且条件门控通过的贡献（cap/gainSpeed/gainable 无条件计入）；
//   rest          — 剔除已计入纽带子句后剩余文本（供通用 forEachGatedClause 继续处理）。
// 门控未通过时：把「条件前缀 + 数值子句」原样还原回 rest，让通用循环的条件规则按 0 层正确判定为不计入，
// 从而与「未计入」面板消费判定（consumesMinionAffix → forEachGatedClause 同门控）保持一致。
// 与 minionAffixStats / consumesTetherText 同源，保证「统计已计入⇔计算真实计入」。
export function extractTether(text, states) {
  const stacks = (states && states.tetherStacks) || 0
  const cap = (states && states.tetherCap) || 3
  const contributions = []
  const restSegments = []
  for (const seg of String(text || '').split(/[;；]/)) {
    const clauses = seg.split(/[，,]/)
    const kept = []
    let mode = null // null | 'have' | 'atCap' | 'per'
    let modePrefix = '' // 条件前缀原文（门控失败时还原用）
    let gatePass = false
    for (const clauseRaw of clauses) {
      const clause = clauseRaw.trim()
      if (!clause) continue
      if (/^拥有纽带时/.test(clause)) {
        mode = 'have'
        modePrefix = clause
        gatePass = stacks > 0
        continue
      }
      if (/^纽带达到上限时/.test(clause)) {
        mode = 'atCap'
        modePrefix = clause
        gatePass = stacks >= cap
        continue
      }
      if (/^每拥有1层纽带/.test(clause)) {
        mode = 'per'
        modePrefix = clause
        gatePass = stacks > 0
        continue
      }
      let m = clause.match(TETHER_CAP_RE)
      if (m) {
        contributions.push({
          kind: 'cap',
          value: parseInt(m[1].replace(/\s/g, ''), 10) || 0,
          segment: clause,
        })
        continue
      }
      m = clause.match(TETHER_GAIN_SPEED_RE)
      if (m) {
        contributions.push({ kind: 'gainSpeed', value: matchTetherValue(m), segment: clause })
        continue
      }
      if (TETHER_GAINABLE_RE.test(clause)) {
        contributions.push({ kind: 'gainable', value: 1, segment: clause })
        continue
      }
      if (mode) {
        let vm = null
        let kind = null
        if (mode === 'per') {
          vm = clause.match(TETHER_PER_CRIT_VAL_RE)
          if (vm) kind = 'perCrit'
          else {
            vm = clause.match(TETHER_PER_MORE_VAL_RE)
            if (vm) kind = 'perMore'
          }
        } else {
          vm = clause.match(TETHER_HAVE_VAL_RE)
          kind = mode === 'have' ? 'haveMore' : 'atCapMore'
        }
        if (vm && gatePass) {
          const val = matchTetherValue(vm)
          contributions.push({
            kind,
            value: mode === 'per' ? val * stacks : val,
            segment: `${modePrefix}，${clause}`,
          })
        } else {
          // 未命中数值子句 或 条件未满足：把前缀与当前子句还原给通用循环
          kept.push(modePrefix)
          kept.push(clauseRaw)
        }
        mode = null
        modePrefix = ''
        gatePass = false
        continue
      }
      kept.push(clauseRaw)
    }
    if (kept.length) restSegments.push(kept.join('，'))
  }
  return { contributions, rest: restSegments.join('；') }
}

// 判定文本是否含被魔灵面板计入的纽带词缀（与 extractTether 同源门控）。
export function consumesTetherText(text, states) {
  return extractTether(text, states).contributions.length > 0
}

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
  if (consumesTetherText(text, states)) return true
  let hit = false
  forEachGatedClause(text, states, (clause) => {
    if (!hit && consumesMinionClause(clause)) hit = true
  })
  return hit
}
