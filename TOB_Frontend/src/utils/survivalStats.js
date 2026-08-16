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
  MANA_REGEN_RE,
  pctValue,
  LOCAL_BASE_RE,
  localArmorEvasionValue,
  isArmorText,
  isEvasionText,
  isCombinedReturnText,
  isLifeReturnText,
  isShieldReturnText,
  isLifeReturnIntervalText,
  isShieldReturnIntervalText,
  isReturnIntervalText,
  isShieldChargeSpeedText,
} from './survivalAffix.js'

// 生存板块统计：对 build 内 6 个模块词缀文本做正则聚合，产出护甲/闪避（总值+各类加成）、
// 抗性、返还、魔力回复、护盾充能等生存相关数值。条件词缀按战斗状态开关判定（与魔灵面板同逻辑）。
// 数值口径：范围取中值，单值取自身。
// 机械基准：护盾充能期间每秒回复 20% 最大护盾（充能速度按加算叠加）；护盾启动回复时间为 2 秒（当前无对应词缀）。

const MODULES = [
  { key: 'divinity', collect: collectDivinityAffixTexts },
  { key: 'talent', collect: collectTalentAffixTexts },
  { key: 'equipment', collect: collectEquipmentAffixTexts },
  { key: 'memory', collect: collectMemoryAffixTexts },
  { key: 'pact', collect: collectPactAffixTexts },
  { key: 'skill', collect: collectSkillAffixTexts },
]

// 护甲/闪避：`+X%护甲值` 为加算，「额外+X%护甲值」为乘区；排除「该装备…」局部基底、「护甲减伤穿透」。
// 局部「该装备…」判定与消费谓词见 survivalAffix.js（与 affixConsumers 共享单一来源）。

const SHIELD_CHARGE_BASE_PCT = 20
const SHIELD_RECHARGE_DELAY_S = 2

// 百分比数值：范围取中值，单值取自身（pctValue 定义于 survivalAffix.js）

// 各装备护甲/闪避基底：从该装备词缀文本（基底词缀 + 词条）解析「该装备护甲值/闪避值」平值，
// 与 shield 模块 equipmentShieldBase 同构。item 无 armor/evasion 数字字段，解析是唯一来源。
function baseArmorEvasion(build) {
  let armor = 0
  let evasion = 0
  const equipMap = {}
  for (const it of build.equipmentInventory || []) equipMap[it.id] = it
  for (const slot of Object.values(build.equipment || {})) {
    if (!slot) continue
    const item = typeof slot === 'object' ? slot : equipMap[slot]
    if (!item) continue
    const { armor: a, evasion: e } = localArmorEvasionValue(item)
    armor += a
    evasion += e
  }
  return { armor, evasion }
}

export function aggregateSurvivalStats(build) {
  const { armor: baseArmor, evasion: baseEvasion } = baseArmorEvasion(build)
  const acc = {
    armorInc: 0,
    armorMore: 1,
    evasionInc: 0,
    evasionMore: 1,
    lifeReturn: 0,
    lifeReturnInterval: 0,
    shieldReturn: 0,
    shieldReturnInterval: 0,
    manaRegen: 0,
    shieldChargeSpeed: 0,
  }
  const states = normalizeStates(build && build.configuration)

  for (const mod of MODULES) {
    const texts = mod.collect(build)
    for (const raw of texts || []) {
      forEachGatedClause(raw, states, (text) => {
        if (LOCAL_BASE_RE.test(text)) return

        // 护甲值 / 闪避值（乘区优先，「额外」为 more，其余为 inc；排除「护甲减伤穿透」）
        if (isArmorText(text)) {
          const v = pctValue(text)
          if (v != null) {
            if (/额外/.test(text)) acc.armorMore *= 1 + v / 100
            else acc.armorInc += v
          }
        }
        if (isEvasionText(text)) {
          const v = pctValue(text)
          if (v != null) {
            if (/额外/.test(text)) acc.evasionMore *= 1 + v / 100
            else acc.evasionInc += v
          }
        }

        // 返还（组合词缀优先，避免与单项重复计数）
        if (isCombinedReturnText(text)) {
          const v = pctValue(text)
          if (v != null) {
            acc.lifeReturn += v
            acc.shieldReturn += v
          }
        } else {
          if (isLifeReturnText(text)) {
            const v = pctValue(text)
            if (v != null) acc.lifeReturn += v
          }
          if (isShieldReturnText(text)) {
            const v = pctValue(text)
            if (v != null) acc.shieldReturn += v
          }
        }

        // 返还间隔
        if (isLifeReturnIntervalText(text)) {
          const v = pctValue(text)
          if (v != null) acc.lifeReturnInterval += v
        } else if (isShieldReturnIntervalText(text)) {
          const v = pctValue(text)
          if (v != null) acc.shieldReturnInterval += v
        } else if (isReturnIntervalText(text)) {
          const v = pctValue(text)
          if (v != null) {
            acc.lifeReturnInterval += v
            acc.shieldReturnInterval += v
          }
        }

        let m = text.match(MANA_REGEN_RE)
        if (m) acc.manaRegen += parseFloat(m[1]) || 0

        if (isShieldChargeSpeedText(text)) {
          const v = pctValue(text)
          if (v != null) acc.shieldChargeSpeed += v
        }
      })
    }
  }

  const round = (v) => Math.round(v)
  return {
    armorTotal: round(baseArmor * (1 + acc.armorInc / 100) * acc.armorMore),
    armorInc: acc.armorInc,
    armorMore: Math.round((acc.armorMore - 1) * 100),
    evasionTotal: round(baseEvasion * (1 + acc.evasionInc / 100) * acc.evasionMore),
    evasionInc: acc.evasionInc,
    evasionMore: Math.round((acc.evasionMore - 1) * 100),
    lifeReturn: acc.lifeReturn,
    lifeReturnInterval: acc.lifeReturnInterval,
    shieldReturn: acc.shieldReturn,
    shieldReturnInterval: acc.shieldReturnInterval,
    manaRegen: acc.manaRegen,
    shieldChargePct: +(SHIELD_CHARGE_BASE_PCT * (1 + acc.shieldChargeSpeed / 100)).toFixed(1),
    shieldRechargeDelay: SHIELD_RECHARGE_DELAY_S,
  }
}
