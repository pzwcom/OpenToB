import { normalizeStates, evaluateCondition } from './combatStates.js'
import { collectEffects } from './specialAffixRules.js'
import { cleanAffixText } from './affixText.js'

export const ELEMENTS = ['physical', 'cold', 'fire', 'lightning', 'erosion', 'chaos']
const ELEMENTAL = ['cold', 'fire', 'lightning']
const DOT_TYPES = ['ignite', 'wither', 'trauma', 'worsen', 'aggravate']

const VALUE_RE = /([+-]?\d+(?:\.\d+)?)\s*%/
const RANGE_RE = /(\d+(?:\.\d+)?)\s*[~〜\-－—–]\s*(\d+(?:\.\d+)?)/
const FLAT_RE = /点(物理|火焰|冰冷|闪电|腐蚀|侵蚀|混乱)伤害/

const ELEMENT_MAP = {
  物理: 'physical',
  火焰: 'fire',
  冰冷: 'cold',
  闪电: 'lightning',
  腐蚀: 'erosion',
  侵蚀: 'erosion',
  混乱: 'chaos',
  元素: 'elemental',
}

function fallbackTarget(text) {
  if (/召唤物/.test(text)) return { skillType: 'minion' }
  const m = text.match(/(物理|火焰|冰冷|闪电|腐蚀|侵蚀|混乱|元素)/)
  return m ? ELEMENT_MAP[m[1]] : 'damage'
}

function emptyBucket() {
  return { flat: 0, inc: 0, mores: [], resPen: 1 }
}

function effectValue(e, valueCtx) {
  const v = typeof e.value === 'function' ? e.value(valueCtx) : e.value
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function effectApplies(e, states) {
  return evaluateCondition(e.condition, states)
}

function rangeAvg(text) {
  const m = text.match(RANGE_RE)
  return m ? (parseFloat(m[1]) + parseFloat(m[2])) / 2 : null
}

function fallbackEffects(others) {
  const effects = []
  const incMap = new Map()
  const moreMap = new Map()
  // 被 fallback 实际消费的词缀文本（含点伤 / 无条件伤害句），供"未计入词缀"统计取差集
  const consumed = new Set()
  for (const raw of others) {
    const text = cleanAffixText(raw).trim()
    if (!text) continue
    const flatM = text.match(FLAT_RE)
    if (flatM) {
      const avg = rangeAvg(text)
      if (avg != null) {
        consumed.add(text)
        effects.push({ type: 'addAs', target: ELEMENT_MAP[flatM[1]], source: text, value: avg })
      }
      continue
    }
    if (!/(伤害|damage)/i.test(text)) continue
    // 「受到」开头的伤害减免是 incoming 向（敌人对你），不参与玩家输出，保守跳过
    if (/受到/.test(text)) continue
    // 「附加主/副手武器伤害的X%至…」：依赖武器基础伤害与技能类型细分，暂不折算，
    // 保守跳过（留在未计入面板标注），避免被当作普通 inc 误加
    if (/附加.*武器伤害/.test(text)) continue
    // 无条件句才走 fallback：含条件句式但未被规则覆盖的，保守处理（默认不生效），避免高估
    if (hasConditionMarker(text)) continue
    const rangeM = text.match(RANGE_RE)
    let v = null
    if (rangeM) {
      v = (parseFloat(rangeM[1]) + parseFloat(rangeM[2])) / 2
    } else {
      const m = text.match(VALUE_RE)
      if (m) v = parseFloat(m[1])
    }
    if (v == null) continue
    consumed.add(text)
    const more = /(额外|additional)/i.test(text)
    if (more) {
      if (!moreMap.has(text)) moreMap.set(text, { text, count: 0, value: v })
      moreMap.get(text).count += 1
    } else {
      if (!incMap.has(text)) incMap.set(text, { text, count: 0, value: v })
      incMap.get(text).count += 1
    }
  }
  for (const e of incMap.values()) {
    const target = fallbackTarget(e.text)
    effects.push({
      type: target.skillType === 'minion' ? 'minion' : 'inc',
      target,
      source: e.text,
      value: (e.value * e.count) / 100,
    })
  }
  for (const e of moreMap.values()) {
    const target = fallbackTarget(e.text)
    effects.push({
      type: target.skillType === 'minion' ? 'minion' : 'more',
      target,
      more: true,
      source: e.text,
      value: Math.pow(1 + e.value / 100, e.count),
    })
  }
  return { effects, consumed }
}

// 未被计算引擎消费的词缀清单：规则（RULES）未命中、且 fallback 也不消费（条件句/非伤害句/无数值句）的文本。
// 用于"未计入词缀"面板：识别标注 > 静默忽略，避免静默算错。
export function unconsumedAffixes(affixTexts) {
  const { others } = collectEffects(affixTexts || [])
  const { consumed } = fallbackEffects(others)
  const map = new Map()
  for (const raw of others) {
    const text = cleanAffixText(raw).trim()
    if (!text) continue
    if (consumed.has(text)) continue
    map.set(text, (map.get(text) || 0) + 1)
  }
  return [...map.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
}

// 通用条件句式标记：未被规则覆盖的条件句，fallback 默认不生效（保守，避免无条件全量导致高估）
const CONDITION_RE = /(?:时|如果|最近|每有|每拥有|每[^，。;；]{0,8}(?:点|层|个|名|秒|米|次)|触发|处于|击败时|击中时|周围|获得.*?时|持有|拥有|当|低于|达到上限)/

function hasConditionMarker(text) {
  return CONDITION_RE.test(text)
}

function isMinionTarget(target) {
  if (!target) return false
  if (target === 'minion') return true
  if (typeof target === 'object' && (target.skillType === 'minion' || target.target === 'minion')) return true
  return false
}

function damageTypeMatch(target, element) {  if (!target) return true
  const dt = typeof target === 'string' ? target : target.damageType
  if (!dt || dt === 'damage') return true
  if (dt === 'elemental') return ELEMENTAL.includes(element)
  return dt === element
}

function skillTypeMatch(target, config) {
  if (!target) return true
  const st = typeof target === 'string' ? target : target.skillType
  if (!st || st === 'damage') return true
  if (ELEMENTS.includes(st) || st === 'elemental') return true
  const current = config.skillType || null
  if (!current) return true
  return st === current
}

// 基础属性基准值按 50 级定义，实际生效值随英雄等级线性缩放并向上取整
function baseStats(build) {
  let str = 0
  let dex = 0
  let int = 0
  const equipMap = {}
  for (const it of build.equipmentInventory || []) equipMap[it.id] = it
  for (const slot of Object.values(build.equipment || {})) {
    if (!slot) continue
    const item = typeof slot === 'object' ? slot : equipMap[slot]
    if (!item) continue
    str += item.str || 0
    dex += item.dex || 0
    int += item.int || 0
  }
  const hero = build.heroTraits || {}
  const heroLevel = hero.level || 1
  const scale = (v) => Math.ceil(((v || 0) * heroLevel) / 50)
  str += scale(hero.baseStr)
  dex += scale(hero.baseDex)
  int += scale(hero.baseInt)
  return { str, dex, int }
}

// 属性类词缀叠加到 stats：先加平值（全属性/单属性），再乘百分比（-20%全属性 等）
function applyStatEffects(effects, states, valueCtx) {
  const stats = valueCtx.stats
  const applyFlat = (e) => {
    if (!effectApplies(e, states)) return
    const v = effectValue(e, valueCtx)
    if (e.target === 'all') {
      stats.str += v
      stats.dex += v
      stats.int += v
    } else if (stats[e.target] != null) {
      stats[e.target] += v
    }
  }
  for (const e of effects) {
    if (e.type !== 'stat') continue
    applyFlat(e)
  }
  for (const e of effects) {
    if (e.type !== 'statPct') continue
    if (!effectApplies(e, states)) continue
    const v = effectValue(e, valueCtx)
    if (e.target === 'all') {
      stats.str *= 1 + v
      stats.dex *= 1 + v
      stats.int *= 1 + v
    } else if (stats[e.target] != null) {
      stats[e.target] *= 1 + v
    }
  }
}

function stageBase(build, config, valueCtx) {
  const buckets = {}
  const minionBuckets = {}
  for (const e of ELEMENTS) {
    buckets[e] = emptyBucket()
    minionBuckets[e] = emptyBucket()
  }
  valueCtx.stats = baseStats(build)

  const equipMap = {}
  for (const it of build.equipmentInventory || []) equipMap[it.id] = it
  for (const slot of Object.values(build.equipment || {})) {
    if (!slot) continue
    const item = typeof slot === 'object' ? slot : equipMap[slot]
    if (!item) continue
    buckets.physical.flat += ((item.flatPhysLow || 0) + (item.flatPhysHigh || 0)) / 2
    buckets.cold.flat += ((item.flatColdLow || 0) + (item.flatColdHigh || 0)) / 2
    buckets.fire.flat += ((item.flatFireLow || 0) + (item.flatFireHigh || 0)) / 2
    buckets.lightning.flat += ((item.flatLightningLow || 0) + (item.flatLightningHigh || 0)) / 2
    buckets.chaos.flat += ((item.flatChaosLow || 0) + (item.flatChaosHigh || 0)) / 2
  }

  const skills = Array.isArray(build.skills) ? build.skills : []
  const active = skills.filter((sk) => sk.type === 'active' || sk.type === 'trigger')
  if (active.length > 0) {
    let totalEff = 0
    const skillFlat = { physical: 0, cold: 0, fire: 0, lightning: 0, chaos: 0 }
    for (const sk of active) {
      totalEff += (sk.effectiveness || 100) / 100
      const base = sk.baseDamage || 0
      skillFlat.physical += base * 0.4
      skillFlat.cold += base * 0.15
      skillFlat.fire += base * 0.15
      skillFlat.lightning += base * 0.15
      skillFlat.chaos += base * 0.15
    }
    const avgEff = totalEff / active.length
    for (const e of ELEMENTS) buckets[e].flat += (skillFlat[e] || 0) * avgEff
  }

  const cfgFlat = config.baseFlat || {}
  for (const e of ELEMENTS) buckets[e].flat += cfgFlat[e] || 0

  return {
    player: { buckets, attackSpeedInc: 0, castSpeedInc: 0 },
    minion: { buckets: minionBuckets },
    crit: { chance: 5, multi: 150 },
    atkSpeed: 1.5,
    castSpeed: 1.2,
  }
}

function stageConvert(s, effects, states, valueCtx) {
  // 先收集所有玩家输出转换（from -> {to: pct}），再基于转换前的原始 flat 统一分配，
  // 避免顺序转换误差；总转出率超过 100% 时按比例归一化。
  const plan = {}
  for (const e of effects) {
    if (e.type !== 'conversion') continue
    const tgt = e.target
    if (!tgt || tgt.def) continue
    if (!effectApplies(e, states)) continue
    const from = tgt.damageType
    const to = tgt.to
    if (!from || !to || !ELEMENTS.includes(from) || !ELEMENTS.includes(to)) continue
    if (!skillTypeMatch(tgt, valueCtx.config)) continue
    const v = effectValue(e, valueCtx)
    if (!plan[from]) plan[from] = {}
    plan[from][to] = (plan[from][to] || 0) + v
  }
  for (const from of Object.keys(plan)) {
    const base = s.player.buckets[from].flat
    if (base === 0) continue
    const entries = Object.entries(plan[from])
    const totalPct = entries.reduce((sum, [, p]) => sum + p, 0)
    const scale = totalPct > 1 ? 1 / totalPct : 1
    for (const [to, pct] of entries) {
      const amount = base * pct * scale
      s.player.buckets[to].flat += amount
    }
    s.player.buckets[from].flat = base * (1 - Math.min(1, totalPct) * scale)
  }
  return s
}

function addToBuckets(s, target, v, config) {
  const isMinion =
    (target && typeof target === 'object' && target.skillType === 'minion') || target === 'minion'
  const buckets = isMinion ? s.minion.buckets : s.player.buckets
  for (const e of ELEMENTS) {
    if (!damageTypeMatch(target, e)) continue
    if (!isMinion && !skillTypeMatch(target, config)) continue
    buckets[e].flat += v
  }
}

function stageAddAs(s, effects, states, valueCtx) {
  for (const e of effects) {
    if (e.type !== 'addAs') continue
    if (!effectApplies(e, states)) continue
    addToBuckets(s, e.target, effectValue(e, valueCtx), valueCtx.config)
  }
  return s
}

function stageIncrease(s, effects, states, valueCtx) {
  for (const e of effects) {
    if (e.more) continue
    if (e.type === 'defensive' || e.type === 'conversion' || e.type === 'addAs' || e.type === 'proc' || e.type === 'stat' || e.type === 'statPct' || e.type === 'resist') continue
    if (!effectApplies(e, states)) continue
    const v = effectValue(e, valueCtx)
    if (e.type === 'minion' || isMinionTarget(e.target)) {
      for (const el of ELEMENTS) {
        if (damageTypeMatch(e.target, el)) s.minion.buckets[el].inc += v
      }
      continue
    }
    for (const el of ELEMENTS) {
      if (!damageTypeMatch(e.target, el)) continue
      if (!skillTypeMatch(e.target, valueCtx.config)) continue
      s.player.buckets[el].inc += v
    }
  }
  return s
}

function stageMore(s, effects, states, valueCtx) {
  const seen = new Set()
  for (const e of effects) {
    if (!e.more) continue
    if (e.type === 'defensive' || e.type === 'conversion' || e.type === 'stat' || e.type === 'statPct' || e.type === 'resist') continue
    if (!effectApplies(e, states)) continue
    const key = e.source || e.text || ''
    if (seen.has(key)) continue
    seen.add(key)
    const v = effectValue(e, valueCtx)
    if (e.type === 'minion' || isMinionTarget(e.target)) {
      for (const el of ELEMENTS) {
        if (damageTypeMatch(e.target, el)) s.minion.buckets[el].mores.push(v)
      }
      continue
    }
    for (const el of ELEMENTS) {
      if (!damageTypeMatch(e.target, el)) continue
      if (!skillTypeMatch(e.target, valueCtx.config)) continue
      s.player.buckets[el].mores.push(v)
    }
  }
  return s
}

function stageCrit(s, config) {
  s.crit.chance = Math.min(100, 5 + (config.critChance || 100) - 100)
  s.crit.multi = 150 + (config.critMulti || 100) - 100
  return s
}

function stageSpeed(s, config, valueCtx) {
  const buffSpeed = (config.buffs || []).reduce(
    (sum, b) => (b && b.active && b.type === 'speed' ? sum + (b.value || 0) : sum),
    0
  )
  const atkInc = (config.attackSpeedInc || 0) + buffSpeed
  const castInc = (config.castSpeedInc || 0) + buffSpeed
  valueCtx.attackSpeedInc = atkInc
  valueCtx.castSpeedInc = castInc
  s.player.attackSpeedInc = atkInc
  s.player.castSpeedInc = castInc
  s.atkSpeed = +(1.5 * (1 + atkInc / 100)).toFixed(2)
  s.castSpeed = +(1.2 * (1 + castInc / 100)).toFixed(2)
  return s
}

function stageRes(s, config) {
  const pen = (r) => 1 - Math.max(0, (r || 0) / 200)
  for (const e of ELEMENTS) {
    s.player.buckets[e].resPen =
      e === 'physical' ? pen(config.physRes) : e === 'chaos' ? pen(config.chaosRes) : pen(config.eleRes)
  }
  return s
}

function stageDps(s, config) {
  const skillType = config.skillType || null
  const speed = skillType === 'spell' ? s.castSpeed : s.atkSpeed
  const critFactor = 1 + (s.crit.chance / 100) * (s.crit.multi / 100 - 1)
  const perElement = {}
  let total = 0
  for (const e of ELEMENTS) {
    const b = s.player.buckets[e]
    const more = b.mores.reduce((m, v) => m * v, 1)
    const final = b.flat * (1 + b.inc) * more * b.resPen
    perElement[e] = {
      flat: +b.flat.toFixed(2),
      inc: +(b.inc * 100).toFixed(2),
      more: +((more - 1) * 100).toFixed(2),
      final: +final.toFixed(0),
    }
    total += final
  }
  return {
    dps: +(total * speed * critFactor).toFixed(0),
    totalFlat: +total.toFixed(0),
    atkSpeed: s.atkSpeed,
    castSpeed: s.castSpeed,
    critChance: s.crit.chance,
    critMulti: s.crit.multi,
    critFactor: +critFactor.toFixed(3),
    perElement,
    minion: s.minion,
  }
}

// DoT 持续伤害（点燃/凋零/创伤/恶化/加剧）：独立桶，不并入主 dps（触发率/持续时间未知，避免误导）。
// final 为"每秒"伤害；inc/more 词缀有加成但无基础异常伤害时，hasBase=false。
function stageDot(effects, states, valueCtx) {
  const buckets = {}
  for (const t of DOT_TYPES) buckets[t] = { flat: 0, inc: 0, mores: [] }
  let affixCount = 0
  for (const e of effects) {
    if (e.type !== 'dot') continue
    if (!effectApplies(e, states)) continue
    affixCount += 1
    const v = effectValue(e, valueCtx)
    const targets = e.dotType === 'all' ? DOT_TYPES : [e.dotType]
    if (e.kind === 'flat') {
      for (const t of targets) buckets[t].flat += v
    } else if (e.kind === 'more') {
      for (const t of targets) buckets[t].mores.push(v)
    } else {
      for (const t of targets) buckets[t].inc += v
    }
  }
  const hasBase = DOT_TYPES.some((t) => buckets[t].flat > 0)
  const hasBoost = DOT_TYPES.some((t) => buckets[t].inc !== 0 || buckets[t].mores.length > 0)
  const out = { affixCount, hasBase, hasBoost }
  for (const t of DOT_TYPES) {
    const b = buckets[t]
    const more = b.mores.reduce((m, x) => m * x, 1)
    out[t] = {
      flat: +b.flat.toFixed(2),
      inc: +(b.inc * 100).toFixed(2),
      more: +((more - 1) * 100).toFixed(2),
      final: +Math.max(0, b.flat * (1 + b.inc) * more).toFixed(0),
    }
  }
  return out
}

export function computeDamage(ctx) {
  const states = normalizeStates(ctx && ctx.states)
  const config = (ctx && ctx.config) || {}
  const build = (ctx && ctx.build) || {}
  const { effects, others } = collectEffects((ctx && ctx.affixTexts) || [])
  const { effects: fallback } = fallbackEffects(others)
  const all = effects.concat(fallback)
  const buffSpeed = (config.buffs || []).reduce(
    (sum, b) => (b && b.active && b.type === 'speed' ? sum + (b.value || 0) : sum),
    0
  )
  const valueCtx = {
    states,
    config,
    build,
    stats: { str: 0, dex: 0, int: 0 },
    attackSpeedInc: (config.attackSpeedInc || 0) + buffSpeed,
    castSpeedInc: (config.castSpeedInc || 0) + buffSpeed,
  }

  let s = stageBase(build, config, valueCtx)
  applyStatEffects(all, states, valueCtx)
  s = stageConvert(s, all, states, valueCtx)
  s = stageAddAs(s, all, states, valueCtx)
  s = stageIncrease(s, all, states, valueCtx)
  s = stageMore(s, all, states, valueCtx)
  s = stageCrit(s, config)
  s = stageSpeed(s, config, valueCtx)
  s = stageRes(s, config)
  const result = stageDps(s, config)
  const dot = stageDot(all, states, valueCtx)
  return { ...result, stats: valueCtx.stats, dot }
}

function baseDefenseStats(build) {
  const d = {
    armor: 0,
    evasion: 0,
    maxLife: 0,
    maxMana: 0,
    energyShield: 0,
    damageReduction: 0,
    incomingPhysConvert: 0,
    res: { fire: 0, cold: 0, lightning: 0, erosion: 0, chaos: 0 },
  }
  const equipMap = {}
  for (const it of build.equipmentInventory || []) equipMap[it.id] = it
  for (const slot of Object.values(build.equipment || {})) {
    if (!slot) continue
    const item = typeof slot === 'object' ? slot : equipMap[slot]
    if (!item) continue
    d.armor += item.armor || 0
    d.evasion += item.evasion || 0
    d.maxLife += item.maxLife || 0
    d.maxMana += item.maxMana || 0
    d.energyShield += item.energyShield || 0
    d.res.fire += item.fireRes || 0
    d.res.cold += item.coldRes || 0
    d.res.lightning += item.lightningRes || 0
    d.res.erosion += item.erosionRes || 0
    d.res.chaos += item.chaosRes || 0
  }
  const hero = build.heroTraits || {}
  const heroLevel = hero.level || 1
  const scale = (v) => Math.ceil(((v || 0) * heroLevel) / 50)
  d.maxLife += scale(hero.bonusLife)
  d.maxMana += scale(hero.bonusMana)
  d.energyShield += scale(hero.bonusES)
  return d
}

export function computeDefense(ctx) {
  const states = normalizeStates(ctx && ctx.states)
  const config = (ctx && ctx.config) || {}
  const build = (ctx && ctx.build) || {}
  const { effects } = collectEffects((ctx && ctx.affixTexts) || [])
  const valueCtx = {
    states,
    config,
    build,
    stats: baseStats(build),
    attackSpeedInc: 0,
    castSpeedInc: 0,
  }
  const d = baseDefenseStats(build)
  applyStatEffects(effects, states, valueCtx)
  const penalties = []
  for (const e of effects) {
    if (!effectApplies(e, states)) continue
    const v = effectValue(e, valueCtx)
    const tgt = e.target
    if (e.type === 'stat' || e.type === 'statPct') continue
    if (e.type === 'resist') {
      const keys = tgt === 'all' ? ['fire', 'cold', 'lightning'] : [tgt]
      for (const key of keys) {
        if (d.res[key] == null) continue
        d.res[key] += v * 100
      }
      continue
    }
    if (e.type === 'defensive') {
      if (tgt === 'armor') d.armor *= 1 + v
      else if (tgt === 'evasion') d.evasion *= 1 + v
      else if (tgt === 'maxLife') d.maxLife *= 1 + v
      else if (tgt === 'maxMana') d.maxMana *= 1 + v
      else if (tgt === 'energyShield') d.energyShield *= 1 + v
      else if (tgt === 'damageReduction') d.damageReduction += v
      else if (typeof tgt === 'string' && tgt.endsWith('Res')) {
        const key = tgt.replace(/Res$/, '')
        d.res[key] = (d.res[key] || 0) + v * 100
      } else if (v < 0) {
        penalties.push({ target: tgt, value: v })
      }
    } else if (e.type === 'conversion' && tgt && tgt.def === 'physToFire') {
      d.incomingPhysConvert += v
    }
  }
  d.penalties = penalties
  return d
}
