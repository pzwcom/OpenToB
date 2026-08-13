import { useMemo, useState } from 'react'
import { useIntl } from 'react-intl'
import { RightOutlined, SearchOutlined } from '@ant-design/icons'
import legendEquipData from '../../assets/json/装备/传奇装备/传奇装备.json'
import normalEquipData from '../../assets/json/装备/普通装备/普通装备.json'
import { GRAFT_PARTS, graftImgPath, graftSubCategory } from '../../data/graftData.js'
import { itemMatchesSlot } from '../../utils/equipSlot.js'
import './EquipmentBrowser.less'

// 图鉴分类树：组 → 细分类列表（仅渲染数据中存在的细分类）
const CATEGORY_GROUPS = [
  {
    key: 'oneHand',
    labelKey: 'equip.browserGroup.oneHand',
    subs: ['爪', '匕首', '单手剑', '单手锤', '单手斧', '法杖', '灵杖', '魔杖', '手杖', '手枪'],
  },
  {
    key: 'shield',
    labelKey: 'equip.browserGroup.shield',
    subs: ['力量盾牌', '敏捷盾牌', '智慧盾牌'],
  },
  {
    key: 'twoHand',
    labelKey: 'equip.browserGroup.twoHand',
    subs: ['双手剑', '双手锤', '双手斧', '锡杖', '武杖', '弓', '弩', '火枪', '火炮'],
  },
  {
    key: 'helmet',
    labelKey: 'equip.browserGroup.helmet',
    subs: ['力量头盔', '敏捷头盔', '智慧头盔'],
  },
  {
    key: 'chest',
    labelKey: 'equip.browserGroup.chest',
    subs: ['力量胸甲', '敏捷胸甲', '智慧胸甲'],
  },
  {
    key: 'gloves',
    labelKey: 'equip.browserGroup.gloves',
    subs: ['力量手套', '敏捷手套', '智慧手套'],
  },
  {
    key: 'boots',
    labelKey: 'equip.browserGroup.boots',
    subs: ['力量靴子', '敏捷靴子', '智慧靴子'],
  },
  {
    key: 'trinket',
    labelKey: 'equip.browserGroup.trinket',
    subs: ['项链', '戒指', '腰带', '灵魂戒指'],
  },
]

const TABS = [
  { key: 'legend', labelKey: 'equip.browserLegend' },
  { key: 'normal', labelKey: 'equip.browserNormal' },
  { key: 'graft', labelKey: 'equip.browserGraft' },
]

// 渴瘾装备：10 个身体部位，按「渴瘾肢体/渴瘾异肢」分组，无需求等级
const GRAFT_ITEMS = GRAFT_PARTS.map((part) => ({
  key: part,
  name: part,
  category: '渴瘾装备',
  subCategory: graftSubCategory(part),
  level: null,
  imgPath: graftImgPath(part),
}))

const GRAFT_GROUPS = [
  { key: 'graftLimb', labelKey: 'equip.browserGraftLimb', subs: ['渴瘾肢体'] },
  { key: 'graftEcto', labelKey: 'equip.browserGraftEcto', subs: ['渴瘾异肢'] },
]

function parseLevel(requiredLevel) {
  const m = /(\d+)/.exec(requiredLevel || '')
  return m ? Number(m[1]) : null
}

const toItem = (d, key) => ({
  key,
  name: d.物品名称 || key,
  category: d.类别 || '',
  subCategory: d.细分类 || '',
  level: parseLevel(d.需求等级),
  imgPath: d.图片地址 || '',
})

const LEGEND_ITEMS = Object.entries(legendEquipData).map(([key, d]) => toItem(d, key))
const NORMAL_ITEMS = Object.entries(normalEquipData).map(([key, d]) => toItem(d, key))

export default function EquipmentBrowser({ onSelect, onTabChange, slotKey }) {
  const { formatMessage } = useIntl()
  const [tab, setTab] = useState('legend')
  const [query, setQuery] = useState('')
  const [activeSub, setActiveSub] = useState('')
  const [collapsed, setCollapsed] = useState(() => new Set())

  const allItems = useMemo(
    () => (tab === 'legend' ? LEGEND_ITEMS : tab === 'normal' ? NORMAL_ITEMS : GRAFT_ITEMS),
    [tab]
  )

  // 槽位过滤：仅展示匹配当前槽位的装备，分类树随过滤结果只渲染相关分组。
  // 渴瘾装备按部位名匹配槽位（脑部→头盔、手部→手套 等），与传奇/普通装备一致。
  const slotItems = useMemo(() => {
    if (!slotKey) return allItems
    return allItems.filter((i) => itemMatchesSlot(i, slotKey))
  }, [allItems, slotKey])

  const groups = useMemo(() => {
    const available = new Set(slotItems.map((i) => i.subCategory).filter(Boolean))
    const defs = tab === 'graft' ? GRAFT_GROUPS : CATEGORY_GROUPS
    return defs.map((g) => ({ ...g, subs: g.subs.filter((s) => available.has(s)) })).filter(
      (g) => g.subs.length > 0
    )
  }, [slotItems, tab])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = activeSub
      ? slotItems.filter((i) => i.subCategory === activeSub)
      : slotItems
    const result = q
      ? list.filter(
          (i) =>
            i.name.toLowerCase().includes(q) || i.subCategory.toLowerCase().includes(q)
        )
      : list
    return result.sort(
      (a, b) => (b.level ?? -1) - (a.level ?? -1) || a.name.localeCompare(b.name, 'zh')
    )
  }, [slotItems, query, activeSub])

  function switchTab(next) {
    if (next === tab) return
    setTab(next)
    setQuery('')
    setActiveSub('')
    onTabChange?.(next)
  }

  function toggleGroup(key) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="equipb">
      <div className="equipb__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`equipb__tab ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            {formatMessage({ id: t.labelKey })}
          </button>
        ))}
      </div>

      <div className="equipb__pane">
        <div className="equipb__tree">
          <div
            className={`equipb__node ${activeSub === '' ? 'is-active' : ''}`}
            onClick={() => setActiveSub('')}
          >
            <span className="equipb__node-text">{formatMessage({ id: 'equip.browserAll' })}</span>
          </div>
          {groups.map((g) => {
            const open = !collapsed.has(g.key)
            return (
              <div key={g.key} className="equipb__group-block">
                <div className="equipb__group" onClick={() => toggleGroup(g.key)}>
                  <RightOutlined className={`equipb__group-arrow ${open ? 'is-open' : ''}`} />
                  <span className="equipb__group-text">
                    {formatMessage({ id: g.labelKey })}
                  </span>
                </div>
                {open &&
                  g.subs.map((s) => (
                    <div
                      key={s}
                      className={`equipb__sub ${activeSub === s ? 'is-active' : ''}`}
                      onClick={() => setActiveSub(s)}
                    >
                      <span className="equipb__sub-guide" />
                      <span className="equipb__sub-text">{s}</span>
                    </div>
                  ))}
              </div>
            )
          })}
        </div>

        <div className="equipb__list">
          <div className="equipb__search">
            <input
              className="equipb__search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={formatMessage({ id: 'equip.browserSearch' })}
            />
            <SearchOutlined className="equipb__search-icon" />
          </div>
          <div className="equipb__items">
            {filtered.length === 0 && (
              <div className="equipb__empty">{formatMessage({ id: 'equip.browserEmpty' })}</div>
            )}
            {filtered.map((item) => (
              <button
                key={item.key}
                type="button"
                className="equipb__item"
                onClick={() => onSelect?.(item)}
              >
                <div
                  className={`equipb__item-frame ${
                    tab === 'normal' ? 'equipb__item-frame--normal' : ''
                  } ${tab === 'graft' ? 'equipb__item-frame--graft' : ''}`}
                >
                  {item.imgPath && (
                    <img src={encodeURI(item.imgPath)} alt={item.name} className="equipb__item-img" />
                  )}
                </div>
                <span className="equipb__item-name">{item.name}</span>
                {item.level != null && (
                  <span className="equipb__item-level">
                    {formatMessage({ id: 'equip.browserLevel' }, { level: item.level })}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
