import { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useIntl } from 'react-intl'
import { Button, Input, Modal, Popconfirm, Slider, Tooltip, message } from 'antd'
import { CloseOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { buildStore } from '../stores/buildStore.js'
import { modulePresetStore } from '../stores/modulePresetStore.js'
import { uuidv4 } from '../stores/uuid.js'
import {
  CORE_BOOST_FACTOR,
  CORE_BOOST_LEVEL,
  affixDescWithValue,
  destinyDisplayText,
  destinyType,
  firstAffixRange,
  scaleAffixNumbers,
} from '../utils/pactAffix.js'
import pactSpiritData from '../assets/json/契灵/契灵词缀.json'
import destinyData from '../assets/json/命运/命运词缀.json'
import './PactSpiritPage.less'

export const MAX_PACT_SPIRITS = 3
export const MAX_SPIRIT_LEVEL = 6
export const SMALL_FATE_CAP = 9
export const MID_FATE_CAP = 4
export const SMALL_ADD_CAP = 5
export const MEDIUM_ADD_CAP = 3

const DESTINY_UNDETERMINED_IMG = '/图片/契灵/宿命.png'

// 契约链节点：按游戏链序渲染（小型小型中型 ×3 + 核心，即 2,1,2,1,2,1,1）；
// 已被替换的节点显示替换的命运词缀（图片/名称）；宿命槽位单独处理
function buildChain(spirit) {
  const data = pactSpiritData[spirit.name]
  if (!data) return { nodes: [], destinyImg: DESTINY_UNDETERMINED_IMG }
  const typeMap = { 小型: 'small', 中型: 'medium', 核心: 'core' }
  const replacements = spirit.replacements || {}
  const nodes = (data.契约链 || []).map((slot, i) => {
    const rep = replacements[i]
    const affixName = rep && typeof rep === 'object' ? rep.name : rep
    const affixValue = rep && typeof rep === 'object' ? rep.value : null
    const dest = affixName ? destinyData[affixName] : null
    return {
      text: dest ? affixName : slot.词缀,
      desc: dest && dest.desc ? affixDescWithValue(dest.desc, affixValue) : '',
      img: dest ? dest.imgPath : slot.图片,
      type: typeMap[slot.类型] || 'small',
      nodeIndex: i,
      replaced: !!dest,
    }
  })
  let destinyImg = DESTINY_UNDETERMINED_IMG
  if (data.宿命) destinyImg = Object.values(data.宿命)[0]
  return { nodes, destinyImg }
}

// 数值选择弹窗：滑动块确定命运词缀数值
function ValuePickerModal({ name, min, max, defaultValue, onConfirm, onCancel }) {
  const { formatMessage } = useIntl()
  const [value, setValue] = useState(
    typeof defaultValue === 'number' && Number.isFinite(defaultValue)
      ? defaultValue
      : Math.round((min + max) / 2)
  )
  const desc = destinyData[name] && destinyData[name].desc
  return (
    <div className="pact__value-picker">
      <div className="pact__value-desc">{affixDescWithValue(desc, value)}</div>
      <Slider min={min} max={max} step={1} value={value} onChange={(v) => setValue(v)} />
      <div className="pact__value-actions">
        <Button size="small" onClick={onCancel}>
          {formatMessage({ id: 'app.cancel' })}
        </Button>
        <Button
          size="small"
          type="primary"
          onClick={() => {
            onConfirm(value)
          }}
        >
          {formatMessage({ id: 'pact.valueConfirm' })}
        </Button>
      </div>
    </div>
  )
}

function PactSpiritPage() {
  const { formatMessage } = useIntl()
  const [spiritPickerOpen, setSpiritPickerOpen] = useState(false)
  const [destinyPickerId, setDestinyPickerId] = useState(null)
  const [replacementPicker, setReplacementPicker] = useState(null)
  const [valuePicker, setValuePicker] = useState(null)
  const [search, setSearch] = useState('')

  const pactSpirits = buildStore.build.pactSpirits

  const spiritList = useMemo(() => Object.keys(pactSpiritData), [])
  const destinyList = useMemo(() => Object.entries(destinyData), [])

  // 已加入的契灵从选择列表中过滤（不能添加同一种契灵）
  const addedSpiritNames = useMemo(
    () => new Set(pactSpirits.map((s) => s.name)),
    [pactSpirits]
  )

  const filteredSpirits = spiritList.filter(
    (name) =>
      !addedSpiritNames.has(name) &&
      (!search || name.toLowerCase().includes(search.toLowerCase()))
  )

  const spiritGroups = useMemo(() => {
    const groups = []
    const byClass = new Map()
    for (const name of filteredSpirits) {
      const cls = pactSpiritData[name]?.战斗分类 || formatMessage({ id: 'pact.combatOther' })
      if (!byClass.has(cls)) {
        byClass.set(cls, [])
        groups.push(cls)
      }
      byClass.get(cls).push(name)
    }
    return groups.map((cls) => ({ cls, items: byClass.get(cls) }))
  }, [filteredSpirits, formatMessage])

  const smallPool = useMemo(
    () => destinyList.filter(([name]) => destinyType(name) === 'small'),
    [destinyList]
  )
  const mediumPool = useMemo(
    () => destinyList.filter(([name]) => destinyType(name) === 'medium'),
    [destinyList]
  )

  // 替换计数：全部契灵合计已替换的小型/中型节点数（9/4 共用上限）
  const replacedCounts = useMemo(() => {
    let small = 0
    let medium = 0
    for (const s of pactSpirits) {
      const data = pactSpiritData[s.name]
      if (!data) continue
      for (const [idx, affix] of Object.entries(s.replacements || {})) {
        if (!affix) continue
        const slot = data.契约链[Number(idx)]
        if (!slot) continue
        if (slot.类型 === '小型') small++
        else if (slot.类型 === '中型') medium++
      }
    }
    return { small, medium }
  }, [pactSpirits])

  function pickSpirit(name) {
    if (pactSpirits.length >= MAX_PACT_SPIRITS) return
    if (pactSpirits.some((s) => s.name === name)) return
    buildStore.addPactSpirit({
      spiritId: uuidv4(),
      name,
      level: 1,
      replacements: {},
      additions: [],
    })
    setSpiritPickerOpen(false)
    setSearch('')
  }

  function openReplacementPicker(spirit, node) {
    if (node.type === 'core') return
    setReplacementPicker({ spiritId: spirit.spiritId, nodeIndex: node.nodeIndex, nodeType: node.type })
    setSearch('')
  }

  function openValuePickerForReplacement(name) {
    if (!replacementPicker) return
    const info = destinyData[name]
    const range = firstAffixRange(info && info.desc)
    const spirit = pactSpirits.find((s) => s.spiritId === replacementPicker.spiritId)
    const existing =
      spirit && spirit.replacements && spirit.replacements[replacementPicker.nodeIndex]
    const existingValue =
      existing && typeof existing === 'object' ? existing.value : null
    if (range) {
      setValuePicker({
        mode: 'replace',
        name,
        min: range.min,
        max: range.max,
        current: existingValue,
      })
      return
    }
    buildStore.setPactSpiritReplacement(replacementPicker.spiritId, replacementPicker.nodeIndex, name)
    setReplacementPicker(null)
    setSearch('')
  }

  function confirmReplacementValue(value) {
    if (!replacementPicker || !valuePicker) return
    buildStore.setPactSpiritReplacement(
      replacementPicker.spiritId,
      replacementPicker.nodeIndex,
      valuePicker.name,
      value
    )
    setValuePicker(null)
    setReplacementPicker(null)
    setSearch('')
  }

  function restoreReplacement() {
    if (!replacementPicker) return
    buildStore.setPactSpiritReplacement(replacementPicker.spiritId, replacementPicker.nodeIndex, '')
    setValuePicker(null)
    setReplacementPicker(null)
    setSearch('')
  }

  function openDestinyPicker(spirit) {
    setDestinyPickerId(spirit.spiritId)
    setSearch('')
  }

  function pickAddition(type, name) {
    if (!destinyPickerId) return
    const spirit = pactSpirits.find((s) => s.spiritId === destinyPickerId)
    if (!spirit) return
    const additions = spirit.additions || []
    const count = additions.filter((a) => a.type === type).length
    const cap = type === 'small' ? SMALL_ADD_CAP : MEDIUM_ADD_CAP
    if (count >= cap) return
    if (additions.some((a) => a.type === type && a.name === name)) return
    const info = destinyData[name]
    const range = firstAffixRange(info && info.desc)
    if (range) {
      setValuePicker({
        mode: 'add',
        type,
        name,
        min: range.min,
        max: range.max,
        current: null,
      })
      return
    }
    buildStore.addPactSpiritAddition(destinyPickerId, type, name)
  }

  function confirmAdditionValue(value) {
    if (!destinyPickerId || !valuePicker) return
    const { type, name } = valuePicker
    const spirit = pactSpirits.find((s) => s.spiritId === destinyPickerId)
    if (!spirit) return
    const additions = spirit.additions || []
    const count = additions.filter((a) => a.type === type).length
    const cap = type === 'small' ? SMALL_ADD_CAP : MEDIUM_ADD_CAP
    if (count >= cap) return
    if (additions.some((a) => a.type === type && a.name === name)) return
    buildStore.addPactSpiritAddition(destinyPickerId, type, name, value)
    setValuePicker(null)
  }

  function confirmValue(value) {
    if (!valuePicker) return
    if (valuePicker.mode === 'replace') confirmReplacementValue(value)
    else confirmAdditionValue(value)
  }

  function clearAll() {
    buildStore.setPactSpirits([])
    message.success(formatMessage({ id: 'pact.cleared' }))
  }

  function renderLevelStepper(spirit) {
    return (
      <div className="pact__level" title={formatMessage({ id: 'pact.levelLabel' }, { name: spirit.name })}>
        {spirit.level > 1 && (
          <button
            type="button"
            className="pact__level-btn"
            aria-label={formatMessage({ id: 'pact.levelDec' }, { name: spirit.name })}
            onClick={() => buildStore.setPactSpiritLevel(spirit.spiritId, spirit.level - 1)}
          >
            <span className="pact__level-minus">−</span>
          </button>
        )}
        <span className="pact__level-num">{spirit.level}</span>
        {spirit.level < MAX_SPIRIT_LEVEL && (
          <button
            type="button"
            className="pact__level-btn"
            aria-label={formatMessage({ id: 'pact.levelInc' }, { name: spirit.name })}
            onClick={() => buildStore.setPactSpiritLevel(spirit.spiritId, spirit.level + 1)}
          >
            <span className="pact__level-plus">+</span>
          </button>
        )}
      </div>
    )
  }

  function renderSpiritRow(spirit, index) {
    const data = pactSpiritData[spirit.name]
    const portrait = data ? data.图片地址 : ''
    const chain = buildChain(spirit)
    const additions = spirit.additions || []
    const ascendAffix =
      data && Array.isArray(data.升阶词缀) ? data.升阶词缀[spirit.level - 1] || '' : ''
    const isCoreBoosted = spirit.level === CORE_BOOST_LEVEL
    const ascendAffixText =
      isCoreBoosted && ascendAffix
        ? scaleAffixNumbers(ascendAffix, CORE_BOOST_FACTOR)
        : ascendAffix
    const tooltip = (
      <div className="pact__spirit-tip">
        <div className="pact__spirit-tip-name">{spirit.name}</div>
        {data && (
          <div className="pact__spirit-tip-meta">
            {formatMessage({ id: 'pact.rarity' })}：{data.稀有分类}
            {' · '}
            {formatMessage({ id: 'pact.combatClass' })}：{data.战斗分类}
          </div>
        )}
        <div className="pact__spirit-tip-level">
          {formatMessage({ id: 'pact.levelLabel' }, { name: spirit.name })} {spirit.level}
        </div>
      </div>
    )
    return (
      <div key={spirit.spiritId || index} className="pact__spirit">
        <div className="pact__row">
          <div className="pact__portrait">
            <div className="pact__portrait-thumb">
              <Tooltip title={tooltip} placement="topLeft" mouseEnterDelay={0.2}>
                {portrait ? (
                  <img src={encodeURI(portrait)} alt={spirit.name} className="pact__portrait-img" />
                ) : (
                  <span className="pact__portrait-img pact__portrait-img--empty" />
                )}
              </Tooltip>
              <Popconfirm
                title={formatMessage({ id: 'pact.confirmRemove' })}
                onConfirm={() => buildStore.removePactSpirit(spirit.spiritId)}
                okText={formatMessage({ id: 'app.close' })}
                cancelText={formatMessage({ id: 'app.cancel' })}
              >
                <button
                  type="button"
                  className="pact__remove"
                  aria-label={formatMessage({ id: 'pact.remove' })}
                >
                  <CloseOutlined />
                </button>
              </Popconfirm>
            </div>
            {renderLevelStepper(spirit)}
          </div>
          <span className="pact__divider" />
          <div className="pact__chain">
            {chain.nodes.map((node, i) => (
              <span className="pact__chain-item" key={`${node.text}-${i}`}>
                {i > 0 && <span className="pact__link" />}
                <Tooltip
                  title={
                    node.replaced
                      ? (() => {
                          return (
                            <div className="pact__node-tip">
                              <div className="pact__node-tip-text">{node.text}</div>
                              {node.desc && (
                                <div className="pact__node-tip-affix">
                                  <span className="pact__node-tip-affix-text">{node.desc}</span>
                                </div>
                              )}
                            </div>
                          )
                        })()
                      : i === chain.nodes.length - 1 && ascendAffixText
                        ? (
                            <div className="pact__node-tip">
                              <div className="pact__node-tip-text">{node.text}</div>
                              {isCoreBoosted && (
                                <div className="pact__node-tip-boost">
                                  {formatMessage({ id: 'pact.coreBoost' })}
                                </div>
                              )}
                              <div className="pact__node-tip-affix">
                                <span className="pact__node-tip-affix-label">
                                  {formatMessage({ id: 'pact.ascendAffix' }, { level: spirit.level })}
                                </span>
                                <span className="pact__node-tip-affix-text">{ascendAffixText}</span>
                              </div>
                            </div>
                          )
                        : (
                            node.text
                          )
                  }
                  placement="top"
                  mouseEnterDelay={0.2}
                >
                  <button
                    type="button"
                    className={`pact__node pact__node--${node.type} ${node.replaced ? 'pact__node--replaced' : ''}`}
                    title={node.text}
                    onClick={
                      node.type === 'small' || node.type === 'medium'
                        ? () => openReplacementPicker(spirit, node)
                        : undefined
                    }
                  >
                    {node.img && <img src={encodeURI(node.img)} alt="" className="pact__node-img" />}
                  </button>
                </Tooltip>
              </span>
            ))}
            <span className="pact__chain-item">
              <span className="pact__link" />
              <Tooltip
                title={
                  additions.length
                    ? additions.map((a) => destinyDisplayText(a.name, a.value)).join('、')
                    : formatMessage({ id: 'pact.destinyEmpty' })
                }
                placement="top"
                mouseEnterDelay={0.2}
              >
                <button
                  type="button"
                  className={`pact__node pact__node--destiny ${additions.length ? 'pact__node--destiny-filled' : ''}`}
                  onClick={() => openDestinyPicker(spirit)}
                  aria-label={formatMessage({ id: 'pact.destinyPick' })}
                >
                  <img src={encodeURI(chain.destinyImg)} alt="" className="pact__node-img pact__node-img--muted" />
                  {additions.length > 0 && (
                    <span className="pact__node-badge">{additions.length}</span>
                  )}
                </button>
              </Tooltip>
            </span>
          </div>
        </div>
        {additions.length > 0 && (
          <div className="pact__additions">
            {additions.map((a, ai) => (
              <span key={ai} className={`pact__addition pact__addition--${a.type}`}>
                <span className="pact__addition-label">
                  {formatMessage({ id: a.type === 'small' ? 'pact.fateSmallLabel' : 'pact.addMediumLabel' })}
                </span>
                <span className="pact__addition-name">{destinyDisplayText(a.name, a.value)}</span>
                <button
                  type="button"
                  className="pact__addition-remove"
                  aria-label={formatMessage({ id: 'pact.removeAddition' })}
                  onClick={() => buildStore.removePactSpiritAddition(spirit.spiritId, ai)}
                >
                  <CloseOutlined />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderEmptySlot() {
    return (
      <button type="button" className="pact__row pact__row--empty" onClick={() => setSpiritPickerOpen(true)}>
        <span className="pact__empty-slot">
          <PlusOutlined />
        </span>
        <span className="pact__divider" />
        <span className="pact__empty-text">{formatMessage({ id: 'pact.selectHint' })}</span>
      </button>
    )
  }

  const destinyPickerSpirit = destinyPickerId
    ? pactSpirits.find((s) => s.spiritId === destinyPickerId)
    : null
  const addList = destinyPickerSpirit?.additions || []
  const smallAddCount = addList.filter((a) => a.type === 'small').length
  const mediumAddCount = addList.filter((a) => a.type === 'medium').length

  const rp = replacementPicker
  const rpSpirit = rp ? pactSpirits.find((s) => s.spiritId === rp.spiritId) : null
  const rpReplaced = rp && rpSpirit ? rpSpirit.replacements?.[rp.nodeIndex] : null
  const rpReplacedName = rpReplaced && typeof rpReplaced === 'object' ? rpReplaced.name : rpReplaced
  const rpQuotaFull =
    rp && (rp.nodeType === 'small' ? replacedCounts.small : replacedCounts.medium) >=
      (rp?.nodeType === 'small' ? SMALL_FATE_CAP : MID_FATE_CAP)
  const rpPool = rp ? (rp.nodeType === 'small' ? smallPool : mediumPool) : []

  return (
    <div className="pact">
      <div className="pact__header">
        <h2 className="pact__title">{formatMessage({ id: 'tab.pactSpirit' })}</h2>
        <div className="pact__header-actions">
          <Button size="small" onClick={() => modulePresetStore.openDrawer('pactSpirit')}>
            {formatMessage({ id: 'preset.open' })}
          </Button>
          <Button size="small" onClick={clearAll}>
            {formatMessage({ id: 'pact.clearAll' })}
          </Button>
        </div>
      </div>

      <section className="pact__section">
        <div className="pact__section-head">
          <h3 className="pact__section-title">{formatMessage({ id: 'pact.title' })}</h3>
          <span className="pact__section-count">
            {formatMessage({ id: 'pact.spiritCount' }, { count: pactSpirits.length })}
          </span>
        </div>
        <div className="pact__rows">
          {pactSpirits.map((spirit, i) => renderSpiritRow(spirit, i))}
          {pactSpirits.length < MAX_PACT_SPIRITS && renderEmptySlot()}
        </div>
        <div className="pact__counters">
          <span className="pact__counter">
            {formatMessage({ id: 'pact.smallReplace' })}：
            <span className="pact__counter-num">
              {replacedCounts.small} / {SMALL_FATE_CAP}
            </span>
          </span>
          <span className="pact__counter">
            {formatMessage({ id: 'pact.mediumReplace' })}：
            <span className="pact__counter-num">
              {replacedCounts.medium} / {MID_FATE_CAP}
            </span>
          </span>
        </div>
      </section>

      <Modal
        title={formatMessage({ id: 'pact.pickSpiritTitle' })}
        visible={spiritPickerOpen}
        onCancel={() => setSpiritPickerOpen(false)}
        footer={null}
        width={760}
      >
        <Input
          className="pact__search"
          size="small"
          allowClear
          prefix={<SearchOutlined />}
          placeholder={formatMessage({ id: 'pact.search' })}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="pact__picker-list">
          {spiritGroups.length === 0 ? (
            <div className="pact__picker-none">{formatMessage({ id: 'skills.empty' })}</div>
          ) : (
            spiritGroups.map((group) => (
              <div key={group.cls} className="pact__picker-group">
                <div className="pact__picker-group-title">{group.cls}</div>
                <div className="pact__picker-grid">
                  {group.items.map((name) => {
                    const data = pactSpiritData[name]
                    const tooltip = (
                      <div className="pact__pick-tip">
                        <div className="pact__pick-tip-name">{name}</div>
                        <div className="pact__pick-tip-meta">
                          {formatMessage({ id: 'pact.rarity' })}：{data.稀有分类}
                          {' · '}
                          {formatMessage({ id: 'pact.combatClass' })}：{data.战斗分类}
                        </div>
                        <div className="pact__pick-tip-affixes">
                          {data.契约链
                            .filter((slot) => slot.类型 === '核心')
                            .map((slot, si) => (
                              <div className="pact__pick-tip-core" key={si}>
                                <div className="pact__pick-tip-core-name">
                                  <span className="pact__pick-tip-type pact__pick-tip-type--核心">核心</span>
                                  <span className="pact__pick-tip-text">{slot.词缀}</span>
                                </div>
                                {data.升阶词缀 && data.升阶词缀[0] && (
                                  <div className="pact__pick-tip-core-desc">
                                    <span className="pact__pick-tip-affix-label">
                                      {formatMessage({ id: 'pact.ascendAffix' }, { level: 1 })}
                                    </span>
                                    <span className="pact__pick-tip-text">{data.升阶词缀[0]}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          {data.契约链
                            .filter((slot) => slot.类型 !== '核心')
                            .map((slot, si) => (
                              <div
                                className={`pact__pick-tip-affix pact__pick-tip-affix--${slot.类型}`}
                                key={si}
                              >
                                <span className="pact__pick-tip-type">{slot.类型}</span>
                                <span className="pact__pick-tip-text">{slot.词缀}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )
                    return (
                      <Tooltip title={tooltip} placement="top" mouseEnterDelay={0.2} key={name}>
                        <button
                          type="button"
                          className="pact__picker-item"
                          onClick={() => {
                            if (pactSpirits.length >= MAX_PACT_SPIRITS) return
                            pickSpirit(name)
                          }}
                        >
                          <span className="pact__picker-img">
                            <img src={encodeURI(data.图片地址)} alt="" />
                          </span>
                          <span className="pact__picker-name">{name}</span>
                        </button>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <Modal
        title={
          rp
            ? formatMessage({
                id: rp.nodeType === 'small' ? 'pact.replaceSmallTitle' : 'pact.replaceMediumTitle',
              })
            : ''
        }
        visible={!!rp}
        onCancel={() => setReplacementPicker(null)}
        footer={null}
        width={760}
      >
        <Input
          className="pact__search"
          size="small"
          allowClear
          prefix={<SearchOutlined />}
          placeholder={formatMessage({ id: 'pact.search' })}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="pact__destiny-list">
          {rpReplacedName && (
            <div className="pact__replace-actions">
              <button type="button" className="pact__restore-btn" onClick={restoreReplacement}>
                {formatMessage({ id: 'pact.restore' })}
              </button>
            </div>
          )}
          {rpQuotaFull && !rpReplacedName && (
            <div className="pact__quota-hint">{formatMessage({ id: 'pact.quotaFull' })}</div>
          )}
          <div className="pact__destiny-grid">
            {rpPool
              .filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))
              .map(([name, info]) => {
                const isCurrent = rpReplacedName === name
                const disabled = rpQuotaFull && !rpReplacedName
                return (
                  <button
                    type="button"
                    key={name}
                    className={`pact__destiny-item ${disabled ? 'pact__destiny-item--disabled' : ''} ${isCurrent ? 'pact__destiny-item--current' : ''}`}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return
                      openValuePickerForReplacement(name)
                    }}
                    title={info.desc || name}
                  >
                    <span className="pact__destiny-name">{name}</span>
                    {info.desc && <span className="pact__destiny-desc">{info.desc}</span>}
                  </button>
                )
              })}
          </div>
        </div>
      </Modal>

      <Modal
        title={formatMessage({ id: 'pact.addTitle' })}
        visible={!!destinyPickerSpirit}
        onCancel={() => setDestinyPickerId(null)}
        footer={null}
        width={760}
      >
        <Input
          className="pact__search"
          size="small"
          allowClear
          prefix={<SearchOutlined />}
          placeholder={formatMessage({ id: 'pact.search' })}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="pact__destiny-list">
          {smallAddCount + mediumAddCount > 0 && (
            <div className="pact__additions-current">
              {addList.map((a, ai) => (
                <span key={ai} className={`pact__addition pact__addition--${a.type}`}>
                  <span className="pact__addition-label">
                    {formatMessage({ id: a.type === 'small' ? 'pact.fateSmallLabel' : 'pact.addMediumLabel' })}
                  </span>
                  <span className="pact__addition-name">{destinyDisplayText(a.name, a.value)}</span>
                  <button
                    type="button"
                    className="pact__addition-remove"
                    aria-label={formatMessage({ id: 'pact.removeAddition' })}
                    onClick={() => buildStore.removePactSpiritAddition(destinyPickerId, ai)}
                  >
                    <CloseOutlined />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="pact__destiny-group">
            <div className="pact__destiny-group-title">
              {formatMessage({ id: 'pact.fateSmallLabel' })}（{smallAddCount}/{SMALL_ADD_CAP}）
            </div>
            <div className="pact__destiny-grid">
              {smallPool
                .filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))
                .map(([name, info]) => {
                  const added = addList.some((a) => a.type === 'small' && a.name === name)
                  const disabled = added || smallAddCount >= SMALL_ADD_CAP
                  return (
                    <button
                      type="button"
                      key={name}
                      className={`pact__destiny-item ${disabled ? 'pact__destiny-item--disabled' : ''}`}
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return
                        pickAddition('small', name)
                      }}
                      title={info.desc || name}
                    >
                      <span className="pact__destiny-name">{name}</span>
                      {added && <span className="pact__destiny-added">{formatMessage({ id: 'pact.added' })}</span>}
                      {info.desc && <span className="pact__destiny-desc">{info.desc}</span>}
                    </button>
                  )
                })}
            </div>
          </div>
          <div className="pact__destiny-group">
            <div className="pact__destiny-group-title">
              {formatMessage({ id: 'pact.addMediumLabel' })}（{mediumAddCount}/{MEDIUM_ADD_CAP}）
            </div>
            <div className="pact__destiny-grid">
              {mediumPool
                .filter(([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))
                .map(([name, info]) => {
                  const added = addList.some((a) => a.type === 'medium' && a.name === name)
                  const disabled = added || mediumAddCount >= MEDIUM_ADD_CAP
                  return (
                    <button
                      type="button"
                      key={name}
                      className={`pact__destiny-item ${disabled ? 'pact__destiny-item--disabled' : ''}`}
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return
                        pickAddition('medium', name)
                      }}
                      title={info.desc || name}
                    >
                      <span className="pact__destiny-name">{name}</span>
                      {added && <span className="pact__destiny-added">{formatMessage({ id: 'pact.added' })}</span>}
                      {info.desc && <span className="pact__destiny-desc">{info.desc}</span>}
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={
          valuePicker
            ? `${formatMessage({ id: 'pact.valueTitle' })}：${valuePicker.name}`
            : ''
        }
        visible={!!valuePicker}
        onCancel={() => setValuePicker(null)}
        footer={null}
        width={520}
        zIndex={1100}
      >
        {valuePicker && (
          <ValuePickerModal
            key={valuePicker.name}
            name={valuePicker.name}
            min={valuePicker.min}
            max={valuePicker.max}
            defaultValue={valuePicker.current}
            onConfirm={confirmValue}
            onCancel={() => setValuePicker(null)}
          />
        )}
      </Modal>
    </div>
  )
}

export default observer(PactSpiritPage)
