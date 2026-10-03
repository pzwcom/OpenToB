import { cleanAffixText, normalizeAffixNumbers } from './affixText.js'
import { blessingStacks } from './combatStates.js'

const VALUE_RE = /([+-]?\d+(?:\.\d+)?)\s*%/
// 带符号范围：`-20–-15` / `+50–60`（负数必须带符号，配合 normalizeAffixNumbers 处理括号）
const RANGE_RE = /([+-]?\d+(?:\.\d+)?)\s*[~〜\-－—–]\s*([+-]?\d+(?:\.\d+)?)/

// 中文数字 → 整数（每有N层 的 N 可能为 一/二/…/十）
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
function cnToInt(s) {
  const n = parseInt(s, 10)
  if (Number.isFinite(n)) return n
  if (CN_NUM[s] != null) return CN_NUM[s]
  if (s.startsWith('十')) return 10 + (CN_NUM[s[1]] || 0)
  return null
}

// 英雄机制状态标记 → combatStates 状态键（详见 Spec/计算引擎/英雄特性配置.md）。
// 命中标记 + 伤害/穿透/暴击数值 的从句挂 condition 到对应状态，开关开才计入。
// 顺序：更具体标记在前（如 魔术射击 需先于 弹药，避免 特殊弹药 被误归 弹药）。
const HERO_MECHANIC_STATES = [
  { state: 'magicShot', markers: ['魔术射击'] },
  { state: 'rageBurst', markers: ['暴气状态'] },
  { state: 'ammo', markers: ['弹药'] },
  { state: 'deflection', markers: ['偏斜'] },
  { state: 'swiftness', markers: ['迅捷'] },
  { state: 'spellBurst', markers: ['法术迸发'] },
  { state: 'inferno', markers: ['炼狱'] },
  { state: 'iceFireBerserk', markers: ['冰火暴走'] },
  { state: 'divineGift', markers: ['神赐'] },
  { state: 'divineDomain', markers: ['神域'] },
  { state: 'desecration', markers: ['亵渎'] },
  { state: 'distortedSpace', markers: ['扭曲时空'] },
  { state: 'overload', markers: ['超载'] },
  { state: 'holyDomain', markers: ['圣光领域'] },
  { state: 'mithrilState', markers: ['秘银'] },
  { state: 'moistenStacks', markers: ['润物'] },
  { state: 'tide', markers: ['海潮'] },
  // 第二批（原"暂不适配"，复核后适配）：开关类英雄机制标记
  { state: 'frostPulse', markers: ['冰霜脉冲'] },
  { state: 'maxCombo', markers: ['达到最大连续攻击计数'] },
  { state: 'bombExplosion', markers: ['炸弹引爆'] },
]

// 计数器机制：动作/存在量 → 状态层数（每 X 次动作 → 层数折算，堆叠上限见从句）。
// getter 读 combatStates 对应状态；divisor 固定或从从句捕获（\d+），如 每对敌人施加4层麻痹 → ÷4。
// 必须在 heroMechanicConditional 之前（部分从句同时含 炸弹引爆/冰霜脉冲 等标记）、
// 在 stackPerLayer 之前（猫驰电掣 含 每…层麻痹，会被 stackPerLayer 误归 0 层）。
const PER_ACTION_STACKS = [
  { test: /每投掷一枚炸弹/, state: 'bombThrows', getter: (s) => s.bombThrows || 0 },
  { test: /当前每存在1个炸弹/, state: 'activeBombs', getter: (s) => s.activeBombs || 0 },
  { test: /每被冰霜脉冲击中1次/, state: 'frostPulseHits', getter: (s) => s.frostPulseHits || 0 },
  { test: /每对敌人施加(\d+)层麻痹/, state: 'paralysisStacks', getter: (s) => s.paralysisStacks || 0 },
  { test: /时空幻象每次消耗魔力/, state: 'illusionCasts', getter: (s) => s.illusionCasts || 0 },
  { test: /每拾取一个机械零件/, state: 'mechParts', getter: (s) => s.mechParts || 0 },
  { test: /每封印(\d+)%生命/, state: 'lifeSealed', getter: (s) => s.lifeSealed || 0 },
]

const HERO_MECHANIC_VALUE_RE = /(伤害|穿透|暴击)/

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

// 点伤双范围：`攻击附加18–21-24–27点物理伤害` 取 4 值均值（分隔 `-` 与范围 `–` 区分，避免 `-24` 被当负数）；
// 单范围回退 RANGE_RE 中值。
function pointRangeAvg(text) {
  const dr = text.match(
    /(\d+(?:\.\d+)?)\s*[~〜－—–]\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*[~〜－—–]\s*(\d+(?:\.\d+)?)/
  )
  if (dr) return (parseFloat(dr[1]) + parseFloat(dr[2]) + parseFloat(dr[3]) + parseFloat(dr[4])) / 4
  const rm = text.match(RANGE_RE)
  return rm ? (parseFloat(rm[1]) + parseFloat(rm[2])) / 2 : null
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
  // ===== L3 防具传奇装备：新增状态/每层折算 =====
  // 最近每消耗N生命 → per-stack：`最近每消耗4000生命，+(3–5)%伤害` 与
  // `最近每消耗3300生命，攻击附加18–21-24–27点物理伤害，最多叠加170层`（点伤类须在此截住，否则被 attackSpellFlatPhys 无条件消费）。
  {
    id: 'recentLifeSpentAddPhys',
    test: (text) => /最近每消耗[^，,;；。]*生命/.test(text) && /攻击附加.*点物理伤害/.test(text),
    build: (text) => {
      const m = text.match(/最近每消耗\s*(\d+(?:\.\d+)?)/)
      const x = m ? parseFloat(m[1]) : null
      const capM = text.match(/最多叠加\s*(\d+)(?:层|次)/)
      const capCount = capM ? parseInt(capM[1], 10) : Infinity
      const v = pointRangeAvg(text)
      if (x == null || v == null) return null
      return {
        type: 'addAs',
        target: { skillType: 'attack', damageType: 'physical' },
        source: text,
        value: (ctx) => {
          const stacks = Math.floor((ctx.states.recentLifeSpent || 0) / x)
          return Math.min(stacks, capCount) * v
        },
      }
    },
  },
  {
    id: 'recentLifeSpentPerStack',
    test: (text) => /最近每消耗[^，,;；。]*生命/.test(text) && /伤害/.test(text),
    build: (text) => {
      const m = text.match(/最近每消耗\s*(\d+(?:\.\d+)?)/)
      const x = m ? parseFloat(m[1]) : null
      const rest = text.replace(/最近每消耗[^，,]*生命，?/, '')
      const y = percentValue(rest)
      if (x == null || y == null) return null
      const more = isMoreText(rest)
      return {
        type: 'perStack',
        target: 'damage',
        more,
        source: text,
        value: (ctx) => {
          const stacks = Math.floor((ctx.states.recentLifeSpent || 0) / x)
          return more ? 1 + (stacks * y) / 100 : (stacks * y) / 100
        },
      }
    },
  },
  // 每有N最大魔力 → per-stack：`每有(75–100)最大魔力，额外+1%法术伤害，至多70%`
  {
    id: 'maxManaPerStack',
    test: (text) => /每有[^，,;；。]*最大魔力/.test(text) && /伤害/.test(text),
    build: (text) => {
      const dm = text.match(/每有\s*(\d+(?:\.\d+)?)\s*[~〜\-－—–]\s*(\d+(?:\.\d+)?)\s*最大魔力/)
      const sm = text.match(/每有\s*(\d+(?:\.\d+)?)\s*最大魔力/)
      const divisor = dm ? (parseFloat(dm[1]) + parseFloat(dm[2])) / 2 : sm ? parseFloat(sm[1]) : null
      const pm = text.match(/额外\s*([+-]?\d+(?:\.\d+)?)\s*%/)
      const capM = text.match(/至多\s*([+-]?\d+(?:\.\d+)?)%/)
      if (divisor == null || !pm) return null
      const per = parseFloat(pm[1])
      const cap = capM ? parseFloat(capM[1]) : null
      return {
        type: 'perStack',
        target: { skillType: 'spell' },
        more: true,
        source: text,
        value: (ctx) => {
          const stacks = Math.floor((ctx.states.maxMana || 0) / divisor)
          // cap 是百分数（如 70），value 返回小数，需 cap/100 后比较（cap 单位规则）
          const v = Math.min(cap != null ? cap / 100 : Infinity, (stacks * per) / 100)
          return 1 + v
        },
      }
    },
  },
  // 坚韧祝福达到上限时，每N点最大生命 → per-stack：`坚韧祝福达到上限时，每100点最大生命，额外+1%攻击火焰伤害，上限+(20–30)%`
  {
    id: 'toughCapMaxLifePerStack',
    test: (text) => /坚韧祝福达到上限时/.test(text) && /每\s*\d+(?:\.\d+)?\s*点最大生命/.test(text),
    build: (text) => {
      const m = text.match(/每\s*(\d+(?:\.\d+)?)\s*点最大生命/)
      const x = m ? parseFloat(m[1]) : null
      const pm = text.match(/额外\s*([+-]?\d+(?:\.\d+)?)\s*%/)
      const capM = text.match(/上限\s*[+-]?(\d+(?:\.\d+)?)(?:\s*[~〜\-－—–]\s*(\d+(?:\.\d+)?))?%/)
      if (x == null || !pm) return null
      const per = parseFloat(pm[1])
      const cap = capM
        ? capM[2] != null
          ? (parseFloat(capM[1]) + parseFloat(capM[2])) / 2
          : parseFloat(capM[1])
        : null
      return {
        type: 'perStack',
        target: { skillType: 'attack', damageType: 'fire' },
        more: true,
        source: text,
        value: (ctx) => {
          const stacks = Math.floor((ctx.states.maxLife || 0) / x)
          // cap 是百分数（如 25），value 返回小数，需 cap/100 后比较（cap 单位规则）
          const v = Math.min(cap != null ? cap / 100 : Infinity, (stacks * per) / 100)
          return 1 + v
        },
        condition: { state: 'blessTough', min: 1 },
      }
    },
  },
  // 最近N秒内每闪避N次 → per-stack（叠乘=more）：`最近10秒内每闪避1次，额外+(7–10)%伤害（叠乘），上限5层`
  {
    id: 'dodgePerStack',
    test: (text) => /最近\d+秒内每闪避(\d+)次/.test(text) && /伤害/.test(text),
    build: (text) => {
      const m = text.match(/每闪避(\d+)次/)
      const x = m ? parseInt(m[1], 10) : null
      const rest = text.replace(/最近\d+秒内每闪避\d+次，?/, '')
      const per = percentValue(rest)
      const capM = text.match(/上限\s*(\d+)(?:层|次)/)
      const capCount = capM ? parseInt(capM[1], 10) : Infinity
      if (x == null || per == null) return null
      return {
        type: 'perStack',
        target: 'damage',
        more: true,
        source: text,
        value: (ctx) => {
          const stacks = Math.floor((ctx.states.recentDodgeCount || 0) / x)
          return 1 + (Math.min(stacks, capCount) * per) / 100
        },
      }
    },
  },
  // 至少拥有N点护甲值时，额外+X%伤害
  {
    id: 'armorThresholdDamage',
    test: (text) => /至少拥有\d+(?:\.\d+)?点护甲值时/.test(text) && /伤害/.test(text),
    build: (text) => {
      const m = text.match(/至少拥有(\d+(?:\.\d+)?)点护甲值时/)
      const threshold = m ? parseFloat(m[1]) : null
      const rest = text.replace(/至少拥有[^，,]*点护甲值时，?/, '')
      const y = percentValue(rest)
      if (threshold == null || y == null) return null
      const more = isMoreText(rest)
      return {
        type: more ? 'more' : 'inc',
        target: 'damage',
        more,
        source: text,
        value: more ? 1 + y / 100 : y / 100,
        condition: (ctx) => (ctx.states.armorValue || 0) >= threshold,
      }
    },
  },
  // 如果最近移动了超过N米，+X%近战伤害
  {
    id: 'recentMoveDistMelee',
    test: (text) => /如果最近移动了超过/.test(text) && /近战伤害/.test(text),
    build: (text) => {
      const m = text.match(/超过\s*(\d+(?:\.\d+)?)/)
      const threshold = m ? parseFloat(m[1]) : null
      const rest = text.replace(/如果最近移动了超过[^，,]*米，?/, '')
      const y = percentValue(rest)
      if (threshold == null || y == null) return null
      const more = isMoreText(rest)
      return {
        type: more ? 'more' : 'inc',
        target: 'damage',
        more,
        source: text,
        value: more ? 1 + y / 100 : y / 100,
        condition: (ctx) => (ctx.states.recentMoveDist || 0) >= threshold,
      }
    },
  },
  // 自身只受N个光环影响时，额外+X%近战物理伤害
  {
    id: 'auraCountDamage',
    test: (text) => /自身只受\d+个光环影响时/.test(text) && /伤害/.test(text),
    build: (text) => {
      const m = text.match(/只受(\d+)个光环/)
      const count = m ? parseInt(m[1], 10) : null
      const rest = text.replace(/自身只受[^，,]*个光环影响时，?/, '')
      const y = percentValue(rest)
      if (count == null || y == null) return null
      const more = isMoreText(rest)
      return {
        type: more ? 'more' : 'inc',
        target: fallbackTargetLike(rest),
        more,
        source: text,
        value: more ? 1 + y / 100 : y / 100,
        condition: { state: 'auraCount', value: count },
      }
    },
  },
  // 如果最近使用过火焰/冰冷技能，+X%对应对应/元素伤害
  {
    id: 'recentSkillElementSwap',
    test: (text) => /如果最近使用过(火焰|冰冷)技能/.test(text) && /伤害/.test(text),
    build: (text) => {
      const um = text.match(/如果最近使用过(火焰|冰冷)技能/)
      if (!um) return null
      const usedState = um[1] === '火焰' ? 'recentlyUsedFireSkill' : 'recentlyUsedColdSkill'
      const rest = text.replace(/如果最近使用过[^，,]*技能，?/, '')
      const y = percentValue(rest)
      if (y == null) return null
      const em = rest.match(/(冰冷|火焰|元素)伤害/)
      const target = em ? { 冰冷: 'cold', 火焰: 'fire', 元素: 'elemental' }[em[1]] : 'damage'
      const more = isMoreText(rest)
      return {
        type: more ? 'more' : 'inc',
        target,
        more,
        source: text,
        value: more ? 1 + y / 100 : y / 100,
        condition: { state: usedState },
      }
    },
  },
  // 敌人至少拥有N层麻痹时，额外+X%对其造成的最大闪电伤害
  {
    id: 'enemyParalysisMaxLightning',
    test: (text) => /敌人至少拥有\d+层麻痹时/.test(text) && /伤害/.test(text),
    build: (text) => {
      const m = text.match(/至少拥有(\d+)层麻痹/)
      const threshold = m ? parseInt(m[1], 10) : null
      const rest = text.replace(/敌人至少拥有[^，,]*层麻痹时，?/, '')
      const y = percentValue(rest)
      if (threshold == null || y == null) return null
      const more = isMoreText(rest)
      return {
        type: more ? 'more' : 'inc',
        target: 'lightning',
        more,
        source: text,
        value: more ? 1 + y / 100 : y / 100,
        condition: { state: 'enemyParalysisStacks', min: threshold },
      }
    },
  },
  // 满护盾时/非满护盾时，额外(N–N)%受到的伤害：incoming 向 damageReduction，挂满护盾条件。
  // 必须在 incomingDamageReduction 之前截住（否则会被无条件计入满护盾减免，非满盾时高估）。
  {
    id: 'shieldStateIncoming',
    test: (text) => /(满护盾时|非满护盾时)/.test(text) && /受到的伤害/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const isReduction = /减免|减少|降低/.test(text) || x < 0
      const full = /(?<!非)满护盾时/.test(text)
      return {
        type: 'defensive',
        target: 'damageReduction',
        source: text,
        value: isReduction ? Math.abs(x) / 100 : -Math.abs(x) / 100,
        condition: { state: 'fullShield', value: full },
      }
    },
  },
  // 如果最近消耗了超过N生命，额外(N–N)%受到的伤害：incoming 向 damageReduction，挂最近消耗生命条件。
  // 必须在 incomingDamageReduction 之前截住（否则会被无条件计入，条件不满足时高估）。
  {
    id: 'recentLifeSpentIncoming',
    test: (text) => /最近消耗了超过\s*\d+(?:\.\d+)?\s*生命/.test(text) && /受到的伤害/.test(text),
    build: (text) => {
      const m = text.match(/超过\s*(\d+(?:\.\d+)?)\s*生命/)
      const threshold = m ? parseFloat(m[1]) : null
      const x = percentValue(text)
      if (threshold == null || x == null) return null
      const isReduction = /减免|减少|降低/.test(text) || x < 0
      return {
        type: 'defensive',
        target: 'damageReduction',
        source: text,
        value: isReduction ? Math.abs(x) / 100 : -Math.abs(x) / 100,
        condition: (ctx) => (ctx.states.recentLifeSpent || 0) >= threshold,
      }
    },
  },
  // 非满护盾时，+X%攻击、施法和移动速度（复合速度，条件门控；纯移动速度由 characterStats 走条件规则消费）
  {
    id: 'shieldStateSpeed',
    test: (text) => /非满护盾时/.test(text) && /攻击、施法和移动速度/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      return [
        { type: 'defensive', target: 'attackSpeed', source: text, value: x / 100, condition: { state: 'fullShield', value: false } },
        { type: 'defensive', target: 'castSpeed', source: text, value: x / 100, condition: { state: 'fullShield', value: false } },
        { type: 'defensive', target: 'moveSpeed', source: text, value: x / 100, condition: { state: 'fullShield', value: false } },
      ]
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
    // 受到伤害减免：`额外(-20–-15)%受到的物理伤害` / `额外-40%受到的持续伤害` / `额外+350%受到点燃伤害`。
    // 文本负数（或含 减免/减少/降低 字样）= 减免（正收益）；文本正数且无减免字样 = 承伤惩罚（负收益）。
    // 「如果X祝福上限不低于其他祝福，额外…受到的伤害」交给 blessingDominant（带祝福条件），此处排除。
    id: 'incomingDamageReduction',
    test: (text) => {
      if (text.includes('祝福上限不低于其他祝福')) return false
      if (text.includes('受到的') && /伤害.*(减免|减少|降低)/.test(text)) return true
      return /额外\s*[+-]?\d+(?:\.\d+)?(?:\s*[~〜\-－—–]\s*[+-]?\d+(?:\.\d+)?)?\s*%\s*受到的?[^，,;；。]{0,8}?伤害/.test(
        text
      )
    },
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const isReduction = /减免|减少|降低/.test(text) || x < 0
      return {
        type: 'defensive',
        target: 'damageReduction',
        source: text,
        value: isReduction ? Math.abs(x) / 100 : -Math.abs(x) / 100,
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
    // 纽带每层召唤物伤害/暴击值：`每拥有1层纽带，+X%召唤物伤害`（more/inc × 层数）。
    // 必须在 minionDamage 之前截住，否则会被无条件当召唤物伤害加算（未按层数折算）。
    id: 'tetherPerLayerMinion',
    test: (text) => /每拥有1层纽带/.test(text) && /召唤物.*(伤害|暴击)/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      return {
        type: 'minion',
        target: { skillType: 'minion' },
        more,
        source: text,
        value: (ctx) => {
          const stacks = ctx.states.tetherStacks || 0
          return more ? 1 + (stacks * x) / 100 : (stacks * x) / 100
        },
        condition: { state: 'tetherStacks', min: 1 },
      }
    },
  },
  {
    // 拥有纽带时额外召唤物伤害 / 纽带达到上限时额外召唤物伤害：条件 more。
    // 必须在 minionDamage 之前截住，否则会被无条件计入。
    id: 'tetherConditionalMinion',
    test: (text) =>
      /(拥有纽带时|纽带达到上限时)/.test(text) && /召唤物.*伤害/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      const atCap = text.includes('纽带达到上限时')
      return {
        type: 'minion',
        target: { skillType: 'minion' },
        more,
        source: text,
        value: more ? 1 + x / 100 : x / 100,
        condition: atCap
          ? (ctx) => (ctx.states.tetherStacks || 0) >= (ctx.states.tetherCap || 3)
          : { state: 'tetherStacks', min: 1 },
      }
    },
  },
  {
    // 拥有纽带时受到的伤害转移至随机召唤物：`拥有纽带时，24%受到的伤害转移至随机召唤物`
    //（受到的伤害 X% 由随机召唤物分担 = 自身承伤减少 X%）。挂 condition 到纽带层数 ≥ 1。
    id: 'tetherDamageTransfer',
    test: (text) => /拥有纽带时/.test(text) && /受到的伤害转移至随机召唤物/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      return {
        type: 'defensive',
        target: 'damageReduction',
        source: text,
        value: Math.abs(x) / 100,
        condition: { state: 'tetherStacks', min: 1 },
      }
    },
  },
  // ===== 计数器类英雄机制：每 X 次动作/存在量 → 层数折算（爆破新星 炸弹、冰结之心 脉冲、
  // 电光猫影 麻痹、时空幻象 施法、冲锋征召 零件、与深海共舞 封印生命）。=====
  // 堆叠上限：从句「上限X%」/「最多额外X%」按每层值折算为次数上限，「最多叠加N次/层」直接用。
  {
    id: 'perActionStack',
    test: (text) => PER_ACTION_STACKS.some((e) => e.test.test(text)) && /伤害/.test(text),
    build: (text) => {
      const entry = PER_ACTION_STACKS.find((e) => e.test.test(text))
      if (!entry) return null
      const m = text.match(entry.test)
      const divisor = entry.divisor || (m && m[1] ? parseInt(m[1], 10) : 1)
      if (!divisor) return null
      const perM = text.match(/额外\s*([+-]?\d+(?:\.\d+)?)\s*%([^，,。；;]{0,10})?伤害/)
      if (!perM) return null
      const per = parseFloat(perM[1])
      const more = isMoreText(text)
      let capCount = Infinity
      const capPct = text.match(/上限\s*([+-]?\d+(?:\.\d+)?)%/)
      if (capPct) capCount = Math.ceil(Math.abs(parseFloat(capPct[1]) / per))
      const capPct2 = text.match(/最多额外\s*([+-]?\d+(?:\.\d+)?)%/)
      if (capPct2) capCount = Math.ceil(Math.abs(parseFloat(capPct2[1]) / per))
      const capTimes = text.match(/最多叠加\s*(\d+)(?:次|层)/)
      if (capTimes) capCount = parseInt(capTimes[1], 10)
      const target = /召唤物|自毁程序/.test(text) ? { skillType: 'minion' } : fallbackTargetLike(text)
      return {
        type: 'perStack',
        target,
        more,
        source: text,
        value: (ctx) => {
          const stacks = Math.floor((entry.getter(ctx.states) || 0) / divisor)
          const count = Math.min(stacks, capCount)
          return more ? 1 + (count * per) / 100 : (count * per) / 100
        },
      }
    },
  },
  // 英雄机制状态门控：`弹药`/`魔术射击`/`偏斜`/`冰火暴走`/`圣光领域` 等英雄特性从句
  // （`X状态下`/`X期间`/`拥有X时`）挂 condition 到对应状态，开关开才计入。
  // 必须在 minionDamage 前截住（如 召唤物拥有超载时 不能被无条件当召唤物伤害加算）；
  // 每N层X 的 per-stack 从句排除在外，交给 stackPerLayer 折算。
  {
    id: 'heroMechanicConditional',
    test: (text) => {
      if (!HERO_MECHANIC_VALUE_RE.test(text)) return false
      if (!VALUE_RE.test(text)) return false
      if (/每(?:拥有|有)\s*[0-9一二三四五六七八九十]+层/.test(text)) return false
      if (/(转化为|抵扣|没有|失去|几率|概率)/.test(text)) return false
      return HERO_MECHANIC_STATES.some((m) => m.markers.some((k) => text.includes(k)))
    },
    build: (text) => {
      const mech = HERO_MECHANIC_STATES.find((m) => m.markers.some((k) => text.includes(k)))
      if (!mech) return null
      const x = percentValue(text)
      if (x == null) return null
      const more = isMoreText(text)
      return {
        type: more ? 'more' : 'inc',
        target: fallbackTargetLike(text),
        more,
        source: text,
        value: more ? 1 + x / 100 : x / 100,
        condition: { state: mech.state },
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
    // 周围敌人造成的伤害 = 敌人对你造成的伤害（incoming 向）：`周围敌人额外(-15–-10)%造成的伤害`。
    // 负值 = 敌人对你伤害降低（正收益），正值 = 承伤惩罚。必须在 surroundingEnemyDamage 之前截住，
    // 否则会被当成玩家输出伤害的 more/inc（方向错误）。
    id: 'surroundingEnemyIncoming',
    test: (text) =>
      /周围敌人额外\s*[+-]?\d+(?:\.\d+)?(?:\s*[~〜\-－—–]\s*[+-]?\d+(?:\.\d+)?)?\s*%\s*造成的伤害/.test(
        text
      ),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const isReduction = x < 0
      return {
        type: 'defensive',
        target: 'damageReduction',
        source: text,
        value: isReduction ? Math.abs(x) / 100 : -Math.abs(x) / 100,
        condition: { state: 'isInCombat' },
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
    test: (text) => /每(拥有|有)\s*([0-9一二三四五六七八九十]+)层/.test(text),
    build: (text) => {
      const m = text.match(/每(拥有|有)\s*([0-9一二三四五六七八九十]+)层/)
      const x = m ? cnToInt(m[2]) : null
      const y = percentValue(text)
      if (x == null || y == null) return null
      const more = isMoreText(text)
      const keyM = text.match(/每(?:拥有|有)\s*[0-9一二三四五六七八九十]+层([^，,。;；]{1,10})/)
      const key = keyM ? keyM[1] : ''
      const stateMap = {
        祝福: (s) => blessingStacks(s),
        任意祝福: (s) => blessingStacks(s),
        鼓舞: (s) => s.inspiration || 0,
        亵渎: (s) => s.desecration || 0,
        聚能祝福: (s) => s.blessFocus || 0,
        灵动祝福: (s) => s.blessAgile || 0,
        坚韧祝福: (s) => s.blessTough || 0,
        纽带: (s) => s.tetherStacks || 0,
        升温: (s) => s.heatStacks || 0,
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
  {
    // 攻击/施法速度：`+25%攻击与施法速度` / `-5%攻击速度` / `额外+13%攻击速度` / `+15%主手武器攻击速度`。
    // 排除负向「额外-N%攻击速度」（negativeAttackSpeed 已吃，且其 build 不吃 `(-15–-10)%` 范围形态，本规则兜底）；
    // 排除 固定为（武器攻击速度固定为1.35，全局改值类）与 召唤物/魔灵/智械（魔灵面板专属，勿抢占）。
    id: 'attackCastSpeed',
    test: (text) => {
      if (/速度固定|固定为|同样作用于|召唤物|魔灵|智械/.test(text)) return false
      if (!/(?:攻击(?:和|与|及)?施法速度|攻击速度|施法速度|攻速|主手武器攻击速度)/.test(text)) return false
      return percentValue(text) != null
    },
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      const effects = []
      if (/(?:攻击(?:和|与|及)?施法速度|攻击速度|主手武器攻击速度|攻速)/.test(text)) {
        effects.push({ type: 'defensive', target: 'attackSpeed', source: text, value: x / 100 })
      }
      if (/(?:攻击(?:和|与|及)?施法速度|施法速度)/.test(text)) {
        effects.push({ type: 'defensive', target: 'castSpeed', source: text, value: x / 100 })
      }
      return effects
    },
  },
  {
    // 投射物速度：`+70%投射物速度`（属性加成类，非伤害词缀）
    id: 'projectileSpeed',
    test: (text) => {
      if (/固定|同样作用于/.test(text)) return false
      return text.includes('投射物速度') && percentValue(text) != null
    },
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      return { type: 'defensive', target: 'projectileSpeed', source: text, value: x / 100 }
    },
  },
  {
    // 暴击值：`+180%暴击值` / `+51攻击和法术暴击值` / `+28%主手武器暴击值`。
    // 排除 召唤物/魔灵/智械（魔灵面板专属）、幸运（暴击幸运=机制）、固定（武器暴击值固定为500，全局改值类）、
    // `-100%暴击值`（无法暴击，全局改值类 L5）。
    // 引擎 stageCrit 用 config 计算暴击率，此 effect 仅作消费分类（防「未计入」面板误报）。
    id: 'critValue',
    test: (text) => {
      if (/召唤物|魔灵|智械|幸运|固定/.test(text)) return false
      if (/[+-]?\s*100\s*%\s*暴击值/.test(text)) return false
      if (!text.includes('暴击值')) return false
      return percentValue(text) != null || flatValue(text) != null
    },
    build: (text) => {
      const p = percentValue(text)
      if (p != null) return { type: 'crit', target: 'value', source: text, value: p / 100 }
      const v = flatValue(text)
      if (v == null) return null
      return { type: 'crit', target: 'value', source: text, value: v }
    },
  },
  {
    // 暴击伤害：`(-30–-20)%暴击伤害`（范围取中值，负数=暴击伤害惩罚）
    id: 'critDamage',
    test: (text) => {
      if (/召唤物|魔灵|智械/.test(text)) return false
      return text.includes('暴击伤害') && percentValue(text) != null
    },
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      return { type: 'crit', target: 'multi', source: text, value: x / 100 }
    },
  },
  {
    // 组合属性：`+55点力量与智慧` → 力量+智慧 双 stat
    id: 'statCombo',
    test: (text) => /[+-]?\d+(?:\.\d+)?\s*点(力量|敏捷|智慧|智力)与(力量|敏捷|智慧|智力)/.test(text),
    build: (text) => {
      const v = flatValue(text)
      const m = text.match(/(力量|敏捷|智慧|智力)与(力量|敏捷|智慧|智力)/)
      if (v == null || !m) return null
      const statMap = { 力量: 'str', 敏捷: 'dex', 智慧: 'int', 智力: 'int' }
      return [
        { type: 'stat', target: statMap[m[1]], source: text, value: v },
        { type: 'stat', target: statMap[m[2]], source: text, value: v },
      ]
    },
  },
  {
    // 受到的伤害转化：`100%受到的冰冷和闪电伤害转化为火焰伤害` / `23%受到的物理和元素伤害转化为腐蚀伤害`
    //（incoming 向转换，computeDefense 仅折算 physToFire，其余分类消费防误计）
    id: 'incomingConvert',
    test: (text) => /受到的.*(?:转化为|转化成)/.test(text),
    build: (text) => {
      const x = percentValue(text)
      if (x == null) return null
      return { type: 'conversion', target: { def: 'incoming' }, source: text, value: x / 100 }
    },
  },
  {
    // 祝福上限压制条件：`如果坚韧祝福上限不低于其他祝福，额外(-10–-8)%受到的伤害` 等。
    // 条件 = 该祝福层数 ≥ 另两种祝福层数（probe/默认状态下三者同层，条件恒真）。
    id: 'blessingDominant',
    test: (text) => /如果(坚韧|灵动|聚能)祝福上限不低于其他祝福/.test(text),
    build: (text) => {
      const m = text.match(/如果(坚韧|灵动|聚能)祝福上限不低于其他祝福/)
      if (!m) return null
      const key = { 坚韧: 'blessTough', 灵动: 'blessAgile', 聚能: 'blessFocus' }[m[1]]
      const others = key === 'blessTough' ? ['blessAgile', 'blessFocus'] : key === 'blessAgile' ? ['blessTough', 'blessFocus'] : ['blessTough', 'blessAgile']
      const cond = (ctx) => {
        const s = ctx.states || {}
        return (s[key] || 0) >= Math.max(s[others[0]] || 0, s[others[1]] || 0)
      }
      const x = percentValue(text)
      if (x == null) return null
      if (/受到的伤害/.test(text)) {
        return {
          type: 'defensive',
          target: 'damageReduction',
          source: text,
          value: Math.abs(x) / 100,
          condition: cond,
        }
      }
      if (/(攻击和施法速度|攻击速度)/.test(text)) {
        const effects = []
        if (/(攻击速度|攻击和施法速度)/.test(text)) {
          effects.push({ type: 'defensive', target: 'attackSpeed', source: text, value: x / 100, condition: cond })
        }
        if (/施法速度/.test(text)) {
          effects.push({ type: 'defensive', target: 'castSpeed', source: text, value: x / 100, condition: cond })
        }
        return effects
      }
      const more = isMoreText(text)
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
    // 弹射 per-stack：`直射投射物每弹射1次，额外+4%伤害（叠乘）`，层数取 combatStates.bounceCount ÷ 每N次
    id: 'bouncePerStack',
    test: (text) => /直射投射物每弹射(\d+)次/.test(text) && /伤害/.test(text),
    build: (text) => {
      const m = text.match(/直射投射物每弹射(\d+)次/)
      const x = m ? parseInt(m[1], 10) : null
      const per = percentValue(text)
      if (x == null || per == null) return null
      return {
        type: 'perStack',
        target: 'damage',
        more: true,
        source: text,
        value: (ctx) => {
          const stacks = Math.floor((ctx.states.bounceCount || 0) / x)
          return 1 + (stacks * per) / 100
        },
      }
    },
  },
  {
    // 渗透 per-stack：`敌人每有一种渗透效果，连携终结技对其额外+18%伤害`，层数取 combatStates.enemyPenetrationEffects
    id: 'penetrationPerStack',
    test: (text) => /每有一种渗透效果/.test(text) && /伤害/.test(text),
    build: (text) => {
      const per = percentValue(text)
      if (per == null) return null
      return {
        type: 'perStack',
        target: fallbackTargetLike(text),
        more: true,
        source: text,
        value: (ctx) => 1 + (((ctx.states.enemyPenetrationEffects || 0) * per) / 100),
      }
    },
  },
  {
    // 连续攻击时的物理%转点伤：`连续攻击时，攻击附加18%物理伤害的火焰伤害`。
    // 数值依赖实时物理基底，静态引擎无法精确折算，仅分类消费（value 0 防误计，真实折算属 L4）。
    id: 'physPctAddDamage',
    test: (text) => /攻击附加\s*\d+(?:\.\d+)?\s*%物理伤害的(火焰|冰冷|闪电|腐蚀|物理)伤害/.test(text),
    build: (text) => {
      const m = text.match(/物理伤害的(火焰|冰冷|闪电|腐蚀|物理)伤害/)
      if (!m) return null
      const elMap = { 火焰: 'fire', 冰冷: 'cold', 闪电: 'lightning', 腐蚀: 'erosion', 物理: 'physical' }
      return {
        type: 'addAs',
        target: elMap[m[1]],
        source: text,
        value: 0,
        condition: { state: 'isInCombat' },
      }
    },
  },
  {
    // 击中处于至少三种控制类状态下的敌人时，每秒回复N%最大生命值：
    // 门控到 敌人身上控制类状态种数 ≥ 3（combatStates.enemyControlStates）。
    id: 'enemyControlRecovery',
    test: (text) =>
      /至少三种控制类状态/.test(text) && /每秒回复\d+(?:\.\d+)?%最大生命/.test(text),
    build: (text) => {
      const m = text.match(/每秒回复(\d+(?:\.\d+)?)%最大生命/)
      if (!m) return null
      return {
        type: 'defensive',
        target: 'lifeRegen',
        source: text,
        value: parseFloat(m[1]) / 100,
        condition: { state: 'enemyControlStates', min: 3 },
      }
    },
  },
  {
    // 非满魔时法术伤害：`非满魔时，额外+35%法术伤害`（静态规划器按战斗默认视为生效）
    id: 'notFullManaDamage',
    test: (text) => /非满魔时/.test(text) && /伤害/.test(text),
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
  const cleaned = normalizeAffixNumbers(cleanAffixText(text)).trim()
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
    const segments = normalizeAffixNumbers(cleanAffixText(raw))
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
