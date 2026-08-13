import { useState } from 'react'
import { useIntl } from 'react-intl'
import { cleanAffixText } from '../../utils/affixText.js'
import './UnconsumedAffixPanel.less'

const SOURCE_KEYS = {
  divinity: 'affixStats.source.divinity',
  talent: 'affixStats.source.talent',
  equipment: 'affixStats.source.equipment',
  memory: 'affixStats.source.memory',
  pact: 'affixStats.source.pact',
  skill: 'affixStats.source.skill',
}

function Chevron({ open }) {
  return (
    <svg
      className={'unconsumed__chevron' + (open ? ' unconsumed__chevron--open' : '')}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function SourceGroup({ source, items, formatMessage }) {
  const [open, setOpen] = useState(false)
  const count = items.reduce((s, it) => s + it.count, 0)

  return (
    <div className="unconsumed__group">
      <button
        type="button"
        className="unconsumed__group-head"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="unconsumed__group-title">
          {formatMessage({ id: SOURCE_KEYS[source] || source })}
        </span>
        <span className="unconsumed__group-meta">
          <span className="unconsumed__group-count">
            {formatMessage({ id: 'affixStats.unconsumedCount' }, { count })}
          </span>
          <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div className="unconsumed__group-body">
          {items.map((it) => (
            <div key={it.text} className="unconsumed__row">
              <span className="unconsumed__row-text">{cleanAffixText(it.text)}</span>
              <span className="unconsumed__row-count">
                {formatMessage({ id: 'affixStats.times' }, { count: it.count })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function UnconsumedAffixPanel({ groups }) {
  const { formatMessage } = useIntl()
  const [open, setOpen] = useState(false)
  const total = (groups || []).reduce(
    (s, g) => s + (g.items || []).reduce((x, it) => x + (it.count || 0), 0),
    0
  )
  const isEmpty = total === 0

  return (
    <div className={'unconsumed' + (isEmpty ? ' unconsumed--empty' : '')}>
      <button type="button" className="unconsumed__head" onClick={() => setOpen((v) => !v)}>
        <span className="unconsumed__title">
          {formatMessage({ id: 'affixStats.unconsumedTitle' })}
        </span>
        <span className="unconsumed__meta">
          <span
            className={'unconsumed__count' + (isEmpty ? '' : ' unconsumed__count--warn')}
          >
            {formatMessage({ id: 'affixStats.unconsumedCount' }, { count: total })}
          </span>
          <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div className="unconsumed__body">
          {isEmpty ? (
            <div className="unconsumed__empty">
              {formatMessage({ id: 'affixStats.unconsumedEmpty' })}
            </div>
          ) : (
            <>
              <p className="unconsumed__desc">
                {formatMessage({ id: 'affixStats.unconsumedDesc' })}
              </p>
              {(groups || []).map((g) => (
                <SourceGroup
                  key={g.source}
                  source={g.source}
                  items={g.items}
                  formatMessage={formatMessage}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
