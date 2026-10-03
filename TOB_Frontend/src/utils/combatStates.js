export const combatStates = {
  isInCombat: { category: 'environment', kind: 'toggle', default: true, label: 'state.isInCombat' },
  isFullLife: { category: 'selfBuff', kind: 'toggle', default: true, label: 'state.isFullLife' },
  isLowLife: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.isLowLife' },
  isStationary: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.isStationary' },
  isMoving: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.isMoving' },
  hasCharges: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.hasCharges' },
  enemyIsIgnited: { category: 'enemyDebuff', kind: 'toggle', default: false, label: 'state.enemyIsIgnited' },
  enemyIsShocked: { category: 'enemyDebuff', kind: 'toggle', default: false, label: 'state.enemyIsShocked' },
  enemyIsChilled: { category: 'enemyDebuff', kind: 'toggle', default: false, label: 'state.enemyIsChilled' },
  rageBurst: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.rageBurst',
    requires: ['heroTrait:怒火', 'heroTrait:怒影'],
  },
  battleIntent: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 100, label: 'state.battleIntent' },
  enemyTrauma: { category: 'enemyDebuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.enemyTrauma' },
  enemyWither: { category: 'enemyDebuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.enemyWither' },
  enemyWorsen: { category: 'enemyDebuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.enemyWorsen' },
  enemyPoison: { category: 'enemyDebuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.enemyPoison' },
  // 敌人身上控制类状态种数：`击中处于至少三种控制类状态下的敌人时` 等条件的门控基数。
  enemyControlStates: { category: 'enemyDebuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.enemyControlStates' },
  // 敌人麻痹层数：`敌人至少拥有10层麻痹时` 等条件的门控基数（通用，区别于电光猫影英雄特性的 paralysisStacks）。
  enemyParalysisStacks: { category: 'enemyDebuff', kind: 'number', default: 0, min: 0, max: 40, label: 'state.enemyParalysisStacks' },
  // ===== L3 防具传奇装备：条件/每层折算基础状态 =====
  // 满护盾：`满护盾时/非满护盾时` 条件门控（满护盾=护盾全满，default 关保守）。
  fullShield: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.fullShield' },
  // 最近消耗生命：`最近每消耗N生命` 的 per-stack 折算基数。
  recentLifeSpent: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 100000, label: 'state.recentLifeSpent' },
  // 最大生命/最大魔力：`每有N最大魔力`/`每100点最大生命` 的 per-stack 折算基数（数值来自用户配置）。
  maxLife: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 50000, label: 'state.maxLife' },
  maxMana: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 20000, label: 'state.maxMana' },
  // 最近闪避次数：`最近N秒内每闪避N次` 的 per-stack 折算基数。
  recentDodgeCount: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 30, label: 'state.recentDodgeCount' },
  // 护甲值：`至少拥有N点护甲值时` 条件门控基数。
  armorValue: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 100000, label: 'state.armorValue' },
  // 最近移动距离（米）：`如果最近移动了超过N米` 条件门控基数。
  recentMoveDist: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 100, label: 'state.recentMoveDist' },
  // 光环数量：`自身只受N个光环影响时` 条件门控基数。
  auraCount: { category: 'selfBuff', kind: 'number', default: 1, min: 0, max: 20, label: 'state.auraCount' },
  // 最近使用过火焰/冰冷技能：`如果最近使用过火焰技能，+X%冰冷伤害` 等条件门控。
  recentlyUsedFireSkill: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.recentlyUsedFireSkill' },
  recentlyUsedColdSkill: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.recentlyUsedColdSkill' },
  blessAgile: { category: 'selfBuff', kind: 'number', default: 1, min: 0, max: 99, switchMax: true, label: 'state.blessAgile' },
  blessTough: { category: 'selfBuff', kind: 'number', default: 1, min: 0, max: 99, switchMax: true, label: 'state.blessTough' },
  blessFocus: { category: 'selfBuff', kind: 'number', default: 1, min: 0, max: 99, switchMax: true, label: 'state.blessFocus' },
  recentlyKilled: { category: 'environment', kind: 'toggle', default: false, label: 'state.recentlyKilled' },
  enemyArmorReduced: { category: 'enemyDebuff', kind: 'toggle', default: false, label: 'state.enemyArmorReduced' },
  // 周围敌人数量：0 = 周围没有敌人（`周围没有敌人时` 条件门控），N = 周围只有N个敌人/周围有敌人。
  enemyCount: { category: 'environment', kind: 'number', default: 1, min: 0, max: 10, label: 'state.enemyCount' },
  enemyIsCursed: { category: 'enemyDebuff', kind: 'toggle', default: false, label: 'state.enemyIsCursed' },
  enemyIsFar: { category: 'environment', kind: 'toggle', default: false, label: 'state.enemyIsFar' },
  // 召唤物数量 / 魔灵生长值：随对应技能计算（SkillCalcTab 魔灵面板）配置，
  // 不在环境/场景面板渲染（category 置为非渲染值，normalizeStates 仍保留默认与 clamp）。
  minionCount: { category: 'minion', kind: 'number', default: 0, min: 0, max: 20, label: 'state.minionCount' },
  growthValue: { category: 'minion', kind: 'number', default: 0, min: 0, max: 5000, label: 'state.growthValue' },
  // 弹射次数：投射物每弹射 N 次的折算基数（直射投射物每弹射1次，额外+X%伤害）。category 置 minion 不渲染。
  bounceCount: { category: 'minion', kind: 'number', default: 0, min: 0, max: 20, label: 'state.bounceCount' },
  // 敌人身上渗透效果种数：每有一种渗透效果 的 per-stack 折算基数。category 置 minion 不渲染。
  enemyPenetrationEffects: { category: 'minion', kind: 'number', default: 0, min: 0, max: 10, label: 'state.enemyPenetrationEffects' },
  // 纽带层数：召唤物身上的纽带层数（初始上限 3 + 各模块「+N纽带层数上限」词缀）。
  // cap 由 computeTetherCap(build) 计算（基础 3），UI 用 maxOverride 覆盖开关满层值。
  // 与祝福配置逻辑一致：存 0（无）/ 正数（有），实际层数由 applyTetherCap 换算为 cap。
  tetherStacks: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 99, switchMax: true, label: 'state.tetherStacks' },
  // 暖风层数：守望的暖风英雄特性开关——存 0（无）/ 正数（开），开启即满层。
  // cap 由 computeWarmBreezeCap(build) 计算（基础 10），UI 用 maxOverride 覆盖开关满层值。
  // 与纽带逻辑一致：实际层数由 applyWarmBreezeCap 换算为 cap；仅守望的暖风英雄可选。
  warmBreezeStacks: {
    category: 'selfBuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 99,
    switchMax: true,
    requires: ['heroTrait:守望的暖风'],
    label: 'state.warmBreeze',
  },
  // ===== 各英雄机制状态（类似暖风/怒火爆发）：requires 指定英雄 → 仅该英雄展示并联动引擎 =====
  // 弹药：投射物英雄共用（消耗弹药时 门控伤害）。开关 = 消耗弹药中。
  ammo: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.ammo',
    requires: ['heroTrait:荣光游侠', 'heroTrait:至暗掠影', 'heroTrait:战火狂徒'],
  },
  // 魔术射击：荣光游侠 buff（弹药专家 50% 几率触发）。
  magicShot: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.magicShot',
    requires: ['heroTrait:荣光游侠'],
  },
  // 偏斜：至暗掠影 buff（释放投射物技能时获得）。
  deflection: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.deflection',
    requires: ['heroTrait:至暗掠影'],
  },
  // 升温层数：战火狂徒消耗弹药累积（焚尽荣光），每层折算投射物伤害；上限数据未提供，滑条 0–50。
  heatStacks: {
    category: 'selfBuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 50,
    label: 'state.heatStacks',
    requires: ['heroTrait:战火狂徒'],
  },
  // 迅捷：寻仇之刺 buff（寻仇无冷却/额外攻击速度）。
  swiftness: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.swiftness',
    requires: ['heroTrait:寻仇之刺'],
  },
  // 法术迸发：创想鬼才资源机制（法术迸发释放的技能额外伤害）。
  spellBurst: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.spellBurst',
    requires: ['heroTrait:创想鬼才'],
  },
  // 炼狱：欢愉之焰领域（自动施放，开关=敌人在炼狱内）。
  inferno: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.inferno',
    requires: ['heroTrait:欢愉之焰'],
  },
  // 冰火暴走：冰火融合狂暴状态。
  iceFireBerserk: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.iceFireBerserk',
    requires: ['heroTrait:冰火融合'],
  },
  // 神赐：众神之伟智大招（消耗聚能祝福）。
  divineGift: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.divineGift',
    requires: ['heroTrait:众神之伟智'],
  },
  // 神域：众神之化身领域。
  divineDomain: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.divineDomain',
    requires: ['heroTrait:众神之化身'],
  },
  // 亵渎层数：渎神对敌人施加（上限 25 层），敌方减益。
  desecration: {
    category: 'enemyDebuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 25,
    label: 'state.desecration',
    requires: ['heroTrait:渎神'],
  },
  // 扭曲时空：时空流逝领域（记录/结算持续伤害）。
  distortedSpace: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.distortedSpace',
    requires: ['heroTrait:时空流逝'],
  },
  // 超载：号令征召召唤物增益（释放召唤技能后 4 秒内）。
  overload: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.overload',
    requires: ['heroTrait:号令征召'],
  },
  // 圣光领域：圣庭战车领域。
  holyDomain: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.holyDomain',
    requires: ['heroTrait:圣庭战车'],
  },
  // 秘银净土/姿态：无垢之刃双形态（开关 = 秘银净土存在）。
  mithrilState: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.mithrilState',
    requires: ['heroTrait:无垢之刃'],
  },
  // 润物层数：生长的微风对魔灵施加（上限 10 层），满层开关（与暖风一致）。
  moistenStacks: {
    category: 'selfBuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 99,
    switchMax: true,
    label: 'state.moistenStacks',
    requires: ['heroTrait:生长的微风'],
  },
  // 高歌：与海潮同歌双状态之一（放大海潮效果）。
  highSong: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.highSong',
    requires: ['heroTrait:与海潮同歌'],
  },
  // 海潮：与海潮同歌领域（海潮上的敌人受到额外伤害）。
  tide: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.tide',
    requires: ['heroTrait:与海潮同歌'],
  },
  // ===== 第二批（原"暂不适配"，复核后适配）：计数器/开关类英雄机制 =====
  // 冰霜脉冲：冰结之心触发机制（冰霜脉冲击中时 的冰冷伤害从句门控）。
  frostPulse: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.frostPulse',
    requires: ['heroTrait:冰结之心'],
  },
  // 冰霜脉冲击中次数：冰结之心 霜染舞步（每被击中1次，上限4次）。
  frostPulseHits: {
    category: 'enemyDebuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 4,
    label: 'state.frostPulseHits',
    requires: ['heroTrait:冰结之心'],
  },
  // 最大连续攻击计数：疾风追猎（达到时 的连续攻击伤害从句门控）。
  maxCombo: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.maxCombo',
    requires: ['heroTrait:疾风追猎'],
  },
  // 最近投掷炸弹计数：爆破新星 危险逃亡（每投掷一枚，上限15%）。
  bombThrows: {
    category: 'selfBuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 9,
    label: 'state.bombThrows',
    requires: ['heroTrait:爆破新星'],
  },
  // 场上炸弹数：爆破新星 虚实投递（每存在1个炸弹，最多10枚）。
  activeBombs: {
    category: 'selfBuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 10,
    label: 'state.activeBombs',
    requires: ['heroTrait:爆破新星'],
  },
  // 炸弹引爆：爆破新星 狂暴猎犬（炸弹引爆时的额外伤害门控）。
  bombExplosion: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.bombExplosion',
    requires: ['heroTrait:爆破新星'],
  },
  // 施加麻痹层数：电光猫影 猫驰电掣（每4层麻痹 +1%伤害，最多叠加10层）。
  paralysisStacks: {
    category: 'enemyDebuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 40,
    label: 'state.paralysisStacks',
    requires: ['heroTrait:电光猫影'],
  },
  // 时空幻象施法次数：时空幻象 我没蓝了（每次消耗魔力，最多叠加10次）。
  illusionCasts: {
    category: 'selfBuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 10,
    label: 'state.illusionCasts',
    requires: ['heroTrait:时空幻象'],
  },
  // 机械零件拾取数：冲锋征召 前仆后继/游击战术（每拾取一个，上限10/20次）。
  mechParts: {
    category: 'selfBuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 20,
    label: 'state.mechParts',
    requires: ['heroTrait:冲锋征召'],
  },
  // 封印生命%：与深海共舞 绯浸裙锋（每封印3%生命，额外伤害）。
  lifeSealed: {
    category: 'selfBuff',
    kind: 'number',
    default: 0,
    min: 0,
    max: 100,
    label: 'state.lifeSealed',
    requires: ['heroTrait:与深海共舞'],
  },
}

export function normalizeStates(raw) {
  const out = {}
  for (const [key, meta] of Object.entries(combatStates)) {
    const given = raw && raw[key] !== undefined ? raw[key] : meta.default
    if (meta.kind === 'number') {
      const n = Number(given)
      out[key] = Number.isFinite(n)
        ? Math.max(meta.min ?? -Infinity, Math.min(meta.max ?? Infinity, n))
        : meta.default
    } else {
      out[key] = Boolean(given)
    }
  }
  return out
}

export function evaluateCondition(condition, states) {
  if (condition == null) return true
  if (typeof condition === 'function') return Boolean(condition({ states }))
  if (typeof condition !== 'object') return true
  const value = states[condition.state]
  if (condition.value !== undefined) return value === condition.value
  if (condition.min !== undefined || condition.max !== undefined) {
    const lo = condition.min === undefined || value >= condition.min
    const hi = condition.max === undefined || value <= condition.max
    return lo && hi
  }
  return Boolean(value)
}

export function blessingStacks(states) {
  return (states?.blessAgile || 0) + (states?.blessTough || 0) + (states?.blessFocus || 0)
}

// 祝福开关：存 0（无）/ 正数（有），按当前 BD 的满层数值动态换算实际层数。
// caps 由 computeBlessingCaps(build) 计算（基础 4 + 各模块上限词缀）。
export function applyBlessingCaps(raw, caps) {
  const states = normalizeStates(raw)
  return {
    ...states,
    blessAgile: states.blessAgile > 0 ? caps.agile : 0,
    blessTough: states.blessTough > 0 ? caps.tough : 0,
    blessFocus: states.blessFocus > 0 ? caps.focus : 0,
  }
}

// 纽带层数：与祝福配置逻辑一致——存 0（无）/ 正数（有），实际层数 = 动态上限（computeTetherCap(build)）。
export function applyTetherCap(raw, cap) {
  const states = normalizeStates(raw)
  const c = Math.max(0, Number(cap) || 0)
  return {
    ...states,
    tetherCap: c,
    tetherStacks: states.tetherStacks > 0 ? c : 0,
  }
}

// 暖风层数：守望的暖风特性开关——存 0（无）/ 正数（开），实际层数 = 满层（computeWarmBreezeCap(build)）。
export function applyWarmBreezeCap(raw, cap) {
  const states = normalizeStates(raw)
  const c = Math.max(0, Number(cap) || 0)
  return {
    ...states,
    warmBreezeStacks: states.warmBreezeStacks > 0 ? c : 0,
  }
}
