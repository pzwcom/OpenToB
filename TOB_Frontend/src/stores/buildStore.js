import { makeAutoObservable, reaction } from 'mobx'
import { t } from '../locales/index.js'
import { saveStore } from './saveStore.js'
import { uuidv4 } from './uuid.js'
import { normalizeTalentType } from '../data/divinityData.js'
import { normalizeStates, applyBlessingCaps, applyTetherCap, applyWarmBreezeCap } from '../utils/combatStates.js'
import {
  aggregateDivinityAffixes,
  aggregateEquipmentAffixes,
  aggregateHeroTraitAffixes,
  aggregateMemoryAffixes,
  aggregatePactAffixes,
  aggregateSkillAffixes,
  aggregateTalentAffixes,
  collectDivinityAffixTexts,
  collectEquipmentAffixTexts,
  collectHeroTraitAffixTexts,
  collectMemoryAffixTexts,
  collectPactAffixTexts,
  collectSkillAffixTexts,
  collectTalentAffixTexts,
  computeBlessingCaps,
  computeWarmBreezeCap,
} from '../utils/affixAggregation.js'
import {
  computeDamage,
  computeDefense,
  unconsumedAffixes,
} from '../utils/damageEngine.js'
import { aggregateMinionAffixStats, computeTetherCap } from '../utils/minionAffixStats.js'
import { collectSkillLevelAffixes } from '../utils/skillLevelBonus.js'
import { aggregateCharacterStats } from '../utils/characterStats.js'
import { aggregateSurvivalStats } from '../utils/survivalStats.js'
import { localArmorEvasionValue } from '../utils/survivalAffix.js'
import talentImageData from '../assets/json/天赋/天赋所对应的图片位置.json'

export const DEFAULT_MEMORY_SLOTS = [
  { tier: 45, memoryId: '', randomAffixes: [] },
  { tier: 60, memoryId: '', randomAffixes: [] },
  { tier: 75, memoryId: '', randomAffixes: [] },
]

// ===== 技能模块：固定 5 个主动技能栏 + 4 个被动技能栏，各栏含辅助技能槽 =====
export const MAIN_SLOT_COUNT = 7
export const PASSIVE_SLOT_COUNT = 6
export const MAX_SUPPORTS = 5

// 主动技能栏辅助槽数量：核心技能（第 1 栏）5 个，其余主动技能 4 个；被动技能栏每栏 4 个
export function createEmptySkillSlot(group, index) {
  const isCore = group === 'main' && index === 1
  const supportCount = group === 'main' ? (isCore ? MAX_SUPPORTS : MAX_SUPPORTS - 1) : 4
  return {
    id: uuidv4(),
    group,
    index,
    type: group === 'main' ? 'active' : 'aura',
    kind: group === 'main' ? (isCore ? 'core' : 'active') : 'passive',
    name: '',
    level: 1,
    effectiveness: 0,
    imgPath: '',
    intro: '',
    tags: [],
    family: group === 'main' ? 'active' : 'passive',
    affixes: [],
    supports: Array.from({ length: supportCount }, () => null),
  }
}

export function createDefaultSkills() {
  const skills = []
  for (let i = 1; i <= MAIN_SLOT_COUNT; i++) skills.push(createEmptySkillSlot('main', i))
  for (let i = 1; i <= PASSIVE_SLOT_COUNT; i++) skills.push(createEmptySkillSlot('passive', i))
  return skills
}

export const talentGods = Object.keys(talentImageData)

export function getBranchesOf(god) {
  const data = talentImageData[god]
  return data ? Object.keys(data) : []
}

export function getMainBranchOf(god) {
  return god
}

export function getPlayBranchesOf(god) {
  return getBranchesOf(god).filter((b) => b !== god)
}

function createDefaultPrisms() {
  return { placed: {} }
}

function normalizePrisms(prisms) {
  if (!prisms || typeof prisms !== 'object') return createDefaultPrisms()
  return {
    placed:
      prisms.placed && typeof prisms.placed === 'object' ? prisms.placed : {},
  }
}

// 技能槽条目归一化：按固定（group, index）槽位补全缺失字段，保证 5+4 槽位恒存在
function normalizeSkillSlot(s, group, index) {
  const empty = createEmptySkillSlot(group, index)
  if (!s || typeof s !== 'object') return empty
  const isCore = group === 'main' && index === 1
  const supportCount = empty.supports.length
  const supports = Array.from({ length: supportCount }, (_, i) => {
    const sup = s.supports && Array.isArray(s.supports) ? s.supports[i] : null
    if (!sup || typeof sup !== 'object') return null
    return {
      id: typeof sup.id === 'string' && sup.id ? sup.id : uuidv4(),
      name: typeof sup.name === 'string' ? sup.name : '',
      family: typeof sup.family === 'string' ? sup.family : 'support',
      level: typeof sup.level === 'number' ? sup.level : 1,
      imgPath: typeof sup.imgPath === 'string' ? sup.imgPath : '',
      intro: typeof sup.intro === 'string' ? sup.intro : '',
      tags: Array.isArray(sup.tags) ? sup.tags : [],
    }
  })
  return {
    id: typeof s.id === 'string' && s.id ? s.id : empty.id,
    group,
    index,
    type: group === 'main' ? 'active' : 'aura',
    kind: group === 'main' ? (isCore ? 'core' : 'active') : 'passive',
    name: typeof s.name === 'string' ? s.name : '',
    level: typeof s.level === 'number' ? s.level : 1,
    effectiveness: typeof s.effectiveness === 'number' ? s.effectiveness : 0,
    imgPath: typeof s.imgPath === 'string' ? s.imgPath : '',
    intro: typeof s.intro === 'string' ? s.intro : '',
    tags: Array.isArray(s.tags) ? s.tags : [],
    family: typeof s.family === 'string' && s.family ? s.family : empty.family,
    affixes: Array.isArray(s.affixes)
      ? s.affixes.filter((a) => typeof a === 'string')
      : [],
    supports,
  }
}

function normalizeSkills(skills) {
  const bySlot = {}
  if (Array.isArray(skills)) {
    for (const s of skills) {
      if (s && typeof s === 'object' && s.group && s.index != null) {
        bySlot[`${s.group}-${s.index}`] = s
      }
    }
  }
  const out = []
  for (let i = 1; i <= MAIN_SLOT_COUNT; i++) {
    out.push(normalizeSkillSlot(bySlot[`main-${i}`], 'main', i))
  }
  for (let i = 1; i <= PASSIVE_SLOT_COUNT; i++) {
    out.push(normalizeSkillSlot(bySlot[`passive-${i}`], 'passive', i))
  }
  return out
}

// 命运词缀类型：仅「小型宿命」为小型，其余（中型宿命/天命/双生天命）均为中型
function pactAffixType(name) {
  return name && name.startsWith('小型宿命') ? 'small' : 'medium'
}

function normalizePactSpirit(sp) {
  if (!sp || typeof sp !== 'object') return null
  const spiritId =
    typeof sp.spiritId === 'string' && sp.spiritId ? sp.spiritId : null
  if (!spiritId) return null
  const replacements = {}
  if (sp.replacements && typeof sp.replacements === 'object') {
    for (const [k, v] of Object.entries(sp.replacements)) {
      const idx = Number(k)
      if (!Number.isInteger(idx) || !v) continue
      if (typeof v === 'string') {
        replacements[idx] = { name: v, value: null }
      } else if (v && typeof v === 'object' && typeof v.name === 'string' && v.name) {
        replacements[idx] = {
          name: v.name,
          value: typeof v.value === 'number' ? v.value : null,
        }
      }
    }
  }
  let additions = Array.isArray(sp.additions)
    ? sp.additions
        .filter((a) => a && typeof a === 'object' && typeof a.name === 'string' && a.name)
        .map((a) => ({
          type: a.type === 'medium' ? 'medium' : 'small',
          name: a.name,
          value: typeof a.value === 'number' ? a.value : null,
        }))
    : []
  // 兼容旧存档：旧 destiny 字段（单一命运词缀）迁移为未定宿命添加项
  if (!Array.isArray(sp.additions) && typeof sp.destiny === 'string' && sp.destiny) {
    additions = [{ type: pactAffixType(sp.destiny), name: sp.destiny, value: null }]
  }
  return {
    spiritId,
    name: typeof sp.name === 'string' ? sp.name : '',
    level: typeof sp.level === 'number' ? sp.level : 1,
    replacements,
    additions,
  }
}

function createDefaultBuild() {
  return {
    name: t('app.unnamed'),
    equipment: {
      mainHand: '',
      offHand: '',
      helmet: '',
      armor: '',
      gloves: '',
      boots: '',
      necklace: '',
      ring1: '',
      ring2: '',
      belt: '',
    },
    // 装备库存：build.equipment[槽位] 存此处条目 id（'' = 未装备）
    equipmentInventory: [],
    prisms: { inventory: [] },
    talents: [
      { slot: 1, god: '', branch: '', points: {}, corePoints: {}, prisms: createDefaultPrisms() },
      { slot: 2, god: '', branch: '', points: {}, corePoints: {}, prisms: createDefaultPrisms() },
      { slot: 3, god: '', branch: '', points: {}, corePoints: {}, prisms: createDefaultPrisms() },
      { slot: 4, god: '', branch: '', points: {}, corePoints: {}, prisms: createDefaultPrisms() },
    ],
    skills: createDefaultSkills(),
    heroTraits: {
      name: '',
      level: 1,
      baseStr: 0,
      baseDex: 0,
      baseInt: 0,
      bonusLife: 0,
      bonusMana: 0,
      bonusES: 0,
      moveSpeed: 0,
      origin: '',
      discipline: '',
      progress: '',
      traits: [],
      memorySlots: DEFAULT_MEMORY_SLOTS.map((s) => ({ ...s })),
    },
    memoryInventory: [],
    pactSpirits: [],
    divinityPage: {
      inventory: [],
      placedSlates: [],
    },
    configuration: {
      enemyLevel: 85,
      enemyType: 'unique',
      physRes: 30,
      eleRes: 50,
      enemyArmor: 20000,
      chaosRes: 30,
      extraProjectiles: 0,
      aoeEffect: 0,
      critChance: 100,
      critMulti: 100,
      buffs: [],
      isInCombat: true,
      isFullLife: true,
      isLowLife: false,
      isStationary: false,
      isMoving: false,
      hasCharges: false,
      enemyIsIgnited: false,
      enemyIsShocked: false,
      enemyIsChilled: false,
    },
  }
}

export const equipmentSlots = [
  { key: 'mainHand', label: '主武器' },
  { key: 'offHand', label: '副手' },
  { key: 'helmet', label: '头盔' },
  { key: 'armor', label: '胸甲' },
  { key: 'gloves', label: '手套' },
  { key: 'boots', label: '鞋子' },
  { key: 'necklace', label: '项链' },
  { key: 'ring1', label: '戒指 1' },
  { key: 'ring2', label: '戒指 2' },
  { key: 'belt', label: '腰带' },
]

function computeStats(build) {
  let str = 0
  let dex = 0
  let int_ = 0
  let maxLife = 0
  let maxMana = 0
  let energyShield = 0
  let armor = 0
  let evasion = 0
  let coldRes = 0
  let lightningRes = 0
  let fireRes = 0
  let erosionRes = 0
  let flatPhysLow = 0
  let flatPhysHigh = 0
  let flatColdLow = 0
  let flatColdHigh = 0
  let flatFireLow = 0
  let flatFireHigh = 0
  let flatLightningLow = 0
  let flatLightningHigh = 0
  let flatChaosLow = 0
  let flatChaosHigh = 0
  let incDamage = 0
  let incAttackSpeed = 0
  let incCastSpeed = 0
  let addCritChance = 0
  let addCritMulti = 0

  // build.equipment 存 equipmentInventory 条目 id（或旧存档对象快照），按 id 解析后再读统计字段
  const equipMap = {}
  for (const it of build.equipmentInventory || []) equipMap[it.id] = it
  for (const slot of Object.values(build.equipment || {})) {
    if (!slot) continue
    const item = typeof slot === 'object' ? slot : equipMap[slot]
    if (!item) continue
    const localAE = localArmorEvasionValue(item)
    str += item.str || 0
    dex += item.dex || 0
    int_ += item.int || 0
    maxLife += item.maxLife || 0
    maxMana += item.maxMana || 0
    energyShield += item.energyShield || 0
    armor += localAE.armor
    evasion += localAE.evasion
    coldRes += item.coldRes || 0
    lightningRes += item.lightningRes || 0
    fireRes += item.fireRes || 0
    erosionRes += item.erosionRes || 0
    flatPhysLow += item.flatPhysLow || 0
    flatPhysHigh += item.flatPhysHigh || 0
    flatColdLow += item.flatColdLow || 0
    flatColdHigh += item.flatColdHigh || 0
    flatFireLow += item.flatFireLow || 0
    flatFireHigh += item.flatFireHigh || 0
    flatLightningLow += item.flatLightningLow || 0
    flatLightningHigh += item.flatLightningHigh || 0
    flatChaosLow += item.flatChaosLow || 0
    flatChaosHigh += item.flatChaosHigh || 0
    incDamage += item.incDamage || 0
    incAttackSpeed += item.incAttackSpeed || 0
    incCastSpeed += item.incCastSpeed || 0
    addCritChance += item.addCritChance || 0
    addCritMulti += item.addCritMulti || 0
  }

  const avgPhys = (flatPhysLow + flatPhysHigh) / 2
  const avgCold = (flatColdLow + flatColdHigh) / 2
  const avgFire = (flatFireLow + flatFireHigh) / 2
  const avgLightning = (flatLightningLow + flatLightningHigh) / 2
  const avgChaos = (flatChaosLow + flatChaosHigh) / 2

  const cfg = build.configuration || {}
  const hero = build.heroTraits || {}
  const skills = build.skills || []

  // 基础属性基准值按 50 级定义，实际生效值随英雄等级线性缩放并向上取整
  const heroLevel = hero.level || 1
  const scaleHeroAttr = (v) => Math.ceil(((v || 0) * heroLevel) / 50)
  const heroStr = scaleHeroAttr(hero.baseStr)
  const heroDex = scaleHeroAttr(hero.baseDex)
  const heroInt = scaleHeroAttr(hero.baseInt)
  const heroLife = scaleHeroAttr(hero.bonusLife)
  const heroMana = scaleHeroAttr(hero.bonusMana)
  const heroES = scaleHeroAttr(hero.bonusES)

  const divPage = build.divinityPage
  if (divPage && divPage.placedSlates && divPage.inventory) {
    // 词缀文本经 collectDivinityAffixTexts 适配冥王石板特性（审判+70% 提升、侵染20%投影）
    for (const effect of collectDivinityAffixTexts(build)) {
      if (!effect) continue
      const dmgMatch = effect.match(
        /([+-]?\d+(?:\.\d+)?)\s*%\s*(?:additional\s+)?(damage|伤害|Attack Damage|Spell Damage|Physical Damage|Projectile Damage|Area Damage|Melee Damage|Minion Damage|Elemental Damage|Fire Damage|Cold Damage|Lightning Damage|Erosion Damage|攻击伤害|法术伤害|物理伤害|投射物伤害|范围伤害|近战伤害|召唤物伤害|元素伤害|火焰伤害|冰霜伤害|闪电伤害|腐蚀伤害)/i
      )
      if (dmgMatch) {
        incDamage += parseFloat(dmgMatch[1]) || 0
        continue
      }
      const speedMatch = effect.match(
        /([+-]?\d+(?:\.\d+)?)\s*%\s*(Attack Speed|Cast Speed|Movement Speed|攻击速度|施法速度|移动速度)/i
      )
      if (speedMatch) {
        const sv = parseFloat(speedMatch[1]) || 0
        if (/Attack|攻击/.test(speedMatch[2])) incAttackSpeed += sv
        else if (/Cast|施法/.test(speedMatch[2])) incCastSpeed += sv
        else {
          incAttackSpeed += sv
          incCastSpeed += sv
        }
        continue
      }
      const statMatch = effect.match(
        /([+-]?\d+(?:\.\d+)?)\s*%\s*(Strength|Dexterity|Intelligence|力量|敏捷|智慧|智力)/i
      )
      if (statMatch) {
        const sv = parseFloat(statMatch[1]) || 0
        const label = statMatch[2].toLowerCase()
        if (/strength|力量/.test(label)) str += Math.round((str * sv) / 100)
        else if (/dexterity|敏捷/.test(label)) dex += Math.round((dex * sv) / 100)
        else if (/intelligence|智慧|智力/.test(label)) int_ += Math.round((int_ * sv) / 100)
        continue
      }
      const critMatch = effect.match(
        /([+-]?\d+(?:\.\d+)?)\s*%\s*(Critical Strike Damage|暴击伤害|Crit Dmg)/i
      )
      if (critMatch) {
        addCritMulti += parseFloat(critMatch[1]) || 0
        continue
      }
      const critRateMatch = effect.match(
        /([+-]?\d+(?:\.\d+)?)\s*%\s*(Critical Strike Rating|暴击率|Crit Rating)/i
      )
      if (critRateMatch) {
        addCritChance += parseFloat(critRateMatch[1]) || 0
        continue
      }
      const skillMatch = effect.match(
        /\+(\d+)\s*(?:to\s+)?(Attack|Spell|Physical|Fire|Cold|Lightning|Erosion|Minion)\s*Skill\s*Level/i
      )
      if (skillMatch) {
        incDamage += parseInt(skillMatch[1]) * 10
        continue
      }
    }
  }

  str += heroStr
  dex += heroDex
  int_ += heroInt
  maxLife += heroLife
  maxMana += heroMana
  energyShield += heroES

  let skillFlatPhys = 0
  let skillFlatCold = 0
  let skillFlatFire = 0
  let skillFlatLightning = 0
  let skillFlatChaos = 0
  let skillEffectiveness = 1.0

  const activeSkills = skills.filter((s) => s.type === 'active' || s.type === 'trigger')
  if (activeSkills.length > 0) {
    let totalEff = 0
    for (const sk of activeSkills) {
      const eff = (sk.effectiveness || 100) / 100
      totalEff += eff
      skillFlatPhys += (sk.baseDamage || 0) * 0.4
      skillFlatCold += (sk.baseDamage || 0) * 0.15
      skillFlatFire += (sk.baseDamage || 0) * 0.15
      skillFlatLightning += (sk.baseDamage || 0) * 0.15
      skillFlatChaos += (sk.baseDamage || 0) * 0.15
    }
    skillEffectiveness = totalEff / activeSkills.length
  }

  const auraSkills = skills.filter((s) => s.type === 'aura')
  for (const au of auraSkills) {
    if (au.name && au.level) {
      incDamage += (au.level || 0) * 2
      incAttackSpeed += (au.level || 0) * 1
    }
  }

  let buffIncDamage = 0
  let buffMoreDamage = 1.0
  let buffFlatDmg = 0
  let buffSpeedInc = 0
  for (const bf of cfg.buffs || []) {
    if (!bf.active) continue
    const v = bf.value || 0
    if (bf.type === 'flat') buffFlatDmg += v
    if (bf.type === 'inc') buffIncDamage += v
    if (bf.type === 'more') buffMoreDamage *= 1 + v / 100
    if (bf.type === 'speed') buffSpeedInc += v
  }

  const skillPhys = avgPhys * skillEffectiveness + skillFlatPhys
  const skillCold = avgCold * skillEffectiveness + skillFlatCold
  const skillFire = avgFire * skillEffectiveness + skillFlatFire
  const skillLightning = avgLightning * skillEffectiveness + skillFlatLightning
  const skillChaos = avgChaos * skillEffectiveness + skillFlatChaos

  const totalInc = 1 + (incDamage + buffIncDamage) / 100

  const rawPhys = +((skillPhys + buffFlatDmg * 0.4) * totalInc).toFixed(0)
  const rawCold = +((skillCold + buffFlatDmg * 0.2) * totalInc).toFixed(0)
  const rawFire = +((skillFire + buffFlatDmg * 0.2) * totalInc).toFixed(0)
  const rawLightning = +((skillLightning + buffFlatDmg * 0.1) * totalInc).toFixed(0)
  const rawChaos = +((skillChaos + buffFlatDmg * 0.1) * totalInc).toFixed(0)

  const elePen = 1 - Math.max(0, (cfg.eleRes || 50) / 200)
  const physPen = 1 - Math.max(0, (cfg.physRes || 30) / 200)
  const chaosPen = 1 - Math.max(0, (cfg.chaosRes || 30) / 200)

  const adjPhys = +(rawPhys * physPen).toFixed(0)
  const adjCold = +(rawCold * elePen).toFixed(0)
  const adjFire = +(rawFire * elePen).toFixed(0)
  const adjLightning = +(rawLightning * elePen).toFixed(0)
  const adjChaos = +(rawChaos * chaosPen).toFixed(0)

  const baseAtkSpd = 1.5
  const baseCastSpd = 1.2
  const atkSpeed = +(baseAtkSpd * (1 + (incAttackSpeed + buffSpeedInc) / 100)).toFixed(2)
  const castSpeed = +(baseCastSpd * (1 + incCastSpeed / 100)).toFixed(2)
  const critChance = Math.min(100, 5 + addCritChance + (cfg.critChance || 0) - 100)
  const critMulti = 150 + addCritMulti + (cfg.critMulti || 0) - 100

  const totalFlat = adjPhys + adjCold + adjFire + adjLightning + adjChaos
  const critFactor = 1 + (critChance / 100) * (critMulti / 100 - 1)
  const dps = +(totalFlat * atkSpeed * critFactor * buffMoreDamage).toFixed(0)

  return {
    str,
    dex,
    int: int_,
    maxLife,
    maxMana,
    energyShield,
    armor,
    evasion,
    coldRes,
    lightningRes,
    fireRes,
    erosionRes,
    dps,
    avgPhys,
    avgCold,
    avgFire,
    avgLightning,
    avgChaos,
    rawPhys,
    rawCold,
    rawFire,
    rawLightning,
    rawChaos,
    adjPhys,
    adjCold,
    adjFire,
    adjLightning,
    adjChaos,
    totalFlat,
    atkSpeed,
    castSpeed,
    critChance,
    critMulti,
    incDamage: incDamage + buffIncDamage,
    addCritChance,
    addCritMulti,
  }
}

function computeSummary(build) {
  const eq = build.equipment
  const eqCount = Object.values(eq).filter((v) => !!v).length
  const talentPoints = build.talents.reduce((sum, t) => {
    const points = t.points || {}
    return sum + Object.values(points).reduce((s, v) => s + (v || 0), 0)
  }, 0)
  const skillCount = (build.skills || []).filter((s) => s && s.name).length
  const spiritCount = (build.pactSpirits || []).length
  const slateCount = build.divinityPage?.placedSlates?.length || 0
  return { eqCount, talentPoints, skillCount, spiritCount, slateCount }
}

class BuildStore {
  constructor() {
    this.build = createDefaultBuild()
    this.selectedSlot = null
    this.selectedEquipment = null
    this.saveStatus = ''
    makeAutoObservable(this)
  }

  get equipment() {
    return this.build.equipment
  }

  get computedStats() {
    return computeStats(this.build)
  }

  get blessingCaps() {
    return computeBlessingCaps(this.build)
  }

  // 纽带层数上限：基础 3 + 各模块「+N纽带层数上限」词缀（供 CombatStatePanel 滑块上限覆盖）
  get tetherCap() {
    return computeTetherCap(this.build)
  }

  // 暖风满层层数：守望的暖风特性满层（基础 10，供 CombatStatePanel 开关满层值覆盖）
  get warmBreezeCap() {
    return computeWarmBreezeCap()
  }

  get engineStats() {
    const cfg = this.build.configuration || {}
    const ctx = {
      build: this.build,
      states: applyWarmBreezeCap(
        applyTetherCap(
          applyBlessingCaps(this.build.configuration, computeBlessingCaps(this.build)),
          computeTetherCap(this.build)
        ),
        this.warmBreezeCap
      ),
      affixTexts: [
        ...collectDivinityAffixTexts(this.build),
        ...collectTalentAffixTexts(this.build),
        ...collectEquipmentAffixTexts(this.build),
        ...collectMemoryAffixTexts(this.build),
        ...collectPactAffixTexts(this.build),
        ...collectSkillAffixTexts(this.build),
        ...collectHeroTraitAffixTexts(this.build),
      ],
      config: {
        enemyLevel: cfg.enemyLevel,
        enemyType: cfg.enemyType,
        physRes: cfg.physRes,
        eleRes: cfg.eleRes,
        chaosRes: cfg.chaosRes,
        critChance: cfg.critChance,
        critMulti: cfg.critMulti,
        buffs: cfg.buffs,
      },
    }
    return {
      ...computeDefense(ctx),
      ...computeDamage(ctx),
    }
  }

  get divinityAffixStats() {
    return aggregateDivinityAffixes(this.build)
  }

  get talentAffixStats() {
    return aggregateTalentAffixes(this.build)
  }

  get equipmentAffixStats() {
    return aggregateEquipmentAffixes(this.build)
  }

  get memoryAffixStats() {
    return aggregateMemoryAffixes(this.build)
  }

  get pactAffixStats() {
    return aggregatePactAffixes(this.build)
  }

  get skillAffixStats() {
    return aggregateSkillAffixes(this.build)
  }

  get heroTraitAffixStats() {
    return aggregateHeroTraitAffixes(this.build)
  }

  // 魔灵技能相关词缀聚合（暴击/穿透/魔灵之源/数量上限等），供技能计算 tab 展示
  get minionAffixStats() {
    return aggregateMinionAffixStats(this.build)
  }

  // 全部「技能等级±N」词缀（含负值），供技能页按技能标签计算等级加成
  get skillLevelAffixes() {
    return collectSkillLevelAffixes(this.build)
  }

  // 角色杂项统计（移动速度加成/技能效果持续时间/魔力封印补偿/全域召唤数量上限），供基础属性 tab 展示
  get characterStats() {
    return aggregateCharacterStats(this.build)
  }

  // 生存板块统计（护甲/闪避总值与加成、抗性、返还、魔力回复、护盾充能），供基础属性 tab 展示
  get survivalStats() {
    return aggregateSurvivalStats(this.build)
  }

  // 未被计算引擎消费的词缀，按来源（神格石板/天赋/装备/追忆/契灵/技能）分组。
  // 供"未计入词缀"面板展示：识别标注 > 静默忽略。
  get unconsumedAffixGroups() {
    const sources = {
      divinity: collectDivinityAffixTexts(this.build),
      talent: collectTalentAffixTexts(this.build),
      equipment: collectEquipmentAffixTexts(this.build),
      memory: collectMemoryAffixTexts(this.build),
      pact: collectPactAffixTexts(this.build),
      skill: collectSkillAffixTexts(this.build),
      hero: collectHeroTraitAffixTexts(this.build),
    }
    // 战斗状态用于条件词缀门控（与计算端一致），保证「统计已计入 ⇔ 计算真实计入」。
    const states = applyWarmBreezeCap(
      applyTetherCap(
        this.build && this.build.configuration,
        computeTetherCap(this.build)
      ),
      this.warmBreezeCap
    )
    const groups = []
    for (const [source, texts] of Object.entries(sources)) {
      if (!Array.isArray(texts) || texts.length === 0) continue
      const items = unconsumedAffixes(texts, states)
      if (items.length === 0) continue
      groups.push({ source, items })
    }
    return groups
  }

  get summary() {
    return computeSummary(this.build)
  }

  exportData() {
    return JSON.parse(JSON.stringify(this.build))
  }

  loadFromData(data) {
    if (!data) return
    const merged = { ...createDefaultBuild(), ...data }
    // 配置归一化：保留非状态字段（enemyLevel/buffs/抗性等），状态 key 走 normalizeStates 补默认 + clamp
    merged.configuration = {
      ...createDefaultBuild().configuration,
      ...(data.configuration || {}),
      ...normalizeStates(data.configuration),
    }
    if (!merged.prisms || !Array.isArray(merged.prisms.inventory)) {
      merged.prisms = { inventory: [] }
    }
    if (!merged.divinityPage) {
      merged.divinityPage = { inventory: [], placedSlates: [] }
    }
    if (!Array.isArray(merged.divinityPage.inventory)) {
      merged.divinityPage.inventory = []
    }
    if (!Array.isArray(merged.divinityPage.placedSlates)) {
      merged.divinityPage.placedSlates = []
    }
    // 旧存档兼容：普通/传奇石板的 nodeType 曾存英文（Micro/Medium 等），统一归一化为中文
    merged.divinityPage.inventory = merged.divinityPage.inventory.map((sl) => {
      if (!sl || typeof sl !== 'object' || !Array.isArray(sl.affixes)) return sl
      const affixes = sl.affixes.map((a) =>
        a && typeof a === 'object' && a.nodeType
          ? { ...a, nodeType: normalizeTalentType(a.nodeType) }
          : a
      )
      return { ...sl, affixes }
    })
    if (Array.isArray(merged.talents)) {
      const legacyInventory = []
      merged.talents = merged.talents.map((t, i) => {
        let points = {}
        let corePoints = {}
        if (Array.isArray(t.nodes)) {
          points = {}
        } else if (t.points && typeof t.points === 'object') {
          for (const [key, val] of Object.entries(t.points)) {
            if (key.startsWith('核心天赋_')) {
              corePoints[key.slice('核心天赋_'.length)] = val
            } else {
              points[key] = val
            }
          }
        }
        const normPrisms = normalizePrisms(t.prisms)
        if (Array.isArray(t.prisms?.inventory)) {
          legacyInventory.push(...t.prisms.inventory)
        }
        return {
          slot: i + 1,
          god: t.god || '',
          branch: t.branch || '',
          points,
          corePoints,
          prisms: normPrisms,
        }
      })
      if (legacyInventory.length > 0) {
        merged.prisms.inventory = [
          ...merged.prisms.inventory,
          ...legacyInventory,
        ]
      }
    } else {
      merged.talents = createDefaultBuild().talents
    }
    if (Array.isArray(merged.pactSpirits)) {
      merged.pactSpirits = merged.pactSpirits
        .map((sp) => normalizePactSpirit(sp))
        .filter(Boolean)
    } else {
      merged.pactSpirits = []
    }
    if (Array.isArray(merged.skills)) {
      merged.skills = normalizeSkills(merged.skills)
    } else {
      merged.skills = createDefaultSkills()
    }
    if (!merged.heroTraits || typeof merged.heroTraits !== 'object') {
      merged.heroTraits = createDefaultBuild().heroTraits
    }
    if (!Array.isArray(merged.heroTraits.traits)) {
      merged.heroTraits.traits = []
    }
    if (Array.isArray(merged.heroTraits.memorySlots)) {
      const oldSpecialSlots = merged.heroTraits.memorySlots.filter(
        (s) => s && s.tier === 'special'
      )
      merged.heroTraits.memorySlots = [
        ...DEFAULT_MEMORY_SLOTS.map((def) => {
          const old = merged.heroTraits.memorySlots.find(
            (s) => s && s.tier === def.tier
          )
          if (!old) return { ...def }
          return {
            tier: def.tier,
            // 旧存档用 kind 存追忆名，无 memoryId 时丢弃旧追忆装备
            memoryId:
              old.memoryId && typeof old.memoryId === 'string' ? old.memoryId : '',
            randomAffixes: Array.isArray(old.randomAffixes)
              ? old.randomAffixes
              : [],
          }
        }),
        ...oldSpecialSlots.map((s) => ({
          tier: 'special',
          sourceMemoryId:
            typeof s.sourceMemoryId === 'string' ? s.sourceMemoryId : '',
          memoryId: typeof s.memoryId === 'string' ? s.memoryId : '',
          randomAffixes: [],
        })),
      ]
    } else {
      merged.heroTraits.memorySlots = DEFAULT_MEMORY_SLOTS.map((s) => ({ ...s }))
    }
    if (Array.isArray(merged.memoryInventory)) {
      merged.memoryInventory = merged.memoryInventory
        .map((it) => {
          if (typeof it === 'string') {
            // 旧存档 memoryInventory 为追忆名数组，转为空条目（id 重新生成）
            return {
              id: uuidv4(),
              kind: it,
              rarity: '',
              baseAttr: '',
              enhanceLevel: 10,
              reviveAffix: '',
              inherentAffixes: [],
              randomAffixes: [],
            }
          }
          if (!it || typeof it !== 'object') return null
          const normAffix = (a) => {
            if (!a) return null
            if (typeof a === 'string') return { text: a, value: [] }
            if (typeof a === 'object' && typeof a.text === 'string' && a.text) {
              return { text: a.text, value: Array.isArray(a.value) ? a.value : [] }
            }
            return null
          }
          const inherent = (
            Array.isArray(it.inherentAffixes)
              ? it.inherentAffixes
              : typeof it.inherentAffix === 'string' && it.inherentAffix
                ? [it.inherentAffix]
                : []
          )
            .map(normAffix)
            .filter(Boolean)
          const random = (Array.isArray(it.randomAffixes) ? it.randomAffixes : [])
            .map(normAffix)
            .filter(Boolean)
          return {
            id: it.id || uuidv4(),
            kind: typeof it.kind === 'string' ? it.kind : '',
            rarity: typeof it.rarity === 'string' ? it.rarity : '',
            baseAttr: typeof it.baseAttr === 'string' ? it.baseAttr : '',
            enhanceLevel:
              typeof it.enhanceLevel === 'number' ? it.enhanceLevel : 10,
            reviveAffix:
              typeof it.reviveAffix === 'string' && it.reviveAffix
                ? { text: it.reviveAffix, value: [] }
                : typeof it.reviveAffix === 'object' && it.reviveAffix
                  ? { text: it.reviveAffix.text || '', value: it.reviveAffix.value || [] }
                  : '',
            inherentAffixes: inherent,
            randomAffixes: random,
          }
        })
        .filter(Boolean)
    } else {
      merged.memoryInventory = []
    }
    // ===== 装备模块：equipmentInventory 初始化 + 旧存档兼容 =====
    if (!Array.isArray(merged.equipmentInventory)) {
      merged.equipmentInventory = []
    }
    const normEqAffix = (a) => {
      if (!a) return null
      if (typeof a === 'string') return { text: a, value: [], corrupted: false }
      if (typeof a === 'object' && typeof a.text === 'string' && a.text) {
        return {
          text: a.text,
          value: Array.isArray(a.value) ? a.value : [],
          corrupted: !!a.corrupted,
          ...(a.graftSource ? { graftSource: a.graftSource } : {}),
          ...(a.graftItem ? { graftItem: a.graftItem } : {}),
          ...(a.graftTier !== undefined ? { graftTier: a.graftTier } : {}),
          ...(a.graftKind ? { graftKind: a.graftKind } : {}),
        }
      }
      return null
    }
    const normEquipmentItem = (it, fallbackSlot) => {
      if (!it || typeof it !== 'object') return null
      return {
        id: typeof it.id === 'string' && it.id ? it.id : uuidv4(),
        slot: typeof it.slot === 'string' ? it.slot : fallbackSlot || '',
        category: typeof it.category === 'string' ? it.category : '',
        subCategory: typeof it.subCategory === 'string' ? it.subCategory : '',
        name:
          typeof it.name === 'string' && it.name
            ? it.name
            : typeof it.物品名称 === 'string'
              ? it.物品名称
              : '',
        requiredLevel:
          typeof it.requiredLevel === 'string'
            ? it.requiredLevel
            : typeof it.需求等级 === 'string'
              ? it.需求等级
              : '',
        baseAffix:
          typeof it.baseAffix === 'string'
            ? it.baseAffix
            : typeof it.基底词缀 === 'string'
              ? it.基底词缀
              : '',
        affixes: (Array.isArray(it.affixes)
          ? it.affixes
          : Array.isArray(it.词条)
            ? it.词条
            : []
        )
          .map(normEqAffix)
          .filter(Boolean),
        corrupted: !!it.corrupted,
        isGraft: !!it.isGraft,
        graft:
          it.isGraft && it.graft && typeof it.graft === 'object'
            ? {
                part: typeof it.graft.part === 'string' ? it.graft.part : '',
                legendItem: typeof it.graft.legendItem === 'string' ? it.graft.legendItem : '',
              }
            : undefined,
        imgPath:
          typeof it.imgPath === 'string'
            ? it.imgPath
            : typeof it.图片地址 === 'string'
              ? it.图片地址
              : '',
      }
    }
    const eqInventory = merged.equipmentInventory
      .map((it) => normEquipmentItem(it, ''))
      .filter(Boolean)
    const eqIdSet = new Set(eqInventory.map((it) => it.id))
    const normEquipment = { ...createDefaultBuild().equipment }
    for (const [slotKey, val] of Object.entries(merged.equipment || {})) {
      if (!val) {
        normEquipment[slotKey] = ''
        continue
      }
      if (typeof val === 'string') {
        normEquipment[slotKey] = eqIdSet.has(val) ? val : ''
        continue
      }
      const item = normEquipmentItem(val, slotKey)
      if (item) {
        eqInventory.push(item)
        eqIdSet.add(item.id)
        normEquipment[slotKey] = item.id
      }
    }
    merged.equipment = normEquipment
    merged.equipmentInventory = eqInventory
    this.build = merged
  }

  reset() {
    this.build = createDefaultBuild()
    this.selectedSlot = null
    this.selectedEquipment = null
  }

  setName(name) {
    this.build = { ...this.build, name }
  }

  setEquipment(slot, item) {
    this.build = {
      ...this.build,
      equipment: { ...this.build.equipment, [slot]: item },
    }
  }

  clearEquipment(slot) {
    this.build = {
      ...this.build,
      equipment: { ...this.build.equipment, [slot]: '' },
    }
  }

  // ===== 装备模块 =====

  // 写入 build.equipment[slot]（equipmentInventory 条目 id，'' 表示卸下）
  setEquipmentSlot(slot, itemId) {
    this.build = {
      ...this.build,
      equipment: { ...this.build.equipment, [slot]: itemId || '' },
    }
  }

  addEquipmentItem(item) {
    const equipmentInventory = Array.isArray(this.build.equipmentInventory)
      ? this.build.equipmentInventory
      : []
    const entry = { ...item, id: item.id || uuidv4() }
    this.build = {
      ...this.build,
      equipmentInventory: [...equipmentInventory, entry],
    }
    return entry.id
  }

  updateEquipmentItem(id, item) {
    const equipmentInventory = Array.isArray(this.build.equipmentInventory)
      ? this.build.equipmentInventory.map((it) =>
          it.id === id ? { ...it, ...item, id } : it
        )
      : []
    this.build = { ...this.build, equipmentInventory }
  }

  removeEquipmentItem(id) {
    const equipmentInventory = Array.isArray(this.build.equipmentInventory)
      ? this.build.equipmentInventory.filter((it) => it.id !== id)
      : []
    const equipment = { ...this.build.equipment }
    for (const slotKey of Object.keys(equipment)) {
      if (equipment[slotKey] === id) equipment[slotKey] = ''
    }
    this.build = { ...this.build, equipmentInventory, equipment }
  }

  setEquipmentInventory(equipmentInventory) {
    this.build = { ...this.build, equipmentInventory }
  }

  // 全部卸下：清空所有槽位引用，库存条目保留
  unequipAllEquipment() {
    const equipment = { ...this.build.equipment }
    for (const slotKey of Object.keys(equipment)) equipment[slotKey] = ''
    this.build = { ...this.build, equipment }
  }

  resetEquipmentInventory() {
    const equipment = { ...this.build.equipment }
    for (const slotKey of Object.keys(equipment)) equipment[slotKey] = ''
    this.build = { ...this.build, equipmentInventory: [], equipment }
  }

  selectSlot(slot) {
    this.selectedSlot = slot
    this.selectedEquipment = this.build.equipment[slot] ?? null
  }

  setDivinityInventory(inventory) {
    this.build = {
      ...this.build,
      divinityPage: { ...this.build.divinityPage, inventory },
    }
  }

  addDivinitySlate(slate) {
    const inventory = this.build.divinityPage?.inventory || []
    this.setDivinityInventory([...inventory, slate])
  }

  setDivinityPlaced(placedSlates) {
    this.build = {
      ...this.build,
      divinityPage: { ...this.build.divinityPage, placedSlates },
    }
  }

  updateDivinitySlate(slateId, updates) {
    const inventory = (this.build.divinityPage.inventory || []).map((s) =>
      s.id === slateId ? { ...s, ...updates } : s
    )
    this.build = {
      ...this.build,
      divinityPage: { ...this.build.divinityPage, inventory },
    }
  }

  setTalentPoints(slotIndex, nodeId, points) {
    const talents = this.build.talents.map((t, i) => {
      if (i !== slotIndex) return t
      const nextPoints = { ...(t.points || {}) }
      if (points > 0) nextPoints[nodeId] = points
      else delete nextPoints[nodeId]
      return { ...t, points: nextPoints }
    })
    this.build = { ...this.build, talents }
  }

  setTalentCore(slotIndex, coreName, points) {
    const talents = this.build.talents.map((t, i) => {
      if (i !== slotIndex) return t
      const nextCore = { ...(t.corePoints || {}) }
      if (points > 0) nextCore[coreName] = points
      else delete nextCore[coreName]
      return { ...t, corePoints: nextCore }
    })
    this.build = { ...this.build, talents }
  }

  addPrismInventory(item) {
    const inventory = Array.isArray(this.build.prisms?.inventory)
      ? this.build.prisms.inventory
      : []
    this.build = {
      ...this.build,
      prisms: { ...this.build.prisms, inventory: [...inventory, item] },
    }
  }

  addReverseInventory(item) {
    const inventory = Array.isArray(this.build.prisms?.inventory)
      ? this.build.prisms.inventory
      : []
    this.build = {
      ...this.build,
      prisms: { ...this.build.prisms, inventory: [...inventory, item] },
    }
  }

  placeTalentPrism(slotIndex, nodeId, itemId) {
    const t = this.build.talents[slotIndex]
    if (!t) return false
    const inventory = Array.isArray(this.build.prisms?.inventory)
      ? this.build.prisms.inventory
      : []
    const item = inventory.find((it) => it.id === itemId)
    const prisms = normalizePrisms(t.prisms)
    const togglingOff = prisms.placed[nodeId] === itemId
    if (!togglingOff) {
      if (slotIndex === 0) return false
      if (item?.type === 'reverse') {
        const hasPoints =
          Object.keys(t.points || {}).length > 0 ||
          Object.keys(t.corePoints || {}).length > 0
        if (hasPoints) return false
      }
      const itemType = item?.type || 'prism'
      const sameTypePlaced = this.build.talents.some((x, i) => {
        const placed = normalizePrisms(x.prisms).placed
        for (const [nid, id] of Object.entries(placed)) {
          if (i === slotIndex && nid === nodeId) continue
          const it = inventory.find((a) => a.id === id)
          if (it?.type === itemType) return true
        }
        return false
      })
      const currentPageOccupied = Object.keys(prisms.placed).some(
        (nid) => nid !== nodeId
      )
      if (sameTypePlaced || currentPageOccupied) return false
    }
    const nextPlaced = { ...prisms.placed }
    if (togglingOff) {
      delete nextPlaced[nodeId]
    } else {
      nextPlaced[nodeId] = itemId
    }
    let nextPoints = t.points || {}
    if (item?.type === 'prism' && !togglingOff) {
      nextPoints = { ...nextPoints }
      delete nextPoints[nodeId]
    }
    const resetPage = togglingOff && item?.type === 'reverse'
    const talents = this.build.talents.map((x, i) => {
      if (i !== slotIndex) return x
      if (resetPage) {
        return { ...x, points: {}, corePoints: {}, prisms: { placed: {} } }
      }
      const next = { ...x, prisms: { placed: nextPlaced } }
      if (nextPoints !== (t.points || {})) next.points = nextPoints
      return next
    })
    this.build = { ...this.build, talents }
    return true
  }

  removePrismInventory(itemId) {
    const inventory = Array.isArray(this.build.prisms?.inventory)
      ? this.build.prisms.inventory.filter((it) => it.id !== itemId)
      : []
    const talents = this.build.talents.map((t) => {
      const prisms = normalizePrisms(t.prisms)
      const nextPlaced = { ...prisms.placed }
      for (const key of Object.keys(nextPlaced)) {
        if (nextPlaced[key] === itemId) delete nextPlaced[key]
      }
      return { ...t, prisms: { placed: nextPlaced } }
    })
    this.build = { ...this.build, prisms: { ...this.build.prisms, inventory }, talents }
  }

  clearPrismInventory(type) {
    const inventory = Array.isArray(this.build.prisms?.inventory)
      ? this.build.prisms.inventory
      : []
    const removedIds = new Set(
      inventory.filter((it) => it.type === type).map((it) => it.id)
    )
    const nextInventory = inventory.filter((it) => it.type !== type)
    const talents = this.build.talents.map((t) => {
      const prisms = normalizePrisms(t.prisms)
      const nextPlaced = { ...prisms.placed }
      for (const key of Object.keys(nextPlaced)) {
        if (removedIds.has(nextPlaced[key])) delete nextPlaced[key]
      }
      return { ...t, prisms: { placed: nextPlaced } }
    })
    this.build = {
      ...this.build,
      prisms: { ...this.build.prisms, inventory: nextInventory },
      talents,
    }
  }

  getPrismEquipped(itemId) {
    return this.build.talents.some((t) =>
      Object.values(normalizePrisms(t.prisms).placed).includes(itemId)
    )
  }

  talentSpent(slotIndex) {
    const t = this.build.talents[slotIndex]
    if (!t) return 0
    return Object.values(t.points || {}).reduce((s, v) => s + (v || 0), 0)
  }

  setTalentGod(slotIndex, god) {
    const current = this.build.talents[slotIndex]
    if (!current) return false
    let nextBranch
    if (slotIndex === 0) {
      nextBranch = god
    } else {
      const playBranches = getPlayBranchesOf(god)
      const keep = playBranches.includes(current.branch) && current.god === god
      nextBranch = keep ? current.branch : ''
    }
    if (current.god === god && current.branch === nextBranch) return true
    if (this.talentSpent(slotIndex) > 0) return false
    if (slotIndex === 0 && this.talentSpent(1) > 0) return false
    const talents = this.build.talents.map((t, i) => {
      if (i !== slotIndex) return t
      return { ...t, god, branch: nextBranch }
    })
    if (slotIndex === 0) {
      const t2 = talents[1]
      if (t2) {
        const t2Play = getPlayBranchesOf(god)
        const keep2 = t2Play.includes(t2.branch)
        talents[1] = { ...t2, god, branch: keep2 ? t2.branch : '' }
      }
    }
    this.build = { ...this.build, talents }
    return true
  }

  setTalentBranch(slotIndex, branch) {
    const current = this.build.talents[slotIndex]
    if (!current) return false
    if (current.branch === branch) return true
    if (this.talentSpent(slotIndex) > 0) return false
    const talents = this.build.talents.map((t, i) =>
      i === slotIndex ? { ...t, branch } : t
    )
    this.build = { ...this.build, talents }
    return true
  }

  resetSlotTalents(slotIndex) {
    const talents = this.build.talents.map((t, i) =>
      i === slotIndex
        ? { ...t, points: {}, corePoints: {}, prisms: { placed: {} } }
        : t
    )
    this.build = { ...this.build, talents }
  }

  resetAllTalents() {
    const talents = this.build.talents.map((t) => ({
      ...t,
      points: {},
      corePoints: {},
      prisms: { placed: {} },
    }))
    this.build = { ...this.build, talents }
  }

  // ===== 技能模块（5 主动栏 + 4 被动栏，固定槽位） =====

  setSkills(skills) {
    this.build = { ...this.build, skills }
  }

  // 整体替换技能配置（预设应用用）
  applySkillsPreset(data) {
    if (!data || !Array.isArray(data.skills)) return false
    this.setSkills(normalizeSkills(data.skills))
    return true
  }

  // 设置某技能栏技能（主技能），effectiveness 由调用方按等级计算传入
  setSkillSlot(group, index, patch) {
    const skills = this.build.skills.map((s) =>
      s.group === group && s.index === index ? { ...s, ...patch } : s
    )
    this.setSkills(skills)
  }

  // 设置某技能栏的模组化词缀（最多 MODULAR_MAX_AFFIXES 条，不可重复）
  setSkillAffixes(group, index, affixes) {
    const skills = this.build.skills.map((s) =>
      s.group === group && s.index === index
        ? { ...s, affixes: Array.isArray(affixes) ? affixes.filter((a) => typeof a === 'string') : [] }
        : s
    )
    this.setSkills(skills)
  }

  // 清空某技能栏技能（含辅助槽）
  clearSkillSlot(group, index) {
    const empty = createEmptySkillSlot(group, index)
    const skills = this.build.skills.map((s) =>
      s.group === group && s.index === index ? empty : s
    )
    this.setSkills(skills)
  }

  // 清空所有技能栏
  clearAllSkills() {
    this.setSkills(createDefaultSkills())
  }

  // 设置某技能栏第 socketIdx 个辅助技能槽
  setSkillSupport(group, index, socketIdx, support) {
    const skills = this.build.skills.map((s) => {
      if (s.group !== group || s.index !== index) return s
      const supports = s.supports.map((x, i) =>
        i === socketIdx ? { ...support, id: support.id || uuidv4() } : x
      )
      return { ...s, supports }
    })
    this.setSkills(skills)
  }

  // 卸下某技能栏第 socketIdx 个辅助技能槽
  removeSkillSupport(group, index, socketIdx) {
    const skills = this.build.skills.map((s) => {
      if (s.group !== group || s.index !== index) return s
      const supports = s.supports.map((x, i) => (i === socketIdx ? null : x))
      return { ...s, supports }
    })
    this.setSkills(skills)
  }

  // ===== 英雄模块 =====

  setHeroTraits(heroTraits) {
    this.build = { ...this.build, heroTraits }
  }

  updateHeroTrait(patch) {
    this.setHeroTraits({ ...this.build.heroTraits, ...patch })
  }

  setHero(name) {
    this.updateHeroTrait({
      name,
      traits: [],
      memorySlots: DEFAULT_MEMORY_SLOTS.map((s) => ({ ...s })),
    })
  }

  addHeroTrait(trait) {
    const traits = [...(this.build.heroTraits.traits || [])]
    const idx = traits.findIndex((t) => t.name === trait.name)
    if (idx !== -1) {
      traits[idx] = { ...traits[idx], ...trait }
    } else {
      traits.push({ ...trait })
    }
    this.updateHeroTrait({ traits })
  }

  updateHeroTraitLevel(traitName, level) {
    const traits = [...(this.build.heroTraits.traits || [])]
    const idx = traits.findIndex((t) => t.name === traitName)
    if (level <= 0) {
      if (idx !== -1) traits.splice(idx, 1)
    } else if (idx !== -1) {
      traits[idx] = { ...traits[idx], level }
    } else {
      traits.push({ name: traitName, level })
    }
    this.updateHeroTrait({ traits })
  }

  setMemorySlot(tier, memoryId) {
    const slots = this.build.heroTraits.memorySlots || []
    const old = slots.find((s) => s.tier === tier)
    const removedSource = old && old.memoryId && old.memoryId !== memoryId ? old.memoryId : ''
    const memorySlots = slots
      .map((s) => (s.tier === tier ? { ...s, memoryId, randomAffixes: [] } : s))
      .filter(
        (s) => !(removedSource && s.tier === 'special' && s.sourceMemoryId === removedSource)
      )
    this.updateHeroTrait({ memorySlots })
  }

  // 特殊追忆槽：复苏词缀"基础特性新增基础特性槽位"在 1 级特性下产生的追忆槽
  setSpecialMemorySlot(sourceMemoryId, memoryId) {
    const slots = (this.build.heroTraits.memorySlots || []).filter(
      (s) => !(s.tier === 'special' && s.sourceMemoryId === sourceMemoryId)
    )
    if (memoryId) {
      slots.push({ tier: 'special', sourceMemoryId, memoryId, randomAffixes: [] })
    }
    this.updateHeroTrait({ memorySlots: slots })
  }

  addMemoryRandomAffix(tier, affix) {
    const memorySlots = (this.build.heroTraits.memorySlots || []).map((s) =>
      s.tier === tier ? { ...s, randomAffixes: [...s.randomAffixes, affix] } : s
    )
    this.updateHeroTrait({ memorySlots })
  }

  removeMemoryRandomAffix(tier, modifier) {
    const memorySlots = (this.build.heroTraits.memorySlots || []).map((s) =>
      s.tier === tier
        ? { ...s, randomAffixes: s.randomAffixes.filter((a) => a.modifier !== modifier) }
        : s
    )
    this.updateHeroTrait({ memorySlots })
  }

  resetHeroMemory() {
    const memorySlots = (this.build.heroTraits.memorySlots || [])
      .map((s) => ({
        ...s,
        memoryId: '',
        randomAffixes: [],
      }))
      .filter((s) => s.tier !== 'special')
    this.updateHeroTrait({ memorySlots })
  }

  addMemoryItem(item) {
    const memoryInventory = Array.isArray(this.build.memoryInventory)
      ? this.build.memoryInventory
      : []
    this.build = {
      ...this.build,
      memoryInventory: [
        ...memoryInventory,
        { ...item, id: item.id || uuidv4() },
      ],
    }
  }

  updateMemoryItem(id, item) {
    const memoryInventory = Array.isArray(this.build.memoryInventory)
      ? this.build.memoryInventory.map((it) =>
          it.id === id ? { ...it, ...item, id } : it
        )
      : []
    this.build = { ...this.build, memoryInventory }
  }

  removeMemoryItem(id) {
    const memoryInventory = Array.isArray(this.build.memoryInventory)
      ? this.build.memoryInventory.filter((it) => it.id !== id)
      : []
    const memorySlots = (this.build.heroTraits.memorySlots || [])
      .map((s) => (s.memoryId === id ? { ...s, memoryId: '', randomAffixes: [] } : s))
      .filter((s) => !(s.tier === 'special' && s.sourceMemoryId === id))
    this.build = { ...this.build, memoryInventory }
    this.updateHeroTrait({ memorySlots })
  }

  setMemoryInventory(memoryInventory) {
    this.build = { ...this.build, memoryInventory }
  }

  resetMemoryInventory() {
    const memorySlots = (this.build.heroTraits.memorySlots || [])
      .map((s) => ({
        ...s,
        memoryId: '',
        randomAffixes: [],
      }))
      .filter((s) => s.tier !== 'special')
    this.build = { ...this.build, memoryInventory: [] }
    this.updateHeroTrait({ memorySlots })
  }

  // ===== 契约灵模块 =====

  setPactSpirits(pactSpirits) {
    this.build = { ...this.build, pactSpirits }
  }

  addPactSpirit(spirit) {
    this.setPactSpirits([...this.build.pactSpirits, spirit])
  }

  updatePactSpirit(spiritId, patch) {
    const pactSpirits = this.build.pactSpirits.map((s) =>
      s.spiritId === spiritId ? { ...s, ...patch } : s
    )
    this.setPactSpirits(pactSpirits)
  }

  removePactSpirit(spiritId) {
    this.setPactSpirits(
      this.build.pactSpirits.filter((s) => s.spiritId !== spiritId)
    )
  }

  // 应用契灵预设：整体替换 pactSpirits（契灵数据本身引用 契灵词缀.json，无需库存合并）
  applyPactSpiritPreset(data) {
    if (!data || !Array.isArray(data.pactSpirits)) return false
    this.setPactSpirits(data.pactSpirits.map(normalizePactSpirit).filter(Boolean))
    return true
  }

  // 契灵等级：1~6（升阶词缀共 6 档）
  setPactSpiritLevel(spiritId, level) {
    this.updatePactSpirit(spiritId, {
      level: Math.max(1, Math.min(6, level || 1)),
    })
  }

  // 命运槽位：destiny 存 命运词缀.json 中的词缀名（'' = 未定宿命）
  // 兼容旧存档，新逻辑请用 addPactSpiritAddition
  setPactSpiritDestiny(spiritId, destiny) {
    this.updatePactSpirit(spiritId, { destiny: destiny || '' })
  }

  // 替换契约链节点：replacements[nodeIndex] 存 {name:命运词缀名, value:数值}（'' 或 null = 还原默认）
  setPactSpiritReplacement(spiritId, nodeIndex, affixName, value) {
    const spirit = this.build.pactSpirits.find((s) => s.spiritId === spiritId)
    if (!spirit) return
    const replacements = { ...(spirit.replacements || {}) }
    if (affixName) {
      replacements[nodeIndex] = {
        name: affixName,
        value: typeof value === 'number' && Number.isFinite(value) ? value : null,
      }
    } else {
      delete replacements[nodeIndex]
    }
    this.updatePactSpirit(spiritId, { replacements })
  }

  // 未定宿命添加天赋：additions 存 [{type:'small'|'medium', name:命运词缀名, value:数值}]
  addPactSpiritAddition(spiritId, type, name, value) {
    const spirit = this.build.pactSpirits.find((s) => s.spiritId === spiritId)
    if (!spirit) return
    const additions = [
      ...(spirit.additions || []),
      {
        type,
        name,
        value: typeof value === 'number' && Number.isFinite(value) ? value : null,
      },
    ]
    this.updatePactSpirit(spiritId, { additions })
  }

  removePactSpiritAddition(spiritId, index) {
    const spirit = this.build.pactSpirits.find((s) => s.spiritId === spiritId)
    if (!spirit) return
    const additions = (spirit.additions || []).filter((_, i) => i !== index)
    this.updatePactSpirit(spiritId, { additions })
  }

  // ===== 模块预设应用 =====

  // 应用天赋预设：整体替换 talents，并将预设引用的棱镜/逆像按 id 合并进当前库存
  applyTalentsPreset(data) {
    if (!data || !Array.isArray(data.talents)) return false
    const presetTalents = data.talents.map((t, i) => ({
      slot: i + 1,
      god: t.god || '',
      branch: t.branch || '',
      points: t.points && typeof t.points === 'object' ? t.points : {},
      corePoints: t.corePoints && typeof t.corePoints === 'object' ? t.corePoints : {},
      prisms: normalizePrisms(t.prisms),
    }))
    const merged = this.mergeInventoryById(
      this.build.prisms?.inventory || [],
      Array.isArray(data.prismsInventory) ? data.prismsInventory : []
    )
    this.build = {
      ...this.build,
      talents: presetTalents,
      prisms: { ...this.build.prisms, inventory: merged },
    }
    return true
  }

  // 应用英雄（追忆）预设：整体替换 heroTraits，并将预设引用的追忆按 id 合并进当前库存
  applyHeroPreset(data) {
    if (!data || !data.heroTraits) return false
    const merged = this.mergeInventoryById(
      this.build.memoryInventory || [],
      Array.isArray(data.memoryInventory) ? data.memoryInventory : []
    )
    this.build = {
      ...this.build,
      heroTraits: data.heroTraits,
      memoryInventory: merged,
    }
    return true
  }

  // 应用装备预设：整体替换装备槽位引用，并将预设引用的装备条目按 id 合并进当前库存
  applyEquipmentPreset(data) {
    if (!data || !data.equipment || typeof data.equipment !== 'object') return false
    const merged = this.mergeInventoryById(
      this.build.equipmentInventory || [],
      Array.isArray(data.equipmentInventory) ? data.equipmentInventory : []
    )
    this.build = {
      ...this.build,
      equipment: { ...this.build.equipment, ...data.equipment },
      equipmentInventory: merged,
    }
    return true
  }

  // 把预设库存中当前不存在（按 id）的物品合并进来，保证引用完整性
  mergeInventoryById(current, preset) {
    const ids = new Set(current.map((it) => it.id))
    const extra = preset.filter((it) => it && !ids.has(it.id))
    return [...current, ...extra]
  }

  // ===== 配置模块（空缺，待填充） =====

  setConfiguration(configuration) {
    this.build = { ...this.build, configuration }
  }

  updateConfiguration(patch) {
    this.setConfiguration({ ...this.build.configuration, ...patch })
  }
}

export const buildStore = new BuildStore()

reaction(
  () => buildStore.build,
  () => {
    if (!saveStore.currentSaveId) return
    buildStore.saveStatus = 'saving'
    setTimeout(() => {
      saveStore.persist(buildStore.exportData())
      buildStore.saveStatus = 'saved'
      setTimeout(() => {
        buildStore.saveStatus = ''
      }, 2000)
    }, 50)
  },
  { delay: 500 }
)
