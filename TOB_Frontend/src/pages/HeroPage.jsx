import { useState, useMemo } from 'react'
import { useIntl } from 'react-intl'
import { observer } from 'mobx-react-lite'
import { Tooltip, Button, Slider, InputNumber, Modal, Select, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { buildStore } from '../stores/buildStore.js'
import { modulePresetStore } from '../stores/modulePresetStore.js'
import heroAvatarData from '../assets/json/角色/角色头像位置.json'
import heroTraitData from '../assets/json/角色/角色特性.json'
import heroTraitImgData from '../assets/json/角色/角色特性图片位置.json'
import memoryImgData from '../assets/json/装备/英雄追忆/英雄追忆图片位置.json'
import memoryBaseAttrData from '../assets/json/装备/英雄追忆/英雄追忆基础属性.json'
import memoryInherentData from '../assets/json/装备/英雄追忆/英雄追忆固有词缀.json'
import memoryRandomData from '../assets/json/装备/英雄追忆/英雄追忆随机词缀.json'
import reviveAffixData from '../assets/json/装备/英雄追忆/追忆复苏词缀.json'
import reviveMoonData from '../assets/json/装备/英雄追忆/复苏词缀（月相）.json'
import { getTraitEffectAtLevel, parseTraitDesc, getTraitAllLevelsTooltip } from '../utils/heroTraitDesc.js'
import { cleanAffixText } from '../utils/affixText.js'
import {
  parseAffixRanges,
  resolveAffixText,
  affixTextOf,
  affixValuesOf,
  affixDisplayText,
  makeAffix,
} from '../utils/affixRange.js'
import './HeroPage.less'

const TIERS = [1, 45, 60, 75]
const MEMORY_KINDS = Object.keys(memoryImgData)
const ENHANCE_NODES = [10, 20, 30, 40, 50]

// 45/60/75 档追忆槽位各自只能装备的追忆类型
const TIER_MEMORY_KIND = { 45: '本源的追忆', 60: '守己的追忆', 75: '奋进的追忆' }

// 特殊复苏词缀（"基础特性新增基础特性槽位"）解析：追忆类型简称 → 完整名称；稀有度排序
const SPECIAL_REVIVE_KIND_MAP = { 本源: '本源的追忆', 守己: '守己的追忆', 奋进: '奋进的追忆' }
const RARITY_RANK = { 普通: 1, 魔法: 2, 稀有: 3, 卓越: 4, 至臻: 5 }

// 解析"基础特性新增基础特性槽位，可以安装{品质}及以下品质的{类型}追忆"（含月相"特殊追忆槽位"变体）
function parseSpecialRevive(text) {
  if (!text) return null
  const m = String(text).match(
    /基础特性新增[^，]*槽位，可以安装([^及]+)及以下品质的(本源|守己|奋进)追忆/
  )
  if (!m) return null
  const kind = SPECIAL_REVIVE_KIND_MAP[m[2]]
  if (!kind || !(m[1] in RARITY_RANK)) return null
  return { kind, maxRarity: m[1] }
}

// 追忆稀有度规则：等级上限（Slider 节点）/ 固有·随机词缀可选 Tier / 固有·随机词缀条数
const RARITY_CONFIG = {
  普通: { maxLevel: 10, tiers: ['3'], count: 1 },
  魔法: { maxLevel: 20, tiers: ['3'], count: 1 },
  稀有: { maxLevel: 30, tiers: ['3', '2'], count: 1 },
  卓越: { maxLevel: 40, tiers: ['3', '2', '1'], count: 2 },
  至臻: { maxLevel: 50, tiers: ['3', '2', '1', '0'], count: 2 },
}
// 复苏词缀按稀有度过滤 Tier：普通/魔法无复苏词缀，稀有 T3~T2，卓越 T1，至臻 T0
const REVIVE_TIERS = {
  普通: [],
  魔法: [],
  稀有: ['3', '2'],
  卓越: ['1'],
  至臻: ['0'],
}
const RARITY_KEYS = {
  普通: 'hero.rarityNormal',
  魔法: 'hero.rarityMagic',
  稀有: 'hero.rarityRare',
  卓越: 'hero.rarityEpic',
  至臻: 'hero.rarityLegendary',
}
const RARITY_OPTIONS = Object.keys(RARITY_CONFIG).map((r) => ({
  value: r,
  key: RARITY_KEYS[r],
}))
const RARITY_CLASS = {
  普通: 'hero__rarity-normal',
  魔法: 'hero__rarity-magic',
  稀有: 'hero__rarity-rare',
  卓越: 'hero__rarity-epic',
  至臻: 'hero__rarity-legendary',
}

function tierColorClass(tier) {
  const t = String(tier)
  if (t === '0') return 'hero__affix--red'
  if (t === '1') return 'hero__affix--orange'
  if (/^[2-7]$/.test(t)) return 'hero__affix--purple'
  return ''
}

function scaledBaseAttrText(baseAttr, enhanceLevel) {
  const lvl = enhanceLevel || 0
  if (!baseAttr || lvl <= 0) return baseAttr || ''
  const m = baseAttr.match(/^([+-]?\d+(?:\.\d+)?)(.*)$/)
  if (!m) return baseAttr
  return `${Math.ceil((parseFloat(m[1]) * lvl) / 50)}${m[2]}`
}

// 某档位追忆槽已装备的追忆提供的特性等级加成：
// 强化等级 ≥50 → +2、≥30 → +1（30/40 归 +1，50 归 +2，10/20 不加）；
// 固有词缀含 "+2英雄特性等级"（清洗后精确匹配）→ +2；两者可叠加。
// 45/60/75 档取对应槽位追忆；1 级特性取全部特殊追忆槽（复苏词缀生成）的追忆。
function memoryTraitBonusOf(memorySlots, memoryInventory, tier) {
  let items = []
  if (tier === 1) {
    items = (memorySlots || [])
      .filter((s) => s.tier === 'special' && s.memoryId)
      .map((s) => (memoryInventory || []).find((it) => it.id === s.memoryId))
      .filter(Boolean)
  } else {
    const slot = (memorySlots || []).find((s) => s.tier === tier)
    if (!slot || !slot.memoryId) return { enhance: 0, inherent: 0 }
    const item = (memoryInventory || []).find((it) => it.id === slot.memoryId)
    if (item) items.push(item)
  }
  if (items.length === 0) return { enhance: 0, inherent: 0 }
  let enhance = 0
  let inherent = 0
  for (const item of items) {
    enhance += item.enhanceLevel >= 50 ? 2 : item.enhanceLevel >= 30 ? 1 : 0
    const inherentAffixes = Array.isArray(item.inherentAffixes)
      ? item.inherentAffixes
      : [item.inherentAffix]
    if (
      inherentAffixes
        .filter(Boolean)
        .some((a) => cleanAffixText(affixTextOf(a)).replace(/\s+/g, '') === '+2英雄特性等级')
    ) {
      inherent += 2
    }
  }
  return { enhance, inherent }
}

function affixTierOf(kind, modifier) {
  const text = affixTextOf(modifier)
  const pools = [memoryInherentData[kind], memoryRandomData[kind]]
  for (const pool of pools) {
    const found = (pool || []).find((a) => a.Modifier === text)
    if (found) return found.Tier
  }
  return ''
}

// 词缀 selector 选项：左侧文本 + 右侧 Tier 徽标（均按 Tier 着色），悬浮展示完整词缀
function renderAffixOption(o) {
  const tierClass = tierColorClass(o.tier)
  return (
    <span className="hero__edit-option" title={o.desc || o.label || o.name || ''}>
      <span className={`hero__edit-option-text hero__affix ${tierClass}`}>
        {o.name || o.label}
      </span>
      {o.tier && <span className={`hero__edit-option-tier ${tierClass}`}>{`T${o.tier}`}</span>}
      {o.desc && <span className="hero__edit-option-desc">{o.desc}</span>}
    </span>
  )
}

// 带数值范围词缀的滑动条：每个独立范围一条 Slider，样式与强化等级一致（无刻度节点）
function AffixRangeSliders({ affix, onChange }) {
  const text = affixTextOf(affix)
  const ranges = parseAffixRanges(text)
  if (ranges.length === 0) return null
  const values = affixValuesOf(affix)
  return (
    <div className="hero__edit-affix-range">
      {ranges.map((r, j) => (
        <Slider
          key={j}
          min={r.min}
          max={r.max}
          step={1}
          value={values[j] ?? Math.round((r.min + r.max) / 2)}
          onChange={(v) => onChange(j, v)}
        />
      ))}
    </div>
  )
}

const EMPTY_FORM = {
  kind: '',
  rarity: '',
  baseAttr: '',
  enhanceLevel: 10,
  revive: '',
  inherent: [],
  random: [],
}

function getTraitTier(levelUpTime) {
  const m = (levelUpTime || '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 1
}

function groupByTier(heroName) {
  const traits = heroTraitData[heroName] || {}
  const groups = {}
  for (const [name, info] of Object.entries(traits)) {
    const tier = getTraitTier(info.level_up_time)
    if (!groups[tier]) groups[tier] = []
    groups[tier].push({ name, ...info })
  }
  return groups
}

function affixOptionsOf(kind, rarity, data) {
  if (!kind || !rarity) return []
  const cfg = RARITY_CONFIG[rarity]
  const tiers = cfg ? cfg.tiers : []
  return (data[kind] || [])
    .filter((a) => tiers.includes(String(a.Tier)))
    .map((a) => ({ value: a.Modifier, label: cleanAffixText(a.Modifier), tier: a.Tier }))
}

function splitAffixSlots(values, count) {
  const arr = Array.isArray(values) ? values : []
  const slots = []
  for (let i = 0; i < count; i++) slots.push(arr[i] || '')
  return slots
}

function HeroPage() {
  const { formatMessage } = useIntl()
  const [editingTier, setEditingTier] = useState(null)
  const [editingSpecial, setEditingSpecial] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [selectedMemoryId, setSelectedMemoryId] = useState(null)

  const heroTraits = buildStore.build.heroTraits || {}
  const heroName = heroTraits.name || ''
  const traits = Array.isArray(heroTraits.traits) ? heroTraits.traits : []
  const traitLevels = {}
  for (const t of traits) traitLevels[t.name] = t.level

  const memorySlots = Array.isArray(heroTraits.memorySlots)
    ? heroTraits.memorySlots
    : []
  const memoryInventory = Array.isArray(buildStore.build.memoryInventory)
    ? buildStore.build.memoryInventory
    : []

  const groups = heroName ? groupByTier(heroName) : {}

  // 特殊追忆槽：已装备的 45/60/75 追忆若带"基础特性新增基础特性槽位"复苏词缀，
  // 在 1 级特性下生成一个只能安装对应类型 + 品质上限以内追忆的特殊槽
  const specialSlots = memorySlots
    .filter((s) => s.tier !== 'special' && s.memoryId)
    .map((s) => {
      const item = memoryInventory.find((it) => it.id === s.memoryId)
      if (!item) return null
      const req = parseSpecialRevive(affixTextOf(item.reviveAffix))
      return req ? { sourceMemoryId: item.id, ...req } : null
    })
    .filter(Boolean)

  // 复苏词缀：普通池 + 月相池合并；月相词缀用 EntryDesc 作为完整效果文案
  const reviveOptions = useMemo(() => {
    const normal = reviveAffixData.map((r) => ({
      value: r.Entry,
      name: cleanAffixText(r.Entry),
      desc: '',
      tier: r.Tier,
    }))
    const moon = reviveMoonData.map((r) => ({
      value: r.EntryDesc,
      name: cleanAffixText(r.Entry),
      desc: cleanAffixText(r.EntryDesc),
      tier: r.Tier,
    }))
    return [...normal, ...moon]
  }, [])

  function reviveTierOf(text) {
    const v = affixTextOf(text)
    if (!v) return ''
    const o = reviveOptions.find((r) => r.value === v)
    return o ? o.tier : ''
  }

  const rarityCfg = RARITY_CONFIG[form.rarity]
  const enhanceMax = rarityCfg ? rarityCfg.maxLevel : ENHANCE_NODES[ENHANCE_NODES.length - 1]
  const affixCount = rarityCfg ? rarityCfg.count : 1
  const reviveTierWhitelist = form.rarity ? REVIVE_TIERS[form.rarity] : []
  const reviveCandidates = reviveOptions.filter((o) =>
    reviveTierWhitelist.includes(String(o.tier))
  )
  const baseAttrOptions = (memoryBaseAttrData[form.kind] || []).map((a) => ({
    value: a.Modifier,
    label: scaledBaseAttrText(a.Modifier, form.enhanceLevel),
  }))
  const inherentOptions = affixOptionsOf(form.kind, form.rarity, memoryInherentData)
  const randomOptions = affixOptionsOf(form.kind, form.rarity, memoryRandomData)

  function setFormField(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function selectHero(name) {
    buildStore.setHero(heroName === name ? '' : name)
  }

  function memorySlotOf(tier) {
    return memorySlots.find((s) => s.tier === tier)
  }

  function specialSlotOf(sourceMemoryId) {
    return (
      memorySlots.find((s) => s.tier === 'special' && s.sourceMemoryId === sourceMemoryId) ||
      null
    )
  }

  function inventoryItemOf(id) {
    return memoryInventory.find((it) => it.id === id) || null
  }

  function handleTraitClick(trait) {
    const tier = getTraitTier(trait.level_up_time)
    const slot = memorySlotOf(tier)
    const slotItem = slot?.memoryId ? inventoryItemOf(slot.memoryId) : null
    if (!slotItem) {
      message.info(formatMessage({ id: 'hero.memoryNeeded' }))
    }
    if ((traitLevels[trait.name] || 0) > 0) {
      buildStore.updateHeroTraitLevel(trait.name, 0)
      return
    }
    for (const other of groups[tier] || []) {
      if (other.name !== trait.name && (traitLevels[other.name] || 0) > 0) {
        buildStore.updateHeroTraitLevel(other.name, 0)
      }
    }
    buildStore.updateHeroTraitLevel(trait.name, 1)
  }

  function renderTooltip(trait, effectiveLevel, bonus) {
    const hasBonus = bonus.enhance > 0 || bonus.inherent > 0
    const bonusParts = []
    if (bonus.enhance > 0) {
      bonusParts.push(formatMessage({ id: 'hero.traitLevelBonusEnhance' }, { n: bonus.enhance }))
    }
    if (bonus.inherent > 0) {
      bonusParts.push(formatMessage({ id: 'hero.traitLevelBonusInherent' }, { n: bonus.inherent }))
    }
    return (
      <div className="hero__tooltip">
        <div className="hero__tooltip-name">{trait.name}</div>
        {hasBonus && (
          <div className="hero__tooltip-line">
            <span className="hero__tooltip-lv">
              {formatMessage({ id: 'hero.traitLevel' }, { level: effectiveLevel })}
            </span>
            <span>{bonusParts.join(' · ')}</span>
          </div>
        )}
        {hasBonus ? (
          <div className="hero__tooltip-line">
            {getTraitEffectAtLevel(trait.desc, trait.name, effectiveLevel)}
          </div>
        ) : (
          getTraitAllLevelsTooltip(trait.desc, trait.name).lines.map((line, i) => (
            <div className="hero__tooltip-line" key={i}>
              {line}
            </div>
          ))
        )}
        {parseTraitDesc(trait.desc, trait.name).moon && (
          <div className="hero__tooltip-line">
            <span className="hero__tooltip-lv">{formatMessage({ id: 'hero.traitMoon' })}</span>
            {parseTraitDesc(trait.desc, trait.name).moon}
          </div>
        )}
      </div>
    )
  }

  function renderTrait(trait, isBase, activated, bonus) {
    const selected = isBase || (traitLevels[trait.name] || 0) > 0
    const effectiveLevel = Math.max(1, Math.min(5, 1 + bonus.enhance + bonus.inherent))
    const imgPath = heroTraitImgData?.[heroName]?.[trait.name] || ''
    const cls = [
      'hero__mt-trait',
      selected ? 'hero__mt-trait--selected' : '',
      !isBase && !activated ? 'hero__mt-trait--unactivated' : '',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <Tooltip key={trait.name} title={renderTooltip(trait, effectiveLevel, bonus)}>
        <div
          className={cls}
          onClick={() => {
            if (!isBase) handleTraitClick(trait)
          }}
        >
          {imgPath && (
            <span className="hero__mt-trait-imgwrap">
              <img src={encodeURI(imgPath)} alt={trait.name} className="hero__mt-trait-img" />
            </span>
          )}
          {selected && (
            <span className="hero__mt-trait-level">
              {formatMessage({ id: 'hero.traitLevel' }, { level: effectiveLevel })}
            </span>
          )}
        </div>
      </Tooltip>
    )
  }

  function renderColumn(tier) {
    const tierTraits = groups[tier] || []
    const isBase = tier === 1
    const slot = memorySlotOf(tier)
    const slotItem = slot?.memoryId ? inventoryItemOf(slot.memoryId) : null
    const activated = isBase || !!slotItem
    const bonus = memoryTraitBonusOf(memorySlots, memoryInventory, tier)
    return (
      <div key={tier} className="hero__mt-col">
        <div className="hero__mt-col-title">
          {formatMessage({ id: `hero.tierLevel${tier}` })}
        </div>
        <div className="hero__mt-col-body">
          {tierTraits.map((trait) => renderTrait(trait, isBase, activated, bonus))}
          {isBase &&
            specialSlots.map((ss) => {
              const slot = specialSlotOf(ss.sourceMemoryId)
              const slotItem = slot?.memoryId ? inventoryItemOf(slot.memoryId) : null
              return (
                <Tooltip
                  key={`special-${ss.sourceMemoryId}`}
                  title={formatMessage(
                    { id: 'hero.memorySpecialSlotHint' },
                    { kind: ss.kind, maxRarity: ss.maxRarity }
                  )}
                >
                  <div
                    className={`hero__mt-slot hero__mt-slot--special ${slotItem ? 'hero__mt-slot--filled' : ''} ${slotItem && slotItem.rarity ? RARITY_CLASS[slotItem.rarity] : ''}`}
                    onClick={() => setEditingSpecial(ss.sourceMemoryId)}
                  >
                    {slotItem ? (
                      <img
                        src={encodeURI(memoryImgData[slotItem.kind] || '')}
                        alt={slotItem.kind}
                        className="hero__mt-slot-img"
                      />
                    ) : (
                      <PlusOutlined className="hero__mt-slot-icon" />
                    )}
                  </div>
                </Tooltip>
              )
            })}
          {!isBase && (
            <Tooltip
              key={`slot-${tier}`}
              title={formatMessage({ id: 'hero.memorySlotKind' }, { kind: TIER_MEMORY_KIND[tier] })}
            >
              <div
                className={`hero__mt-slot ${slotItem ? 'hero__mt-slot--filled' : ''} ${slotItem && slotItem.rarity ? RARITY_CLASS[slotItem.rarity] : ''}`}
                onClick={() => setEditingTier(tier)}
              >
                {slotItem ? (
                  <img
                    src={encodeURI(memoryImgData[slotItem.kind] || '')}
                    alt={slotItem.kind}
                    className="hero__mt-slot-img"
                  />
                ) : (
                  <PlusOutlined className="hero__mt-slot-icon" />
                )}
              </div>
            </Tooltip>
          )}
        </div>
      </div>
    )
  }

  // ===== 追忆编辑 =====

  function handleSaveMemory() {
    const requiredChecks = [
      { ok: !!form.kind, key: 'hero.memoryKind' },
      { ok: !!form.rarity, key: 'hero.memoryRarity' },
      { ok: !!form.baseAttr, key: 'hero.memoryBaseAttr' },
      { ok: ENHANCE_NODES.includes(form.enhanceLevel), key: 'hero.memoryEnhanceLevel' },
      { ok: (form.inherent || []).filter(Boolean).length >= affixCount, key: 'hero.memoryInherent' },
    ]
    const missing = requiredChecks.find((c) => !c.ok)
    if (missing) {
      message.warning(
        formatMessage(
          { id: 'hero.memoryMissingField' },
          { field: formatMessage({ id: missing.key }) }
        )
      )
      return
    }
    const item = {
      kind: form.kind,
      rarity: form.rarity,
      baseAttr: form.baseAttr,
      enhanceLevel: form.enhanceLevel,
      reviveAffix: form.revive || '',
      inherentAffixes: (form.inherent || []).filter(Boolean).map((a) => makeAffix(a)),
      randomAffixes: (form.random || []).filter(Boolean).map((a) => makeAffix(a)),
    }
    if (editingId) {
      buildStore.updateMemoryItem(editingId, item)
    } else {
      buildStore.addMemoryItem(item)
    }
    message.success(formatMessage({ id: 'hero.memorySaveSuccess' }))
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function startEdit(item) {
    const rarity = RARITY_CONFIG[item.rarity] ? item.rarity : ''
    setEditingId(item.id)
    setForm({
      kind: item.kind || '',
      rarity,
      baseAttr: item.baseAttr || '',
      enhanceLevel: rarity
        ? ENHANCE_NODES.filter((n) => n <= RARITY_CONFIG[rarity].maxLevel).includes(item.enhanceLevel)
          ? item.enhanceLevel
          : RARITY_CONFIG[rarity].maxLevel
        : 10,
      revive: item.reviveAffix || '',
      inherent: Array.isArray(item.inherentAffixes)
        ? item.inherentAffixes.map((a) => makeAffix(a))
        : typeof item.inherentAffix === 'string' && item.inherentAffix
          ? [makeAffix(item.inherentAffix)]
          : [],
      random: Array.isArray(item.randomAffixes) ? item.randomAffixes.map((a) => makeAffix(a)) : [],
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const selectedRevive = reviveOptions.find((o) => o.value === affixTextOf(form.revive))

  // ===== 追忆库存 =====

  function renderInventoryCard(item) {
    const equippedTier = memorySlots.find((s) => s.memoryId === item.id)?.tier ?? null
    return (
      <div key={item.id} className={`hero__inv-card ${RARITY_CLASS[item.rarity] || ''}`}>
        <div className="hero__inv-card-main">
          <div className="hero__inv-card-name">{item.kind}</div>
          <div className="hero__inv-card-rarity-line">
            {item.rarity && <span className="hero__inv-card-rarity">{item.rarity}</span>}
            {equippedTier && (
              <span className="hero__inv-card-equipped">
                {formatMessage({ id: 'hero.memoryEquipped' })}
              </span>
            )}
          </div>
        </div>
        <div className="hero__inv-card-affixes">
          {item.baseAttr && (
            <div className="hero__inv-card-affix">
              {scaledBaseAttrText(item.baseAttr, item.enhanceLevel)}
            </div>
          )}
          {ENHANCE_NODES.includes(item.enhanceLevel) && (
            <div className="hero__inv-card-affix">
              {formatMessage({ id: 'hero.memoryEnhanceLevel' })} {item.enhanceLevel}
            </div>
          )}
          {item.reviveAffix && (
            <div className={`hero__inv-card-affix ${tierColorClass(reviveTierOf(item.reviveAffix))}`}>
              {cleanAffixText(resolveAffixText(affixTextOf(item.reviveAffix), affixValuesOf(item.reviveAffix)))}
            </div>
          )}
          {(Array.isArray(item.inherentAffixes) ? item.inherentAffixes : [item.inherentAffix])
            .filter(Boolean)
            .map((a) => (
              <div key={affixTextOf(a)} className={`hero__inv-card-affix ${tierColorClass(affixTierOf(item.kind, a))}`}>
                {cleanAffixText(resolveAffixText(affixTextOf(a), affixValuesOf(a)))}
              </div>
            ))}
          {(item.randomAffixes || []).map((a) => (
            <div key={affixTextOf(a)} className={`hero__inv-card-affix ${tierColorClass(affixTierOf(item.kind, a))}`}>
              {cleanAffixText(resolveAffixText(affixTextOf(a), affixValuesOf(a)))}
            </div>
          ))}
        </div>
        <div className="hero__inv-card-actions">
          <Button size="small" onClick={() => startEdit(item)}>
            {formatMessage({ id: 'hero.memoryEdit' })}
          </Button>
          <Button size="small" onClick={() => buildStore.removeMemoryItem(item.id)}>
            {formatMessage({ id: 'hero.memoryRemoveFromInventory' })}
          </Button>
        </div>
      </div>
    )
  }

  // ===== 槽位装备 Modal =====

  const tierMode = editingTier !== null
  const specialMode = editingSpecial !== null
  const modalOpen = tierMode || specialMode
  const currentSlot = tierMode
    ? memorySlotOf(editingTier)
    : specialMode
      ? specialSlotOf(editingSpecial)
      : null
  const slotRequiredKind = tierMode ? TIER_MEMORY_KIND[editingTier] : ''
  const slotRequirement = tierMode
    ? { kind: slotRequiredKind, maxRarity: '' }
    : specialMode
      ? specialSlots.find((ss) => ss.sourceMemoryId === editingSpecial) || null
      : null
  const slotCandidates = memoryInventory.filter((it) => {
    if (!slotRequirement || it.kind !== slotRequirement.kind) return false
    if (slotRequirement.maxRarity) {
      if (!(it.rarity in RARITY_RANK)) return false
      if (RARITY_RANK[it.rarity] > RARITY_RANK[slotRequirement.maxRarity]) return false
    }
    return true
  })
  const selectedItem = selectedMemoryId ? inventoryItemOf(selectedMemoryId) : null
  const detailEquipped = !!(selectedItem && currentSlot?.memoryId === selectedItem.id)
  const slotItemEquippedOther = (item) =>
    memorySlots.some((s) => s !== currentSlot && s.memoryId === item.id)

  function closeSlotModal() {
    setEditingTier(null)
    setEditingSpecial(null)
    setSelectedMemoryId(null)
  }

  function equipFromModal(memoryId) {
    if (tierMode) {
      const slot = memorySlotOf(editingTier)
      buildStore.setMemorySlot(editingTier, slot?.memoryId === memoryId ? '' : memoryId)
    } else if (specialMode) {
      const req = specialSlots.find((ss) => ss.sourceMemoryId === editingSpecial) || null
      const item = inventoryItemOf(memoryId)
      if (!req || !item) {
        closeSlotModal()
        return
      }
      if (item.kind !== req.kind) {
        message.warning(
          formatMessage({ id: 'hero.memorySpecialSlotKindMismatch' }, { kind: req.kind })
        )
        return
      }
      if (
        req.maxRarity &&
        (!(item.rarity in RARITY_RANK) || RARITY_RANK[item.rarity] > RARITY_RANK[req.maxRarity])
      ) {
        message.warning(
          formatMessage({ id: 'hero.memorySpecialSlotRarityMismatch' }, { maxRarity: req.maxRarity })
        )
        return
      }
      const slot = specialSlotOf(editingSpecial)
      buildStore.setSpecialMemorySlot(
        editingSpecial,
        slot?.memoryId === memoryId ? '' : memoryId
      )
    }
    closeSlotModal()
  }

  function unEquipFromModal() {
    if (tierMode) buildStore.setMemorySlot(editingTier, '')
    else if (specialMode) buildStore.setSpecialMemorySlot(editingSpecial, '')
    closeSlotModal()
  }

  return (
    <div className="hero">
      <div className="hero__header">
        <h2 className="hero__title">{formatMessage({ id: 'tab.hero' })}</h2>
        <div className="hero__header-actions">
          <Button size="small" onClick={() => modulePresetStore.openDrawer('hero')}>
            {formatMessage({ id: 'preset.open' })}
          </Button>
        </div>
      </div>

      <div className="hero__body">
        <div className="hero__select">
          <div className="hero__panel-title">{formatMessage({ id: 'hero.selectTitle' })}</div>
          <div className="hero__grid">
            {heroAvatarData.map((h) => (
              <div
                key={h.name}
                className={`hero__card ${heroName === h.name ? 'hero__card--active' : ''}`}
                onClick={() => selectHero(h.name)}
              >
                <img src={encodeURI(h.location)} alt={h.name} className="hero__avatar" />
                <span className="hero__card-name">{h.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero__memory">
          <div className="hero__memory-head">
            <div className="hero__panel-title">{formatMessage({ id: 'hero.memoryTraitTitle' })}</div>
            {heroName && (
              <div className="hero__level">
                <span className="hero__level-label">{formatMessage({ id: 'hero.heroLevel' })}</span>
                <InputNumber
                  min={1}
                  max={100}
                  value={heroTraits.level || 1}
                  onChange={(v) => buildStore.updateHeroTrait({ level: v })}
                  size="small"
                  className="hero__level-input"
                />
              </div>
            )}
          </div>
          {!heroName ? (
            <div className="hero__empty">{formatMessage({ id: 'hero.selectHint' })}</div>
          ) : (
            <div className="hero__mt-grid">{TIERS.map(renderColumn)}</div>
          )}
        </div>

        <div className="hero__edit">
          <div className="hero__panel-title">{formatMessage({ id: 'hero.memoryEditTitle' })}</div>
          <div className="hero__edit-form">
            {form.kind && (
              <div className={`hero__edit-preview ${RARITY_CLASS[form.rarity] || ''}`}>
                <img
                  src={encodeURI(memoryImgData[form.kind] || '')}
                  alt={form.kind}
                  className="hero__edit-preview-img"
                />
              </div>
            )}
            <div className="hero__edit-field">
              <span className="hero__edit-field-label">{formatMessage({ id: 'hero.memoryKind' })}</span>
              <Select
                className="hero__edit-field-control"
                value={form.kind || undefined}
                placeholder={formatMessage({ id: 'hero.memorySelectNone' })}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    kind: v || '',
                    baseAttr: '',
                    revive: '',
                    inherent: [],
                    random: [],
                  }))
                }
                options={MEMORY_KINDS.map((k) => ({ value: k, label: k }))}
              />
            </div>
            <div className="hero__edit-field">
              <span className="hero__edit-field-label">{formatMessage({ id: 'hero.memoryRarity' })}</span>
              <Select
                className="hero__edit-field-control"
                value={form.rarity || undefined}
                placeholder={formatMessage({ id: 'hero.memorySelectNone' })}
                onChange={(v) =>
                  setForm((f) => {
                    const rarity = v || ''
                    const maxLevel = rarity ? RARITY_CONFIG[rarity].maxLevel : enhanceMax
                    return {
                      ...f,
                      rarity,
                      enhanceLevel: Math.min(f.enhanceLevel, maxLevel),
                      revive: '',
                      inherent: [],
                      random: [],
                    }
                  })
                }
                options={RARITY_OPTIONS.map((o) => ({
                  value: o.value,
                  label: formatMessage({ id: o.key }),
                }))}
              />
            </div>
            <div className="hero__edit-field">
              <span className="hero__edit-field-label">{formatMessage({ id: 'hero.memoryBaseAttr' })}</span>
              <Select
                className="hero__edit-field-control"
                value={form.baseAttr || undefined}
                placeholder={formatMessage({ id: 'hero.memorySelectNone' })}
                disabled={!form.kind}
                allowClear
                onChange={(v) => setFormField('baseAttr', v || '')}
                options={baseAttrOptions}
              />
            </div>
            <div className="hero__edit-field">
              <span className="hero__edit-field-label">{formatMessage({ id: 'hero.memoryEnhanceLevel' })}</span>
              <div className="hero__edit-field-control hero__edit-enhance">
                <Slider
                  min={10}
                  max={enhanceMax}
                  step={10}
                  marks={ENHANCE_NODES.reduce((acc, n) => {
                    if (n <= enhanceMax) acc[n] = String(n)
                    return acc
                  }, {})}
                  value={form.enhanceLevel}
                  disabled={!form.rarity}
                  onChange={(v) => setFormField('enhanceLevel', v)}
                />
              </div>
            </div>
            {!form.rarity && (
              <div className="hero__edit-hint">{formatMessage({ id: 'hero.memoryRarityFirst' })}</div>
            )}
            <div className="hero__edit-field">
              <span className="hero__edit-field-label">{formatMessage({ id: 'hero.memoryRevive' })}</span>
              <div className="hero__edit-field-control">
                <Select
                  value={
                    form.revive
                      ? {
                          value: affixTextOf(form.revive),
                          label: cleanAffixText(affixDisplayText(form.revive)),
                        }
                      : undefined
                  }
                  placeholder={formatMessage({ id: 'hero.memorySelectNone' })}
                  disabled={!form.kind || reviveCandidates.length === 0}
                  allowClear
                  showSearch
                  labelInValue
                  onChange={(v) => setFormField('revive', v && v.value ? makeAffix(v.value) : '')}
                  filterOption={(input, option) =>
                    (option.searchText || '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={reviveCandidates.map((o) => ({
                    value: o.value,
                    searchText: `${o.name} ${o.desc}`,
                    label: renderAffixOption(o),
                  }))}
                />
                <AffixRangeSliders
                  affix={form.revive}
                  onChange={(j, v) => {
                    const values = [...affixValuesOf(form.revive)]
                    values[j] = v
                    setFormField('revive', makeAffix({ text: affixTextOf(form.revive), value: values }))
                  }}
                />
              </div>
            </div>
            {form.rarity && reviveCandidates.length === 0 && (
              <div className="hero__edit-hint">{formatMessage({ id: 'hero.memoryReviveNone' })}</div>
            )}
            {selectedRevive?.desc && (
              <div
                className={`hero__edit-affix hero__edit-revive-desc ${tierColorClass(selectedRevive.tier)}`}
              >
                {selectedRevive.desc}
              </div>
            )}
            {Array.from({ length: affixCount }, (_, i) => {
              const slot = i + 1
              return (
                <div className="hero__edit-field" key={`inherent-${slot}`}>
                  <span className="hero__edit-field-label">
                    {affixCount > 1
                      ? formatMessage({ id: 'hero.memoryInherentSlot' }, { n: slot })
                      : formatMessage({ id: 'hero.memoryInherent' })}
                  </span>
                  <div className="hero__edit-field-control">
                    <Select
                      value={
                        splitAffixSlots(form.inherent, affixCount)[i]
                          ? {
                              value: affixTextOf(splitAffixSlots(form.inherent, affixCount)[i]),
                              label: cleanAffixText(
                                affixDisplayText(splitAffixSlots(form.inherent, affixCount)[i])
                              ),
                            }
                          : undefined
                      }
                      placeholder={formatMessage({ id: 'hero.memorySelectNone' })}
                      disabled={!form.kind || !form.rarity}
                      allowClear
                      showSearch
                      labelInValue
                      optionFilterProp="label"
                      onChange={(v) => {
                        const next = splitAffixSlots(form.inherent, affixCount)
                        next[i] = v && v.value ? makeAffix(v.value) : ''
                        setFormField('inherent', next)
                      }}
                      options={inherentOptions
                        .filter((o) => {
                          const others = splitAffixSlots(form.inherent, affixCount).filter(
                            (x, idx) => idx !== i && x
                          )
                          const randomPicked = splitAffixSlots(form.random, affixCount).filter(Boolean)
                          return (
                            !others.some((x) => affixTextOf(x) === o.value) &&
                            !randomPicked.some((x) => affixTextOf(x) === o.value)
                          )
                        })
                        .map((o) => ({
                          value: o.value,
                          searchText: o.label,
                          label: renderAffixOption(o),
                        }))}
                      filterOption={(input, option) =>
                        (option.searchText || '').toLowerCase().includes(input.toLowerCase())
                      }
                    />
                    <AffixRangeSliders
                      affix={splitAffixSlots(form.inherent, affixCount)[i]}
                      onChange={(j, v) => {
                        const next = splitAffixSlots(form.inherent, affixCount)
                        const cur = next[i]
                        if (!cur) return
                        const values = [...affixValuesOf(cur)]
                        values[j] = v
                        next[i] = makeAffix({ text: affixTextOf(cur), value: values })
                        setFormField('inherent', next)
                      }}
                    />
                  </div>
                </div>
              )
            })}
            {Array.from({ length: affixCount }, (_, i) => {
              const slot = i + 1
              return (
                <div className="hero__edit-field" key={`random-${slot}`}>
                  <span className="hero__edit-field-label">
                    {affixCount > 1
                      ? formatMessage({ id: 'hero.memoryRandomSlot' }, { n: slot })
                      : formatMessage({ id: 'hero.memoryRandom' })}
                  </span>
                  <div className="hero__edit-field-control">
                    <Select
                      value={
                        splitAffixSlots(form.random, affixCount)[i]
                          ? {
                              value: affixTextOf(splitAffixSlots(form.random, affixCount)[i]),
                              label: cleanAffixText(
                                affixDisplayText(splitAffixSlots(form.random, affixCount)[i])
                              ),
                            }
                          : undefined
                      }
                      placeholder={formatMessage({ id: 'hero.memorySelectNone' })}
                      disabled={!form.kind || !form.rarity}
                      allowClear
                      showSearch
                      labelInValue
                      optionFilterProp="label"
                      onChange={(v) => {
                        const next = splitAffixSlots(form.random, affixCount)
                        next[i] = v && v.value ? makeAffix(v.value) : ''
                        setFormField('random', next)
                      }}
                      options={randomOptions
                        .filter((o) => {
                          const others = splitAffixSlots(form.random, affixCount).filter(
                            (x, idx) => idx !== i && x
                          )
                          const inherentPicked = splitAffixSlots(form.inherent, affixCount).filter(Boolean)
                          return (
                            !others.some((x) => affixTextOf(x) === o.value) &&
                            !inherentPicked.some((x) => affixTextOf(x) === o.value)
                          )
                        })
                        .map((o) => ({
                          value: o.value,
                          searchText: o.label,
                          label: renderAffixOption(o),
                        }))}
                      filterOption={(input, option) =>
                        (option.searchText || '').toLowerCase().includes(input.toLowerCase())
                      }
                    />
                    <AffixRangeSliders
                      affix={splitAffixSlots(form.random, affixCount)[i]}
                      onChange={(j, v) => {
                        const next = splitAffixSlots(form.random, affixCount)
                        const cur = next[i]
                        if (!cur) return
                        const values = [...affixValuesOf(cur)]
                        values[j] = v
                        next[i] = makeAffix({ text: affixTextOf(cur), value: values })
                        setFormField('random', next)
                      }}
                    />
                  </div>
                </div>
              )
            })}
            <div className="hero__edit-actions">
              <Button type="primary" size="small" className="hero__edit-save" onClick={handleSaveMemory}>
                {formatMessage({ id: 'hero.memorySave' })}
              </Button>
              {editingId && (
                <Button size="small" onClick={cancelEdit}>
                  {formatMessage({ id: 'hero.memoryEditCancel' })}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="hero__inventory">
          <div className="hero__inventory-head">
            <div className="hero__panel-title">{formatMessage({ id: 'hero.memoryInventoryTitle' })}</div>
            <div className="hero__inv-toolbar">
              <Button size="small" onClick={() => buildStore.resetMemoryInventory()}>
                {formatMessage({ id: 'hero.memoryClearAll' })}
              </Button>
            </div>
          </div>
          {memoryInventory.length === 0 ? (
            <div className="hero__inv-empty">{formatMessage({ id: 'hero.memoryInventoryPrompt' })}</div>
          ) : (
            <div className="hero__inv-grid">{memoryInventory.map(renderInventoryCard)}</div>
          )}
        </div>
      </div>

      <Modal
        title={formatMessage(
          { id: specialMode ? 'hero.memorySpecialSelect' : 'hero.memorySelect' },
          specialMode
            ? { kind: slotRequirement?.kind || '', maxRarity: slotRequirement?.maxRarity || '' }
            : {}
        )}
        open={modalOpen}
        onCancel={closeSlotModal}
        footer={null}
        centered
        destroyOnClose
        afterOpenChange={(open) => {
          if (open) {
            setSelectedMemoryId(currentSlot?.memoryId || null)
          }
        }}
      >
        {slotCandidates.length === 0 ? (
          <div className="hero__modal-empty">
            {specialMode
              ? formatMessage(
                  { id: 'hero.memorySpecialSlotNoKind' },
                  { kind: slotRequirement?.kind || '', maxRarity: slotRequirement?.maxRarity || '' }
                )
              : formatMessage({ id: 'hero.memorySlotNoKind' }, { kind: slotRequiredKind })}
          </div>
        ) : (
          <>
            <div className="hero__modal-strip">
              {slotCandidates.map((item) => {
                const equipped = currentSlot?.memoryId === item.id
                const equippedOther = slotItemEquippedOther(item)
                return (
                  <div
                    key={item.id}
                    className={`hero__modal-mini ${selectedMemoryId === item.id ? 'hero__modal-mini--selected' : ''} ${equippedOther ? 'hero__modal-mini--disabled' : ''} ${RARITY_CLASS[item.rarity] || ''}`}
                    onClick={() => {
                      if (equippedOther) {
                        message.info(formatMessage({ id: 'hero.memoryEquippedOther' }))
                        return
                      }
                      setSelectedMemoryId(item.id)
                    }}
                  >
                    <img
                      src={encodeURI(memoryImgData[item.kind] || '')}
                      alt={item.kind}
                      className="hero__modal-mini-img"
                    />
                    <div className="hero__modal-mini-name">{item.kind}</div>
                    {equipped && (
                      <div className="hero__modal-mini-badge">
                        {formatMessage({ id: 'hero.memoryEquipped' })}
                      </div>
                    )}
                    {equippedOther && (
                      <div className="hero__modal-mini-badge">
                        {formatMessage({ id: 'hero.memoryEquippedOther' })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {selectedItem && (
              <div className="hero__modal-detail">
                <div className="hero__modal-detail-head">
                  <span className="hero__modal-detail-name">{selectedItem.kind}</span>
                  {selectedItem.rarity && (
                    <span className="hero__modal-detail-rarity">{selectedItem.rarity}</span>
                  )}
                </div>
                <div className="hero__modal-detail-body">
                  {selectedItem.baseAttr && (
                    <div className="hero__modal-detail-row">
                      <span className="hero__modal-detail-label">
                        {formatMessage({ id: 'hero.memoryBaseAttr' })}
                      </span>
                      <span className="hero__modal-detail-affix">
                        {scaledBaseAttrText(selectedItem.baseAttr, selectedItem.enhanceLevel)}
                      </span>
                    </div>
                  )}
                  {ENHANCE_NODES.includes(selectedItem.enhanceLevel) && (
                    <div className="hero__modal-detail-row">
                      <span className="hero__modal-detail-label">
                        {formatMessage({ id: 'hero.memoryEnhanceLevel' })}
                      </span>
                      <span className="hero__modal-detail-affix">{selectedItem.enhanceLevel}</span>
                    </div>
                  )}
                  {selectedItem.reviveAffix && (
                    <div className="hero__modal-detail-row">
                      <span className="hero__modal-detail-label">
                        {formatMessage({ id: 'hero.memoryRevive' })}
                      </span>
                      <span
                        className={`hero__modal-detail-affix ${tierColorClass(
                          reviveTierOf(selectedItem.reviveAffix)
                        )}`}
                      >
                        {cleanAffixText(
                          resolveAffixText(
                            affixTextOf(selectedItem.reviveAffix),
                            affixValuesOf(selectedItem.reviveAffix)
                          )
                        )}
                      </span>
                    </div>
                  )}
                  {(Array.isArray(selectedItem.inherentAffixes)
                    ? selectedItem.inherentAffixes
                    : [selectedItem.inherentAffix]
                  )
                    .filter(Boolean)
                    .map((a) => (
                      <div className="hero__modal-detail-row" key={affixTextOf(a)}>
                        <span className="hero__modal-detail-label">
                          {formatMessage({ id: 'hero.memoryInherent' })}
                        </span>
                        <span
                          className={`hero__modal-detail-affix ${tierColorClass(
                            affixTierOf(selectedItem.kind, a)
                          )}`}
                        >
                          {cleanAffixText(resolveAffixText(affixTextOf(a), affixValuesOf(a)))}
                        </span>
                      </div>
                    ))}
                  {(selectedItem.randomAffixes || []).map((a) => (
                    <div className="hero__modal-detail-row" key={affixTextOf(a)}>
                      <span className="hero__modal-detail-label">
                        {formatMessage({ id: 'hero.memoryRandom' })}
                      </span>
                      <span
                        className={`hero__modal-detail-affix ${tierColorClass(
                          affixTierOf(selectedItem.kind, a)
                        )}`}
                      >
                        {cleanAffixText(resolveAffixText(affixTextOf(a), affixValuesOf(a)))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="hero__modal-detail-footer">
                  {detailEquipped ? (
                    <Button size="small" onClick={unEquipFromModal}>
                      {formatMessage({ id: 'hero.memoryUnEquip' })}
                    </Button>
                  ) : (
                    <Button size="small" type="primary" onClick={() => equipFromModal(selectedItem.id)}>
                      {formatMessage({ id: 'hero.memoryEquip' })}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}

export default observer(HeroPage)
