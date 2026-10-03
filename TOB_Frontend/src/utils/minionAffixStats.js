import {
  collectDivinityAffixTexts,
  collectEquipmentAffixTexts,
  collectHeroTraitAffixTexts,
  collectMemoryAffixTexts,
  collectPactAffixTexts,
  collectSkillAffixTexts,
  collectTalentAffixTexts,
  computeWarmBreezeCap,
} from './affixAggregation.js'
import { applyTetherCap, applyWarmBreezeCap } from './combatStates.js'
import { forEachGatedClause } from './conditionClauses.js'
import {
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
  TETHER_CAP_RE,
  extractTether,
} from './minionAffix.js'

// 魔灵技能相关词缀统计：对 build 内 6 个模块（神格石板/天赋树/装备/英雄追忆/契灵/技能）的
// 原始词缀文本做正则聚合，产出各属性行合计值与模块明细（供 Drawer 展示来源）。
// 数值口径：范围取中值（与 damageEngine.rangeAvg 一致），单值取自身。

const MODULES = [
  { key: 'divinity', collect: collectDivinityAffixTexts },
  { key: 'talent', collect: collectTalentAffixTexts },
  { key: 'equipment', collect: collectEquipmentAffixTexts },
  { key: 'memory', collect: collectMemoryAffixTexts },
  { key: 'pact', collect: collectPactAffixTexts },
  { key: 'skill', collect: collectSkillAffixTexts },
  { key: 'hero', collect: collectHeroTraitAffixTexts },
]

// 魔灵面板词缀的解析正则统一在 minionAffix.js（与 affixConsumers 消费判定同源）
// 条件词缀识别（CONDITION_RULES / LEADING_COND_RE / splitLeadingCondition）统一在 conditionClauses.js（与各统计端谓词共享）

const ELEMENT_KEY = { 火焰: 'fire', 冰冷: 'cold', 闪电: 'lightning' }
const PEN_DETAIL_KEY = { fire: 'elementFire', cold: 'elementCold', lightning: 'elementLightning' }

function matchValue(m) {
  if (!m) return null
  const num = m[3] != null ? (parseFloat(m[2]) + parseFloat(m[3])) / 2 : parseFloat(m[2])
  if (Number.isNaN(num)) return null
  return m[1] === '-' ? -num : num
}

function emptyAcc() {
  return {
    critDamage: 0,
    critValueFlat: 0,
    critValuePct: 0,
    critRate: 0,
    elementPen: { fire: 0, cold: 0, lightning: 0 },
    armorPen: 0,
    erosionPen: 0,
    spiritSourceEffect: 0,
    doubleDamageChance: 0,
    countCap: 0,
    countCapFixed: null,
    atkSpeed: 0,
    castSpeed: 0,
    // 纽带：当前层数（状态）、上限（3 + 上限词缀）、获得速度、各条件/每层加成合计
    tetherStacks: 0,
    tetherCap: 3,
    tetherGainable: false,
    tetherGainSpeed: 0,
    tetherHaveMore: 0,
    tetherAtCapMore: 0,
    tetherPerCrit: 0,
    tetherPerMore: 0,
    detail: {
      critDamage: [],
      critValueFlat: [],
      critValuePct: [],
      elementFire: [],
      elementCold: [],
      elementLightning: [],
      armorPen: [],
      erosionPen: [],
      spiritSourceEffect: [],
      doubleDamageChance: [],
      countCap: [],
      atkSpeed: [],
      castSpeed: [],
      tetherGainSpeed: [],
      tetherHaveMore: [],
      tetherAtCapMore: [],
      tetherPerCrit: [],
      tetherPerMore: [],
    },
  }
}

// 纽带层数上限：基础 3 + 各模块「+N纽带层数上限」词缀。神格石板带「神格生效上限：1」时同类只计一次。
export function computeTetherCap(build) {
  const BASE = 3
  let cap = BASE
  const seenDiv = new Set()
  const apply = (text) => {
    const m = String(text || '').match(TETHER_CAP_RE)
    if (m) cap += parseInt(m[1].replace(/\s/g, ''), 10) || 0
  }
  for (const mod of MODULES) {
    const texts = mod.collect(build)
    for (const raw of texts || []) {
      const t = String(raw || '')
      const hasCapNote = /神格生效上限/.test(t)
      const key = t.replace(/（神格生效上限：1）/, '')
      if (mod.key === 'divinity' && hasCapNote) {
        if (seenDiv.has(key)) continue
        seenDiv.add(key)
      }
      apply(t)
    }
  }
  return cap
}

export function aggregateMinionAffixStats(build) {
  const acc = emptyAcc()
  const { detail } = acc
  const tetherCap = computeTetherCap(build)
  const states = applyWarmBreezeCap(
    applyTetherCap(build && build.configuration, tetherCap),
    computeWarmBreezeCap()
  )
  acc.tetherCap = tetherCap
  acc.tetherStacks = states.tetherStacks
  acc.warmBreezeStacks = states.warmBreezeStacks

  const add = (key, module, segment, value) => {
    acc[key] += value
    detail[key].push({ module, text: segment, value })
  }

  const addPen = (el, module, segment, value) => {
    acc.elementPen[el] += value
    detail[PEN_DETAIL_KEY[el]].push({ module, text: segment, value })
  }

  // 纽带词缀预扫描：命中（含条件门控）即按当前层数折算计入，并从通用循环剔除（避免重复计入）。
  // 与 consumesTetherText / extractTether 同源，保证「统计已计入⇔计算真实计入」。
  const TETHER_ACC_KEY = {
    gainSpeed: 'tetherGainSpeed',
    haveMore: 'tetherHaveMore',
    atCapMore: 'tetherAtCapMore',
    perCrit: 'tetherPerCrit',
    perMore: 'tetherPerMore',
  }
  const processTether = (raw, modKey) => {
    const { contributions, rest } = extractTether(raw, states)
    for (const c of contributions) {
      if (c.kind === 'gainable') {
        acc.tetherGainable = true
      } else {
        const dk = TETHER_ACC_KEY[c.kind]
        if (dk) {
          acc[dk] += c.value
          detail[dk].push({ module: modKey, text: c.segment, value: c.value })
        }
      }
    }
    return rest
  }

  for (const mod of MODULES) {
    const texts = mod.collect(build)
    // 神格石板词缀带「神格生效上限：1」时，同类文本只生效一次（与 computeTetherCap 去重口径一致）
    const seenDiv = new Set()
    for (const raw of texts || []) {
      const t = String(raw || '')
      if (mod.key === 'divinity' && /神格生效上限/.test(t)) {
        const key = t.replace(/（神格生效上限：1）/g, '')
        if (seenDiv.has(key)) continue
        seenDiv.add(key)
      }
      const rest = processTether(raw, mod.key)
      if (!rest) continue
      forEachGatedClause(rest, states, (text) => {
        let m = text.match(CRIT_DMG_RE)
        if (m) add('critDamage', mod.key, text, matchValue(m))

        m = text.match(CRIT_VALUE_PCT_RE)
        if (m) add('critValuePct', mod.key, text, matchValue(m))

        m = text.match(CRIT_VALUE_FLAT_RE)
        if (m) add('critValueFlat', mod.key, text, matchValue(m))

        m = text.match(SPIRIT_SOURCE_RE)
        if (m) add('spiritSourceEffect', mod.key, text, matchValue(m))

        m = text.match(DOUBLE_DMG_RE)
        if (m) add('doubleDamageChance', mod.key, text, matchValue(m))

        m = text.match(ELEM_PEN_RE)
        if (m) {
          const el = ELEMENT_KEY[m[4]]
          if (el) addPen(el, mod.key, text, matchValue(m))
        }

        m = text.match(ELEM_CORR_PEN_RE)
        if (m) {
          const v = matchValue(m)
          addPen('fire', mod.key, text, v)
          addPen('cold', mod.key, text, v)
          addPen('lightning', mod.key, text, v)
          acc.erosionPen += v
          detail.erosionPen.push({ module: mod.key, text, value: v })
        }

        m = text.match(EROSION_PEN_RE)
        if (m) add('erosionPen', mod.key, text, matchValue(m))

        m = text.match(ARMOR_PEN_RE)
        if (m) add('armorPen', mod.key, text, matchValue(m))

        m = text.match(ATK_SPEED_RE)
        if (m) add('atkSpeed', mod.key, text, matchValue(m))

        m = text.match(CAST_SPEED_RE)
        if (m) add('castSpeed', mod.key, text, matchValue(m))

        m = text.match(DUAL_SPEED_RE)
        if (m) {
          const v = matchValue(m)
          add('atkSpeed', mod.key, text, v)
          add('castSpeed', mod.key, text, v)
        }

        m = text.match(CAP_FIXED_RE)
        if (m) {
          const v = parseInt(m[1], 10)
          acc.countCapFixed = v
          detail.countCap.push({ module: mod.key, text, value: v, fixed: true })
        }
        m = text.match(CAP_GLOBAL_RE)
        if (m) add('countCap', mod.key, text, parseInt(m[1], 10))
        m = text.match(CAP_SKILL_RE)
        if (m) add('countCap', mod.key, text, parseInt(m[1], 10))
      })
    }
  }

  // 暴击率 = (flat暴击值/100) × (100 + 百分比暴击值)/100，上限 100
  acc.critRate = Math.min(100, (acc.critValueFlat / 100) * ((100 + acc.critValuePct) / 100))

  return acc
}
