import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Select } from 'antd'
import BaseButton from '../ui/BaseButton.jsx'
import SlatePreview from './SlatePreview.jsx'
import { cleanAffixText } from '../../utils/affixText.js'
import { createSlateId, NETHER_KING_SHAPES } from '../../data/divinityData.js'
import netherKingSlatesData from '../../assets/json/装备/神格石板/冥王天赋/冥王神格石板.json'
import netherKingNodesData from '../../assets/json/装备/神格石板/冥王天赋/冥王天赋点.json'
import banishmentBaseData from '../../assets/json/装备/神格石板/冥王天赋/放逐基底词缀.json'

const SMALL_CATEGORY = { key: '小型冥王天赋点', labelId: 'divinity.netherKing.small' }

const ALL_CATEGORIES = [
  SMALL_CATEGORY,
  { key: '中型冥王天赋点', labelId: 'divinity.netherKing.medium' },
  { key: '传奇中型冥王天赋点', labelId: 'divinity.netherKing.legendaryMedium' },
  { key: '至臻冥王天赋点', labelId: 'divinity.netherKing.supreme' },
]

const CATEGORY_COLOR = {
  '小型冥王天赋点': '#60a5fa',
  '中型冥王天赋点': '#c084fc',
  '传奇中型冥王天赋点': '#fb923c',
  '至臻冥王天赋点': '#f87171',
}

const POWER_KEYWORDS = ['侵染效果激活时', '放逐效果激活时', '审判效果激活时']

function getTypeKeyword(typeName) {
  if (typeName.includes('审判')) return '审判效果激活时'
  if (typeName.includes('侵染') || typeName.includes('浸染')) return '侵染效果激活时'
  if (typeName.includes('放逐')) return '放逐效果激活时'
  return ''
}

const TRAIT_MSG = {
  '审判效果激活时': 'divinity.netherKingTrait.judgment',
  '侵染效果激活时': 'divinity.netherKingTrait.infection',
}

function getTraitItems(typeName) {
  if (typeName.includes('放逐')) {
    return Object.entries(banishmentBaseData).map(([name, item]) => ({
      name,
      desc: (item.描述 || '').split(';').map((s) => cleanAffixText(s)).filter(Boolean),
    }))
  }
  const msgId = TRAIT_MSG[getTypeKeyword(typeName)]
  return msgId ? [{ msgId }] : []
}

function getCategoryOptions(categoryKey, typeName) {
  const nodes = netherKingNodesData[categoryKey] || []
  if (categoryKey !== '至臻冥王天赋点') return nodes
  const keyword = getTypeKeyword(typeName)
  return nodes.filter((n) => {
    if (!POWER_KEYWORDS.some((k) => n.词缀.includes(k))) return true
    return !!keyword && n.词缀.includes(keyword)
  })
}

const INCOMPLETE_TYPES = [
  {
    name: '冥王的残缺神格：审判',
    shape: 'NetherKingJudgmentIncomplete',
    slotCount: 2,
    categories: [SMALL_CATEGORY],
    image: netherKingSlatesData['冥王的神格：审判'].图片地址,
  },
  {
    name: '冥王的残缺神格：浸染',
    shape: 'NetherKingInfectionIncomplete',
    slotCount: 2,
    categories: [SMALL_CATEGORY],
    image: netherKingSlatesData['冥王的神格：侵染'].图片地址,
  },
]

const COMPLETE_TYPES = Object.entries(netherKingSlatesData).map(([name, data]) => ({
  name,
  shape: NETHER_KING_SHAPES[name],
  slotCount: 3,
  categories: ALL_CATEGORIES,
  image: data.图片地址,
}))

const TYPE_LIST = [...COMPLETE_TYPES, ...INCOMPLETE_TYPES]

export default function NetherKingSlateCrafter({ onSave }) {
  const { formatMessage } = useIntl()
  const [selectedType, setSelectedType] = useState(null)
  const [slotSelections, setSlotSelections] = useState([])
  const [inherentSelection, setInherentSelection] = useState(null)

  const currentType = TYPE_LIST.find((t) => t.name === selectedType) || null

  function selectType(name) {
    const type = TYPE_LIST.find((t) => t.name === name)
    setSelectedType(name)
    setSlotSelections(type ? Array.from({ length: type.slotCount }, () => null) : [])
    setInherentSelection(null)
  }

  function findNode(talentId) {
    if (!currentType) return null
    for (const { key } of currentType.categories) {
      const node = (netherKingNodesData[key] || []).find(
        (n) => n.talent_id === talentId
      )
      if (node) return { category: key, node }
    }
    return null
  }

  function handleInherentChange(talentId) {
    if (!talentId) {
      setInherentSelection(null)
      return
    }
    setInherentSelection(findNode(talentId))
  }

  function handleSlotChange(slotIdx, talentId) {
    if (!currentType) return
    setSlotSelections((arr) => {
      const next = [...arr]
      if (!talentId) {
        next[slotIdx] = null
        return next
      }
      next[slotIdx] = findNode(talentId)
      return next
    })
  }

  function saveSlate() {
    if (!currentType) return
    const affixes = slotSelections.map((sel, i) => ({
      slotIndex: i,
      nodeType: sel ? sel.category : '',
      text: sel ? sel.node.词缀 : '',
    }))
    onSave({
      id: createSlateId(),
      isNetherKing: true,
      netherKingName: selectedType,
      inherentAffix: inherentSelection ? inherentSelection.node.词缀 : '',
      shape: currentType.shape,
      rotation: 0,
      flippedH: false,
      flippedV: false,
      affixes,
      isLegendary: true,
      legendaryName: selectedType,
      god: undefined,
    })
    setSelectedType(null)
    setSlotSelections([])
    setInherentSelection(null)
  }

  function renderAffixSelect(value, onChange) {
    const takenIds = new Set()
    for (const sel of slotSelections) {
      if (sel && sel.node.talent_id !== value) takenIds.add(sel.node.talent_id)
    }
    if (inherentSelection && inherentSelection.node.talent_id !== value) {
      takenIds.add(inherentSelection.node.talent_id)
    }
    return (
      <Select
        className="divinity-nether-select"
        size="small"
        showSearch
        placeholder={formatMessage({ id: 'divinity.netherKingCrafter.selectAffix' })}
        filterOption={(input, option) =>
          String(option?.label || '')
            .toLowerCase()
            .includes(String(input).toLowerCase())
        }
        notFoundContent={formatMessage({ id: 'divinity.netherKingCrafter.noAffix' })}
        value={value || undefined}
        onChange={onChange}
      >
        {currentType.categories.map(({ key, labelId }) => (
          <Select.OptGroup key={key} label={formatMessage({ id: labelId })}>
            {getCategoryOptions(key, currentType.name).map((n) => (
              <Select.Option
                key={n.talent_id}
                value={n.talent_id}
                label={n.词缀}
                disabled={n.talent_id !== value && takenIds.has(n.talent_id)}
              >
                <span style={{ color: CATEGORY_COLOR[key] }}>{n.词缀}</span>
              </Select.Option>
            ))}
          </Select.OptGroup>
        ))}
      </Select>
    )
  }

  return (
    <div className="divinity-panel">
      <h3 className="divinity-panel__title divinity-panel__title--amber">
        {formatMessage({ id: 'divinity.netherKingCrafter.title' })}
      </h3>

      <div>
        <label className="divinity-label">{formatMessage({ id: 'divinity.netherKingCrafter.type' })}</label>
        <div className="divinity-template-list">
          {TYPE_LIST.map((type) => (
            <button
              key={type.name}
              type="button"
              className={`divinity-template-btn ${
                selectedType === type.name ? 'divinity-template-btn--active' : ''
              }`}
              onClick={() => selectType(type.name)}
            >
              <img src={type.image} className="divinity-nether-type__img" alt="" />
              <span className="divinity-template-btn__name">{type.name}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedType && currentType && (
        <>
          {getTraitItems(currentType.name).length > 0 && (
            <div>
              <label className="divinity-label">
                {formatMessage({ id: 'divinity.netherKingCrafter.trait' })}
              </label>
              <div className="divinity-special-list">
                {getTraitItems(currentType.name).map((item, ti) =>
                  item.msgId ? (
                    <div key={ti} className="divinity-special-item divinity-special-item--nether">
                      {formatMessage({ id: item.msgId })}
                    </div>
                  ) : (
                    <div key={ti} className="divinity-special-item divinity-special-item--nether">
                      <div className="divinity-affix-opt-core__name">{item.name}</div>
                      {item.desc.map((line, li) => (
                        <div key={li} className="divinity-affix-opt-core__desc">{line}</div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <div className="divinity-preview-box">
            <SlatePreview
              slate={{
                shape: currentType.shape,
                rotation: 0,
                flippedH: false,
                flippedV: false,
                isNetherKing: true,
                isLegendary: true,
              }}
              size="md"
            />
          </div>

          <div>
            <label className="divinity-label">
              {formatMessage({ id: 'divinity.netherKingCrafter.inherentAffix' })}
            </label>
            {renderAffixSelect(inherentSelection ? inherentSelection.node.talent_id : '', handleInherentChange)}
          </div>

          <div>
            <label className="divinity-label">
              {formatMessage({ id: 'divinity.netherKingCrafter.slots' }, { count: currentType.slotCount })}
            </label>
            <div className="divinity-affix-list">
              {slotSelections.map((sel, si) => (
                <div key={si} className="divinity-affix-row">
                  <span className="divinity-affix-idx">#{si + 1}</span>
                  {renderAffixSelect(sel ? sel.node.talent_id : '', (v) => handleSlotChange(si, v))}
                </div>
              ))}
            </div>
          </div>

          <BaseButton variant="primary" size="sm" className="divinity-btn-full" onClick={saveSlate}>
            {formatMessage({ id: 'divinity.netherKingCrafter.save' })}
          </BaseButton>
        </>
      )}
    </div>
  )
}
