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
