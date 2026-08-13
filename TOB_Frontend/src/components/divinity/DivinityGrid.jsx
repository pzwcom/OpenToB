import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { message, Tooltip } from 'antd'
import DivinityGridCell from './DivinityGridCell.jsx'
import {
  INFECTION_PROJECTION,
  JUDGMENT_BOOST,
  collectDivinityCopiedAffixes,
  collectDivinitySlateEffects,
} from '../../utils/affixAggregation.js'
import { cleanAffixText } from '../../utils/affixText.js'
import { scaleAffixTextByFactor } from '../../utils/talentTree.js'
import {
  CELL_SIZE,
  DISPLAY_PAD,
  GOD_NAMES,
  GRID_COLS,
  GRID_ROWS,
  computeSlateEdges,
  findOutOfBoundsCells,
  findOverlappingCells,
  getShapeCells,
  getShapeLabel,
  getSlateColor,
  hasPlacedNetherKing,
  isValidGridCell,
  LEGENDARY_SLATE_LIMITS,
  normalizeTalentType,
  placedLegendaryCount,
} from '../../data/divinityData.js'

const DISP_ROWS = GRID_ROWS + DISPLAY_PAD * 2
const DISP_COLS = GRID_COLS + DISPLAY_PAD * 2
const DISP_START = -DISPLAY_PAD

// 整块石板悬浮提示：石板整体作为单一 hover 目标（不按格子拆分）
function SlateBlock({
  slate,
  cells,
  cellSize,
  edges,
  overlapSet,
  boosted,
  projections,
  copied,
  dragging,
  onHover,
  onMouseDown,
  onClick,
  onContextMenu,
}) {
  const { formatMessage } = useIntl()
  const minRow = Math.min(...cells.map((c) => c.row))
  const minCol = Math.min(...cells.map((c) => c.col))
  const maxRow = Math.max(...cells.map((c) => c.row))
  const maxCol = Math.max(...cells.map((c) => c.col))
  const rowCount = maxRow - minRow + 1
  const colCount = maxCol - minCol + 1
  const slateId = slate.id

  const boxCells = []
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      boxCells.push({ row: r, col: c, isSlateCell: cells.some((cc) => cc.row === r && cc.col === c) })
    }
  }

  const name = slate.isNetherKing
    ? slate.netherKingName
    : slate.isLegendary
      ? slate.legendaryName
      : GOD_NAMES[slate.god] || ''
  const affixList = []
  if (slate.isNetherKing && slate.inherentAffix) {
    affixList.push({
      type: formatMessage({ id: 'divinity.netherKingCrafter.inherentAffix' }),
      text: slate.inherentAffix,
    })
  }
  for (const a of slate.affixes || []) {
    const text = typeof a === 'string' ? a : a?.text
    if (!text) continue
    affixList.push({ type: normalizeTalentType(a?.nodeType || ''), text })
  }

  const tipContent = (
    <div className="divinity-grid__cell-tip">
      <div className="divinity-grid__cell-tip-name">
        {name}
        {getShapeLabel(slate.shape) ? ` · ${getShapeLabel(slate.shape)}` : ''}
      </div>
      {affixList.map((a, ai) => (
        <div key={ai} className="divinity-grid__cell-tip-affix">
          {a.type && <span className="divinity-grid__cell-tip-type">{a.type}</span>}
          <span className="divinity-grid__cell-tip-text">
            {cleanAffixText(boosted ? scaleAffixTextByFactor(a.text, JUDGMENT_BOOST) : a.text)}
          </span>
        </div>
      ))}
      {boosted && (
        <div className="divinity-grid__cell-tip-note">
          {formatMessage({ id: 'divinity.gridBoost' }, { value: JUDGMENT_BOOST })}
        </div>
      )}
      {projections.length > 0 && (
        <>
          <div className="divinity-grid__cell-tip-note">
            {formatMessage({ id: 'divinity.gridProject' }, { value: INFECTION_PROJECTION })}
          </div>
          {projections.map((p, pi) => (
            <div key={pi} className="divinity-grid__cell-tip-text">
              {cleanAffixText(p.text)}
            </div>
          ))}
        </>
      )}
      {copied.length > 0 && (
        <>
          <div className="divinity-grid__cell-tip-note">
            {formatMessage({ id: 'divinity.gridCopied' })}
          </div>
          {copied.map((c, ci) => (
            <div key={ci} className="divinity-grid__cell-tip-affix">
              {c.source && (
                <span className="divinity-grid__cell-tip-type">
                  {formatMessage({ id: 'divinity.gridCopiedFrom' }, { source: c.source })}
                </span>
              )}
              <span className="divinity-grid__cell-tip-text">
                {cleanAffixText(boosted ? scaleAffixTextByFactor(c.text, JUDGMENT_BOOST) : c.text)}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )

  const inner = (
    <div
      className="divinity-grid__slate"
      onMouseEnter={() => onHover(slateId)}
      onMouseLeave={() => onHover(null)}
      style={{
        gridRowStart: minRow - DISP_START + 1,
        gridRowEnd: minRow - DISP_START + 1 + rowCount,
        gridColumnStart: minCol - DISP_START + 1,
        gridColumnEnd: minCol - DISP_START + 1 + colCount,
        display: 'grid',
        gridTemplateColumns: `repeat(${colCount}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rowCount}, ${cellSize}px)`,
        gap: 1,
      }}
    >
      {boxCells.map((c, bi) =>
        c.isSlateCell ? (
          <div
            key={bi}
            style={{ gridRow: c.row - minRow + 1, gridColumn: c.col - minCol + 1 }}
          >
            <DivinityGridCell
              row={c.row}
              col={c.col}
              cellSize={cellSize}
              slateId={slateId}
              slates={[slate]}
              edges={edges}
              isOverlapping={overlapSet.has(`${c.row},${c.col}`)}
              boosted={boosted}
              projections={projections}
              onMouseDown={onMouseDown}
              onClick={onClick}
              onContextMenu={onContextMenu}
            />
          </div>
        ) : (
          <div
            key={bi}
            className={
              isValidGridCell(c.row, c.col)
                ? 'divinity-grid__cell-hole'
                : 'divinity-grid__cell-hole divinity-grid__cell-hole--void'
            }
            style={{
              width: cellSize,
              height: cellSize,
              gridRow: c.row - minRow + 1,
              gridColumn: c.col - minCol + 1,
            }}
          />
        )
      )}
    </div>
  )

  if (dragging) return inner
  return (
    <Tooltip title={tipContent} placement="top" mouseEnterDelay={0.3}>
      {inner}
    </Tooltip>
  )
}

export default function DivinityGrid({
  inventory,
  placedSlates,
  onPlace,
  onSelect,
  onDelete,
  onShowToolbar,
}) {
  const { formatMessage } = useIntl()
  const gridRef = useRef(null)
  const [dragUI, setDragUI] = useState({ state: null, preview: null, float: null })
  const dragRef = useRef(dragUI)
  const listenersRef = useRef({ move: null, up: null })
  const commit = () => setDragUI({ ...dragRef.current })

  // 悬浮石板 + 按键删除（d）：hover 整块石板时按 d 删除该石板
  const hoveredSlateIdRef = useRef(null)
  const handleHover = useCallback((slateId) => {
    hoveredSlateIdRef.current = slateId
  }, [])
  useEffect(() => {
    function onKeyDown(e) {
      if (!(e.key === 'd' || e.key === 'D')) return
      const tag = e.target && e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (dragRef.current.state) return
      const id = hoveredSlateIdRef.current
      if (!id) return
      hoveredSlateIdRef.current = null
      onDelete(id)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDelete])

  const placedMap = useMemo(() => {
    const map = {}
    for (const p of placedSlates) {
      const slate = inventory.find((s) => s.id === p.slateId)
      if (!slate) continue
      const cells = getShapeCells(slate.shape, slate.rotation, slate.flippedH, slate.flippedV)
      for (const [r, c] of cells) {
        map[`${p.row + r},${p.col + c}`] = p.slateId
      }
    }
    return map
  }, [placedSlates, inventory])

  const edges = useMemo(() => computeSlateEdges(placedSlates, inventory), [placedSlates, inventory])
  const overlapSet = useMemo(() => {
    const set = new Set()
    for (const c of findOverlappingCells(placedSlates, inventory)) set.add(`${c.row},${c.col}`)
    return set
  }, [placedSlates, inventory])
  const oobCells = useMemo(() => findOutOfBoundsCells(placedSlates, inventory), [placedSlates, inventory])
  const hasErrors = overlapSet.size > 0 || oobCells.length > 0
  const slateEffects = useMemo(
    () =>
      collectDivinitySlateEffects({
        divinityPage: { inventory, placedSlates },
      }),
    [inventory, placedSlates]
  )
  const copiedAffixes = useMemo(
    () =>
      collectDivinityCopiedAffixes({
        divinityPage: { inventory, placedSlates },
      }),
    [inventory, placedSlates]
  )

  const cleanupDrag = useCallback(() => {
    const { move, up } = listenersRef.current
    if (move) document.removeEventListener('mousemove', move)
    if (up) document.removeEventListener('mouseup', up)
    listenersRef.current = { move: null, up: null }
    dragRef.current = { state: null, preview: null, float: null }
    commit()
  }, [])

  const onGlobalMouseMove = useCallback((e) => {
    const d = dragRef.current
    if (!d.state) return
    d.float = {
      x: e.clientX - CELL_SIZE * (1 - (d.state.offsetCol || 0)),
      y: e.clientY - CELL_SIZE / 2,
    }
    const el = gridRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const relX = e.clientX - rect.left
      const relY = e.clientY - rect.top
      const snapCol = Math.round((relX - CELL_SIZE / 2) / CELL_SIZE) + DISP_START
      const snapRow = Math.round((relY - CELL_SIZE / 2) / CELL_SIZE) + DISP_START
      const cells = getShapeCells(d.state.shape, d.state.rotation, d.state.flippedH, d.state.flippedV)
      const minR = Math.min(...cells.map(([r]) => r))
      d.preview = { row: snapRow - minR, col: snapCol }
    } else {
      d.preview = null
    }
    commit()
  }, [])

  const onGlobalMouseUp = useCallback(() => {
    const d = dragRef.current
    if (d.state && d.preview) {
      const ds = d.state
      const sl = inventory.find((s) => s.id === ds.slateId)
      if (sl) {
        const pos = { row: d.preview.row, col: d.preview.col }
        const cells = getShapeCells(sl.shape, sl.rotation, sl.flippedH, sl.flippedV)
        let canPlace = true
        if (sl.isNetherKing && hasPlacedNetherKing(placedSlates, inventory, ds.slateId)) {
          canPlace = false
          message.warning(formatMessage({ id: 'divinity.netherKingLimit' }))
        } else if (
          sl.legendaryName &&
          LEGENDARY_SLATE_LIMITS[sl.legendaryName] &&
          placedLegendaryCount(placedSlates, inventory, sl.legendaryName, ds.slateId) >=
            LEGENDARY_SLATE_LIMITS[sl.legendaryName]
        ) {
          canPlace = false
          message.warning(
            formatMessage({ id: 'divinity.legendaryLimit' }, { name: sl.legendaryName, limit: LEGENDARY_SLATE_LIMITS[sl.legendaryName] })
          )
        } else {
          for (const [r, c] of cells) {
            const cr = pos.row + r
            const cc = pos.col + c
            if (!isValidGridCell(cr, cc)) {
              canPlace = false
              break
            }
            const key = `${cr},${cc}`
            if (placedMap[key] && placedMap[key] !== ds.slateId) {
              canPlace = false
              break
            }
          }
        }
        if (canPlace) {
          const otherPlaced = placedSlates.filter((p) => p.slateId !== ds.slateId)
          onPlace([...otherPlaced, { slateId: ds.slateId, col: pos.col, row: pos.row }])
          onSelect(ds.slateId)
        }
      }
    }
    cleanupDrag()
  }, [inventory, placedSlates, placedMap, onPlace, onSelect, cleanupDrag, formatMessage])

  useEffect(() => cleanupDrag, [cleanupDrag])

  const onCellMouseDown = useCallback(
    (row, col) => {
      const slId = placedMap[`${row},${col}`]
      if (!slId) return
      const sl = inventory.find((s) => s.id === slId)
      if (!sl) return
      const el = gridRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cellCenterX = rect.left + (col - DISP_START) * CELL_SIZE + CELL_SIZE / 2
      const cellCenterY = rect.top + (row - DISP_START) * CELL_SIZE + CELL_SIZE / 2
      const cols = getShapeCells(sl.shape, sl.rotation, sl.flippedH, sl.flippedV).map(([, c]) => c)
      const minC = Math.min(...cols)
      dragRef.current = {
        state: {
          slateId: sl.id,
          shape: sl.shape,
          rotation: sl.rotation,
          flippedH: sl.flippedH,
          flippedV: sl.flippedV,
          offsetCol: minC,
        },
        preview: null,
        float: {
          x: cellCenterX - CELL_SIZE / 2 - CELL_SIZE * (1 - minC),
          y: cellCenterY - CELL_SIZE / 2,
        },
      }
      listenersRef.current = { move: onGlobalMouseMove, up: onGlobalMouseUp }
      document.addEventListener('mousemove', onGlobalMouseMove)
      document.addEventListener('mouseup', onGlobalMouseUp)
      commit()
    },
    [placedMap, inventory, onGlobalMouseMove, onGlobalMouseUp]
  )

  const onCellClick = useCallback(
    (row, col) => {
      const slId = placedMap[`${row},${col}`]
      if (slId) onSelect(slId)
    },
    [placedMap, onSelect]
  )

  const onCellContextMenu = useCallback(
    (row, col) => {
      const slId = placedMap[`${row},${col}`]
      if (slId) {
        onSelect(slId)
        onShowToolbar({ row, col })
      }
    },
    [placedMap, onSelect, onShowToolbar]
  )

  const d = dragUI
  const dragCells = d.state
    ? getShapeCells(d.state.shape, d.state.rotation, d.state.flippedH, d.state.flippedV)
    : []
  let dragColor = { bg: 'rgba(120,113,108,0.4)' }
  if (d.state) {
    const sl = inventory.find((s) => s.id === d.state.slateId)
    const c = sl ? getSlateColor(sl) : { fill: 'rgba(120,113,108,0.4)' }
    dragColor = { bg: c.fill }
  }

  function isPreviewValid(cellR, cellC) {
    if (!d.preview) return false
    const row = d.preview.row + cellR
    const col = d.preview.col + cellC
    if (!isValidGridCell(row, col)) return false
    if (placedMap[`${row},${col}`]) return false
    return true
  }

  const cells = []
  const slateBlocks = []
  const slateCover = new Set()
  for (const p of placedSlates) {
    const sl = inventory.find((s) => s.id === p.slateId)
    if (!sl) continue
    const shapeCells = getShapeCells(sl.shape, sl.rotation, sl.flippedH, sl.flippedV)
    const absCells = shapeCells.map(([r, c]) => ({ row: p.row + r, col: p.col + c }))
    const minRow = Math.min(...absCells.map((c) => c.row))
    const minCol = Math.min(...absCells.map((c) => c.col))
    const maxRow = Math.max(...absCells.map((c) => c.row))
    const maxCol = Math.max(...absCells.map((c) => c.col))
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) slateCover.add(`${r},${c}`)
    }
    slateBlocks.push(
      <SlateBlock
        key={p.slateId}
        slate={sl}
        cells={absCells}
        cellSize={CELL_SIZE}
        edges={edges}
        overlapSet={overlapSet}
        boosted={slateEffects.boostedIds.has(p.slateId)}
        projections={slateEffects.projectedIds.get(p.slateId) || []}
        copied={copiedAffixes.get(p.slateId) || []}
        dragging={!!d.state}
        onHover={handleHover}
        onMouseDown={onCellMouseDown}
        onClick={onCellClick}
        onContextMenu={onCellContextMenu}
      />
    )
  }

  for (let idx = 0; idx < DISP_ROWS * DISP_COLS; idx++) {
    const row = DISP_START + Math.floor(idx / DISP_COLS)
    const col = DISP_START + (idx % DISP_COLS)
    if (slateCover.has(`${row},${col}`)) continue
    cells.push(
      <DivinityGridCell
        key={idx}
        row={row}
        col={col}
        cellSize={CELL_SIZE}
        slateId={null}
        slates={inventory}
        edges={edges}
        isOverlapping={false}
        boosted={false}
        projections={[]}
        onMouseDown={onCellMouseDown}
        onClick={onCellClick}
        onContextMenu={onCellContextMenu}
      />
    )
  }

  return (
    <div className="divinity-grid">
      {hasErrors && (
        <div className="divinity-grid__warning">
          <span className="divinity-grid__warning-text">
            {formatMessage({ id: 'divinity.gridError' })}
          </span>
        </div>
      )}

      <div
        ref={gridRef}
        data-divinity-grid
        className="divinity-grid__container"
        style={{ width: DISP_COLS * CELL_SIZE, height: DISP_ROWS * CELL_SIZE }}
      >
        <div
          className="divinity-grid__cells"
          style={{
            gridTemplateColumns: `repeat(${DISP_COLS}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${DISP_ROWS}, ${CELL_SIZE}px)`,
          }}
        >
          {cells}
          {slateBlocks}
        </div>

        {d.state && d.preview && (
          <div
            className="divinity-grid__preview"
            style={{
              left: (d.preview.col - DISP_START) * CELL_SIZE,
              top: (d.preview.row - DISP_START) * CELL_SIZE,
            }}
          >
            {dragCells.map(([r, c], ci) => (
              <div
                key={ci}
                className="divinity-grid__preview-cell"
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  left: c * CELL_SIZE,
                  top: r * CELL_SIZE,
                  backgroundColor: dragColor.bg,
                }}
              >
                {!isPreviewValid(r, c) && <span className="divinity-grid__preview-invalid" />}
              </div>
            ))}
          </div>
        )}

        {d.state && d.float && (
          <div className="divinity-grid__float" style={{ left: d.float.x, top: d.float.y }}>
            {dragCells.map(([r, c], ci) => (
              <div
                key={ci}
                className="divinity-grid__float-cell"
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  left: c * CELL_SIZE,
                  top: r * CELL_SIZE,
                  backgroundColor: dragColor.bg,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
