import { createPortal } from 'react-dom'
import { useIntl } from 'react-intl'

export default function SlateEditToolbar({ visible, targetRect, shapeLabel, onRotate, onFlipH, onFlipV, onRemove }) {
  const { formatMessage } = useIntl()
  if (!visible) return null

  const x = (targetRect?.left ?? 0) + (targetRect?.width ?? 0) / 2
  const y = (targetRect?.top ?? 0) - 8

  return createPortal(
    <div
      className="divinity-toolbar"
      data-toolbar
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="divinity-toolbar__btn"
        title={formatMessage({ id: 'divinity.toolbar.rotateL' })}
        onClick={() => onRotate(-90)}
      >
        &#x21B6;
      </button>
      <button
        type="button"
        className="divinity-toolbar__btn"
        title={formatMessage({ id: 'divinity.toolbar.rotateR' })}
        onClick={() => onRotate(90)}
      >
        &#x21B7;
      </button>
      <button
        type="button"
        className="divinity-toolbar__btn"
        title={formatMessage({ id: 'divinity.toolbar.flipH' })}
        onClick={onFlipH}
      >
        &#x2194;
      </button>
      <button
        type="button"
        className="divinity-toolbar__btn"
        title={formatMessage({ id: 'divinity.toolbar.flipV' })}
        onClick={onFlipV}
      >
        &#x2195;
      </button>
      <span className="divinity-toolbar__divider" />
      <span className="divinity-toolbar__label">{shapeLabel}</span>
      <span className="divinity-toolbar__divider" />
      <button
        type="button"
        className="divinity-toolbar__btn divinity-toolbar__btn--danger"
        title={formatMessage({ id: 'divinity.toolbar.remove' })}
        onClick={onRemove}
      >
        &#x2715;
      </button>
    </div>,
    document.body
  )
}
