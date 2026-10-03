import { cleanAffixText } from './affixText.js'
import { consumesShieldAffix } from './shieldAffix.js'
import { consumesMinionAffix } from './minionAffix.js'
import { consumesSurvivalAffix } from './survivalAffix.js'
import { consumesCharacterAffix } from './characterAffix.js'
import { consumesSkillLevelAffix } from './skillLevelAffix.js'
import { consumesMaxLifeAffix, consumesMaxManaAffix } from './vitalsAffix.js'

// 集中注册表：旁路词缀消费者（不被伤害引擎 collectEffects 消费、但被其他模块/面板计入的词缀类型）。
// 新增消费者只需在此登记一次，其余消费方（aggregateAffixTexts 分组、unconsumedAffixes 排除、
// AffixStatsPanel / TalentsPage 渲染、computeBlessingCaps 取值）自动生效。
// 每个条目：
//   key    — 分组键（aggregateAffixTexts 返回值里的 bucket 名）
//   label  — 词缀统计面板的分组标题 i18n key
//   test   — 命中即认为"被该消费者计入"
//   parse  —（可选）从词缀文本提取数值（供该消费者自己的计算逻辑使用）

// —— 祝福层数上限：被条件配置（computeBlessingCaps）消费，默认满层 = 基础 4 + 各模块上限词缀。
//    注意排除条件句式「每+1任意祝福层数上限，…」（每层条件，非上限加成）。
const BLESSING_CAP_RE = /(?<!每)([+-]\s*\d+)\s*(任意|坚韧|灵动|聚能)祝福层数上限/
const BLESSING_CAP_RE_G = new RegExp(BLESSING_CAP_RE.source, 'g')

// 祝福名 → 生效的层数 key（任意=全部）
export const BLESSING_KEY_BY_NAME = {
  任意: ['agile', 'tough', 'focus'],
  坚韧: ['tough'],
  灵动: ['agile'],
  聚能: ['focus'],
}

// —— 魔灵面板：被技能计算 tab（minionAffixStats）消费（数量上限、召唤物攻速/施法速度、暴击值、穿透、魔灵之源效果、双倍伤害）。
//    消费判定复用 minionAffix.consumesMinionAffix（与 minionAffixStats 解析正则同源）。
// —— 护盾（能量护盾）：被 damageEngine.computeShield 消费（装备「+X该装备护盾」局部基底与「%该装备护盾」局部增加、
//    全局「+X%最大护盾」加算、「额外+X%最大护盾」乘区、「+X最大护盾」平值）。
//    消费判定复用 shieldAffix.consumesShieldAffix（与 damageEngine 同源）。
// —— 生存板块：被 survivalStats 消费（护甲值/闪避值/返还/回魔/护盾充能）。
//    消费判定复用 survivalAffix.consumesSurvivalAffix（与 survivalStats 解析同源）。
// —— 角色统计：被 characterStats 消费（移动速度/技能持续时间/封印补偿/召唤数量上限）。
//    消费判定复用 characterAffix.consumesCharacterAffix（与 characterStats 解析同源）。
// —— 技能等级：被技能页（skillLevelBonus）消费（「+N技能等级」按标签作用于技能槽）。
//    消费判定复用 skillLevelAffix.consumesSkillLevelAffix（与 collectSkillLevelAffixes 解析同源）。
// 各消费者只登记分组与标签，消费判定一律复用对应计算模块的叶子模块谓词，不在此重写。

export const AFFIX_CONSUMERS = [
  {
    key: 'blessing',
    label: 'affixStats.blessing',
    test: (text) => BLESSING_CAP_RE.test(String(text || '')),
    parse: (text) =>
      [...String(text || '').matchAll(BLESSING_CAP_RE_G)].map((m) => ({
        name: m[2],
        value: parseInt(m[1].replace(/\s/g, ''), 10) || 0,
      })),
  },
  {
    key: 'minion',
    label: 'affixStats.minion',
    test: consumesMinionAffix,
  },
  {
    key: 'shield',
    label: 'affixStats.shield',
    test: consumesShieldAffix,
  },
  {
    key: 'survival',
    label: 'affixStats.survival',
    test: consumesSurvivalAffix,
  },
  {
    key: 'character',
    label: 'affixStats.character',
    test: consumesCharacterAffix,
  },
  {
    key: 'skillLevel',
    label: 'affixStats.skillLevel',
    test: consumesSkillLevelAffix,
  },
  {
    key: 'maxLife',
    label: 'affixStats.maxLife',
    test: consumesMaxLifeAffix,
  },
  {
    key: 'maxMana',
    label: 'affixStats.maxMana',
    test: consumesMaxManaAffix,
  },
  // ===== L1 防具传奇装备词缀：纯数值展示类（无独立数值面板），消费判定即本表 test（单一来源），
  // 不套用 forEachGatedClause 门控——这些是规划器语境下无条件生效的修饰类词缀（击中时/受击时等
  // 前缀视为战斗常态），避免条件句式被保守门控挡成"未计入"。
  {
    key: 'curse',
    label: 'affixStats.curse',
    test: (text) => /诅咒/.test(text),
  },
  {
    key: 'resistCap',
    label: 'affixStats.resistCap',
    test: (text) => /(火焰|火|冰冷|冰霜|冰|闪电|雷|腐蚀|侵蚀|元素|全元素)抗性上限/.test(text),
  },
  {
    key: 'skillArea',
    label: 'affixStats.skillArea',
    test: (text) => /技能范围/.test(text) && !/诅咒/.test(text),
  },
  {
    key: 'blessDuration',
    label: 'affixStats.blessDuration',
    test: (text) => /祝福持续时间/.test(text),
  },
  {
    key: 'injuryBuffer',
    label: 'affixStats.injuryBuffer',
    test: (text) => /受伤缓冲/.test(text),
  },
  {
    key: 'ailmentChance',
    label: 'affixStats.ailmentChance',
    test: (text) => /几率/.test(text) && /(点燃|创伤|致盲|瘫痪|减速|避免伤害|双倍伤害)/.test(text),
  },
  {
    key: 'ailmentEffect',
    label: 'affixStats.ailmentEffect',
    test: (text) =>
      /(震慑效果|麻痹效果|麻痹持续时间|点燃上限|冰结值上限|额外施加\d+层麻痹|额外造成\d+层点燃|控制类状态效果|初始加剧值|减速效果|恶化持续时间|凋零持续时间|附加致盲)/.test(
        text
      ),
  },
  {
    key: 'spellBurst',
    label: 'affixStats.spellBurst',
    test: (text) => /法术迸发(充能速度|上限)/.test(text),
  },
  {
    key: 'regen',
    label: 'affixStats.regen',
    test: (text) => /(每秒自然回复|每秒回复\d+%?生命|每秒回复\d+%?魔力|自然回复速度)/.test(text),
  },
  {
    key: 'moveSpeedFixed',
    label: 'affixStats.moveSpeedFixed',
    test: (text) => /移动速度固定为基础值/.test(text),
  },
  {
    key: 'defenseValue',
    label: 'affixStats.defenseValue',
    test: (text) => /防御值/.test(text),
  },
  {
    key: 'blockPct',
    label: 'affixStats.blockPct',
    test: (text) => /格挡比例/.test(text),
  },
  {
    key: 'evasionCap',
    label: 'affixStats.evasionCap',
    test: (text) => /闪避上限/.test(text),
  },
  {
    key: 'size',
    label: 'affixStats.size',
    test: (text) => /体型/.test(text),
  },
  {
    key: 'cooldownRecovery',
    label: 'affixStats.cooldownRecovery',
    test: (text) => /冷却回复速度/.test(text),
  },
  {
    key: 'recovery',
    label: 'affixStats.recovery',
    test: (text) => /回复技能/.test(text),
  },
  {
    key: 'bounce',
    label: 'affixStats.bounce',
    test: (text) => /弹射次数/.test(text),
  },
  {
    key: 'ignoreRes',
    label: 'affixStats.ignoreRes',
    test: (text) => /无视.*抗性/.test(text),
  },
  {
    key: 'knockback',
    label: 'affixStats.knockback',
    test: (text) => /击退/.test(text),
  },
  {
    key: 'minionShield',
    label: 'affixStats.minionShield',
    test: (text) => /召唤物附加.*护盾/.test(text),
  },
  {
    key: 'shieldSource',
    label: 'affixStats.shieldSource',
    test: (text) => /附加\d+%[^，,;；。]*护盾/.test(text),
  },
  {
    key: 'blessGain',
    label: 'affixStats.blessGain',
    test: (text) => /几率获得.*祝福/.test(text),
  },
  {
    key: 'resPenConvert',
    label: 'affixStats.resPenConvert',
    test: (text) => /每[+-]?\d+%[^，,;；。]*抗性[^。]*穿透/.test(text),
  },
  {
    key: 'blessBuff',
    label: 'affixStats.blessBuff',
    test: (text) => /祝福时，拥有/.test(text),
  },
  {
    // 生命状态定义类：`非生命健康时，视为处于生命濒危状态`（改变低血判定的机制词缀，无独立数值面板）
    key: 'lowLifeStatus',
    label: 'affixStats.lowLifeStatus',
    test: (text) => /视为处于生命濒危状态/.test(text),
  },
  {
    // 护甲减伤穿透：`如果最近消耗了N%以上最大生命，攻击技能+N%护甲减伤穿透`（机制类，无独立数值面板；召唤物穿透归 minion 消费者）
    key: 'armorPen',
    label: 'affixStats.armorPen',
    test: (text) => /护甲减伤穿透/.test(text) && !/召唤物/.test(text),
  },
  {
    // 魔灵初始生长值：`如果最近移动了超过N米，魔灵+N初始生长值`（魔灵面板生长值基数，无独立数值面板）
    key: 'minionGrowthBase',
    label: 'affixStats.minionGrowthBase',
    test: (text) => /初始生长值/.test(text),
  },
]

// 命中文本的第一个消费者；无命中返回 null。
// states 为战斗状态（normalizeStates 后），用于条件词缀门控（与计算端共用 conditionClauses.forEachGatedClause）。
export function consumerOf(text, states) {
  const cleaned = cleanAffixText(text).trim()
  if (!cleaned) return null
  for (const c of AFFIX_CONSUMERS) {
    if (c.test(cleaned, states)) return c
  }
  return null
}

// 按 key 取消费者
export function consumerByKey(key) {
  return AFFIX_CONSUMERS.find((c) => c.key === key) || null
}

// 提取祝福层数上限词缀的全部匹配（`+1坚韧;+1聚能` 等用 `;` 分隔的多段都要计入，用 matchAll 而非 match）
export function parseBlessingCapMatches(text) {
  const c = consumerByKey('blessing')
  return c && c.parse ? c.parse(text) : []
}
