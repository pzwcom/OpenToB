// 最大生命 / 最大魔力词缀消费判定的单一来源。
// 真正的计算在 damageEngine.computeMaxLife / computeMaxMana；
// 本模块只导出「哪些词缀文本参与生命/魔力上限计算」的判定与相关正则，
// 供 damageEngine 与 affixConsumers（词缀统计/未计入面板）复用，避免消费逻辑两处重写。
// 条件词缀按 splitLeadingCondition 门控，条件不满足 → 不消费（进未计入面板）。

import { forEachGatedClause } from './conditionClauses.js'

// 不参与「最大生命上限」计算的句式：
// 回复/消耗/失去/受到（治疗、扣血、承伤），附加/相当于/屏障（转化型护盾、加伤），
// 伤害/造成（「造成X最大生命%的真实伤害」类爆炸词缀），以及「最大生命和最大护盾」组合（归护盾 computeShield 计算，避免双计）。
const MAX_LIFE_SKIP_RE =
  /回复|消耗|失去|受到|附加|相当于|屏障|伤害|造成|每秒|最大生命和最大护盾/

// 不参与「最大魔力上限」计算的句式：
// 回复/消耗/封印/附加/相当于（回复、耗蓝、封印），「最大生命和最大魔力」组合归最大生命计算。
const MAX_MANA_SKIP_RE =
  /回复|消耗|失去|受到|封印|附加|相当于|屏障|伤害|造成|每秒|最大生命和最大魔力/

// 判定一条子句是否被最大生命上限计算计入：含「最大生命」且不命中 skip。
function consumesMaxLifeClause(clause) {
  return clause.includes('最大生命') && !MAX_LIFE_SKIP_RE.test(clause)
}

// 判定一条子句是否被最大魔力上限计算计入：含「最大魔力」且不命中 skip。
function consumesMaxManaClause(clause) {
  return clause.includes('最大魔力') && !MAX_MANA_SKIP_RE.test(clause)
}

// 判定一条词缀文本是否被最大生命上限计算计入（与 computeMaxLife 同门控）。
export function consumesMaxLifeAffix(text, states) {
  let hit = false
  forEachGatedClause(text, states, (clause) => {
    if (!hit && consumesMaxLifeClause(clause)) hit = true
  })
  return hit
}

// 判定一条词缀文本是否被最大魔力上限计算计入（与 computeMaxMana 同门控）。
export function consumesMaxManaAffix(text, states) {
  let hit = false
  forEachGatedClause(text, states, (clause) => {
    if (!hit && consumesMaxManaClause(clause)) hit = true
  })
  return hit
}
