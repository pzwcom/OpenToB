import { useCallback, useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useIntl } from 'react-intl'
import { message } from 'antd'
import { buildStore } from '../stores/buildStore.js'
import BaseButton from '../components/ui/BaseButton.jsx'
import BaseModal from '../components/ui/BaseModal.jsx'
import DivinityGrid from '../components/divinity/DivinityGrid.jsx'
import SlateEditToolbar from '../components/divinity/SlateEditToolbar.jsx'
import SlateCrafter from '../components/divinity/SlateCrafter.jsx'
import LegendarySlateCrafter from '../components/divinity/LegendarySlateCrafter.jsx'
import NetherKingSlateCrafter from '../components/divinity/NetherKingSlateCrafter.jsx'
import SlateInventory from '../components/divinity/SlateInventory.jsx'
import AffixStatsPanel from '../components/affix/AffixStatsPanel.jsx'
import '../components/divinity/divinity.less'
import {
  CELL_SIZE,
  GODS,
  GOD_NAMES,
  GRID_COLS,
  GRID_ROWS,
  createSlateId,
  getGodColor,
  getShapeCells,
  getShapeLabel,
  hasPlacedNetherKing,
  LEGENDARY_SLATE_LIMITS,
  NETHER_KING_COLOR,
  placedLegendaryCount,
  normalizeTalentType,
} from '../data/divinityData.js'

const AFFIX_TYPE_IDS = [
  ['小型天赋', 'divinity.crafter.microGroup'],
  ['中型天赋', 'divinity.crafter.mediumGroup'],
  ['传奇中型天赋', 'divinity.crafter.legendaryGroup'],
]

const NETHER_AFFIX_TYPE_IDS = [
  ['小型冥王天赋点', 'divinity.netherKing.small'],
  ['中型冥王天赋点', 'divinity.netherKing.medium'],
  ['传奇中型冥王天赋点', 'divinity.netherKing.legendaryMedium'],
  ['至臻冥王天赋点', 'divinity.netherKing.supreme'],
]

function DivinityPage() {
  const { formatMessage } = useIntl()

  const div = buildStore.build.divinityPage || { inventory: [], placedSlates: [] }
  const inventory = div.inventory || []
  const placedSlates = div.placedSlates || []

  const [selectedSlateId, setSelectedSlateId] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')

  const [toolbarVisible, setToolbarVisible] = useState(false)
  const [toolbarTargetRect, setToolbarTargetRect] = useState(null)
  const [toolbarShapeLabel, setToolbarShapeLabel] = useState('')

  const selectedSlate = selectedSlateId
    ? inventory.find((s) => s.id === selectedSlateId) || null
    : null
  const placedSlateIds = placedSlates.map((p) => p.slateId)

  function isPlaced(slateId) {
    return placedSlateIds.includes(slateId)
  }

  function selectSlateById(id) {
    setSelectedSlateId(id)
    setToolbarVisible(false)
  }

  function placeAtCenter(slate) {
    const currentPlaced = buildStore.build.divinityPage?.placedSlates || []
    if (currentPlaced.some((p) => p.slateId === slate.id)) return
    if (slate.isNetherKing && hasPlacedNetherKing(currentPlaced, inventory)) {
      message.warning(formatMessage({ id: 'divinity.netherKingLimit' }))
      return
    }
    const legendLimit = slate.legendaryName ? LEGENDARY_SLATE_LIMITS[slate.legendaryName] : 0
    if (
      legendLimit &&
      placedLegendaryCount(currentPlaced, inventory, slate.legendaryName) >= legendLimit
    ) {
      message.warning(
        formatMessage({ id: 'divinity.legendaryLimit' }, { name: slate.legendaryName, limit: legendLimit })
      )
      return
    }
    const cells = getShapeCells(slate.shape, slate.rotation, slate.flippedH, slate.flippedV)
    const maxR = Math.max(...cells.map(([r]) => r))
    const maxC = Math.max(...cells.map(([, c]) => c))
    const centerRow = Math.max(0, Math.floor((GRID_ROWS - maxR - 1) / 2))
    const centerCol = Math.max(0, Math.floor((GRID_COLS - maxC - 1) / 2))
    buildStore.setDivinityPlaced([...currentPlaced, { slateId: slate.id, col: centerCol, row: centerRow }])
  }

  function addSlateToInventory(slate) {
    buildStore.addDivinitySlate(slate)
    setSelectedSlateId(slate.id)
    if (!isPlaced(slate.id)) {
      placeAtCenter(slate)
    }
  }

  function startPlacing(slateId) {
    setSelectedSlateId(slateId)
    const sl = inventory.find((s) => s.id === slateId)
    if (sl && !isPlaced(slateId)) {
      placeAtCenter(sl)
    }
  }

  function removePlaced(slateId) {
    buildStore.setDivinityPlaced(placedSlates.filter((p) => p.slateId !== slateId))
  }

  function copySlate(src) {
    const copy = JSON.parse(JSON.stringify(src))
    copy.id = createSlateId()
    buildStore.setDivinityInventory([...inventory, copy])
    setSelectedSlateId(copy.id)
  }

  function deleteSlate(slateId) {
    removePlaced(slateId)
    buildStore.setDivinityInventory(inventory.filter((s) => s.id !== slateId))
    if (selectedSlateId === slateId) setSelectedSlateId(null)
    setToolbarVisible(false)
  }

  function updateSlate(slateId, updates) {
    buildStore.updateDivinitySlate(slateId, updates)
  }

  function rotateSlate(delta) {
    const s = selectedSlate
    if (!s) return
    const newRot = ((s.rotation + delta) % 360 + 360) % 360
    updateSlate(s.id, { rotation: newRot })
    removePlaced(s.id)
    setToolbarVisible(false)
  }

  function flipHSlate() {
    const s = selectedSlate
    if (!s) return
    updateSlate(s.id, { flippedH: !s.flippedH, flippedV: false })
    removePlaced(s.id)
    setToolbarVisible(false)
  }

  function flipVSlate() {
    const s = selectedSlate
    if (!s) return
    updateSlate(s.id, { flippedV: !s.flippedV, flippedH: false })
    removePlaced(s.id)
    setToolbarVisible(false)
  }

  function changeGod(god) {
    const s = selectedSlate
    if (!s) return
    updateSlate(s.id, { god, affixes: s.affixes.map((a) => ({ ...a, nodeType: '' })) })
  }

  function setAffixType(idx, value) {
    const s = selectedSlate
    if (!s) return
    const affixes = [...s.affixes]
    affixes[idx] = { ...affixes[idx], nodeType: value }
    updateSlate(s.id, { affixes })
  }

  function setAffixText(idx, value) {
    const s = selectedSlate
    if (!s) return
    const affixes = [...s.affixes]
    affixes[idx] = { ...affixes[idx], text: value }
    updateSlate(s.id, { affixes })
  }

  function handleImport() {
    setImportError('')
    try {
      const data = JSON.parse(importText)
      const arr = Array.isArray(data) ? data : [data]
      const newSlates = []
      for (const item of arr) {
        const affixes = (item.affixes || []).map((text, i) => ({
          slotIndex: i,
          nodeType: '',
          text: typeof text === 'string' ? text : text.text || text.effect || '',
        }))
        let god = 'Might'
        if (item.god) {
          const found = GODS.find((g) => g.toLowerCase() === item.god.toLowerCase())
          if (found) god = found
        }
        newSlates.push({
          id: createSlateId(),
          god,
          shape: item.shape || 'O',
          rotation: item.rotation || 0,
          flippedH: item.flippedH || false,
          flippedV: item.flippedV || false,
          affixes,
          isLegendary: !!item.isLegendary,
          legendaryName: item.legendaryName || item.name || undefined,
        })
      }
      buildStore.setDivinityInventory([...inventory, ...newSlates])
      setShowImportModal(false)
      setImportText('')
    } catch (e) {
      setImportError(formatMessage({ id: 'divinity.import.error' }, { msg: e.message }))
    }
  }

  function handleShowToolbar({ row, col }) {
    const el = document.querySelector('[data-divinity-grid]')
    if (!el) return
    const rect = el.getBoundingClientRect()
    const displayStartCol = -1
    const displayStartRow = -1
    setToolbarTargetRect({
      left: rect.left + (col - displayStartCol) * CELL_SIZE,
      top: rect.top + (row - displayStartRow) * CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
    })
    setToolbarShapeLabel(selectedSlate ? getShapeLabel(selectedSlate.shape) : '')
    setToolbarVisible(true)
  }

  useEffect(() => {
    function onGlobalClick(e) {
      if (toolbarVisible && !e.target.closest('[data-toolbar]')) {
        setToolbarVisible(false)
      }
    }
    document.addEventListener('click', onGlobalClick)
    return () => document.removeEventListener('click', onGlobalClick)
  }, [toolbarVisible])

  const handleGridPlace = useCallback((newPlaced) => buildStore.setDivinityPlaced(newPlaced), [])
  const handleGridSelect = useCallback((id) => selectSlateById(id), [])

  return (
    <div className="divinity">
      <div className="divinity__header">
        <h2 className="divinity__title">{formatMessage({ id: 'divinity.title' })}</h2>
      </div>

      <div className="divinity__body">
        <div className="divinity__grid-wrap">
          <DivinityGrid
            inventory={inventory}
            placedSlates={placedSlates}
            onPlace={handleGridPlace}
            onSelect={handleGridSelect}
            onDelete={deleteSlate}
            onShowToolbar={handleShowToolbar}
          />

          <div className="divinity__grid-stats">
            <AffixStatsPanel
              titleKey="affixStats.talentAffixTitle"
              stats={buildStore.divinityAffixStats}
              defaultOpen
            />
          </div>
        </div>

        <div className="divinity__side">
          <div className="divinity__legend">
            {GODS.map((god) => (
              <span key={god} className="divinity__legend-item">
                <span className="divinity__legend-dot" style={{ backgroundColor: getGodColor(god).stroke }} />
                {GOD_NAMES[god]}
              </span>
            ))}
            <span className="divinity__legend-item">
              <span className="divinity__legend-dot" style={{ backgroundColor: '#ea580c' }} />
              {formatMessage({ id: 'divinity.legendary' })}
            </span>
            <span className="divinity__legend-item">
              <span className="divinity__legend-dot" style={{ backgroundColor: NETHER_KING_COLOR.stroke }} />
              {formatMessage({ id: 'divinity.netherKing' })}
            </span>
            <span className="divinity__legend-item">
              <span className="divinity__legend-dot" style={{ backgroundColor: 'rgba(245,158,11,0.7)' }} />
              {formatMessage({ id: 'divinity.gridBoostLegend' })}
            </span>
            <span className="divinity__legend-item">
              <span className="divinity__legend-dot" style={{ backgroundColor: 'rgba(56,189,248,0.7)' }} />
              {formatMessage({ id: 'divinity.gridProjectLegend' })}
            </span>
          </div>

          <SlateCrafter onSave={addSlateToInventory} />
          <LegendarySlateCrafter onSave={addSlateToInventory} />
          <NetherKingSlateCrafter onSave={addSlateToInventory} />

          <SlateInventory
            items={inventory}
            selectedId={selectedSlateId}
            placedSlateIds={placedSlateIds}
            onSelect={selectSlateById}
            onPlace={startPlacing}
            onCopy={copySlate}
            onDelete={deleteSlate}
            onImport={() => setShowImportModal(true)}
          />

          {selectedSlate && (
            <div className="divinity-selected">
              <div className="divinity-selected__head">
                <h3 className="divinity-selected__name">
                  {selectedSlate.isNetherKing
                    ? selectedSlate.netherKingName
                    : selectedSlate.isLegendary
                      ? selectedSlate.legendaryName
                      : GOD_NAMES[selectedSlate.god] || formatMessage({ id: 'divinity.inventory.slate' })}
                </h3>
                <span className="divinity-selected__shape">{getShapeLabel(selectedSlate.shape)}</span>
              </div>

              <div className="divinity-selected__actions">
                <BaseButton size="sm" variant="ghost" onClick={() => placeAtCenter(selectedSlate)}>
                  {formatMessage({ id: 'divinity.selected.placeBoard' })}
                </BaseButton>
                {isPlaced(selectedSlate.id) && (
                  <BaseButton size="sm" variant="ghost" onClick={() => removePlaced(selectedSlate.id)}>
                    {formatMessage({ id: 'divinity.selected.removeBoard' })}
                  </BaseButton>
                )}
                <BaseButton size="sm" variant="ghost" onClick={() => copySlate(selectedSlate)}>
                  {formatMessage({ id: 'divinity.selected.copy' })}
                </BaseButton>
                <BaseButton size="sm" variant="ghost" className="divinity-selected__delete" onClick={() => deleteSlate(selectedSlate.id)}>
                  {formatMessage({ id: 'divinity.selected.delete' })}
                </BaseButton>
              </div>

              <div className="divinity-selected__transform">
                <span className="divinity-selected__transform-label">
                  {formatMessage({ id: 'divinity.selected.transform' })}
                </span>
                <button type="button" className="divinity-tool-btn" onClick={() => rotateSlate(-90)}>
                  &#x21B6;
                </button>
                <button type="button" className="divinity-tool-btn" onClick={() => rotateSlate(90)}>
                  &#x21B7;
                </button>
                <button type="button" className="divinity-tool-btn" onClick={flipHSlate}>
                  &#x2194;
                </button>
                <button type="button" className="divinity-tool-btn" onClick={flipVSlate}>
                  &#x2195;
                </button>
              </div>

              {!selectedSlate.isLegendary && (
                <div>
                  <label className="divinity-label">{formatMessage({ id: 'divinity.selected.god' })}</label>
                  <div className="divinity-chip-row">
                    {GODS.map((god) => (
                      <button
                        key={god}
                        type="button"
                        className={`divinity-chip ${
                          selectedSlate.god === god ? 'divinity-chip--active' : ''
                        }`}
                        style={
                          selectedSlate.god === god
                            ? {
                                backgroundColor: getGodColor(god).fill,
                                borderColor: getGodColor(god).stroke,
                                color: getGodColor(god).stroke,
                              }
                            : undefined
                        }
                        onClick={() => changeGod(god)}
                      >
                        {GOD_NAMES[god]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="divinity-label">
                  {formatMessage({
                    id: selectedSlate.isNetherKing ? 'divinity.selected.netherSlots' : 'divinity.selected.affixes',
                  })}
                </label>
                {selectedSlate.isNetherKing && selectedSlate.inherentAffix && (
                  <div className="divinity-affix-row">
                    <span className="divinity-affix-idx">#0</span>
                    <span className="divinity-affix-block__label" style={{ color: NETHER_KING_COLOR.stroke }}>
                      {formatMessage({ id: 'divinity.netherKingCrafter.inherentAffix' })}
                    </span>
                    <span className="divinity-affix-text">{selectedSlate.inherentAffix}</span>
                  </div>
                )}
                <div className="divinity-affix-list">
                  {(selectedSlate.affixes || []).map((affix, ai) => (
                    <div key={ai} className="divinity-affix-row">
                      <span className="divinity-affix-idx">#{ai + 1}</span>
                      <select
                        className="divinity-select"
                        value={normalizeTalentType(affix.nodeType) || ''}
                        onChange={(e) => setAffixType(ai, e.target.value)}
                      >
                        <option value="">{formatMessage({ id: 'divinity.crafter.none' })}</option>
                        {(selectedSlate.isNetherKing ? NETHER_AFFIX_TYPE_IDS : AFFIX_TYPE_IDS)
                          .map(([type, msgId]) => (
                            <option key={type} value={type}>
                              {formatMessage({ id: msgId })}
                            </option>
                          ))}
                      </select>
                      <input
                        className="divinity-select divinity-select--flex3"
                        value={affix.text || ''}
                        placeholder={formatMessage({ id: 'divinity.selected.affixPlaceholder' })}
                        onChange={(e) => setAffixText(ai, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <BaseModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        size="sm"
        title={formatMessage({ id: 'divinity.import.title' })}
      >
        <div className="divinity-panel__body">
          <textarea
            className="divinity-import-textarea"
            value={importText}
            placeholder={formatMessage({ id: 'divinity.import.placeholder' })}
            onChange={(e) => setImportText(e.target.value)}
          />
          {importError && <p className="divinity-import-error">{importError}</p>}
          <div className="divinity-import-actions">
            <BaseButton size="sm" variant="secondary" onClick={() => setShowImportModal(false)}>
              {formatMessage({ id: 'divinity.import.cancel' })}
            </BaseButton>
            <BaseButton size="sm" variant="primary" onClick={handleImport}>
              {formatMessage({ id: 'divinity.import.confirm' })}
            </BaseButton>
          </div>
        </div>
      </BaseModal>

      <SlateEditToolbar
        visible={toolbarVisible}
        targetRect={toolbarTargetRect}
        shapeLabel={toolbarShapeLabel}
        onRotate={(delta) => {
          rotateSlate(delta)
          setToolbarVisible(false)
        }}
        onFlipH={() => {
          flipHSlate()
          setToolbarVisible(false)
        }}
        onFlipV={() => {
          flipVSlate()
          setToolbarVisible(false)
        }}
        onRemove={() => {
          const s = selectedSlate
          if (s) removePlaced(s.id)
          setToolbarVisible(false)
        }}
      />
    </div>
  )
}

export default observer(DivinityPage)
