import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Select } from 'antd'
import BaseButton from '../ui/BaseButton.jsx'
import SlatePreview from './SlatePreview.jsx'
import {
  GODS,
  GOD_NAMES,
  MAX_SLATE_AFFIXES,
  REGULAR_SHAPES,
  SHAPE_DEFS,
  createSlateId,
  getGodColor,
} from '../../data/divinityData.js'
import nonLegendarySlatesData from '../../assets/json/装备/神格石板/非传奇神格石板词缀.json'

// 普通石板只有三种天赋：小型 / 中型 / 传奇中型，不含核心天赋
const AFFIX_TYPES = ['小型天赋', '中型天赋', '传奇中型天赋']

const TYPE_GROUP_IDS = {
  小型天赋: 'divinity.crafter.microGroup',
  中型天赋: 'divinity.crafter.mediumGroup',
  传奇中型天赋: 'divinity.crafter.legendaryGroup',
}

const TYPE_COLOR = {
  小型天赋: '#60a5fa',
  中型天赋: '#c084fc',
  传奇中型天赋: '#fb923c',
}

// 前端神 key -> 爬取数据中的中文神名
const GOD_DATA_KEYS = {
  Might: '巨力之神',
  Hunting: '狩猎之神',
  Knowledge: '知识之神',
  War: '征战之神',
  Deception: '欺诈之神',
  Machines: '机械之神',
}

// 每个神的天赋池：来自该神天赋树下的所有分支（如 狩猎之神/神射手/刀锋行者/德鲁伊/刺客），
// 仅保留 小型/中型/传奇中型 三种天赋；同一词缀文本跨分支重复时去重。
const TALENT_POOL_BY_GOD = (() => {
  const pool = {}
  for (const godKey of GODS) {
    const godName = GOD_DATA_KEYS[godKey]
    const godData = godName ? nonLegendarySlatesData[godName] : null
    const groups = { 小型天赋: [], 中型天赋: [], 传奇中型天赋: [] }
    const seen = { 小型天赋: new Set(), 中型天赋: new Set(), 传奇中型天赋: new Set() }
    if (godData) {
      for (const [, nodes] of Object.entries(godData)) {
        for (const node of nodes) {
          const type = node.天赋类型
          if (!AFFIX_TYPES.includes(type)) continue
          const text = node.天赋词缀
          if (!text || seen[type].has(text)) continue
          seen[type].add(text)
          groups[type].push({ text })
        }
      }
    }
    pool[godKey] = groups
  }
  return pool
})()

function typeOfText(godKey, text) {
  const groups = TALENT_POOL_BY_GOD[godKey]
  if (!groups || !text) return ''
  for (const type of AFFIX_TYPES) {
    if (groups[type].some((n) => n.text === text)) return type
  }
  return ''
}

export default function SlateCrafter({ onSave }) {
  const { formatMessage } = useIntl()
  const [selectedGod, setSelectedGod] = useState('Might')
  const [selectedShape, setSelectedShape] = useState('O')
  const [selectedRotation, setSelectedRotation] = useState(0)
  const [selectedFlippedH, setSelectedFlippedH] = useState(false)
  const [selectedFlippedV, setSelectedFlippedV] = useState(false)
  const [affixSlots, setAffixSlots] = useState(() =>
    Array.from({ length: MAX_SLATE_AFFIXES }, (_, i) => ({ slotIndex: i, nodeType: '', text: '' }))
  )

  const talentGroups = TALENT_POOL_BY_GOD[selectedGod] || {
    小型天赋: [],
    中型天赋: [],
    传奇中型天赋: [],
  }

  const selectedAffixCount = affixSlots.filter((a) => a.text).length

  const takenTexts = new Set(affixSlots.map((a) => a.text).filter(Boolean))

  function updateAffix(idx, value) {
    setAffixSlots((arr) => {
      const next = [...arr]
      const type = typeOfText(selectedGod, value)
      next[idx] = { slotIndex: idx, nodeType: type, text: value }
      return next
    })
  }

  function saveSlate() {
    const cellCount = SHAPE_DEFS[selectedShape]?.cells.length || 4
    const actualAffixes = affixSlots.slice(0, cellCount).filter((a) => a.text)
    const affixes = []
    for (let i = 0; i < cellCount; i++) {
      const a = actualAffixes.find((x) => x.slotIndex === i)
      affixes.push(a ? { ...a } : { slotIndex: i, nodeType: '', text: '' })
    }
    onSave({
      id: createSlateId(),
      god: selectedGod,
      shape: selectedShape,
      rotation: selectedRotation,
      flippedH: selectedFlippedH,
      flippedV: selectedFlippedV,
      affixes,
      isLegendary: false,
    })
    setAffixSlots(Array.from({ length: MAX_SLATE_AFFIXES }, (_, i) => ({ slotIndex: i, nodeType: '', text: '' })))
  }

  return (
    <div className="divinity-panel">
      <h3 className="divinity-panel__title">{formatMessage({ id: 'divinity.crafter.title' })}</h3>

      <div>
        <label className="divinity-label">{formatMessage({ id: 'divinity.crafter.god' })}</label>
        <div className="divinity-chip-row">
          {GODS.map((god) => (
            <button
              key={god}
              type="button"
              className={`divinity-chip ${god === selectedGod ? 'divinity-chip--active' : ''}`}
              style={
                god === selectedGod
                  ? {
                      backgroundColor: getGodColor(god).fill,
                      borderColor: getGodColor(god).stroke,
                      color: getGodColor(god).stroke,
                    }
                  : undefined
              }
              onClick={() => setSelectedGod(god)}
            >
              {GOD_NAMES[god]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="divinity-label">{formatMessage({ id: 'divinity.crafter.shape' })}</label>
        <div className="divinity-shape-row">
          <div className="divinity-chip-row">
            {REGULAR_SHAPES.map((s) => (
              <button
                key={s}
                type="button"
                className={`divinity-chip ${s === selectedShape ? 'divinity-chip--active-alt' : ''}`}
                onClick={() => {
                  setSelectedShape(s)
                  setSelectedRotation(0)
                  setSelectedFlippedH(false)
                  setSelectedFlippedV(false)
                }}
              >
                {SHAPE_DEFS[s].label}
              </button>
            ))}
          </div>
          <div className="divinity-tool-row">
            <button
              type="button"
              className="divinity-tool-btn"
              onClick={() => setSelectedRotation(((selectedRotation - 90) % 360 + 360) % 360)}
            >
              &#x21B6;
            </button>
            <button
              type="button"
              className="divinity-tool-btn"
              onClick={() => setSelectedRotation(((selectedRotation + 90) % 360 + 360) % 360)}
            >
              &#x21B7;
            </button>
            <button
              type="button"
              className={`divinity-tool-btn ${selectedFlippedH ? 'divinity-tool-btn--on' : ''}`}
              onClick={() => {
                setSelectedFlippedH((v) => !v)
                setSelectedFlippedV(false)
              }}
            >
              &#x2194;
            </button>
            <button
              type="button"
              className={`divinity-tool-btn ${selectedFlippedV ? 'divinity-tool-btn--on' : ''}`}
              onClick={() => {
                setSelectedFlippedV((v) => !v)
                setSelectedFlippedH(false)
              }}
            >
              &#x2195;
            </button>
          </div>
        </div>
        <div className="divinity-preview-box">
          <SlatePreview
            shape={selectedShape}
            rotation={selectedRotation}
            flippedH={selectedFlippedH}
            flippedV={selectedFlippedV}
            god={selectedGod}
            size="md"
          />
        </div>
      </div>

      <div>
        <label className="divinity-label">
          {formatMessage({ id: 'divinity.crafter.affixes' }, { count: selectedAffixCount, max: MAX_SLATE_AFFIXES })}
        </label>
        <div className="divinity-affix-list">
          {affixSlots.map((affix, ai) => (
            <div key={ai} className="divinity-affix-row">
              <span className="divinity-affix-idx">#{ai + 1}</span>
              <Select
                className="divinity-select"
                size="small"
                showSearch
                placeholder={formatMessage({ id: 'divinity.crafter.none' })}
                filterOption={(input, option) =>
                  String(option?.label || '')
                    .toLowerCase()
                    .includes(String(input).toLowerCase())
                }
                notFoundContent={formatMessage({ id: 'divinity.legendaryCrafter.noAffix' })}
                value={affix.text || undefined}
                onChange={(v) => updateAffix(ai, v)}
              >
                {AFFIX_TYPES.map((type) => (
                  <Select.OptGroup key={type} label={formatMessage({ id: TYPE_GROUP_IDS[type] })}>
                    {talentGroups[type].map((n) => (
                      <Select.Option
                        key={type + n.text}
                        value={n.text}
                        label={n.text}
                        disabled={affix.text !== n.text && takenTexts.has(n.text)}
                      >
                        <span style={{ color: TYPE_COLOR[type] }}>{n.text}</span>
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                ))}
              </Select>
              {affix.text && (
                <button
                  type="button"
                  className="divinity-affix-clear"
                  onClick={() => updateAffix(ai, '')}
                >
                  &#x2715;
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <BaseButton variant="primary" size="sm" className="divinity-btn-full" onClick={saveSlate}>
        {formatMessage({ id: 'divinity.crafter.save' })}
      </BaseButton>
    </div>
  )
}
