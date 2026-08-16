import {
  collectDivinityAffixTexts,
  collectEquipmentAffixTexts,
  collectMemoryAffixTexts,
  collectPactAffixTexts,
  collectSkillAffixTexts,
  collectTalentAffixTexts,
} from './affixAggregation.js'
import { forEachGatedClause } from './conditionClauses.js'
import { normalizeStates } from './combatStates.js'
import {
  MOVE_SPEED_RE,
  SKILL_DURATION_RE,
  SEAL_COMP_RE,
  MECH_CAP_RE,
  MINION_CAP_RE,
  PER_SKILL_RE,
} from './characterAffix.js'

// 角色基础属性之外的杂项角色统计：对 build 内 6 个模块（神格石板/天赋树/装备/英雄追忆/契灵/技能）的
// 原始词缀文本做正则聚合。条件词缀（持盾时/满血时等）按战斗状态开关判定是否计入（与魔灵面板同逻辑）。
// 数值口径：范围取中值，单值取自身。

const MODULES = [
  { key: 'divinity', collect: collectDivinityAffixTexts },
  { key: 'talent', collect: collectTalentAffixTexts },
  { key: 'equipment', collect: collectEquipmentAffixTexts },
  { key: 'memory', collect: collectMemoryAffixTexts },
  { key: 'pact', collect: collectPactAffixTexts },
  { key: 'skill', collect: collectSkillAffixTexts },
]

// 角色统计词缀的解析正则统一在 characterAffix.js（与 affixConsumers 消费判定同源）

export function aggregateCharacterStats(build) {
  const acc = {
    moveSpeed: 0,
    skillDuration: 0,
    sealCompensation: 0,
    mechCap: 0,
    minionCap: 0,
  }
  const states = normalizeStates(build && build.configuration)

  for (const mod of MODULES) {
    const texts = mod.collect(build)
    for (const raw of texts || []) {
      forEachGatedClause(raw, states, (text) => {
        let m = text.match(MOVE_SPEED_RE)
        if (m) acc.moveSpeed += parseFloat(m[1]) || 0

        m = text.match(SKILL_DURATION_RE)
        if (m) acc.skillDuration += parseFloat(m[1]) || 0

        m = text.match(SEAL_COMP_RE)
        if (m) acc.sealCompensation += parseFloat(m[1]) || 0

        if (!PER_SKILL_RE.test(text)) {
          m = text.match(MECH_CAP_RE)
          if (m) acc.mechCap += parseInt(m[1], 10) || 0

          m = text.match(MINION_CAP_RE)
          if (m) acc.minionCap += parseInt(m[1], 10) || 0
        }
      })
    }
  }

  return acc
}
