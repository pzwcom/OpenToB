import { useMemo, useState } from 'react'
import { useIntl } from 'react-intl'
import { observer } from 'mobx-react-lite'
import { Button, Drawer, Select, Slider, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { buildStore } from '../stores/buildStore.js'
import { modulePresetStore } from '../stores/modulePresetStore.js'
import legendEquipData from '../assets/json/装备/传奇装备/传奇装备.json'
import normalEquipData from '../assets/json/装备/普通装备/普通装备.json'
import { cleanAffixText } from '../utils/affixText.js'
import {
  itemMatchesSlot,
  validateEquipRules,
} from '../utils/equipSlot.js'
import {
  graftBasePoolOf,
  graftCraftPoolOf,
  graftImgPath,
  graftLegendPoolOf,
  graftSubCategory,
  isGraftPart,
} from '../data/graftData.js'
import {
  normalBasePoolOf,
  normalCraftPoolOf,
} from '../data/normalAffixData.js'
import { perfumeAffixPool } from '../data/perfumeAffixData.js'
import {
  isTowerSubCategory,
  towerAffixPoolOf,
} from '../data/towerAffixData.js'
import EquipmentBrowser from '../components/equipment/EquipmentBrowser.jsx'
import {
  affixDisplayText,
  affixTextOf,
  affixValuesOf,
  makeAffix,
  parseAffixRanges,
} from '../utils/affixRange.js'
import './EquipmentPage.less'

const SLOT_KEYS = [
  'mainHand',
  'offHand',
  'helmet',
  'armor',
  'gloves',
  'boots',
  'necklace',
  'ring1',
  'ring2',
  'belt',
]

// 2×4 小槽位展示顺序：头部/胸甲/项链/手套 / 腰带/左戒/右戒/鞋子
const SMALL_SLOT_KEYS = ['helmet', 'armor', 'necklace', 'gloves', 'belt', 'ring1', 'ring2', 'boots']

const SLOT_LABEL_KEYS = {
  mainHand: 'equip.mainHand',
  offHand: 'equip.offHand',
  helmet: 'equip.helmet',
  armor: 'equip.chest',
  gloves: 'equip.glove',
  boots: 'equip.boot',
  necklace: 'equip.necklace',
  ring1: 'equip.ringLeft',
  ring2: 'equip.ringRight',
  belt: 'equip.belt',
}

const SLOT_ICONS = {
  mainHand: '/图片/背景图片/装备背景图/icon_Slot_Weapon.webp',
  offHand: '/图片/背景图片/装备背景图/icon_Slot_Weapon.webp',
  helmet: '/图片/背景图片/装备背景图/icon_Slot_Helmet.webp',
  armor: '/图片/背景图片/装备背景图/icon_Slot_Chest_Armor.webp',
  gloves: '/图片/背景图片/装备背景图/icon_Slot_Glove.webp',
  boots: '/图片/背景图片/装备背景图/icon_Slot_Boot.webp',
  necklace: '/图片/背景图片/装备背景图/icon_Slot_Necklace.webp',
  ring1: '/图片/背景图片/装备背景图/icon_Slot_Ring.webp',
  ring2: '/图片/背景图片/装备背景图/icon_Slot_Ring.webp',
  belt: '/图片/背景图片/装备背景图/icon_Slot_Belt.webp',
}

// 槽位匹配规则统一在 utils/equipSlot.js（itemMatchesSlot），本页与 EquipmentBrowser 共用

function tierColorClass(tier) {
  const t = String(tier)
  if (t === '0' || t === '0+') return 'equip__affix--red'
  if (t === '1') return 'equip__affix--orange'
  if (/^[2-7]$/.test(t)) return 'equip__affix--purple'
  return ''
}

// 词缀 selector 选项：左侧文本 + 右侧 Tier 徽标（均按 Tier 着色），悬浮展示完整词缀（规范见 Spec/前端设计/前端界面总设计.md §5）
// libLabel 传入时 Tier 徽标显示为「初阶|T0」形式（打造词缀 selector）
function renderAffixOption(entry, libLabel) {
  const tierClass = tierColorClass(entry.Tier)
  const text = cleanAffixText(entry.Entry || entry.text || '')
  return (
    <span className="equip__edit-option" title={text}>
      <span className={`equip__edit-option-text ${tierClass}`}>{text}</span>
      {entry.Tier !== undefined && entry.Tier !== '' && (
        <span className={`equip__edit-option-tier ${tierClass}`}>
          {libLabel ? `${libLabel}|T${entry.Tier}` : `T${entry.Tier}`}
        </span>
      )}
    </span>
  )
}

// 词缀 Select 搜索：按词缀文本过滤（悬浮/搜索一致）
function filterAffixOption(input, option) {
  const text = option?.text || ''
  return text.toLowerCase().includes((input || '').toLowerCase())
}

// 高塔词缀 selector 选项：词缀文本 + 序列徽标（中阶序列=橙 / 高阶序列=红）
function renderTowerOption(entry) {
  const text = cleanAffixText(entry[0] || '')
  const series = entry[1] || ''
  const high = series === '高阶序列'
  return (
    <span className="equip__edit-option" title={text}>
      <span className="equip__edit-option-text">{text}</span>
      <span className={`equip__edit-option-tier ${high ? 'equip__affix--red' : 'equip__affix--orange'}`}>
        {series}
      </span>
    </span>
  )
}

// 调香词缀 selector 选项：词缀文本 + 分类徽标（中型/核心=橙 / 异香=红）
function renderPerfumeOption(entry) {
  const text = cleanAffixText(entry.描述 || '')
  const name = entry.名称 || ''
  const typeLabel = entry.类型 === 'exotic' ? '异香天赋' : entry.类型 === 'core' ? '核心天赋' : '中型天赋'
  const typeClass = entry.类型 === 'exotic' ? 'equip__affix--red' : 'equip__affix--orange'
  return (
    <span className="equip__edit-option" title={text}>
      <span className="equip__edit-option-text">
        {name ? `${name}：${text}` : text}
      </span>
      <span className={`equip__edit-option-tier ${typeClass}`}>{typeLabel}</span>
    </span>
  )
}

// 调香词缀分类徽标文案与颜色（中型/核心=橙 / 异香=红）
function perfumeTypeLabel(entry) {
  return entry.类型 === 'exotic' ? '异香天赋' : entry.类型 === 'core' ? '核心天赋' : '中型天赋'
}

function perfumeTypeClass(entry) {
  return entry.类型 === 'exotic' ? 'equip__affix--red' : 'equip__affix--orange'
}

// 打造词缀 Library 三档（数据值 → UI 顺序）
const CRAFT_LIB_LABEL_KEYS = {
  初阶词缀: 'equip.craftLib.primary',
  进阶词缀: 'equip.craftLib.advanced',
  至臻词缀: 'equip.craftLib.supreme',
}
// 进阶/至臻词缀每件装备最多 2 条（初级不限）
const MAX_LIB_AFFIX_COUNT = 2
const MAX_LIB_LIBRARIES = ['进阶词缀', '至臻词缀']

// 词缀"同族"归一化：去掉数值区间与数字，仅保留文本骨架（火焰抗性 T1/T2 视为同一种词缀）
// 归属同一 Library 才互斥（不同 Library 的同文本词缀是不同打造词缀，可叠加）
function affixFamilyKey(lib, text) {
  if (!text) return ''
  return lib + '|' + text
    .replace(/[（(][^）)]*\d[^）)]*[)）]/g, '')
    .replace(/\d+(?:\.\d+)?/g, '')
    .replace(/[()（）\s]+/g, '')
}

// 打造词缀 selector：扁平选项（Tier 徽标带「初阶|T0」前缀标识 Library）；与已选词缀同族的选项禁用
function affixOptionGroups(pool, blockedFamilies, labelOf) {
  return pool.map((e, i) => {
    const lib = e.Library || '初阶词缀'
    return {
      value: i,
      label: renderAffixOption(e, labelOf(lib)),
      text: e.Entry || e.text || '',
      disabled: blockedFamilies.has(affixFamilyKey(lib, e.Entry || e.text || '')),
    }
  })
}

// 带数值范围词缀的滑动条：每个独立范围一条 Slider
function AffixRangeSliders({ affix, onChange }) {
  const text = affixTextOf(affix)
  const ranges = parseAffixRanges(text)
  if (ranges.length === 0) return null
  const values = affixValuesOf(affix)
  return (
    <div className="equip__edit-range">
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

const MAX_CORRUPTED = 2

// 渴瘾装备：词缀总量上限 6；同源传奇词缀最多 2 个
const MAX_GRAFT_AFFIXES = 6
const MAX_GRAFT_LEGEND = 2

// 普通装备打造：前缀 3 条 + 后缀 3 条，共 6 个打造词缀
const MAX_CRAFT_PREFIX = 3
const MAX_CRAFT_SUFFIX = 3

// 调香词缀（腰带）最多 1 条；高塔词缀（武器）最多 1 条
const MAX_PERFUME = 1
const MAX_TOWER = 1

const EMPTY_FORM = {
  name: '',
  category: '',
  subCategory: '',
  requiredLevel: '',
  baseAffix: '',
  normalAffixes: [],
  corruptedAffixes: [],
  affixes: [],
  corrupted: false,
  canCorrupt: false,
  isGraft: false,
  isNormal: false,
  graft: null,
  imgPath: '',
}

// 传奇装备数据（模块级常量，供 selector 选项与编辑回填使用）
const LEGEND_ITEMS = Object.entries(legendEquipData).map(([name, d]) => ({
  value: name,
  name: d.物品名称 || name,
  category: d.类别 || '',
  subCategory: d.细分类 || '',
  requiredLevel: d.需求等级 || '',
  baseAffix: d.基底词缀 || '',
  normalAffixes: Array.isArray(d.词条) ? d.词条 : [],
  corruptedAffixes: Array.isArray(d.侵蚀词条) ? d.侵蚀词条 : [],
  imgPath: d.图片地址 || '',
}))

// 普通装备数据：无词条/侵蚀词条，基底词缀为「无」时视为空
const NORMAL_ITEMS = Object.entries(normalEquipData).map(([name, d]) => ({
  value: name,
  name: d.物品名称 || name,
  category: d.类别 || '',
  subCategory: d.细分类 || '',
  requiredLevel: d.需求等级 || '',
  baseAffix: d.基底词缀 === '无' ? '' : d.基底词缀 || '',
  normalAffixes: [],
  corruptedAffixes: [],
  imgPath: d.图片地址 || '',
}))

// 普通装备名称集合：用于编辑时识别是否为普通装备（可打造）
const NORMAL_ITEM_NAMES = new Set(NORMAL_ITEMS.map((n) => n.name))

// ===== 库存卡片稀有度（传奇 / 普通 / 渴瘾），见 Spec/前端设计/装备页面设计.md §5.1 =====
const RARITY_LABEL_KEYS = {
  legend: 'equip.rarityLegend',
  normal: 'equip.rarityNormal',
  graft: 'equip.rarityGraft',
}

function inventoryRarityOf(it) {
  if (!it) return 'normal'
  if (it.isGraft || isGraftPart(it.name) || it.category === '渴瘾装备') return 'graft'
  if (LEGEND_ITEMS.some((l) => l.value === it.name)) return 'legend'
  return 'normal'
}

// 卡片背景：传奇 = 橙；普通/渴瘾 = 按词缀条数 0-2 蓝 / 3-4 粉 / 5-6 红
function inventoryCardClass(it) {
  if (inventoryRarityOf(it) === 'legend') return 'equip__inv-card--legend'
  const count = (it.affixes || []).length
  if (count <= 2) return 'equip__inv-card--affix-0-2'
  if (count <= 4) return 'equip__inv-card--affix-3-4'
  return 'equip__inv-card--affix-5-6'
}

// 稀有度徽标颜色与卡片背景同源
function inventoryRarityClass(it) {
  if (inventoryRarityOf(it) === 'legend') return 'equip__inv-card-rarity--legend'
  const count = (it.affixes || []).length
  if (count <= 2) return 'equip__inv-card-rarity--blue'
  if (count <= 4) return 'equip__inv-card-rarity--pink'
  return 'equip__inv-card-rarity--red'
}

function formFromLegend(legend, isNormal = false) {
  return {
    name: legend.name,
    category: legend.category,
    subCategory: legend.subCategory,
    requiredLevel: legend.requiredLevel,
    baseAffix: legend.baseAffix,
    normalAffixes: legend.normalAffixes,
    corruptedAffixes: legend.corruptedAffixes,
    affixes: legend.normalAffixes.map((t) => ({ ...makeAffix(t), corrupted: false })),
    corrupted: false,
    canCorrupt: legend.corruptedAffixes.length > 0,
    isGraft: false,
    isNormal,
    graft: null,
    imgPath: legend.imgPath,
  }
}

// 编辑既有库存条目：优先按装备名反查传奇数据恢复「正常/侵蚀」词条池，并保留已存数值
function formFromItem(item) {
  if (item && (item.isGraft || isGraftPart(item.name) || item.category === '渴瘾装备')) {
    return formFromGraftItem(item)
  }
  const legend = LEGEND_ITEMS.find((l) => l.value === item.name)
  const saved = (Array.isArray(item.affixes) ? item.affixes : []).map((a) => makeAffix(a))
  const savedTexts = saved.map((a) => affixTextOf(a))
  // 逐词条侵蚀标记：新存档携带 corrupted；旧存档整体 corrupted=true 时全部视为已侵蚀
  const hasPerAffixFlag = saved.some((a) => typeof a.corrupted === 'boolean')
  const affixes =
    saved.length > 0
      ? saved.map((a) => ({
          ...a,
          corrupted: hasPerAffixFlag ? !!a.corrupted : !!item.corrupted,
        }))
      : (legend ? legend.normalAffixes : []).map((t) => ({ ...makeAffix(t), corrupted: false }))
  const pool = legend
    ? item.corrupted
      ? legend.corruptedAffixes
      : legend.normalAffixes
    : savedTexts
  return {
    name: item.name || '',
    category: item.category || '',
    subCategory: item.subCategory || '',
    requiredLevel: item.requiredLevel || '',
    baseAffix: item.baseAffix || '',
    normalAffixes: legend ? legend.normalAffixes : pool,
    corruptedAffixes: legend ? legend.corruptedAffixes : pool,
    affixes,
    corrupted: affixes.some((a) => a.corrupted),
    canCorrupt: !!legend && legend.corruptedAffixes.length > 0,
    isGraft: false,
    isNormal: !legend && NORMAL_ITEM_NAMES.has(item.name),
    graft: null,
    imgPath: item.imgPath || '',
  }
}

// 渴瘾装备：新建（选中身体部位）
function formFromGraftPart(part) {
  return {
    name: part,
    category: '渴瘾装备',
    subCategory: graftSubCategory(part),
    requiredLevel: '',
    baseAffix: '',
    normalAffixes: [],
    corruptedAffixes: [],
    affixes: [],
    corrupted: false,
    canCorrupt: false,
    isGraft: true,
    graft: {
      part,
      legendItem: '',
    },
    imgPath: graftImgPath(part),
  }
}

// 渴瘾装备：编辑既有条目（词缀携带 graftSource/graftItem/graftTier/graftKind 元数据）
function formFromGraftItem(item) {
  const saved = (Array.isArray(item.affixes) ? item.affixes : []).map((a) => makeAffix(a))
  const legendItem =
    (item.graft && item.graft.legendItem) ||
    saved.find((a) => a.graftSource === 'legend')?.graftItem ||
    ''
  return {
    name: item.name || '',
    category: item.category || '渴瘾装备',
    subCategory: item.subCategory || graftSubCategory(item.name || ''),
    requiredLevel: item.requiredLevel || '',
    baseAffix: item.baseAffix || '',
    normalAffixes: [],
    corruptedAffixes: [],
    affixes: saved,
    corrupted: false,
    canCorrupt: false,
    isGraft: true,
    graft: { part: item.name || '', legendItem },
    imgPath: item.imgPath || (isGraftPart(item.name) ? graftImgPath(item.name) : ''),
  }
}

function EquipmentPage() {
  const { formatMessage } = useIntl()
  const [drawer, setDrawer] = useState({ open: false, slotKey: null, inventoryId: null })
  const [form, setForm] = useState(EMPTY_FORM)
  const [filterCategory, setFilterCategory] = useState('')

  const equipment = buildStore.build.equipment || {}
  // buildStore 保证 equipmentInventory 恒为数组（默认值/loadFromData/action 均维护），observer 下引用稳定
  const inventory = buildStore.build.equipmentInventory

  const categories = useMemo(() => {
    const set = new Set()
    for (const it of inventory) if (it.category) set.add(it.category)
    return [...set].sort()
  }, [inventory])

  const filteredInventory = filterCategory
    ? inventory.filter((it) => it.category === filterCategory)
    : inventory

  const isLegendName = (name) => !!name && LEGEND_ITEMS.some((l) => l.value === name)

  // 组合规则校验（规则一~三）；出错返回首个错误文案 key，通过返回 ''
  function equipRuleError(item, slotKey) {
    const errors = validateEquipRules({
      equipment,
      inventory,
      item,
      slotKey,
      isLegendName,
    })
    return errors.length > 0 ? errors[0] : ''
  }

  const inventoryItemOf = (id) => inventory.find((it) => it.id === id) || null

  const slotLabel = (slotKey) => formatMessage({ id: SLOT_LABEL_KEYS[slotKey] })

  const slotCandidates = drawer.slotKey
    ? inventory.filter((it) => itemMatchesSlot(it, drawer.slotKey))
    : []
  const equippedItem = drawer.slotKey ? inventoryItemOf(equipment[drawer.slotKey]) : null

  // 渴瘾编辑用：当前部位的传奇物品池与打造词缀池
  const graftPart = form.isGraft ? form.graft?.part : ''
  const legendPool = graftPart ? graftLegendPoolOf(graftPart) : []
  const legendItem = legendPool.find((l) => l.key === form.graft?.legendItem) || null
  const craftPool = graftPart ? graftCraftPoolOf(graftPart) : { prefix: [], suffix: [] }
  const basePool = graftPart ? graftBasePoolOf(graftPart) : []

  // 打造词缀"同族"集合：已添加词缀（库+文本骨架）——同 Library 下火焰抗性 T1/T2 视为同一词缀，互斥
  const selectedAffixFamilies = useMemo(
    () =>
      new Set(
        form.affixes
          .filter((a) => a.graftSource === 'craft')
          .map((a) => affixFamilyKey(a.graftLibrary || '初阶词缀', affixTextOf(a)))
      ),
    [form.affixes]
  )
  const libLabel = (lib) =>
    formatMessage({ id: CRAFT_LIB_LABEL_KEYS[lib] || lib, defaultMessage: lib })

  // 普通装备打造用：按细分类取基础词缀池与打造词缀池（前缀/后缀）
  const normalBasePool = useMemo(
    () => (form.isNormal ? normalBasePoolOf(form.subCategory) : []),
    [form.isNormal, form.subCategory]
  )
  const normalCraftPool = useMemo(
    () => (form.isNormal ? normalCraftPoolOf(form.subCategory) : { prefix: [], suffix: [] }),
    [form.isNormal, form.subCategory]
  )
  // 调香词缀池（腰带）：异香天赋；高塔词缀池（武器）：按武器细分类取 [词缀, 系列]
  const perfumePool = useMemo(() => (form.isNormal ? perfumeAffixPool() : []), [form.isNormal])
  const towerPool = useMemo(
    () => (form.isNormal ? towerAffixPoolOf(form.subCategory) : []),
    [form.isNormal, form.subCategory]
  )
  const isBelt = form.subCategory === '腰带'
  // 基础词缀选项：池内候选 + 装备固有基底词缀（若不在池中，确保选中值可回显），按 Tier 着色
  const normalBaseOptions = useMemo(() => {
    const opts = normalBasePool.map((b) => ({
      value: b.Entry || b.text || '',
      text: b.Entry || b.text || '',
      label: renderAffixOption(b),
    }))
    if (form.baseAffix && !opts.some((o) => o.value === form.baseAffix)) {
      opts.unshift({ value: form.baseAffix, text: form.baseAffix, label: form.baseAffix })
    }
    return opts
  }, [normalBasePool, form.baseAffix])

  function openSlot(slotKey) {
    const item = inventoryItemOf(equipment[slotKey])
    setForm(item ? formFromItem(item) : EMPTY_FORM)
    setDrawer({ open: true, slotKey, inventoryId: null })
  }

  function openInventoryEdit(inventoryId) {
    const item = inventoryItemOf(inventoryId)
    if (!item) return
    setForm(formFromItem(item))
    setDrawer({ open: true, slotKey: null, inventoryId })
  }

  function closeDrawer() {
    setDrawer({ open: false, slotKey: null, inventoryId: null })
    setForm(EMPTY_FORM)
  }

  function selectEquipmentItem(item) {
    if (isGraftPart(item.name)) {
      setForm(formFromGraftPart(item.name))
      return
    }
    const legend = LEGEND_ITEMS.find((l) => l.value === item.name)
    if (legend) {
      setForm(formFromLegend(legend))
      return
    }
    const normal = NORMAL_ITEMS.find((n) => n.name === item.name)
    if (normal) {
      setForm(formFromLegend(normal, true))
      return
    }
    setForm(EMPTY_FORM)
  }

  function toggleAffixCorrupted(affixIndex) {
    setForm((f) => {
      const target = f.affixes[affixIndex]
      if (!target) return f
      const willCorrupt = !target.corrupted
      if (willCorrupt) {
        const count = f.affixes.filter((a) => a.corrupted).length
        if (count >= MAX_CORRUPTED) {
          message.warning(formatMessage({ id: 'equip.corruptLimit' }))
          return f
        }
      }
      const pool = willCorrupt ? f.corruptedAffixes : f.normalAffixes
      const nextText = pool[affixIndex] || affixTextOf(target)
      return {
        ...f,
        corrupted: f.affixes.some((a, i) => (i === affixIndex ? willCorrupt : a.corrupted)),
        affixes: f.affixes.map((a, i) =>
          i === affixIndex ? makeAffix({ text: nextText, corrupted: willCorrupt }) : a
        ),
      }
    })
  }

  function updateAffixValue(affixIndex, rangeIndex, v) {
    setForm((f) => ({
      ...f,
      affixes: f.affixes.map((a, i) => {
        if (i !== affixIndex) return a
        const values = [...affixValuesOf(a)]
        values[rangeIndex] = v
        return makeAffix({ ...a, text: affixTextOf(a), value: values })
      }),
    }))
  }

  // ===== 渴瘾装备编辑 =====

  function selectGraftLegendItem(legendKey) {
    setForm((f) => ({
      ...f,
      graft: { ...f.graft, legendItem: legendKey },
      // 切换传奇物品时清空已选传奇词缀（不同物品的词缀不可混搭）
      affixes: f.affixes.filter((a) => a.graftSource !== 'legend'),
    }))
  }

  function toggleGraftLegendAffix(text) {
    setForm((f) => {
      const existing = f.affixes.find((a) => a.graftSource === 'legend' && a.text === text)
      if (existing) {
        return { ...f, affixes: f.affixes.filter((a) => a !== existing) }
      }
      const legendCount = f.affixes.filter((a) => a.graftSource === 'legend').length
      if (legendCount >= MAX_GRAFT_LEGEND) {
        message.warning(formatMessage({ id: 'equip.graftLegendLimit' }))
        return f
      }
      return {
        ...f,
        affixes: [...f.affixes, makeAffix({ text, graftSource: 'legend', graftItem: f.graft.legendItem })],
      }
    })
  }

  function addGraftCrafted(entry, kind) {
    setForm((f) => {
      if (f.affixes.length >= MAX_GRAFT_AFFIXES) {
        message.warning(formatMessage({ id: 'equip.graftAffixLimit' }))
        return f
      }
      const lib = entry.Library || '初阶词缀'
      if (MAX_LIB_LIBRARIES.includes(lib)) {
        const count = f.affixes.filter((a) => a.graftLibrary === lib).length
        if (count >= MAX_LIB_AFFIX_COUNT) {
          message.warning(
            formatMessage(
              { id: 'equip.craftLibLimit' },
              { lib: libLabel(lib), count: MAX_LIB_AFFIX_COUNT }
            )
          )
          return f
        }
      }
      return {
        ...f,
        affixes: [
          ...f.affixes,
          makeAffix({
            text: entry.Entry,
            graftSource: 'craft',
            graftTier: entry.Tier,
            graftKind: kind,
            graftLibrary: lib,
          }),
        ],
      }
    })
  }

  function removeGraftAffix(affixIndex) {
    setForm((f) => ({
      ...f,
      affixes: f.affixes.filter((_, i) => i !== affixIndex),
    }))
  }

  function selectGraftBase(entry) {
    setForm((f) => ({ ...f, baseAffix: entry ? entry.Entry : '' }))
  }

  // ===== 普通装备打造 =====

  function selectNormalBase(entry) {
    setForm((f) => ({ ...f, baseAffix: entry ? entry.Entry : '' }))
  }

  // 打造词缀：前缀最多 3 条、后缀最多 3 条；进阶/至臻各最多 2 条（crafted 元数据供 Tier 着色与保存反查）
  function addNormalCrafted(entry, kind) {
    const isPrefix = kind === '前缀'
    const limit = isPrefix ? MAX_CRAFT_PREFIX : MAX_CRAFT_SUFFIX
    setForm((f) => {
      const count = f.affixes.filter((a) => a.graftKind === kind).length
      if (count >= limit) {
        message.warning(
          formatMessage({ id: isPrefix ? 'equip.craftPrefixLimit' : 'equip.craftSuffixLimit' })
        )
        return f
      }
      const lib = entry.Library || '初阶词缀'
      if (MAX_LIB_LIBRARIES.includes(lib)) {
        const libCount = f.affixes.filter((a) => a.graftLibrary === lib).length
        if (libCount >= MAX_LIB_AFFIX_COUNT) {
          message.warning(
            formatMessage(
              { id: 'equip.craftLibLimit' },
              { lib: libLabel(lib), count: MAX_LIB_AFFIX_COUNT }
            )
          )
          return f
        }
      }
      return {
        ...f,
        affixes: [
          ...f.affixes,
          makeAffix({
            text: entry.Entry,
            graftSource: 'craft',
            graftTier: entry.Tier,
            graftKind: kind,
            graftLibrary: lib,
          }),
        ],
      }
    })
  }

  function removeNormalAffix(affixIndex) {
    setForm((f) => ({
      ...f,
      affixes: f.affixes.filter((_, i) => i !== affixIndex),
    }))
  }

  // ===== 调香词缀（腰带） / 高塔词缀（武器）=====

  function addPerfumeAffix(entry) {
    if (!entry || !entry.描述) return
    setForm((f) => {
      if (f.affixes.some((a) => a.graftSource === 'perfume' && a.text === entry.描述)) {
        return f
      }
      if (f.affixes.filter((a) => a.graftSource === 'perfume').length >= MAX_PERFUME) {
        message.warning(formatMessage({ id: 'equip.perfumeLimit' }))
        return f
      }
      return {
        ...f,
        affixes: [
          ...f.affixes,
          makeAffix({
            text: entry.描述,
            graftSource: 'perfume',
            graftItem: entry.名称,
            graftType: entry.类型,
          }),
        ],
      }
    })
  }

  function addTowerAffix(entry) {
    if (!entry || !Array.isArray(entry) || !entry[0]) return
    setForm((f) => {
      if (f.affixes.some((a) => a.graftSource === 'tower' && a.text === entry[0])) {
        return f
      }
      if (f.affixes.filter((a) => a.graftSource === 'tower').length >= MAX_TOWER) {
        message.warning(formatMessage({ id: 'equip.towerLimit' }))
        return f
      }
      return {
        ...f,
        affixes: [
          ...f.affixes,
          makeAffix({
            text: entry[0],
            graftSource: 'tower',
            graftLibrary: entry[1] || '',
          }),
        ],
      }
    })
  }

  function handleSave() {
    if (!form.name) {
      message.warning(formatMessage({ id: 'equip.missingItem' }))
      return
    }
    if (drawer.slotKey && !itemMatchesSlot(form, drawer.slotKey)) {
      message.warning(formatMessage({ id: 'equip.slotMismatch' }))
      return
    }
    const item = {
      id: drawer.inventoryId || undefined,
      category: form.category,
      subCategory: form.subCategory,
      name: form.name,
      requiredLevel: form.requiredLevel,
      baseAffix: form.baseAffix,
      affixes: form.affixes.map((a) => makeAffix(a)),
      corrupted: form.corrupted,
      imgPath: form.imgPath,
      ...(form.isGraft ? { isGraft: true, graft: form.graft } : {}),
    }
    if (drawer.slotKey) {
      const ruleError = equipRuleError(item, drawer.slotKey)
      if (ruleError) {
        message.warning(formatMessage({ id: ruleError }))
        return
      }
    }
    let id
    if (drawer.inventoryId) {
      id = drawer.inventoryId
      buildStore.updateEquipmentItem(id, item)
    } else {
      id = buildStore.addEquipmentItem(item)
    }
    if (drawer.slotKey) buildStore.setEquipmentSlot(drawer.slotKey, id)
    message.success(formatMessage({ id: 'equip.saved' }))
    closeDrawer()
  }

  function handleUnequip() {
    if (drawer.slotKey) {
      buildStore.setEquipmentSlot(drawer.slotKey, '')
      message.success(formatMessage({ id: 'equip.unequipped' }))
    }
    closeDrawer()
  }

  function handleUnequipAll() {
    buildStore.unequipAllEquipment()
    message.success(formatMessage({ id: 'equip.unequippedAll' }))
  }

  function equipInventoryItem(inventoryId) {
    if (!drawer.slotKey) return
    const item = inventoryItemOf(inventoryId)
    if (!item) return
    if (!itemMatchesSlot(item, drawer.slotKey)) {
      message.warning(formatMessage({ id: 'equip.slotMismatch' }))
      return
    }
    const ruleError = equipRuleError(item, drawer.slotKey)
    if (ruleError) {
      message.warning(formatMessage({ id: ruleError }))
      return
    }
    buildStore.setEquipmentSlot(drawer.slotKey, inventoryId)
    closeDrawer()
  }

  function handleRemoveItem(inventoryId) {
    buildStore.removeEquipmentItem(inventoryId)
    if (drawer.inventoryId === inventoryId) closeDrawer()
  }

  function handleClearInventory() {
    buildStore.resetEquipmentInventory()
  }

  function renderSlotInner(slotKey) {
    const item = inventoryItemOf(equipment[slotKey])
    return (
      <>
        {!item && <img src={SLOT_ICONS[slotKey]} alt="" className="equip__slot-bg" />}
        {item ? (
          <img src={encodeURI(item.imgPath)} alt={item.name} className="equip__slot-item" />
        ) : (
          <span className="equip__slot-plus">
            <PlusOutlined />
          </span>
        )}
      </>
    )
  }

  function renderInventoryCard(it) {
    const equippedSlotKey = SLOT_KEYS.find((k) => equipment[k] === it.id)
    const rarity = inventoryRarityOf(it)
    const graftLegendName = (a) =>
      a.graftSource === 'legend' && a.graftItem ? `（${a.graftItem}）` : ''
    return (
      <div key={it.id} className={`equip__inv-card ${inventoryCardClass(it)}`}>
        <div className="equip__inv-card-thumb">
          {it.imgPath ? (
            <img src={encodeURI(it.imgPath)} alt={it.name} className="equip__inv-card-img" />
          ) : (
            <PlusOutlined className="equip__inv-card-img-ph" />
          )}
        </div>
        <div className="equip__inv-card-main">
          <div className="equip__inv-card-head">
            <div
              className={`equip__inv-card-name ${
                rarity === 'legend' ? 'equip__inv-card-name--legend' : ''
              }`}
            >
              {it.name}
            </div>
            <span className={`equip__inv-card-rarity ${inventoryRarityClass(it)}`}>
              {formatMessage({ id: RARITY_LABEL_KEYS[rarity] })}
            </span>
          </div>
          <div className="equip__inv-card-meta">
            {it.category && <span>{it.category}</span>}
            {it.subCategory && <span> · {it.subCategory}</span>}
            {it.requiredLevel && <span> · {it.requiredLevel}</span>}
          </div>
          {equippedSlotKey && (
            <div className="equip__inv-card-equipped">
              {formatMessage({ id: 'equip.equipped' })}
            </div>
          )}
        </div>
        <div className="equip__inv-card-affixes">
          {it.baseAffix && (
            <div className="equip__inv-card-affix">{cleanAffixText(it.baseAffix)}</div>
          )}
          {(it.affixes || []).map((a, i) => {
            const tier = affixTierOf(a)
            const tierClass = tierColorClass(tier)
            return (
              <div
                key={`${affixTextOf(a)}-${i}`}
                className={`equip__inv-card-affix ${
                  a.corrupted ? 'equip__inv-card-affix--corrupted' : ''
                } ${tierClass}`}
              >
                {cleanAffixText(affixDisplayText(a))}
                {graftLegendName(a)}
                {tier !== '' && (
                  <span className={`equip__inv-card-affix-tier ${tierClass}`}>{`T${tier}`}</span>
                )}
                {a.corrupted && (
                  <span className="equip__inv-card-corrupted-tag">
                    {formatMessage({ id: 'equip.corruptedTag' })}
                  </span>
                )}
                {a.graftSource === 'legend' && (
                  <span className="equip__graft-source-tag">
                    {formatMessage({ id: 'equip.graftSourceLegend' })}
                  </span>
                )}
                {a.graftSource === 'craft' && (
                  <span className="equip__graft-source-tag">
                    {formatMessage({ id: 'equip.graftSourceCraft' })}·{a.graftKind}
                    {a.graftLibrary ? `·${libLabel(a.graftLibrary)}` : ''}
                  </span>
                )}
                {a.graftSource === 'perfume' && (
                  <span className={`equip__graft-source-tag ${perfumeTypeClass(a)}`}>
                    {formatMessage({ id: 'equip.sourcePerfume' })}·{perfumeTypeLabel(a)}
                  </span>
                )}
                {a.graftSource === 'tower' && (
                  <span className={`equip__graft-source-tag ${a.graftLibrary === '高阶序列' ? 'equip__affix--red' : 'equip__affix--orange'}`}>
                    {formatMessage({ id: 'equip.sourceTower' })}
                    {a.graftLibrary ? `·${a.graftLibrary}` : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="equip__inv-card-actions">
          <Button size="small" onClick={() => openInventoryEdit(it.id)}>
            {formatMessage({ id: 'equip.edit' })}
          </Button>
          <Button size="small" onClick={() => handleRemoveItem(it.id)}>
            {formatMessage({ id: 'equip.removeFromInventory' })}
          </Button>
        </div>
      </div>
    )
  }

  const drawerTitle = drawer.inventoryId
    ? formatMessage({ id: 'equip.editTitle' })
    : drawer.slotKey
      ? `${formatMessage({ id: 'equip.editTitle' })} · ${slotLabel(drawer.slotKey)}`
      : formatMessage({ id: 'equip.craftNewItem' })

  return (
    <div className="equip">
      <div className="equip__header">
        <h2 className="equip__title">{formatMessage({ id: 'tab.equipment' })}</h2>
        <div className="equip__header-actions">
          <Button size="small" onClick={() => modulePresetStore.openDrawer('equipment')}>
            {formatMessage({ id: 'preset.open' })}
          </Button>
          <Button size="small" disabled={!SLOT_KEYS.some((k) => equipment[k])} onClick={handleUnequipAll}>
            {formatMessage({ id: 'equip.unequipAll' })}
          </Button>
        </div>
      </div>

      <div className="equip__bar">
        <div className="equip__slots">
          <div
            className="equip__slot equip__slot--lg"
            aria-label={slotLabel('mainHand')}
            title={equipment.mainHand ? inventoryItemOf(equipment.mainHand)?.name : formatMessage({ id: 'equip.slotEmpty' })}
            onClick={() => openSlot('mainHand')}
          >
            {renderSlotInner('mainHand')}
          </div>
          <div
            className="equip__slot equip__slot--lg"
            aria-label={slotLabel('offHand')}
            title={equipment.offHand ? inventoryItemOf(equipment.offHand)?.name : formatMessage({ id: 'equip.slotEmpty' })}
            onClick={() => openSlot('offHand')}
          >
            {renderSlotInner('offHand')}
          </div>
          <div className="equip__slots-sm">
            {SMALL_SLOT_KEYS.map((k) => (
              <div
                key={k}
                className="equip__slot equip__slot--sm"
                aria-label={slotLabel(k)}
                title={equipment[k] ? inventoryItemOf(equipment[k])?.name : formatMessage({ id: 'equip.slotEmpty' })}
                onClick={() => openSlot(k)}
              >
                {renderSlotInner(k)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="equip__inventory">
        <div className="equip__inventory-head">
          <div className="equip__panel-title">
            {formatMessage({ id: 'equip.inventoryTitle' })}
          </div>
          <div className="equip__inv-toolbar">
            <Select
              className="equip__inv-filter"
              size="small"
              value={filterCategory || undefined}
              placeholder={formatMessage({ id: 'equip.filterAll' })}
              allowClear
              onChange={(v) => setFilterCategory(v || '')}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
            <Button size="small" onClick={handleClearInventory}>
              {formatMessage({ id: 'equip.clearAll' })}
            </Button>
          </div>
        </div>
        {filteredInventory.length === 0 ? (
          <div className="equip__inv-empty">{formatMessage({ id: 'equip.inventoryEmpty' })}</div>
        ) : (
          <div className="equip__inv-grid">{filteredInventory.map(renderInventoryCard)}</div>
        )}
      </div>

      <Drawer
        title={drawerTitle}
        placement="left"
        width={680}
        open={drawer.open}
        onClose={closeDrawer}
        destroyOnClose
      >
        <div className="equip__edit-body">
          <div className="equip__edit-preview">
            {form.imgPath ? (
              <img src={encodeURI(form.imgPath)} alt={form.name} className="equip__edit-preview-img" />
            ) : (
              <img
                src={drawer.slotKey ? SLOT_ICONS[drawer.slotKey] : SLOT_ICONS.mainHand}
                alt=""
                className="equip__edit-preview-icon"
              />
            )}
          </div>

          <div className="equip__edit-field equip__edit-field--browser">
            <EquipmentBrowser
              slotKey={drawer.slotKey}
              onSelect={(item) => selectEquipmentItem(item)}
              onTabChange={() => setForm(EMPTY_FORM)}
            />
          </div>

          {drawer.slotKey && slotCandidates.length > 0 && (
            <div className="equip__edit-pick">
              <div className="equip__edit-pick-title">
                {formatMessage({ id: 'equip.pickFromInventory' })}
              </div>
              <div className="equip__edit-pick-strip">
                {slotCandidates.map((it) => (
                  <div
                    key={it.id}
                    className={`equip__edit-pick-card ${
                      equippedItem?.id === it.id ? 'equip__edit-pick-card--equipped' : ''
                    }`}
                    onClick={() => equipInventoryItem(it.id)}
                  >
                    <img src={encodeURI(it.imgPath)} alt={it.name} className="equip__edit-pick-img" />
                    <div className="equip__edit-pick-name">{it.name}</div>
                    {equippedItem?.id === it.id && (
                      <div className="equip__edit-pick-badge">
                        {formatMessage({ id: 'equip.equipped' })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="equip__edit-info">
            <div className="equip__edit-info-row">
              <span className="equip__edit-info-label">{formatMessage({ id: 'equip.category' })}</span>
              <span className="equip__edit-info-value">{form.category || '--'}</span>
            </div>
            <div className="equip__edit-info-row">
              <span className="equip__edit-info-label">{formatMessage({ id: 'equip.subCategory' })}</span>
              <span className="equip__edit-info-value">{form.subCategory || '--'}</span>
            </div>
            <div className="equip__edit-info-row">
              <span className="equip__edit-info-label">{formatMessage({ id: 'equip.requiredLevel' })}</span>
              <span className="equip__edit-info-value">{form.requiredLevel || '--'}</span>
            </div>
          </div>

          {form.isGraft && (
            <div className="equip__graft">
              <div className="equip__graft-base">
                <div className="equip__edit-affixes-title">
                  {formatMessage({ id: 'equip.baseAffix' })}
                </div>
                <Select
                  className="equip__graft-select"
                  size="small"
                  showSearch
                  allowClear
                  placeholder={formatMessage({ id: 'equip.graftPickBase' })}
                  value={form.baseAffix || undefined}
                  filterOption={filterAffixOption}
                  onChange={(v) => {
                    const e = basePool.find((b) => b.Entry === v)
                    selectGraftBase(e || null)
                  }}
                  options={basePool.map((b) => ({
                    value: b.Entry,
                    text: b.Entry,
                    label: renderAffixOption(b),
                  }))}
                />
              </div>

              <div className="equip__graft-legend">
                <div className="equip__edit-affixes-title">
                  {formatMessage({ id: 'equip.graftLegend' })}
                </div>
                <Select
                  className="equip__graft-select"
                  size="small"
                  showSearch
                  placeholder={formatMessage({ id: 'equip.graftPickLegend' })}
                  value={form.graft.legendItem || undefined}
                  filterOption={(input, option) =>
                    (option?.text || '').toLowerCase().includes((input || '').toLowerCase())
                  }
                  onChange={selectGraftLegendItem}
                  options={graftLegendPoolOf(form.graft.part).map((l) => ({
                    value: l.key,
                    text: l.name,
                    label: l.name,
                  }))}
                />
                {legendItem && legendItem.affixes.length > 0 && (
                  <div className="equip__graft-legend-affixes">
                    {legendItem.affixes.map((text) => {
                      const active = form.affixes.some(
                        (a) => a.graftSource === 'legend' && a.text === text
                      )
                      return (
                        <button
                          key={text}
                          type="button"
                          className={`equip__graft-legend-affix ${
                            active ? 'is-active' : ''
                          }`}
                          onClick={() => toggleGraftLegendAffix(text)}
                        >
                          {cleanAffixText(text)}
                          {active && (
                            <span className="equip__graft-legend-count">✓</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="equip__graft-craft">
                <div className="equip__edit-affixes-title">
                  {formatMessage({ id: 'equip.graftCraft' })}
                </div>
                <div className="equip__graft-craft-row">
                  <Select
                    className="equip__graft-select"
                    size="small"
                    showSearch
                    placeholder={formatMessage({ id: 'equip.graftPrefix' })}
                    value={undefined}
                    filterOption={filterAffixOption}
                    onChange={(v) => {
                      const e = craftPool.prefix[v]
                      if (e) addGraftCrafted(e, '前缀')
                    }}
                    options={affixOptionGroups(craftPool.prefix, selectedAffixFamilies, libLabel)}
                  />
                  <Select
                    className="equip__graft-select"
                    size="small"
                    showSearch
                    placeholder={formatMessage({ id: 'equip.graftSuffix' })}
                    value={undefined}
                    filterOption={filterAffixOption}
                    onChange={(v) => {
                      const e = craftPool.suffix[v]
                      if (e) addGraftCrafted(e, '后缀')
                    }}
                    options={affixOptionGroups(craftPool.suffix, selectedAffixFamilies, libLabel)}
                  />
                </div>
              </div>
            </div>
          )}

          {form.isGraft ? (
            <>
              {form.baseAffix && (
                <div className="equip__edit-affixes">
                  <div className="equip__edit-affixes-title">
                    {formatMessage({ id: 'equip.baseAffix' })}
                  </div>
                  <div className="equip__edit-affix">{cleanAffixText(form.baseAffix)}</div>
                </div>
              )}
              {form.affixes.length > 0 && (
                <div className="equip__edit-affixes">
                  <div className="equip__edit-affixes-title">
                    {formatMessage({ id: 'equip.affixes' })}（{form.affixes.length}/
                    {MAX_GRAFT_AFFIXES}）
                  </div>
                  {form.affixes.map((a, i) => (
                    <div
                      key={`${affixTextOf(a)}-${i}`}
                      className={`equip__edit-affix ${tierColorClass(affixTierOf(a))}`}
                    >
                      <div className="equip__edit-affix-row">
                        <div className="equip__edit-affix-text">
                          {cleanAffixText(affixDisplayText(a))}
                          {a.graftSource === 'legend' && (
                            <span className="equip__graft-source-tag">
                              {formatMessage({ id: 'equip.graftSourceLegend' })}
                            </span>
                          )}
                          {a.graftSource === 'craft' && (
                            <span className="equip__graft-source-tag">
                              {formatMessage({ id: 'equip.graftSourceCraft' })}·{a.graftKind}
                              {a.graftLibrary ? `·${libLabel(a.graftLibrary)}` : ''}
                            </span>
                          )}
                        </div>
                        <Button
                          size="small"
                          className="equip__edit-affix-erode"
                          onClick={() => removeGraftAffix(i)}
                        >
                          {formatMessage({ id: 'equip.graftRemove' })}
                        </Button>
                      </div>
                      <AffixRangeSliders affix={a} onChange={(j, v) => updateAffixValue(i, j, v)} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : form.isNormal ? (
            <>
              <div className="equip__graft">
                <div className="equip__graft-base">
                  <div className="equip__edit-affixes-title">
                    {formatMessage({ id: 'equip.baseAffix' })}
                  </div>
                  <Select
                    className="equip__graft-select"
                    size="small"
                    showSearch
                    allowClear
                    placeholder={formatMessage({ id: 'equip.normalPickBase' })}
                    value={form.baseAffix || undefined}
                    filterOption={filterAffixOption}
                    onChange={(v) => {
                      const e = normalBasePool.find((b) => (b.Entry || b.text) === v)
                      selectNormalBase(e || null)
                    }}
                    options={normalBaseOptions}
                  />
                </div>

                {isBelt && perfumePool.length > 0 && (
                  <div className="equip__graft-perfume">
                    <div className="equip__edit-affixes-title">
                      {formatMessage({ id: 'equip.perfume' })}（
                      {form.affixes.filter((a) => a.graftSource === 'perfume').length}/{MAX_PERFUME}）
                    </div>
                    <Select
                      className="equip__graft-select"
                      size="small"
                      showSearch
                      placeholder={formatMessage({ id: 'equip.perfumePick' })}
                      value={undefined}
                      filterOption={(input, option) =>
                        (option?.text || '').toLowerCase().includes((input || '').toLowerCase())
                      }
                      onChange={(v) => {
                        const e = perfumePool[v]
                        if (e) addPerfumeAffix(e)
                      }}
                      options={perfumePool.map((e, i) => ({
                        value: i,
                        text: `${e.名称} ${e.描述}`,
                        label: renderPerfumeOption(e),
                      }))}
                    />
                    {form.affixes
                      .map((a, i) => ({ a, i }))
                      .filter(({ a }) => a.graftSource === 'perfume')
                      .map(({ a, i }) => (
                        <div
                          key={`${affixTextOf(a)}-${i}`}
                          className={`equip__edit-affix ${perfumeTypeClass(a)}`}
                        >
                          <div className="equip__edit-affix-row">
                            <div className="equip__edit-affix-text">
                              {cleanAffixText(affixDisplayText(a))}
                              <span className={`equip__graft-source-tag ${perfumeTypeClass(a)}`}>
                                {formatMessage({ id: 'equip.sourcePerfume' })}·{perfumeTypeLabel(a)}
                              </span>
                            </div>
                            <Button
                              size="small"
                              className="equip__edit-affix-erode"
                              onClick={() => removeNormalAffix(i)}
                            >
                              {formatMessage({ id: 'equip.graftRemove' })}
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {isTowerSubCategory(form.subCategory) && towerPool.length > 0 && (
                  <div className="equip__graft-tower">
                    <div className="equip__edit-affixes-title">
                      {formatMessage({ id: 'equip.tower' })}（
                      {form.affixes.filter((a) => a.graftSource === 'tower').length}/{MAX_TOWER}）
                    </div>
                    <Select
                      className="equip__graft-select"
                      size="small"
                      showSearch
                      placeholder={formatMessage({ id: 'equip.towerPick' })}
                      value={undefined}
                      filterOption={filterAffixOption}
                      onChange={(v) => {
                        const e = towerPool[v]
                        if (e) addTowerAffix(e)
                      }}
                      options={towerPool.map((e, i) => ({
                        value: i,
                        text: e[0],
                        label: renderTowerOption(e),
                      }))}
                    />
                    {form.affixes
                      .map((a, i) => ({ a, i }))
                      .filter(({ a }) => a.graftSource === 'tower')
                      .map(({ a, i }) => (
                        <div
                          key={`${affixTextOf(a)}-${i}`}
                          className={`equip__edit-affix ${
                            a.graftLibrary === '高阶序列' ? 'equip__affix--red' : 'equip__affix--orange'
                          }`}
                        >
                          <div className="equip__edit-affix-row">
                            <div className="equip__edit-affix-text">
                              {cleanAffixText(affixDisplayText(a))}
                              <span
                                className={`equip__graft-source-tag ${
                                  a.graftLibrary === '高阶序列'
                                    ? 'equip__affix--red'
                                    : 'equip__affix--orange'
                                }`}
                              >
                                {formatMessage({ id: 'equip.sourceTower' })}
                                {a.graftLibrary ? `·${a.graftLibrary}` : ''}
                              </span>
                            </div>
                            <Button
                              size="small"
                              className="equip__edit-affix-erode"
                              onClick={() => removeNormalAffix(i)}
                            >
                              {formatMessage({ id: 'equip.graftRemove' })}
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <div className="equip__graft-craft">
                  <div className="equip__edit-affixes-title">
                    {formatMessage({ id: 'equip.normalCraft' })}
                  </div>
                  <div className="equip__graft-craft-row">
                    <Select
                      className="equip__graft-select"
                      size="small"
                      showSearch
                      placeholder={formatMessage({ id: 'equip.graftPrefix' })}
                      value={undefined}
                      filterOption={filterAffixOption}
                      onChange={(v) => {
                        const e = normalCraftPool.prefix[v]
                        if (e) addNormalCrafted(e, '前缀')
                      }}
                      options={affixOptionGroups(normalCraftPool.prefix, selectedAffixFamilies, libLabel)}
                    />
                    <Select
                      className="equip__graft-select"
                      size="small"
                      showSearch
                      placeholder={formatMessage({ id: 'equip.graftSuffix' })}
                      value={undefined}
                      filterOption={filterAffixOption}
                      onChange={(v) => {
                        const e = normalCraftPool.suffix[v]
                        if (e) addNormalCrafted(e, '后缀')
                      }}
                      options={affixOptionGroups(normalCraftPool.suffix, selectedAffixFamilies, libLabel)}
                    />
                  </div>
                </div>
              </div>

              {form.affixes.some((a) => a.graftSource === 'craft') && (
                <div className="equip__edit-affixes">
                  <div className="equip__edit-affixes-title">
                    {formatMessage({ id: 'equip.normalCraftAffixes' })}（
                    {form.affixes.filter((a) => a.graftSource === 'craft').length}/
                    {MAX_CRAFT_PREFIX + MAX_CRAFT_SUFFIX}）
                  </div>
                  {form.affixes
                    .map((a, i) => ({ a, i }))
                    .filter(({ a }) => a.graftSource === 'craft')
                    .map(({ a, i }) => (
                    <div
                      key={`${affixTextOf(a)}-${i}`}
                      className={`equip__edit-affix ${tierColorClass(affixTierOf(a))}`}
                    >
                      <div className="equip__edit-affix-row">
                        <div className="equip__edit-affix-text">
                          {cleanAffixText(affixDisplayText(a))}
                          <span className="equip__graft-source-tag">
                            {formatMessage({ id: 'equip.graftSourceCraft' })}·{a.graftKind}
                            {a.graftLibrary ? `·${libLabel(a.graftLibrary)}` : ''}
                          </span>
                        </div>
                        <Button
                          size="small"
                          className="equip__edit-affix-erode"
                          onClick={() => removeNormalAffix(i)}
                        >
                          {formatMessage({ id: 'equip.graftRemove' })}
                        </Button>
                      </div>
                      <AffixRangeSliders affix={a} onChange={(j, v) => updateAffixValue(i, j, v)} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {form.baseAffix && (
                <div className="equip__edit-affixes">
                  <div className="equip__edit-affixes-title">{formatMessage({ id: 'equip.baseAffix' })}</div>
                  <div className="equip__edit-affix">{cleanAffixText(form.baseAffix)}</div>
                </div>
              )}

              {form.affixes.length > 0 && (
                <div className="equip__edit-affixes">
                  <div className="equip__edit-affixes-title">{formatMessage({ id: 'equip.affixes' })}</div>
                  {form.affixes.map((a, i) => (
                    <div
                      key={`${affixTextOf(a)}-${i}`}
                      className={`equip__edit-affix ${a.corrupted ? 'equip__edit-affix--corrupted' : ''}`}
                    >
                      <div className="equip__edit-affix-row">
                        <div className="equip__edit-affix-text">
                          {cleanAffixText(affixDisplayText(a))}
                          {a.corrupted && (
                            <span className="equip__edit-affix-corrupted-tag">
                              {formatMessage({ id: 'equip.corruptedTag' })}
                            </span>
                          )}
                        </div>
                        {form.canCorrupt && (
                          <Button
                            size="small"
                            className="equip__edit-affix-erode"
                            onClick={() => toggleAffixCorrupted(i)}
                          >
                            {a.corrupted
                              ? formatMessage({ id: 'equip.uncorrupt' })
                              : formatMessage({ id: 'equip.corrupt' })}
                          </Button>
                        )}
                      </div>
                      <AffixRangeSliders affix={a} onChange={(j, v) => updateAffixValue(i, j, v)} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="equip__edit-actions">
            <Button type="primary" className="equip__edit-save" onClick={handleSave}>
              {formatMessage({ id: 'equip.saveToInventory' })}
            </Button>
            {drawer.slotKey && equippedItem && (
              <Button onClick={handleUnequip}>{formatMessage({ id: 'equip.remove' })}</Button>
            )}
            <Button onClick={closeDrawer}>{formatMessage({ id: 'app.close' })}</Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}

// 词缀 Tier：传奇装备/渴瘾传奇词缀无 Tier 返回 ''；打造词缀（含渴瘾打造）返回 graftTier 用于着色
function affixTierOf(a) {
  if (!a) return ''
  if (a.graftTier !== undefined) return String(a.graftTier)
  return ''
}

export default observer(EquipmentPage)
