import { memo } from 'react'
import {
  getSlateColor,
  isOnGrid,
  isValidGridCell,
} from '../../data/divinityData.js'

function DivinityGridCell({
  row,
  col,
  cellSize,
  slateId,
  slates,
  edges,
  isOverlapping,
  boosted,
  projections,
  onMouseDown,
  onClick,
  onContextMenu,
}) {
  const cellIdx = slateId ? slates.findIndex((s) => s.id === slateId) : -1
  const sl = cellIdx >= 0 ? slates[cellIdx] : null
  const onGrid = isOnGrid(row, col)
  const inBounds = isValidGridCell(row, col)
  const isOob = onGrid && !inBounds
  const key = `${row},${col}`
  const edge = edges[key] || { top: true, right: true, bottom: true, left: true }
  const color = sl ? getSlateColor(sl) : { stroke: '#52525b', fill: 'rgba(39,39,42,0.3)' }

  let bgClass = ''
  if (slateId) bgClass += ' divinity-grid__cell--slate'
  if (onGrid && !slateId && inBounds) bgClass += ' divinity-grid__cell--bg'
  if (isOverlapping && slateId) bgClass += ' divinity-grid__cell--overlap'
  if (isOob) bgClass += ' divinity-grid__cell--void'
  if (slateId && boosted) bgClass += ' divinity-grid__cell--boosted'
  if (slateId && !boosted && projections.length > 0) bgClass += ' divinity-grid__cell--projected'

  const style = { width: cellSize, height: cellSize }
  if (slateId) {
    style.backgroundColor = color.fill
    if (edge.top) style.borderTopColor = 'rgba(255,255,255,0.7)'
    if (edge.right) style.borderRightColor = 'rgba(255,255,255,0.7)'
    if (edge.bottom) style.borderBottomColor = 'rgba(255,255,255,0.7)'
    if (edge.left) style.borderLeftColor = 'rgba(255,255,255,0.7)'
  }

  return (
    <div
      className={`divinity-grid__cell ${bgClass}`}
      style={style}
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown(row, col)
      }}
      onClick={() => onClick(row, col)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(row, col)
      }}
    >
      {isOob && <span className="divinity-grid__cell-void" />}
    </div>
  )
}

export default memo(DivinityGridCell)
