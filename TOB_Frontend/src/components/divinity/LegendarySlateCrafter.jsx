import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Select } from 'antd'
import BaseButton from '../ui/BaseButton.jsx'
import SlatePreview from './SlatePreview.jsx'
import { createSlateId, getShapeLabel } from '../../data/divinityData.js'
import legendarySlatesData from '../../assets/json/装备/神格石板/传奇神格石板词缀.json'
import nonLegendarySlatesData from '../../assets/json/装备/神格石板/非传奇神格石板词缀.json'

const TYPE_GROUP_IDS = {
  小型天赋: 'divinity.crafter.microGroup',
  中型天赋: 'divinity.crafter.mediumGroup',
  传奇中型天赋: 'divinity.crafter.legendaryGroup',
  一级核心天赋: 'divinity.crafter.firstCoreGroup',
  二级核心天赋: 'divinity.crafter.secondCoreGroup',
}

const TYPE_COLOR = {
  小型天赋: '#60a5fa',
  中型天赋: '#c084fc',
  传奇中型天赋: '#fb923c',
  一级核心天赋: '#fb923c',
  二级核心天赋: '#fb923c',
}

// 槽位占位文本（<...>）-> 允许的天赋类型（中文），顺序：最具体匹配在前
const SLOT_TYPE_RULES = [
  { match: '小型天赋或中型天赋', types: ['小型天赋', '中型天赋'] },
  { match: '中型天赋或一级核心天赋', types: ['中型天赋', '一级核心天赋'] },
  { match: '二级核心天赋', types: ['二级核心天赋'] },
  { match: '传奇中型天赋', types: ['传奇中型天赋'] },
  { match: '小型天赋', types: ['小型天赋'] },
  { match: '中型天赋', types: ['中型天赋'] },
]

// 传奇石板形状映射：5 块沿用原有形状；寰空神隙/众星归所为新增，
// 图片无法目视分辨，按词缀语义取合理默认（详见交付说明）
const LEGENDARY_SHAPE_MAP = {
  星星蛾火: 'Single',
  蛾火燎原之刻: 'Single',
  神性一角: 'CornerL',
  群星辉陨: 'Vertical2',
  神之谱系: 'Pedigree',
  寰空神隙: 'Vertical2',
  众星归所: 'Single',
}

const LEGENDARY_SHAPE_CONFIG = {
  Single: { canRotate: false, canFlip: false },
  CornerL: { canRotate: true, canFlip: true },
  Vertical2: { canRotate: true, canFlip: true },
  Pedigree: { canRotate: true, canFlip: true },
}

// 星星蛾火：4 个复制方向（上/下/左/右），制作时可选择启用哪些方向
const DIRECTION_ORDER = ['上', '下', '左', '右']
const DIRECTION_MSG_ID = {
  上: 'divinity.legendaryCrafter.dirUp',
  下: 'divinity.legendaryCrafter.dirDown',
  左: 'divinity.legendaryCrafter.dirLeft',
  右: 'divinity.legendaryCrafter.dirRight',
}
const DIRECTION_AFFIX_TEXT = {
  上: '复制上侧相邻石板的最后一条天赋到该石板，无法复制核心天赋',
  下: '复制下侧相邻石板的最后一条天赋到该石板，无法复制核心天赋',
  左: '复制左侧相邻石板的最后一条天赋到该石板，无法复制核心天赋',
  右: '复制右侧相邻石板的最后一条天赋到该石板，无法复制核心天赋',
}

const NETHER_TYPES = ['小型冥王天赋点', '中型冥王天赋点', '传奇中型冥王天赋点', '至臻冥王天赋点']
const REGULAR_TYPES = ['小型天赋', '中型天赋', '传奇中型天赋']

function parseSlotTypes(text) {
  const inner = text.replace(/^<|>$/g, '')
  for (const rule of SLOT_TYPE_RULES) {
    if (inner === rule.match) return rule.types
  }
  return []
}

function buildTemplate(name, data) {
  const shape = LEGENDARY_SHAPE_MAP[name] || 'Single'
  const shapeConfig = LEGENDARY_SHAPE_CONFIG[shape] || LEGENDARY_SHAPE_CONFIG.Single
  if (name === '星星蛾火') {
    return {
      key: name,
      name,
      image: data.图片地址 || '',
      shape,
      shapeLabel: getShapeLabel(shape),
      canRotate: shapeConfig.canRotate,
      canFlip: shapeConfig.canFlip,
      fixedAffixes: [],
      affixSlots: [],
      directionSlots: [...DIRECTION_ORDER],
    }
  }
  const fixedAffixes = []
  const affixSlots = []
  for (const affix of data.词缀 || []) {
    if (typeof affix !== 'string' || !affix.startsWith('<')) {
      fixedAffixes.push({ text: affix })
      continue
    }
    const allowedTypes = parseSlotTypes(affix)
    if (allowedTypes.length) {
      affixSlots.push({ allowedTypes, label: affix.replace(/^<|>$/g, '') })
    } else {
      fixedAffixes.push({ text: affix })
    }
  }
  return {
    key: name,
    name,
    image: data.图片地址 || '',
    shape,
    shapeLabel: getShapeLabel(shape),
    canRotate: shapeConfig.canRotate,
    canFlip: shapeConfig.canFlip,
    fixedAffixes,
    affixSlots,
  }
}

const TEMPLATES = Object.entries(legendarySlatesData).map(([name, data]) =>
  buildTemplate(name, data)
)

// 传奇石板槽位可选天赋池：按 非传奇神格石板词缀.json 的天赋类型（中文）过滤，
// 命名核心天赋按来源拆分，并记录来源分支名用于选项展示：
//   一级核心天赋 = 与主天赋同名的分支（如 巨力之神/巨力之神：淘汰、借势…）
//   二级核心天赋 = 其他分天赋分支（如 巨力之神/勇者、猛袭者…）
//   无来源 核心天赋不入传奇槽位池；冥王天赋点不参与
const TALENT_POOL = (() => {
  const pool = {
    小型天赋: [],
    中型天赋: [],
    传奇中型天赋: [],
    一级核心天赋: [],
    二级核心天赋: [],
  }
  const seen = {
    小型天赋: new Set(),
    中型天赋: new Set(),
    传奇中型天赋: new Set(),
    一级核心天赋: new Set(),
    二级核心天赋: new Set(),
  }
  const add = (type, text, source, name) => {
    if (!text || seen[type].has(text)) return
    seen[type].add(text)
    pool[type].push({ text, source, name })
  }
  for (const [godName, godData] of Object.entries(nonLegendarySlatesData)) {
    for (const [subName, subData] of Object.entries(godData)) {
      for (const node of subData) {
        const type = node.天赋类型
        if (REGULAR_TYPES.includes(type)) {
          add(type, node.天赋词缀, subName, type)
        } else if (!NETHER_TYPES.includes(type)) {
          if (godName === '无来源') continue
          add(subName === godName ? '一级核心天赋' : '二级核心天赋', node.天赋词缀, subName, type)
        }
      }
    }
  }
  return pool
})()

export default function LegendarySlateCrafter({ onSave }) {
  const { formatMessage } = useIntl()
  const [selectedKey, setSelectedKey] = useState(null)
  const [craftRotation, setCraftRotation] = useState(0)
  const [craftFlippedH, setCraftFlippedH] = useState(false)
  const [craftFlippedV, setCraftFlippedV] = useState(false)
  const [craftAffixes, setCraftAffixes] = useState([])
  const [craftDirection, setCraftDirection] = useState('上')

  const currentTemplate = selectedKey
    ? TEMPLATES.find((t) => t.key === selectedKey) || null
    : null

  function selectTemplate(key) {
    setSelectedKey(key)
    setCraftRotation(0)
    setCraftFlippedH(false)
    setCraftFlippedV(false)
    const tmpl = TEMPLATES.find((t) => t.key === key)
    setCraftAffixes(Array.from({ length: tmpl?.affixSlots?.length || 0 }, () => ''))
    setCraftDirection(tmpl?.directionSlots?.length ? tmpl.directionSlots[0] : '上')
  }

  function getNodesForType(type) {
    return TALENT_POOL[type] || []
  }

  function saveSlate() {
    const tmpl = currentTemplate
    if (!tmpl) return

    let affixes = []
    if (tmpl.directionSlots && tmpl.directionSlots.length) {
      affixes = [{ slotIndex: 0, nodeType: '', text: DIRECTION_AFFIX_TEXT[craftDirection] || '' }]
    } else if (tmpl.fixedAffixes && tmpl.fixedAffixes.length) {
      affixes = tmpl.fixedAffixes.map((fa, i) => ({ slotIndex: i, nodeType: '', text: fa.text }))
    } else if (tmpl.affixSlots && tmpl.affixSlots.length) {
      affixes = craftAffixes.map((text, i) => ({
        slotIndex: i,
        nodeType: tmpl.affixSlots[i].label || '',
        text: text || '',
      }))
    }

    onSave({
      id: createSlateId(),
      shape: tmpl.shape,
      rotation: craftRotation,
      flippedH: craftFlippedH,
      flippedV: craftFlippedV,
      affixes,
      isLegendary: true,
      legendaryName: tmpl.name,
      god: undefined,
    })
    setSelectedKey(null)
    setCraftAffixes([])
  }

  return (
    <div className="divinity-panel">
      <h3 className="divinity-panel__title divinity-panel__title--amber">
        {formatMessage({ id: 'divinity.legendaryCrafter.title' })}
      </h3>

      <div>
        <label className="divinity-label">{formatMessage({ id: 'divinity.legendaryCrafter.template' })}</label>
        <div className="divinity-template-list">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              className={`divinity-template-btn ${
                selectedKey === tpl.key ? 'divinity-template-btn--active' : ''
              }`}
              onClick={() => selectTemplate(tpl.key)}
            >
              {tpl.image && <img src={tpl.image} className="divinity-legend-type__img" alt="" />}
              <span className="divinity-template-btn__name">{tpl.name}</span>
              <span className="divinity-template-btn__shape">- {tpl.shapeLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedKey && currentTemplate && (
        <>
          <div className="divinity-shape-row">
            <div className="divinity-preview-box">
              <SlatePreview
                shape={currentTemplate.shape}
                rotation={craftRotation}
                flippedH={craftFlippedH}
                flippedV={craftFlippedV}
                isLegendary
                size="md"
              />
            </div>
            {(currentTemplate.canRotate || currentTemplate.canFlip) && (
              <div className="divinity-tool-row">
                {currentTemplate.canRotate && (
                  <button
                    type="button"
                    className="divinity-tool-btn"
                    onClick={() => setCraftRotation(((craftRotation - 90) % 360 + 360) % 360)}
                  >
                    &#x21B6;
                  </button>
                )}
                {currentTemplate.canRotate && (
                  <button
                    type="button"
                    className="divinity-tool-btn"
                    onClick={() => setCraftRotation(((craftRotation + 90) % 360 + 360) % 360)}
                  >
                    &#x21B7;
                  </button>
                )}
                {currentTemplate.canFlip && (
                  <button
                    type="button"
                    className={`divinity-tool-btn ${craftFlippedH ? 'divinity-tool-btn--on' : ''}`}
                    onClick={() => {
                      setCraftFlippedH((v) => !v)
                      setCraftFlippedV(false)
                    }}
                  >
                    &#x2194;
                  </button>
                )}
                {currentTemplate.canFlip && (
                  <button
                    type="button"
                    className={`divinity-tool-btn ${craftFlippedV ? 'divinity-tool-btn--on' : ''}`}
                    onClick={() => {
                      setCraftFlippedV((v) => !v)
                      setCraftFlippedH(false)
                    }}
                  >
                    &#x2195;
                  </button>
                )}
              </div>
            )}
          </div>

          {currentTemplate.directionSlots && currentTemplate.directionSlots.length > 0 && (
            <div>
              <label className="divinity-label">
                {formatMessage({ id: 'divinity.legendaryCrafter.directions' })}
              </label>
              <div className="divinity-tool-row">
                {DIRECTION_ORDER.map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    className={`divinity-tool-btn ${craftDirection === dir ? 'divinity-tool-btn--on' : ''}`}
                    onClick={() => setCraftDirection(dir)}
                  >
                    {formatMessage({ id: DIRECTION_MSG_ID[dir] })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentTemplate.fixedAffixes && currentTemplate.fixedAffixes.length > 0 && (
            <div>
              <label className="divinity-label">
                {formatMessage({ id: 'divinity.legendaryCrafter.specialEffects' })}
              </label>
              <div className="divinity-special-list">
                {currentTemplate.fixedAffixes.map((fa, fi) => (
                  <div key={fi} className="divinity-special-item">
                    {fa.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTemplate.affixSlots && currentTemplate.affixSlots.length > 0 && (
            <div>
              <label className="divinity-label">
                {formatMessage({ id: 'divinity.legendaryCrafter.affixSlots' }, { count: currentTemplate.affixSlots.length })}
              </label>
              <div className="divinity-affix-list">
                {currentTemplate.affixSlots.map((slot, si) => (
                  <div key={si} className="divinity-affix-block">
                    <div className="divinity-affix-block__head">
                      <span className="divinity-affix-idx">#{si + 1}</span>
                      <span className="divinity-affix-block__label">
                        {slot.label || (slot.allowedTypes || []).join('/')}
                      </span>
                    </div>
                    <Select
                      className="divinity-select"
                      size="small"
                      showSearch
                      placeholder={formatMessage({ id: 'divinity.legendaryCrafter.selectAffix' })}
                      filterOption={(input, option) =>
                        String(option?.label || '')
                          .toLowerCase()
                          .includes(String(input).toLowerCase())
                      }
                      notFoundContent={formatMessage({ id: 'divinity.legendaryCrafter.noAffix' })}
                      value={craftAffixes[si] || undefined}
                      onChange={(v) =>
                        setCraftAffixes((arr) => {
                          const next = [...arr]
                          next[si] = v || ''
                          return next
                        })
                      }
                    >
                      {(slot.allowedTypes || []).map((type) => (
                        <Select.OptGroup key={type} label={formatMessage({ id: TYPE_GROUP_IDS[type] })}>
                          {getNodesForType(type).map(({ text, source, name }) => {
                            const isCore = type === '一级核心天赋' || type === '二级核心天赋'
                            const label = isCore && name ? `${source}·${name}` : text
                            const taken = craftAffixes[si] !== text && craftAffixes.includes(text)
                            return (
                              <Select.Option key={text} value={text} label={label} disabled={taken}>
                                {isCore && name ? (
                                  <div className="divinity-affix-opt-core">
                                    <div className="divinity-affix-opt-core__name" style={{ color: TYPE_COLOR[type] }}>
                                      <span className="divinity-affix-opt-source">{source}·</span>
                                      {name}
                                    </div>
                                    <div className="divinity-affix-opt-core__desc">{text}</div>
                                  </div>
                                ) : (
                                  <span style={{ color: TYPE_COLOR[type] }}>{text}</span>
                                )}
                              </Select.Option>
                            )
                          })}
                        </Select.OptGroup>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <BaseButton variant="primary" size="sm" className="divinity-btn-full" onClick={saveSlate}>
            {formatMessage({ id: 'divinity.legendaryCrafter.save' })}
          </BaseButton>
        </>
      )}
    </div>
  )
}
