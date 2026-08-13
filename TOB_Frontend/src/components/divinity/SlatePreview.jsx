import { useMemo } from 'react'
import { getShapeCells, getSlateColor, SHAPE_DEFS } from '../../data/divinityData.js'

const CELL_PX = { sm: 8, md: 14 }

function getSizeAfterRotation(def, rotation) {
  if (!def) return { rows: 1, cols: 1 }
  const off = def.size
  const r = ((rotation % 360) + 360) % 360
  if (r === 90 || r === 270) {
    return { rows: off[1], cols: off[0] }
  }
  return { rows: off[0], cols: off[1] }
}

const COLOR_CLASS = {
  '#78716c': 'divinity-preview__cell--stone',
  '#059669': 'divinity-preview__cell--emerald',
  '#2563eb': 'divinity-preview__cell--blue',
  '#dc2626': 'divinity-preview__cell--red',
  '#9333ea': 'divinity-preview__cell--purple',
  '#0891b2': 'divinity-preview__cell--cyan',
  '#1e3a8a': 'divinity-preview__cell--nether',
}

export default function SlatePreview({
  slate = null,
  size = 'sm',
  shape = '',
  rotation = 0,
  flippedH = false,
  flippedV = false,
  isLegendary = false,
  isNetherKing = false,
  god = 'Might',
}) {
  const cellSize = CELL_PX[size] || 8

  const resolvedShape = slate ? slate.shape : shape
  const resolvedRotation = slate ? slate.rotation : rotation
  const resolvedFlippedH = slate ? slate.flippedH : flippedH
  const resolvedFlippedV = slate ? slate.flippedV : flippedV

  const cells = useMemo(
    () => getShapeCells(resolvedShape, resolvedRotation, resolvedFlippedH, resolvedFlippedV),
    [resolvedShape, resolvedRotation, resolvedFlippedH, resolvedFlippedV]
  )
  const occupiedSet = useMemo(() => new Set(cells.map(([r, c]) => `${r},${c}`)), [cells])

  const def = SHAPE_DEFS[resolvedShape]
  const bounds = getSizeAfterRotation(def, resolvedRotation)

  const cellsArray = []
  for (let r = 0; r < bounds.rows; r++) {
    for (let c = 0; c < bounds.cols; c++) {
      cellsArray.push([r, c])
    }
  }

  let colorClass = 'divinity-preview__cell--stone'
  if ((slate && slate.isNetherKing) || isNetherKing) {
    colorClass = 'divinity-preview__cell--nether'
  } else if ((slate && slate.isLegendary) || isLegendary) {
    colorClass = 'divinity-preview__cell--legendary'
  } else {
    const c = slate ? getSlateColor(slate) : getSlateColor({ god, isLegendary: false })
    colorClass = COLOR_CLASS[c.stroke] || 'divinity-preview__cell--stone'
  }

  return (
    <div
      className="divinity-preview"
      style={{
        gridTemplateColumns: `repeat(${bounds.cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${bounds.rows}, ${cellSize}px)`,
      }}
    >
      {cellsArray.map(([r, c]) => (
        <div
          key={`${r},${c}`}
          className={`divinity-preview__cell ${
            occupiedSet.has(`${r},${c}`) ? colorClass : ''
          }`}
        />
      ))}
    </div>
  )
}
