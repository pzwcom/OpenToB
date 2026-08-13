import { useIntl } from 'react-intl'
import SlatePreview from './SlatePreview.jsx'
import { GOD_NAMES, getShapeLabel } from '../../data/divinityData.js'

export default function SlateInventory({
  items,
  selectedId,
  placedSlateIds,
  onSelect,
  onPlace,
  onCopy,
  onDelete,
  onImport,
}) {
  const { formatMessage } = useIntl()
  const isPlaced = (id) => placedSlateIds.includes(id)

  return (
    <div className="divinity-panel">
      <div className="divinity-panel__head">
        <h3 className="divinity-panel__title divinity-panel__title--row">
          {formatMessage({ id: 'divinity.inventory.title' }, { count: items.length })}
        </h3>
        <button type="button" className="divinity-link" onClick={onImport}>
          {formatMessage({ id: 'divinity.inventory.import' })}
        </button>
      </div>

      {!items.length && (
        <div className="divinity-inventory__empty">
          {formatMessage({ id: 'divinity.inventory.empty' })}
        </div>
      )}

      {items.length > 0 && (
        <div className="divinity-inventory">
          {items.map((slate) => (
            <div
              key={slate.id}
              className={`divinity-inventory__item ${
                slate.id === selectedId ? 'divinity-inventory__item--selected' : ''
              }`}
              onClick={() => onSelect(slate.id)}
            >
              <SlatePreview slate={slate} size="sm" />
              <div className="divinity-inventory__info">
                <p className="divinity-inventory__name">
                  {slate.isNetherKing
                    ? slate.netherKingName
                    : slate.isLegendary
                      ? slate.legendaryName
                      : GOD_NAMES[slate.god] || formatMessage({ id: 'divinity.inventory.slate' })}
                </p>
                <p className="divinity-inventory__shape">{getShapeLabel(slate.shape)}</p>
              </div>
              <div className="divinity-inventory__actions">
                {!isPlaced(slate.id) && (
                  <button
                    type="button"
                    className="divinity-inventory__place-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPlace(slate.id)
                    }}
                  >
                    {formatMessage({ id: 'divinity.inventory.place' })}
                  </button>
                )}
                <button
                  type="button"
                  className="divinity-inventory__icon-btn"
                  title={formatMessage({ id: 'divinity.inventory.copy' })}
                  onClick={(e) => {
                    e.stopPropagation()
                    onCopy(slate)
                  }}
                >
                  &#x2398;
                </button>
                <button
                  type="button"
                  className="divinity-inventory__icon-btn divinity-inventory__icon-btn--danger"
                  title={formatMessage({ id: 'divinity.inventory.delete' })}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(slate.id)
                  }}
                >
                  &#x2715;
                </button>
              </div>
              {isPlaced(slate.id) && (
                <span className="divinity-inventory__placed">
                  {formatMessage({ id: 'divinity.inventory.placed' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
