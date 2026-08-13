import { cleanAffixText } from './affixText.js'
import { blessingStacks } from './combatStates.js'

const VALUE_RE = /([+-]?\d+(?:\.\d+)?)\s*%/
const RANGE_RE = /(\d+(?:\.\d+)?)\s*[~〜\-－—–]\s*(\d+(?:\.\d+)?)/

const isMoreText = (text) => /(额外|additional)/i.test(text)

// DoT 异常状态类型映射（点燃/凋零/创伤/恶化 + 加剧值）
const DOT_MAP = { 点燃: 'ignite', 凋零: 'wither', 创伤: 'trauma', 恶化: 'worsen' }

// 伤害转换元素映射
const CONV_EL_MAP = {
  物理: 'physical',
  火焰: 'fire',
  冰冷: 'cold',
  闪电: 'lightning',
  腐蚀: 'erosion',
  侵蚀: 'erosion',
  混沌: 'chaos',
}

function percentValue(text) {
  const rm = text.match(RANGE_RE)
  if (rm) return (parseFloat(rm[1]) + parseFloat(rm[2])) / 2
  const m = text.match(VALUE_RE)
  return m ? parseFloat(m[1]) : null
}

function rangeAvg(text) {
  const m = text.match(RANGE_RE)
  return m ? (parseFloat(m[1]) + parseFloat(m[2])) / 2 : null
}

// 平值（非百分比）数值：取范围中值或单个带符号数值
function flatValue(text) {
  const rm = text.match(RANGE_RE)
  if (rm) return (parseFloat(rm[1]) + parseFloat(rm[2])) / 2
  const m = text.match(/([+-]?\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

const RULES = [
  {
    id: 'blessingPerStack',
    test: (text) => text.includes('每拥有1层任意祝福'),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      return {
        type: 'perStack',
        target: 'damage',
        more,
        source: text,
        value: (ctx) => {
          const stacks = blessingStacks(ctx.states)
          return more ? 1 + (stacks * x) / 100 : (stacks * x) / 100
        },
      }
    },
  },
  {
    id: 'traumaConditional',
    test: (text) => text.includes('创伤状态') && text.includes('伤害'),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      return {
        type: 'conditional',
        target: 'damage',
        more,
        source: text,
        value: more ? 1 + x / 100 : x / 100,
        condition: { state: 'enemyTrauma', min: 1 },
      }
    },
  },
  {
    id: 'movingArmor',
    test: (text) => text.includes('移动时') && text.includes('护甲'),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      return {
        type: 'defensive',
        target: 'armor',
        source: text,
        value: x / 100,
        condition: { state: 'isMoving' },
      }
    },
  },
  {
    id: 'attackSpellFlatPhys',
    test: (text) =>
      text.includes('附加') && text.includes('点物理伤害') && (text.includes('攻击') || text.includes('法术')),
    build: (text) => {
      const v = rangeAvg(text)
      if (v == null) return null
      const targets = []
      if (text.includes('攻击')) targets.push({ skillType: 'attack', damageType: 'physical' })
      if (text.includes('法术')) targets.push({ skillType: 'spell', damageType: 'physical' })
      if (targets.length === 0) return null
      return targets.map((t) => ({ type: 'addAs', target: t, source: text, value: v }))
    },
  },
  {
    id: 'incomingPhysToFire',
    test: (text) => text.includes('受到的物理伤害') && text.includes('火焰伤害'),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      return {
        type: 'conversion',
        target: { def: 'physToFire' },
        source: text,
        value: x / 100,
      }
    },
  },
  {
    id: 'incomingDamageReduction',
    test: (text) => text.includes('受到的') && /伤害.*(减免|减少|降低)/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      return {
        type: 'defensive',
        target: 'damageReduction',
        source: text,
        value: Math.abs(x) / 100,
      }
    },
  },
  {
    id: 'projectileSpeedScale',
    test: (text) => text.includes('投射物速度') && text.includes('同样作用于'),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      return {
        type: 'attributeScale',
        target: { skillType: 'projectile' },
        source: text,
        value: (ctx) => ((ctx.attackSpeedInc || 0) * x) / 10000,
      }
    },
  },
  {
    id: 'negativeAttackSpeed',
    test: (text) => /额外\s*-\s*\d+(?:\.\d+)?\s*%/.test(text) && /(攻击速度|攻速)/.test(text),
    build: (text) => {
      const m = text.match(/额外\s*([+-]?\d+(?:\.\d+)?)\s*%/)
      if (!m) return null
      return {
        type: 'defensive',
        target: 'attackSpeed',
        source: text,
        value: -Math.abs(parseFloat(m[1])) / 100,
      }
    },
  },
  {
    id: 'procBlessOnKill',
    test: (text) => text.includes('击败时') && text.includes('祝福'),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      return {
        type: 'proc',
        target: 'blessTough',
        source: text,
        value: x / 100,
        simulated: false,
      }
    },
  },
  {
    id: 'attrPerPoint',
    test: (text) => /每\s*\d+(?:\.\d+)?\s*点属性/.test(text),
    build: (text) => {
      const m = text.match(/每\s*(\d+(?:\.\d+)?)\s*点属性/)
      const x = m ? parseFloat(m[1]) : null
      const y = percentValue(text)
      if (x == null || y == null) return null
      const more = isMoreText(text)
      return {
        type: 'perStack',
        target: 'damage',
        more,
        source: text,
        value: (ctx) => {
          const stats = ctx.stats || {}
          const attr = (stats.str || 0) + (stats.dex || 0) + (stats.int || 0)
          const stacks = Math.floor(attr / x)
          return more ? 1 + (stacks * y) / 100 : (stacks * y) / 100
        },
      }
    },
  },
  {
    id: 'ragePerPoint',
    test: (text) => /每拥有\s*\d+(?:\.\d+)?\s*点怒气/.test(text),
    build: (text) => {
      const m = text.match(/每拥有\s*(\d+(?:\.\d+)?)\s*点怒气/)
      const x = m ? parseFloat(m[1]) : null
      const y = percentValue(text)
      if (x == null || y == null) return null
      const more = isMoreText(text)
      return {
        type: 'perStack',
        target: 'damage',
        more,
        source: text,
        value: (ctx) => {
          const rage = ctx.states.rage || 0
          const stacks = Math.floor(rage / x)
          return more ? 1 + (stacks * y) / 100 : (stacks * y) / 100
        },
      }
    },
  },
  {
    id: 'minionDamage',
    test: (text) => /召唤物.*(伤害|暴击)/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      return {
        type: 'minion',
        target: { skillType: 'minion' },
        more,
        source: text,
        value: more ? 1 + x / 100 : x / 100,
      }
    },
  },
  {
    id: 'enemyStateDamage',
    test: (text) =>
      /对(冰结|感电|点燃|创伤|凋零|被诅咒)的敌人/.test(text) &&
      /(伤害|damage|暴击|穿透)/i.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      const stateMap = {
        冰结: { state: 'enemyIsChilled', min: 1 },
        感电: { state: 'enemyIsShocked', min: 1 },
        点燃: { state: 'enemyIsIgnited', min: 1 },
        创伤: { state: 'enemyTrauma', min: 1 },
        凋零: { state: 'enemyWither', min: 1 },
        被诅咒: { state: 'enemyIsCursed' },
      }
      const key = text.match(/对(冰结|感电|点燃|创伤|凋零|被诅咒)的敌人/)[1]
      const cond = stateMap[key]
      return {
        type: more ? 'more' : 'inc',
        target: fallbackTargetLike(text),
        more,
        source: text,
        value: more ? 1 + x / 100 : x / 100,
        condition: cond,
      }
    },
  },
  {
    id: 'lifeStateDamage',
    test: (text) => /(生命健康时|生命濒危时|非生命濒危时)/.test(text) && /(伤害|damage)/i.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      let condition
      if (text.includes('生命健康时')) condition = { state: 'isFullLife' }
      else if (text.includes('非生命濒危时')) condition = { state: 'isLowLife', value: false }
      else condition = { state: 'isLowLife' }
      return {
        type: more ? 'more' : 'inc',
        target: fallbackTargetLike(text),
        more,
        source: text,
        value: more ? 1 + x / 100 : x / 100,
        condition,
      }
    },
  },
  {
    id: 'enemyAilmentsPerStack',
    test: (text) => /敌人身上每有1种异常状态/.test(text) && /(伤害|damage|暴击)/i.test(text),
    build: (text) => {
      const x = percentValue(text)
      const maxM = text.match(/最多\s*([+-]?\d+(?:\.\d+)?)\s*%/)
      if (x == null) return null
      const more = isMoreText(text)
      const cap = maxM ? parseFloat(maxM[1]) : null
      return {
        type: 'perStack',
        target: fallbackTargetLike(text),
        more,
        source: text,
        value: (ctx) => {
          const count =
            (ctx.states.enemyIsIgnited ? 1 : 0) +
            (ctx.states.enemyIsShocked ? 1 : 0) +
            (ctx.states.enemyIsChilled ? 1 : 0) +
            (ctx.states.enemyTrauma > 0 ? 1 : 0) +
            (ctx.states.enemyWither > 0 ? 1 : 0) +
            (ctx.states.enemyWorsen > 0 ? 1 : 0) +
            (ctx.states.enemyPoison > 0 ? 1 : 0)
          const v = (count * x) / 100
          return more ? 1 + Math.min(cap ? cap / 100 : Infinity, v) : Math.min(cap ? cap / 100 : Infinity, v)
        },
      }
    },
  },
  {
    id: 'enemyFarDamage',
    test: (text) => /对远处的敌人/.test(text) && /(伤害|damage|暴击)/i.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      return {
        type: more ? 'more' : 'inc',
        target: fallbackTargetLike(text),
        more,
        source: text,
        value: more ? 1 + x / 100 : x / 100,
        condition: { state: 'enemyIsFar' },
      }
    },
  },
  {
    id: 'surroundingEnemyDamage',
    test: (text) => /对周围敌人|周围敌人/.test(text) && /(伤害|damage)/i.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      return {
        type: more ? 'more' : 'inc',
        target: fallbackTargetLike(text),
        more,
        source: text,
        value: more ? 1 + x / 100 : x / 100,
        condition: { state: 'isInCombat' },
      }
    },
  },
  {
    id: 'enemyCountOnly',
    test: (text) => /周围只有\s*(\d+)\s*个敌人/.test(text) && /(伤害|damage|攻击速度|施法速度)/i.test(text),
    build: (text) => {
      const m = text.match(/周围只有\s*(\d+)\s*个敌人/)
      const x = percentValue(text)
      if (!m || x == null) return null
      const more = isMoreText(text)
      const count = parseInt(m[1], 10)
      return {
        type: more ? 'more' : 'inc',
        target: fallbackTargetLike(text),
        more,
        source: text,
        value: more ? 1 + x / 100 : x / 100,
        condition: { state: 'enemyCount', value: count },
      }
    },
  },
  {
    id: 'blockingDamage',
    test: (text) => /(持盾时|格挡时)/.test(text) && /(伤害|damage|护甲|防御)/i.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      const isDefense = /(护甲|防御)/.test(text)
      const target = isDefense ? (text.includes('护甲') ? 'armor' : 'damageReduction') : fallbackTargetLike(text)
      const type = isDefense ? 'defensive' : more ? 'more' : 'inc'
      return {
        type,
        target,
        more,
        source: text,
        value: more ? 1 + x / 100 : x / 100,
        condition: { state: 'isBlocking' },
      }
    },
  },
  {
    id: 'statPerPoint',
    test: (text) =>
      /每\s*\d+(?:\.\d+)?\s*点(力量|敏捷|智慧|智力)/.test(text) && !/暴击值/.test(text),
    build: (text) => {
      const m = text.match(/每\s*(\d+(?:\.\d+)?)\s*点(力量|敏捷|智慧|智力)/)
      const x = m ? parseFloat(m[1]) : null
      const y = percentValue(text)
      if (x == null || y == null) return null
      const more = isMoreText(text)
      const statKey = { 力量: 'str', 敏捷: 'dex', 智慧: 'int', 智力: 'int' }[m[2]]
      return {
        type: 'perStack',
        target: fallbackTargetLike(text),
        more,
        source: text,
        value: (ctx) => {
          const stats = ctx.stats || {}
          const stacks = Math.floor((stats[statKey] || 0) / x)
          return more ? 1 + (stacks * y) / 100 : (stacks * y) / 100
        },
      }
    },
  },
  {
    id: 'stackPerLayer',
    test: (text) => /每(拥有|有)\s*(\d+)层/.test(text),
    build: (text) => {
      const m = text.match(/每(拥有|有)\s*(\d+)层/)
      const x = m ? parseInt(m[2], 10) : null
      const y = percentValue(text)
      if (x == null || y == null) return null
      const more = isMoreText(text)
      const keyM = text.match(/每(?:拥有|有)\s*\d+层([^，,。;；]{1,10})/)
      const key = keyM ? keyM[1] : ''
      const stateMap = {
        祝福: (s) => blessingStacks(s),
        女武神颂: (s) => s.victorySong || 0,
        鼓舞: (s) => s.inspiration || 0,
        亵渎: (s) => s.desecration || 0,
        战意: (s) => s.warIntent || 0,
        聚能祝福: (s) => s.blessFocus || 0,
        灵动祝福: (s) => s.blessAgile || 0,
        坚韧祝福: (s) => s.blessTough || 0,
      }
      const getter = stateMap[key] || (() => 0)
      return {
        type: 'perStack',
        target: fallbackTargetLike(text),
        more,
        source: text,
        value: (ctx) => {
          const stacks = Math.floor(getter(ctx.states) / x)
          return more ? 1 + (stacks * y) / 100 : (stacks * y) / 100
        },
      }
    },
  },
  {
    id: 'countPerUnit',
    test: (text) => /每(?:有|拥有)(?:一个|两个|三个|四五个|\d+个)?(魔灵|智械|天命|召唤物)/.test(text) && /(伤害|damage)/i.test(text),
    build: (text) => {
      const m = text.match(/每(?:有|拥有)(?:(一个|两个|三个|四五个|(\d+)个))?(魔灵|智械|天命|召唤物)/)
      const unit = m && m[3]
      if (!unit) return null
      const x = m[2] ? parseInt(m[2], 10) : { 一个: 1, 两个: 2, 三个: 3, 四五个: 4 }[m[1]] || 1
      const y = percentValue(text)
      if (y == null) return null
      const more = isMoreText(text)
      return {
        type: 'perStack',
        target: unit === '魔灵' || unit === '智械' ? { skillType: 'minion' } : fallbackTargetLike(text),
        more,
        source: text,
        value: (ctx) => {
          const count = ctx.states.minionCount || 0
          const stacks = Math.floor(count / x)
          return more ? 1 + (stacks * y) / 100 : (stacks * y) / 100
        },
      }
    },
  },
  {
    id: 'recentStackDamage',
    test: (text) => /最近每(造成|施加)(\d+)层(凋零|创伤|恶化|中毒)/.test(text) && /(伤害|damage)/i.test(text),
    build: (text) => {
      const m = text.match(/最近每(造成|施加)(\d+)层(凋零|创伤|恶化|中毒)/)
      const x = m ? parseInt(m[2], 10) : null
      const y = percentValue(text)
      if (x == null || y == null) return null
      const more = isMoreText(text)
      const debuff = m[3]
      const stateMap = { 凋零: 'enemyWither', 创伤: 'enemyTrauma', 恶化: 'enemyWorsen', 中毒: 'enemyPoison' }
      const key = stateMap[debuff]
      return {
        type: 'perStack',
        target: fallbackTargetLike(text),
        more,
        source: text,
        value: (ctx) => {
          const stacks = Math.floor((ctx.states[key] || 0) / x)
          return more ? 1 + (stacks * y) / 100 : (stacks * y) / 100
        },
      }
    },
  },
  {
    id: 'growthPerPoint',
    test: (text) => /魔灵每有\s*\d+(?:\.\d+)?\s*点生长值/.test(text) && /(伤害|damage)/i.test(text),
    build: (text) => {
      const m = text.match(/魔灵每有\s*(\d+(?:\.\d+)?)\s*点生长值/)
      const x = m ? parseFloat(m[1]) : null
      const y = percentValue(text)
      if (x == null || y == null) return null
      const more = isMoreText(text)
      const maxM = text.match(/最多(?:额外)?([+-]?\d+(?:\.\d+)?)%/)
      const cap = maxM ? parseFloat(maxM[1]) : null
      return {
        type: 'perStack',
        target: { skillType: 'minion' },
        more,
        source: text,
        value: (ctx) => {
          const growth = ctx.states.growthValue || 0
          const stacks = Math.floor(growth / x)
          const v = (stacks * y) / 100
          const capped = cap != null ? Math.min(cap / 100, v) : v
          return more ? 1 + capped : capped
        },
      }
    },
  },
  {
    id: 'statPct',
    test: (text) => /([+-]?\d+(?:\.\d+)?)%\s*(力量|敏捷|智慧|智力|全属性)/.test(text),
    build: (text) => {
      const m = text.match(/([+-]?\d+(?:\.\d+)?)%\s*(力量|敏捷|智慧|智力|全属性)/)
      const x = m ? parseFloat(m[1]) : null
      if (x == null) return null
      const key = m[2]
      const statMap = { 力量: 'str', 敏捷: 'dex', 智慧: 'int', 智力: 'int' }
      return {
        type: 'statPct',
        target: key === '全属性' ? 'all' : statMap[key],
        source: text,
        value: x / 100,
      }
    },
  },
  {
    id: 'statAll',
    test: (text) => {
      const t = text.replace(/[（）()]/g, '')
      return /[+-]\s*\d+(?:\.\d+)?(?:\s*[~〜\-－—–]\s*\d+(?:\.\d+)?)?\s*全属性/.test(t) && !/%/.test(t)
    },
    build: (text) => {
      const t = text.replace(/[（）()]/g, '')
      const v = flatValue(t)
      if (v == null) return null
      return { type: 'stat', target: 'all', source: text, value: v }
    },
  },
  {
    id: 'statFlat',
    test: (text) => {
      const t = text.replace(/[（）()]/g, '')
      return /[+-]\s*\d+(?:\.\d+)?(?:\s*[~〜\-－—–]\s*\d+(?:\.\d+)?)?\s*(力量|敏捷|智慧|智力)/.test(t) && !/%/.test(t)
    },
    build: (text) => {
      const t = text.replace(/[（）()]/g, '')
      const v = flatValue(t)
      if (v == null) return null
      const statMap = { 力量: 'str', 敏捷: 'dex', 智慧: 'int', 智力: 'int' }
      const m = t.match(/(力量|敏捷|智慧|智力)/)
      return { type: 'stat', target: statMap[m[1]], source: text, value: v }
    },
  },
  {
    id: 'resistFlat',
    test: (text) =>
      /(火焰|火|冰冷|冰霜|冰|闪电|雷|腐蚀|侵蚀|混沌|元素|全元素)抗性/.test(text) &&
      !/上限/.test(text) &&
      !/穿透/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const elMap = {
        火焰: 'fire',
        火: 'fire',
        冰冷: 'cold',
        冰霜: 'cold',
        冰: 'cold',
        闪电: 'lightning',
        雷: 'lightning',
        腐蚀: 'erosion',
        侵蚀: 'erosion',
        混沌: 'chaos',
        元素: 'all',
        全元素: 'all',
      }
      const m = text.match(/(火焰|火|冰冷|冰霜|冰|闪电|雷|腐蚀|侵蚀|混沌|元素|全元素)抗性/)
      return { type: 'resist', target: elMap[m[1]], source: text, value: x / 100 }
    },
  },
  // ===== DoT 持续伤害（点燃/凋零/创伤/恶化/加剧）=====
  // 必须在 fallback 之前截住：此前这些词缀会被 fallback 误当成普通击中伤害加成（高估）
  {
    id: 'dotBaseFlat',
    test: (text) =>
      /附加\s*[+-]?\d+(?:\.\d+)?(?:\s*[~〜\-－—–]\s*[+-]?\d+(?:\.\d+)?)?\s*基础(点燃|凋零|创伤|恶化)伤害/.test(
        text
      ),
    build: (text) => {
      const m = text.match(/基础(点燃|凋零|创伤|恶化)伤害/)
      const v = rangeAvg(text)
      if (!m || v == null) return null
      return { type: 'dot', dotType: DOT_MAP[m[1]], kind: 'flat', source: text, value: v }
    },
  },
  {
    id: 'dotAggravateFlat',
    test: (text) => /每秒施加加剧值/.test(text) && !/召唤物/.test(text),
    build: (text) => {
      const v = flatValue(text)
      if (v == null) return null
      return { type: 'dot', dotType: 'aggravate', kind: 'flat', source: text, value: v }
    },
  },
  {
    id: 'dotGlobalPct',
    test: (text) => /%持续伤害/.test(text) && !/受到/.test(text) && !/召唤物/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      return {
        type: 'dot',
        dotType: 'all',
        kind: more ? 'more' : 'inc',
        source: text,
        value: more ? 1 + x / 100 : x / 100,
      }
    },
  },
  {
    id: 'dotFirePct',
    test: (text) => /%火焰持续伤害/.test(text) && !/受到/.test(text) && !/召唤物/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      return {
        type: 'dot',
        dotType: 'ignite',
        kind: more ? 'more' : 'inc',
        source: text,
        value: more ? 1 + x / 100 : x / 100,
      }
    },
  },
  {
    id: 'dotTypePct',
    test: (text) =>
      /%(点燃|凋零|创伤|恶化)伤害/.test(text) && !/受到/.test(text) && !/召唤物/.test(text),
    build: (text) => {
      const m = text.match(/%(点燃|凋零|创伤|恶化)伤害/)
      const x = percentValue(text)
      if (!m || x == null) return null
      const more = isMoreText(text)
      return {
        type: 'dot',
        dotType: DOT_MAP[m[1]],
        kind: more ? 'more' : 'inc',
        source: text,
        value: more ? 1 + x / 100 : x / 100,
      }
    },
  },
  {
    id: 'dotAggravatePct',
    test: (text) => /%加剧效果/.test(text) && !/召唤物/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      return {
        type: 'dot',
        dotType: 'aggravate',
        kind: more ? 'more' : 'inc',
        source: text,
        value: more ? 1 + x / 100 : x / 100,
      }
    },
  },
  // ===== 伤害转换（玩家输出）=====
  // `100%物理伤害转化为火焰伤害`：把 from 元素的 flat 按比例转入 to 元素桶。
  // 必须在 fallback 之前截住：此前会被 fallback 误当"物理伤害 +100%"（高估）。
  // 排除：`受到`（incoming 减免）、`召唤物`（minion 转换）、`无法`（禁止转换）。
  {
    id: 'convertPlayerDamage',
    test: (text) =>
      /^\s*[（(]?\d+(?:\.\d+)?%[）)]?\s*(物理|火焰|冰冷|闪电|腐蚀|侵蚀|混沌)伤害转化为(物理|火焰|冰冷|闪电|腐蚀|侵蚀|混沌)伤害/.test(
        text
      ) &&
      !/受到/.test(text) &&
      !/召唤物/.test(text) &&
      !/无法/.test(text),
    build: (text) => {
      const m = text.match(
        /^\s*[（(]?(\d+(?:\.\d+)?)%[）)]?\s*(物理|火焰|冰冷|闪电|腐蚀|侵蚀|混沌)伤害转化为(物理|火焰|冰冷|闪电|腐蚀|侵蚀|混沌)伤害/
      )
      if (!m) return null
      const x = parseFloat(m[1])
      if (!Number.isFinite(x) || x <= 0) return null
      const from = CONV_EL_MAP[m[2]]
      const to = CONV_EL_MAP[m[3]]
      return { type: 'conversion', target: { damageType: from, to }, source: text, value: x / 100 }
    },
  },
]

function fallbackTargetLike(text) {
  if (/召唤物/.test(text)) return { skillType: 'minion' }
  const m = text.match(/(物理|火焰|冰冷|闪电|腐蚀|侵蚀|混乱|元素)/)
  if (m) {
    const map = { 物理: 'physical', 火焰: 'fire', 冰冷: 'cold', 闪电: 'lightning', 腐蚀: 'erosion', 侵蚀: 'erosion', 混乱: 'chaos', 元素: 'elemental' }
    return map[m[1]]
  }
  return 'damage'
}

export function classifyAffixText(text) {
  const cleaned = cleanAffixText(text).trim()
  if (!cleaned) return null
  for (const rule of RULES) {
    if (!rule.test(cleaned)) continue
    const result = rule.build(cleaned)
    if (result == null) continue
    return result
  }
  return null
}

export function collectEffects(affixTexts) {
  const effects = []
  const others = []
  for (const raw of affixTexts || []) {
    const segments = cleanAffixText(raw)
      .split(/[;；]/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const seg of segments) {
      const r = classifyAffixText(seg)
      if (r == null) {
        others.push(seg)
        continue
      }
      if (Array.isArray(r)) effects.push(...r)
      else effects.push(r)
    }
  }
  return { effects, others }
}
