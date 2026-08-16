import { observer } from 'mobx-react-lite'
import { useIntl } from 'react-intl'
import { useHistory, useParams } from 'react-router-dom'
import { Tooltip, message, Modal, Select, Slider, Button } from 'antd'
import { useState } from 'react'
import { buildStore, talentGods, getPlayBranchesOf } from '../stores/buildStore.js'
import { modulePresetStore } from '../stores/modulePresetStore.js'
import BaseButton from '../components/ui/BaseButton.jsx'
import prismKindData from '../assets/json/装备/棱镜/棱镜图片及种类.json'
import prismRandomData from '../assets/json/装备/棱镜/随机词缀.json'
import { aggregateAffixTexts } from '../utils/affixAggregation.js'
import { normalizeStates } from '../utils/combatStates.js'
import { cleanAffixText } from '../utils/affixText.js'
import { AFFIX_CONSUMERS } from '../utils/affixConsumers.js'
import {
  buildSlotContext,
  getPrismAffixKind,
  getReverseMultiplier,
  nodeInRangeBox,
  parsePrismAffix2Effects,
  prismCoveringApplies,
  scaleAffixText,
  scaleAffixTextByFactor,
  stripPrismAffixPrefix,
  KIND_CLASS,
  REVERSE_COLUMNS,
  SVG_PAD,
  SVG_WIDTH,
  SVG_HEIGHT,
} from '../utils/talentTree.js'
import './TalentsPage.less'

const SLOT_COUNT = 4
const COL_X = [64, 192, 320, 448, 576, 704, 832]
const COL_THRESHOLD = [0, 3, 6, 9, 12, 15, 18]

const PRISM_KINDS = Object.values(prismKindData).filter(
  (k) => k.name !== '逆像'
)

const PRISM_RANGES = Array.from(
  new Set(
    prismRandomData
      .filter((x) => x.category === '影响范围')
      .map((x) => x.entry)
  )
)

const PRISM_RANDOM = prismRandomData
  .filter((x) => x.category !== '影响范围')
  .reduce((acc, x) => {
    if (!acc[x.entry]) acc[x.entry] = x.rarety || ''
    return acc
  }, {})

const PRISM_RANDOM_OPTIONS = (rarety) =>
  Object.keys(PRISM_RANDOM)
    .filter((entry) => !rarety || PRISM_RANDOM[entry] === rarety)
    .map((entry) => ({ value: entry, label: entry }))

function getColumnThreshold(x) {
  const idx = COL_X.indexOf(x)
  return idx === -1 ? 0 : COL_THRESHOLD[idx]
}

let itemSeq = 0
function makeItemId(prefix) {
  itemSeq += 1
  return `${prefix}_${Date.now().toString(36)}_${itemSeq}`
}

function TalentsPage() {
  const { slot: slotParam } = useParams()
  const history = useHistory()
  const { formatMessage } = useIntl()

  const [prismKind, setPrismKind] = useState('')
  const [prismRange, setPrismRange] = useState('')
  const [prismAffix, setPrismAffix] = useState('')
  const [prismAffix2, setPrismAffix2] = useState('')
  const [reverseSmall, setReverseSmall] = useState(0)
  const [reverseMedium, setReverseMedium] = useState(0)
  const [reverseLegendary, setReverseLegendary] = useState(0)
  const [placingSlot, setPlacingSlot] = useState(null)
  const [placingItem, setPlacingItem] = useState(null)

  let currentSlot = 0
  if (slotParam) {
    const idx = parseInt(slotParam.replace('slot_', ''), 10) - 1
    if (idx >= 0 && idx < SLOT_COUNT) currentSlot = idx
  }

  const activePlacing = placingSlot === currentSlot ? placingItem : null

  const talentData = buildStore.build.talents[currentSlot] || {
    god: '',
    branch: '',
    points: {},
    corePoints: {},
    prisms: { placed: {} },
  }
  const slot2Linked = currentSlot === 1
  const linkedGod = slot2Linked
    ? buildStore.build.talents[0]?.god || ''
    : ''
  const god = slot2Linked ? linkedGod : talentData.god || ''
  const branch = talentData.branch || ''
  const points = talentData.points || {}
  const corePoints = talentData.corePoints || {}
  const prismInventory = Array.isArray(buildStore.build.prisms?.inventory)
    ? buildStore.build.prisms.inventory
    : []
  const prismPlaced = talentData.prisms?.placed || {}
  const allPlaced = buildStore.build.talents.reduce((acc, t, slotIdx) => {
    const placed = t?.prisms?.placed || {}
    for (const [nodeId, itemId] of Object.entries(placed)) {
      acc[itemId] = { slot: slotIdx, nodeId }
    }
    return acc
  }, {})
  const equippedPrism = Object.keys(allPlaced).some(
    (id) => prismInventory.find((it) => it.id === id)?.type === 'prism'
  )
  const equippedReverse = Object.keys(allPlaced).some(
    (id) => prismInventory.find((it) => it.id === id)?.type === 'reverse'
  )
  const currentPageHasItem = Object.keys(prismPlaced).length > 0
  const pageHasPoints =
    Object.keys(points).length > 0 || Object.keys(corePoints).length > 0

  const activePlacingItem = activePlacing
    ? prismInventory.find((it) => it.id === activePlacing)
    : null
  const placingPrism = activePlacingItem?.type === 'prism'

  const isMainSlot = currentSlot === 0
  const playBranches = god ? getPlayBranchesOf(god) : []
  const branchOptions = isMainSlot ? (god ? [god] : []) : playBranches

  const slotCtx = buildSlotContext(
    { god, branch, points, corePoints, prisms: talentData.prisms },
    prismInventory
  )
  const {
    branchData,
    nodeById,
    placedPrismBoxes,
    placedReverseEntry,
    reverseTargets,
    reverseRegionNodeIds,
    reverseClearedIds,
    reverseGhostNodes,
    reverseMirrorId,
    reverseRangeBox,
    reverseMirrorBox,
  } = slotCtx

  const nodeAffix2 = (node) => {
    if (node.isCore) return { extra: 0, ignorePrereq: false }
    let extra = 0
    let ignorePrereq = false
    for (const p of placedPrismBoxes) {
      if (p.nodeId === node.id) continue
      if (!nodeInRangeBox(node, p.box)) continue
      for (const eff of parsePrismAffix2Effects(p.item.affix2)) {
        if (eff.kind !== node.kind) continue
        extra += eff.extra || 0
        if (eff.ignorePrereq) ignorePrereq = true
      }
    }
    return { extra, ignorePrereq }
  }
  const nodeLimitWithBonus = (node) =>
    (reverseTargets.get(node.id)?.source.limit ?? node.limit) +
    nodeAffix2(node).extra

  const spent = Object.values(points).reduce((s, v) => s + (v || 0), 0)

  const allocatedPerGroup = branchData.coreNodes.reduce((acc, n) => {
    if ((corePoints[n.name] || 0) > 0) acc[n.group] = (acc[n.group] || 0) + 1
    return acc
  }, {})

  const normalUnlocked = (node) => {
    if (spent < getColumnThreshold(node.x)) return false
    if (reverseTargets.has(node.id)) return true
    if (reverseMirrorId && node.id === reverseMirrorId) return true
    if (nodeAffix2(node).ignorePrereq) return true
    const pres = branchData.prereq?.get(node.id)
    if (!pres || pres.size === 0) return true
    for (const preKey of pres) {
      const preNode = nodeById.get(preKey)
      const preLimit = preNode
        ? nodeLimitWithBonus(preNode)
        : branchData.nodeLimitByKey?.get(preKey) || 1
      if ((points[preKey] || 0) < preLimit) return false
    }
    return true
  }

  const coreUnlocked = (node) => {
    const value = corePoints[node.name] || 0
    if (value > 0) return true
    if ((allocatedPerGroup[node.group] || 0) > 0) return false
    if (isMainSlot) {
      return node.group === 0 ? spent >= 12 : spent >= 24
    }
    return spent >= 24
  }

  function addPoint(node) {
    if (node.isCore) {
      const cur = corePoints[node.name] || 0
      if (cur >= node.limit) return
      buildStore.setTalentCore(currentSlot, node.name, cur + 1)
      return
    }
    const cur = points[node.id] || 0
    if (cur >= nodeLimitWithBonus(node)) return
    buildStore.setTalentPoints(currentSlot, node.id, cur + 1)
  }

  function removePoint(node) {
    if (node.isCore) {
      const cur = corePoints[node.name] || 0
      if (cur <= 0) return
      buildStore.setTalentCore(currentSlot, node.name, cur - 1)
      return
    }
    const cur = points[node.id] || 0
    if (cur <= 0) return
    buildStore.setTalentPoints(currentSlot, node.id, cur - 1)
  }

  function handleNodeClick(node, isCore, e) {
    if (isCore) {
      if (!coreUnlocked(node)) return
    } else if (!normalUnlocked(node)) return
    if (e?.ctrlKey) removePoint(node)
    else addPoint(node)
  }

  const prismOneAffix = prismKind === '异度棱镜：朦胧'
  const prismAffixOptions = PRISM_RANDOM_OPTIONS('稀有')
  const prismAffix2Options = PRISM_RANDOM_OPTIONS(null).filter((opt) => {
    const bracket = opt.value.match(/\[([^\]]+)\]/)
    return !bracket || prismKind.includes(bracket[1])
  })

  function changePrismKind(value) {
    setPrismKind(value)
    if (prismAffix && PRISM_RANDOM[prismAffix] !== '稀有') setPrismAffix('')
    if (prismAffix2) {
      const bracket = prismAffix2.match(/\[([^\]]+)\]/)
      if (bracket && !value.includes(bracket[1])) setPrismAffix2('')
    }
  }

  function savePrism() {
    if (!prismKind || !prismRange || !prismAffix) return
    if (!prismOneAffix && !prismAffix2) return
    buildStore.addPrismInventory({
      id: makeItemId('prism'),
      type: 'prism',
      kind: prismKind,
      range: prismRange,
      affix: prismAffix,
      affix2: prismOneAffix ? '' : prismAffix2,
    })
    setPrismKind('')
    setPrismRange('')
    setPrismAffix('')
    setPrismAffix2('')
  }

  function saveReverse() {
    buildStore.addReverseInventory({
      id: makeItemId('reverse'),
      type: 'reverse',
      small: reverseSmall,
      medium: reverseMedium,
      legendary: reverseLegendary,
    })
  }

  function removeInventoryItem(itemId) {
    buildStore.removePrismInventory(itemId)
    if (activePlacing === itemId) {
      setPlacingItem(null)
      setPlacingSlot(null)
    }
  }

  function clearInventory(type) {
    buildStore.clearPrismInventory(type)
    if (activePlacing) {
      const removed = prismInventory.find((it) => it.id === activePlacing)
      if (removed?.type === type) {
        setPlacingItem(null)
        setPlacingSlot(null)
      }
    }
  }

  function unequipItem(itemId) {
    const eq = allPlaced[itemId]
    if (!eq) return
    const item = prismInventory.find((it) => it.id === itemId)
    const doUnequip = () => {
      buildStore.placeTalentPrism(eq.slot, eq.nodeId, itemId)
      message.info(
        formatMessage({
          id:
            item?.type === 'reverse'
              ? 'reverse.unequipped'
              : 'prism.unequipped',
        })
      )
    }
    if (item?.type === 'reverse') {
      Modal.confirm({
        title: formatMessage({ id: 'reverse.confirmReset' }),
        okText: formatMessage({ id: 'prism.placeConfirmOk' }),
        cancelText: formatMessage({ id: 'prism.placeConfirmCancel' }),
        onOk: doUnequip,
      })
      return
    }
    doUnequip()
  }

  function togglePlacing(itemId) {
    if (!itemId) {
      setPlacingItem(null)
      setPlacingSlot(null)
      return
    }
    const item = prismInventory.find((it) => it.id === itemId)
    if (!item) return
    const equipped = allPlaced[itemId]
    if (equipped) {
      unequipItem(itemId)
      return
    }
    const sameTypeEquipped =
      item?.type === 'prism' ? equippedPrism : equippedReverse
    if (sameTypeEquipped || currentPageHasItem) {
      message.warning(
        formatMessage({
          id:
            item.type === 'reverse'
              ? 'reverse.globalOccupied'
              : 'prism.globalOccupied',
        })
      )
      return
    }
    if (item?.type === 'reverse' && pageHasPoints) {
      message.warning(formatMessage({ id: 'reverse.needEmptyPage' }))
      return
    }
    if (currentSlot === 0) {
      message.warning(
        formatMessage({
          id:
            item?.type === 'prism'
              ? 'prism.lockedMainSlot'
              : 'reverse.lockedMainSlot',
        })
      )
      return
    }
    if (activePlacing === itemId) {
      setPlacingItem(null)
      setPlacingSlot(null)
    } else {
      setPlacingSlot(currentSlot)
      setPlacingItem(itemId)
    }
  }

  function handleNodePlace(node) {
    if (!activePlacing) return
    const item = prismInventory.find((it) => it.id === activePlacing)
    const alreadyPlaced = prismPlaced[node.id] === activePlacing
    const otherPlaced = prismPlaced[node.id] && !alreadyPlaced
    if (!alreadyPlaced && item?.type === 'reverse' && pageHasPoints) {
      message.warning(formatMessage({ id: 'reverse.needEmptyPage' }))
      return
    }
    if (!alreadyPlaced && item?.type === 'reverse') {
      if (!REVERSE_COLUMNS.includes(node.x)) {
        message.warning(formatMessage({ id: 'reverse.placeColumnHint' }))
        return
      }
    }
    const doPlace = () => {
      const ok = buildStore.placeTalentPrism(currentSlot, node.id, activePlacing)
      if (!ok) {
        message.warning(
          formatMessage({
            id:
              item?.type === 'reverse'
                ? 'reverse.globalOccupied'
                : 'prism.globalOccupied',
          })
        )
        return
      }
      setPlacingItem(null)
      setPlacingSlot(null)
    }
    if (otherPlaced) {
      message.warning(formatMessage({ id: 'prism.nodeOccupied' }))
      return
    }
    if (item?.type === 'prism' && !alreadyPlaced) {
      Modal.confirm({
        title: formatMessage({ id: 'prism.placeConfirmTitle' }),
        okText: formatMessage({ id: 'prism.placeConfirmOk' }),
        cancelText: formatMessage({ id: 'prism.placeConfirmCancel' }),
        onOk: doPlace,
      })
      return
    }
    doPlace()
  }

  function selectGod(g) {
    if (slot2Linked) return
    const ok = buildStore.setTalentGod(currentSlot, g)
    if (!ok) message.warning(formatMessage({ id: 'talent.resetFirst' }))
  }

  function selectBranch(b) {
    const ok = buildStore.setTalentBranch(currentSlot, b)
    if (!ok) message.warning(formatMessage({ id: 'talent.resetFirst' }))
  }

  function switchSlot(idx) {
    history.push(`/builder/talents/slot_${idx + 1}`)
  }

  function resetSlot() {
    buildStore.resetSlotTalents(currentSlot)
  }

  function resetAll() {
    buildStore.resetAllTalents()
  }

  const currentSlotLabel = formatMessage({ id: 'talent.slot' }, { n: currentSlot + 1 })
  const hasSelection = Boolean(god) && Boolean(branch)

  const reverseSlider = (min, max, value, onChange, key) => (
    <div className="talents__slider-wrap" key={key}>
      <span className="talents__slider-bound">{min}%</span>
      <Slider
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        tooltipVisible={false}
        className="talents__slider"
      />
      <span className="talents__slider-bound">{max}%</span>
      <span className="talents__slider-value">
        {value > 0 ? '+' : ''}
        {value}%
      </span>
    </div>
  )

  const coreNodes = branchData.coreNodes

  const affixStats = (() => {
    const texts = []
    const pushAffix = (text, count) => {
      if (!text) return
      for (let i = 0; i < count; i += 1) texts.push(text)
    }

    for (const node of branchData.normalNodes) {
      if (reverseClearedIds.has(node.id)) continue
      const value = points[node.id] || 0
      if (value <= 0) continue
      const reverseTarget = reverseTargets.get(node.id)
      if (reverseTarget) {
        const mult = getReverseMultiplier(
          placedReverseEntry?.item,
          reverseTarget.source.kind
        )
        pushAffix(scaleAffixTextByFactor(reverseTarget.source.affix, mult), value)
      } else {
        pushAffix(node.affix, value)
      }
      const covering = placedPrismBoxes.filter(
        (p) =>
          p.nodeId !== node.id &&
          nodeInRangeBox(node, p.box) &&
          prismCoveringApplies(p.item, node.kind)
      )
      for (const p of covering) {
        pushAffix(stripPrismAffixPrefix(p.item.affix), value)
      }
    }

    for (const node of reverseGhostNodes) {
      const value = points[node.id] || 0
      if (value <= 0) continue
      const reverseTarget = reverseTargets.get(node.id)
      const mult = getReverseMultiplier(
        placedReverseEntry?.item,
        reverseTarget?.source.kind || node.kind
      )
      pushAffix(
        scaleAffixTextByFactor(reverseTarget?.source.affix || node.affix, mult),
        value
      )
    }

    for (const node of branchData.coreNodes) {
      const value = corePoints[node.name] || 0
      if (value <= 0) continue
      pushAffix(node.desc || node.name, value)
    }

    return aggregateAffixTexts(texts, normalizeStates(buildStore.build && buildStore.build.configuration))
  })()

  const affixTotalCount =
    affixStats.increase.reduce((s, g) => s + g.count, 0) +
    affixStats.more.reduce((s, g) => s + g.count, 0) +
    affixStats.flat.reduce((s, g) => s + g.count, 0) +
    AFFIX_CONSUMERS.reduce(
      (s, c) => s + (affixStats[c.key] || []).reduce((x, g) => x + g.count, 0),
      0
    ) +
    affixStats.others.reduce((s, g) => s + g.count, 0)

  const renderNode = (node) => {
    if (reverseClearedIds.has(node.id)) return null
    const value = points[node.id] || 0
    const unlocked = node.isCore ? coreUnlocked(node) : normalUnlocked(node)
    const placedItemId = node.isCore ? null : prismPlaced[node.id]
    const placedItem = placedItemId
      ? prismInventory.find((it) => it.id === placedItemId)
      : null
    const replaced = Boolean(placedItem)
    const reverseTarget = node.isCore
      ? null
      : reverseTargets.get(node.id) || null
    const bgKind = reverseTarget ? reverseTarget.source.kind : node.kind
    const kindClass = node.isCore ? '' : KIND_CLASS[bgKind] || ''
    const isReplacedLike = Boolean(replaced)
    const placing = Boolean(activePlacing) && !node.isCore
    const covering = placedPrismBoxes.filter(
      (p) =>
        p.nodeId !== node.id &&
        nodeInRangeBox(node, p.box) &&
        prismCoveringApplies(p.item, node.kind)
    )
    const covered = covering.length > 0
    const cls = [
      'talents__point',
      kindClass,
      isReplacedLike
        ? ''
        : value > 0
          ? 'talents__point--allocated'
          : 'talents__point--dim',
      !isReplacedLike && !unlocked ? 'talents__point--disabled' : '',
      placing ? 'talents__point--placing' : '',
      placedItem ? 'talents__point--prism-placed' : '',
      covered ? 'talents__point--prism-covered' : '',
    ]
      .filter(Boolean)
      .join(' ')
    const tooltipContent = (
      <div className="talents__tooltip">
        <div className="talents__tooltip-affix">
          {node.isCore
            ? node.name
            : reverseTarget
              ? scaleAffixTextByFactor(
                  reverseTarget.source.affix,
                  (value > 0 ? value : 1) *
                    getReverseMultiplier(
                      placedReverseEntry?.item,
                      reverseTarget.source.kind
                    )
                )
              : replaced
                ? placedItem.type === 'reverse'
                  ? formatMessage({ id: 'reverse.name' })
                  : placedItem.kind
                : scaleAffixText(node.affix, value > 0 ? value : 1)}
        </div>
        {replaced && placedItem.type === 'prism' && (
          <div className="talents__tooltip-prism">
            {[placedItem.affix, placedItem.affix2]
              .filter(Boolean)
              .map((a) => (
                <span key={a} className="talents__tooltip-prism-affix">
                  {stripPrismAffixPrefix(a)}
                </span>
              ))}
          </div>
        )}
        {replaced && placedItem.type === 'reverse' && (
          <div className="talents__tooltip-prism">
            <span className="talents__tooltip-prism-affix">
              {formatMessage({ id: 'reverse.desc' }, {
                small: placedItem.small,
                medium: placedItem.medium,
                legendary: placedItem.legendary,
              })}
            </span>
          </div>
        )}
        {!replaced && covered && value > 0 && (
          <div className="talents__tooltip-prism">
            {covering.flatMap((p) => {
              const lines = []
              if (
                !getPrismAffixKind(p.item.affix) ||
                getPrismAffixKind(p.item.affix) === node.kind
              ) {
                lines.push(
                  scaleAffixText(
                    stripPrismAffixPrefix(p.item.affix),
                    value > 0 ? value : 1
                  )
                )
              }
              for (const eff of parsePrismAffix2Effects(p.item.affix2)) {
                if (eff.kind === node.kind) lines.push(eff.text)
              }
              return lines
            }).map((line) => (
              <span
                key={line}
                className="talents__tooltip-prism-affix"
              >
                {line}
              </span>
            ))}
          </div>
        )}
      </div>
    )

    return (
      <Tooltip key={node.id} title={tooltipContent}>
        <g
          className={cls}
          transform={`translate(${node.x}, ${node.y})`}
          onClick={(e) => {
            if (replaced) return
            if (placing && !node.isCore) {
              handleNodePlace(node)
              return
            }
            handleNodeClick(node, node.isCore, e)
          }}
        >
          <rect
            className={`talents__point-bg ${kindClass}`}
            x="0"
            y="0"
            width={node.w}
            height={node.h}
            rx={node.w / 2}
          />
          {replaced && placedItem.type === 'reverse' ? (
            <image
              className="talents__reverse-icon"
              href={encodeURI(prismKindData['逆像']?.imgPath || '/图片/装备/棱镜/逆像.jpg')}
              x="0"
              y="0"
              width={node.w}
              height={node.h}
              onClick={(e) => {
                e.stopPropagation()
                unequipItem(placedReverseEntry.item.id)
              }}
            />
          ) : (
            <image
              href={encodeURI(
                reverseTarget
                  ? reverseTarget.source.path
                  : replaced && prismKindData[placedItem.kind]?.imgPath
                    ? prismKindData[placedItem.kind].imgPath
                    : node.path
              )}
              x="0"
              y="0"
              width={node.w}
              height={node.h}
            />
          )}
          {!replaced && (
            <text
              className="talents__point-level"
              y={node.h - 2}
              x={node.w - 2}
            >
              {`${value}/${nodeLimitWithBonus(node)}`}
            </text>
          )}
        </g>
      </Tooltip>
    )
  }

  return (
    <div className="talents">
      <div className="talents__header">
        <h2 className="talents__title">
          {formatMessage({ id: 'talent.title' }, { slot: currentSlotLabel })}
        </h2>
        <div className="talents__actions">
          <BaseButton size="sm" variant="ghost" onClick={() => modulePresetStore.openDrawer('talents')}>
            {formatMessage({ id: 'preset.open' })}
          </BaseButton>
          <BaseButton size="sm" variant="ghost" onClick={resetSlot}>
            {formatMessage({ id: 'talent.resetSlot' })}
          </BaseButton>
          <BaseButton size="sm" variant="ghost" onClick={resetAll}>
            {formatMessage({ id: 'talent.resetAll' })}
          </BaseButton>
        </div>
      </div>

      <div className="talents__row">
        <span className="talents__label">{formatMessage({ id: 'talent.selectSlot' })}</span>
        <div className="talents__slots">
          {Array.from({ length: SLOT_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`talents__slot-btn ${
                currentSlot === i ? 'talents__slot-btn--active' : ''
              }`}
              onClick={() => switchSlot(i)}
            >
              {formatMessage({ id: 'talent.slot' }, { n: i + 1 })}
            </button>
          ))}
        </div>
        <span className="talents__count">
          {formatMessage({ id: 'talent.allocated' }, { count: spent })}
        </span>
      </div>

      <div className="talents__picker">
        <div className="talents__picker-row">
          <span className="talents__label">{formatMessage({ id: 'talent.god' })}</span>
          <div className="talents__option-group">
            {talentGods.map((g) => (
              <button
                key={g}
                type="button"
                disabled={slot2Linked}
                className={`talents__option ${
                  god === g ? 'talents__option--active' : ''
                } ${slot2Linked ? 'talents__option--locked' : ''}`}
                onClick={() => selectGod(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="talents__picker-row">
          <span className="talents__label">{formatMessage({ id: 'talent.branch' })}</span>
          <div className="talents__option-group">
            {branchOptions.length === 0 && (
              <span className="talents__option-hint">
                {formatMessage({ id: 'talent.branchHint' })}
              </span>
            )}
            {branchOptions.map((b) => (
              <button
                key={b}
                type="button"
                className={`talents__option ${
                  branch === b ? 'talents__option--active' : ''
                }`}
                onClick={() => selectBranch(b)}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasSelection ? (
        <div className="talents__empty">
          {formatMessage({ id: 'talent.emptyHint' })}
        </div>
      ) : (
        <>
          <div className="talents__core">
            <div className="talents__core-title">
              {formatMessage({ id: 'talent.coreTalent' })}
            </div>
            <div className="talents__core-list">
              {coreNodes.map((node, ci) => {
                const value = corePoints[node.name] || 0
                const unlocked = coreUnlocked(node)
                const cls = [
                  'talents__core-card',
                  coreNodes.length > 4 && ci === 3
                    ? 'talents__core-card--group-gap'
                    : '',
                  value > 0 ? 'talents__core-card--allocated' : '',
                  !unlocked ? 'talents__core-card--disabled' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <Tooltip key={node.id} title={node.desc}>
                    <div
                      className={cls}
                      onClick={(e) => handleNodeClick(node, true, e)}
                    >
                      <div className="talents__core-icon">
                        <img
                          src={encodeURI(node.path)}
                          alt={node.name}
                          className="talents__core-img"
                        />
                      </div>
                      <div className="talents__core-name">{node.name}</div>
                    </div>
                  </Tooltip>
                )
              })}
            </div>
          </div>

          <div
            className={`talents__board ${
              placingPrism ? 'talents__board--placing-prism' : ''
            }`}
          >
            <svg
              width={SVG_WIDTH}
              height={SVG_HEIGHT}
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="talents__svg"
            >
              <g transform={`translate(${SVG_PAD}, ${SVG_PAD})`}>
                {branchData.lines
                  .filter(
                    (line) =>
                      !(
                        reverseRegionNodeIds.has(line.from) ||
                        reverseRegionNodeIds.has(line.to)
                      )
                  )
                  .map((line) => (
                    <line
                      key={line.key}
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      className="talents__line"
                    />
                  ))}
                {placedPrismBoxes.map((p) => (
                  <rect
                    key={`range-${p.nodeId}`}
                    x={p.box.x1}
                    y={p.box.y1}
                    width={p.box.width}
                    height={p.box.height}
                    className="talents__prism-range"
                  />
                ))}
                {reverseRangeBox && (
                  <rect
                    x={reverseRangeBox.x1}
                    y={reverseRangeBox.y1}
                    width={reverseRangeBox.width}
                    height={reverseRangeBox.height}
                    className="talents__reverse-range"
                  />
                )}
                {reverseMirrorBox && (
                  <rect
                    x={reverseMirrorBox.x1}
                    y={reverseMirrorBox.y1}
                    width={reverseMirrorBox.width}
                    height={reverseMirrorBox.height}
                    className="talents__reverse-range-mirror"
                  />
                )}
                {branchData.normalNodes.map((node) => renderNode(node))}
                {reverseGhostNodes.map((node) => renderNode(node))}
              </g>
            </svg>
          </div>

          {activePlacing && (
            <div className="talents__placing-hint">
              {formatMessage({
                id: activePlacingItem?.type === 'prism'
                  ? 'prism.placingPrismHint'
                  : 'reverse.placingHint',
              })}
              <BaseButton size="sm" variant="ghost" onClick={() => togglePlacing(null)}>
                {formatMessage({ id: 'prism.cancelPlace' })}
              </BaseButton>
            </div>
          )}
        </>
      )}
      <div className="talents__tip">
        {formatMessage({ id: 'talent.holdCtrlToRemove' })}
      </div>
      <div className="talents__panels">
            <div className="talents__panel">
              <div className="talents__panel-head">
                <div className="talents__panel-title">
                  {formatMessage({ id: 'prism.title' })}
                </div>
                <Button
                  size="small"
                  type="text"
                  danger
                  disabled={
                    prismInventory.filter((it) => it.type === 'prism')
                      .length === 0
                  }
                  onClick={() => clearInventory('prism')}
                >
                  {formatMessage({ id: 'prism.clearAll' })}
                </Button>
              </div>
              <div className="talents__panel-field">
                <span className="talents__label">
                  {formatMessage({ id: 'prism.kind' })}
                </span>
                <Select
                  className="talents__panel-select"
                  value={prismKind || undefined}
                  placeholder={formatMessage({ id: 'divinity.crafter.none' })}
                  onChange={changePrismKind}
                  options={PRISM_KINDS.map((k) => ({
                    value: k.name,
                    label: k.name,
                  }))}
                />
              </div>
              <div className="talents__panel-field">
                <span className="talents__label">
                  {formatMessage({ id: 'prism.range' })}
                </span>
                <Select
                  className="talents__panel-select"
                  value={prismRange || undefined}
                  placeholder={formatMessage({ id: 'divinity.crafter.none' })}
                  onChange={setPrismRange}
                  options={PRISM_RANGES.map((r) => ({
                    value: r,
                    label: r,
                  }))}
                />
              </div>
              <div className="talents__panel-field">
                <span className="talents__label">
                  {formatMessage({ id: 'prism.randomAffix' })}
                </span>
                <Select
                  className="talents__panel-select"
                  value={prismAffix || undefined}
                  placeholder={formatMessage({ id: 'divinity.crafter.none' })}
                  onChange={setPrismAffix}
                  showSearch
                  optionFilterProp="label"
                  options={prismAffixOptions}
                />
              </div>
              {!prismOneAffix && (
                <div className="talents__panel-field">
                  <span className="talents__label">
                    {formatMessage({ id: 'prism.randomAffix2' })}
                  </span>
                  <Select
                    className="talents__panel-select"
                    value={prismAffix2 || undefined}
                    placeholder={formatMessage({ id: 'divinity.crafter.none' })}
                    onChange={setPrismAffix2}
                    showSearch
                    optionFilterProp="label"
                    options={prismAffix2Options}
                  />
                </div>
              )}
              <BaseButton
                size="sm"
                variant="primary"
                disabled={
                  !prismKind ||
                  !prismRange ||
                  !prismAffix ||
                  (!prismOneAffix && !prismAffix2)
                }
                onClick={savePrism}
              >
                {formatMessage({ id: 'prism.save' })}
              </BaseButton>
              {prismInventory.filter((it) => it.type === 'prism').length ===
              0 ? (
                <p className="talents__panel-empty">
                  {formatMessage({ id: 'prism.empty' })}
                </p>
              ) : (
                <div className="talents__panel-list">
                  {prismInventory
                    .filter((it) => it.type === 'prism')
                    .map((item) => {
                      const equipped = Boolean(allPlaced[item.id])
                      return (
                        <div
                          key={item.id}
                          className={`talents__panel-item ${
                            equipped ? 'talents__panel-item--equipped' : ''
                          } ${
                            activePlacing === item.id
                              ? 'talents__panel-item--active'
                              : ''
                          }`}
                          onClick={() => togglePlacing(item.id)}
                        >
                          <div className="talents__panel-item-main">
                            <span className="talents__panel-item-name">
                              {item.kind}
                            </span>
                            <span className="talents__panel-item-desc">
                              {item.range}；{item.affix}
                              {item.affix2 ? `；${item.affix2}` : ''}
                            </span>
                            {equipped && (
                              <span className="talents__panel-item-equipped">
                                {formatMessage({ id: 'prism.equipped' })}
                              </span>
                            )}
                          </div>
                          <Button
                            size="small"
                            type="text"
                            danger
                            onClick={(e) => {
                              e.stopPropagation()
                              removeInventoryItem(item.id)
                            }}
                          >
                            {formatMessage({ id: 'divinity.inventory.delete' })}
                          </Button>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            <div className="talents__panel">
              <div className="talents__panel-head">
                <div className="talents__panel-title">
                  {formatMessage({ id: 'reverse.title' })}
                </div>
                <Button
                  size="small"
                  type="text"
                  danger
                  disabled={
                    prismInventory.filter((it) => it.type === 'reverse')
                      .length === 0
                  }
                  onClick={() => clearInventory('reverse')}
                >
                  {formatMessage({ id: 'reverse.clearAll' })}
                </Button>
              </div>
              <div className="talents__panel-field">
                <span className="talents__label">
                  {formatMessage({ id: 'reverse.small' })}
                </span>
                {reverseSlider(-100, 200, reverseSmall, setReverseSmall, 'rs')}
              </div>
              <div className="talents__panel-field">
                <span className="talents__label">
                  {formatMessage({ id: 'reverse.medium' })}
                </span>
                {reverseSlider(-100, 100, reverseMedium, setReverseMedium, 'rm')}
              </div>
              <div className="talents__panel-field">
                <span className="talents__label">
                  {formatMessage({ id: 'reverse.legendary' })}
                </span>
                {reverseSlider(-100, 50, reverseLegendary, setReverseLegendary, 'rl')}
              </div>
              <BaseButton size="sm" variant="primary" onClick={saveReverse}>
                {formatMessage({ id: 'reverse.save' })}
              </BaseButton>
              {prismInventory.filter((it) => it.type === 'reverse').length ===
              0 ? (
                <p className="talents__panel-empty">
                  {formatMessage({ id: 'reverse.empty' })}
                </p>
              ) : (
                <div className="talents__panel-list">
                  {prismInventory
                    .filter((it) => it.type === 'reverse')
                    .map((item) => {
                      const equipped = Boolean(allPlaced[item.id])
                      return (
                        <div
                          key={item.id}
                          className={`talents__panel-item ${
                            equipped ? 'talents__panel-item--equipped' : ''
                          } ${
                            activePlacing === item.id
                              ? 'talents__panel-item--active'
                              : ''
                          }`}
                          onClick={() => togglePlacing(item.id)}
                        >
                          <div className="talents__panel-item-main">
                            <span className="talents__panel-item-name">
                              {formatMessage({ id: 'reverse.name' })}
                            </span>
                            <span className="talents__panel-item-desc">
                              {formatMessage({ id: 'reverse.desc' }, {
                                small: item.small,
                                medium: item.medium,
                                legendary: item.legendary,
                              })}
                            </span>
                            {equipped && (
                              <span className="talents__panel-item-equipped">
                                {formatMessage({ id: 'reverse.equipped' })}
                              </span>
                            )}
                          </div>
                          <Button
                            size="small"
                            type="text"
                            danger
                            onClick={(e) => {
                              e.stopPropagation()
                              removeInventoryItem(item.id)
                            }}
                          >
                            {formatMessage({ id: 'divinity.inventory.delete' })}
                          </Button>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
            <div className="talents__panel">
              <div className="talents__panel-head">
                <div className="talents__panel-title">
                  {formatMessage({ id: 'talent.affixStats.title' })}
                </div>
                {affixTotalCount > 0 && (
                  <span className="talents__panel-count">
                    {formatMessage({ id: 'talent.affixStats.count' }, { count: affixTotalCount })}
                  </span>
                )}
              </div>
              {affixTotalCount === 0 ? (
                <p className="talents__panel-empty">
                  {formatMessage({ id: 'talent.affixStats.empty' })}
                </p>
              ) : (
                <div className="talents__affix-stats">
                  {affixStats.increase.length > 0 && (
                    <div className="talents__affix-group">
                      <div className="talents__affix-group-title">
                        {formatMessage({ id: 'talent.affixStats.increase' })}
                      </div>
                      {affixStats.increase.map((g) => (
                        <div key={g.text} className="talents__affix-row">
                          <span className="talents__affix-text">
                            {cleanAffixText(g.text)}
                          </span>
                          <span className="talents__affix-count">
                            {formatMessage({ id: 'talent.affixStats.times' }, { count: g.count })}
                          </span>
                          <span className="talents__affix-total">
                            {g.value >= 0 ? '+' : ''}
                            {g.total}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {affixStats.more.length > 0 && (
                    <div className="talents__affix-group">
                      <div className="talents__affix-group-title">
                        {formatMessage({ id: 'talent.affixStats.more' })}
                      </div>
                      {affixStats.more.map((g) => (
                        <div key={g.text} className="talents__affix-row">
                          <span className="talents__affix-text">
                            {cleanAffixText(g.text)}
                          </span>
                          <span className="talents__affix-count">
                            {formatMessage({ id: 'talent.affixStats.times' }, { count: g.count })}
                          </span>
                          <span className="talents__affix-total talents__affix-total--more">
                            ×{g.multiplier}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {affixStats.flat.length > 0 && (
                    <div className="talents__affix-group">
                      <div className="talents__affix-group-title">
                        {formatMessage({ id: 'talent.affixStats.flat' })}
                      </div>
                      {affixStats.flat.map((g) => (
                        <div key={g.text} className="talents__affix-row">
                          <span className="talents__affix-text">
                            {cleanAffixText(g.text)}
                          </span>
                          <span className="talents__affix-count">
                            {formatMessage({ id: 'talent.affixStats.times' }, { count: g.count })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {AFFIX_CONSUMERS.map((c) => {
                    const items = affixStats[c.key] || []
                    if (items.length === 0) return null
                    return (
                      <div key={c.key} className="talents__affix-group">
                        <div className="talents__affix-group-title">
                          {formatMessage({ id: c.label })}
                        </div>
                        {items.map((g) => (
                          <div key={g.text} className="talents__affix-row">
                            <span className="talents__affix-text">
                              {cleanAffixText(g.text)}
                            </span>
                            <span className="talents__affix-count">
                              {formatMessage({ id: 'affixStats.times' }, { count: g.count })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {affixStats.others.length > 0 && (
                    <div className="talents__affix-group">
                      <div className="talents__affix-group-title">
                        {formatMessage({ id: 'talent.affixStats.others' })}
                      </div>
                      {affixStats.others.map((g) => (
                        <div key={g.text} className="talents__affix-row">
                          <span className="talents__affix-text">
                            {cleanAffixText(g.text)}
                          </span>
                          <span className="talents__affix-count">
                            {formatMessage({ id: 'talent.affixStats.times' }, { count: g.count })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>


    </div>
  )
}

export default observer(TalentsPage)
