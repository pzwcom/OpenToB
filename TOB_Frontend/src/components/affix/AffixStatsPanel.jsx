import { useState } from 'react'
import { useIntl } from 'react-intl'
import { cleanAffixText } from '../../utils/affixText.js'
import { AFFIX_CONSUMERS } from '../../utils/affixConsumers.js'
import './AffixStatsPanel.less'

function countOf(stats) {
  return (
    stats.increase.reduce((s, g) => s + g.count, 0) +
    stats.more.reduce((s, g) => s + g.count, 0) +
    stats.flat.reduce((s, g) => s + g.count, 0) +
    AFFIX_CONSUMERS.reduce(
      (s, c) => s + (stats[c.key] || []).reduce((x, g) => x + g.count, 0),
      0
    ) +
    stats.others.reduce((s, g) => s + g.count, 0)
  )
}

function Group({ titleKey, count, formatMessage, children }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="affix__group">
      <button type="button" className="affix__group-head" onClick={() => setOpen((v) => !v)}>
        <span className="affix__group-title">{formatMessage({ id: titleKey })}</span>
        <span className="affix__group-meta">
          <span className="affix__group-count">
            {formatMessage({ id: 'affixStats.times' }, { count })}
          </span>
          <svg
            className={'affix__chevron' + (open ? ' affix__chevron--open' : '')}
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
        </span>
      </button>
      {open && <div className="affix__group-body">{children}</div>}
    </div>
  )
}

function AffixGroups({ stats, formatMessage }) {
  const totalCount = countOf(stats)

  if (totalCount === 0) {
    return <div className="affix__empty">{formatMessage({ id: 'affixStats.empty' })}</div>
  }

  return (
    <>
      {stats.increase.length > 0 && (
        <Group
          titleKey="affixStats.increase"
          count={stats.increase.reduce((s, g) => s + g.count, 0)}
          formatMessage={formatMessage}
        >
          {stats.increase.map((g) => (
            <div key={g.text} className="affix__row">
              <span className="affix__row-text">{cleanAffixText(g.text)}</span>
              <span className="affix__row-count">
                {formatMessage({ id: 'affixStats.times' }, { count: g.count })}
              </span>
              <span className="affix__row-total">
                {g.value >= 0 ? '+' : ''}
                {g.total}%
              </span>
            </div>
          ))}
        </Group>
      )}

      {stats.more.length > 0 && (
        <Group
          titleKey="affixStats.more"
          count={stats.more.reduce((s, g) => s + g.count, 0)}
          formatMessage={formatMessage}
        >
          {stats.more.map((g) => (
            <div key={g.text} className="affix__row">
              <span className="affix__row-text">{cleanAffixText(g.text)}</span>
              <span className="affix__row-count">
                {formatMessage({ id: 'affixStats.times' }, { count: g.count })}
              </span>
              <span className="affix__row-total affix__row-total--more">
                ×{g.multiplier}
              </span>
            </div>
          ))}
        </Group>
      )}

      {stats.flat.length > 0 && (
        <Group
          titleKey="affixStats.flat"
          count={stats.flat.reduce((s, g) => s + g.count, 0)}
          formatMessage={formatMessage}
        >
          {stats.flat.map((g) => (
            <div key={g.text} className="affix__row">
              <span className="affix__row-text">{cleanAffixText(g.text)}</span>
              <span className="affix__row-count">
                {formatMessage({ id: 'affixStats.times' }, { count: g.count })}
              </span>
            </div>
          ))}
        </Group>
      )}

      {AFFIX_CONSUMERS.map((c) => {
        const items = stats[c.key] || []
        if (items.length === 0) return null
        return (
          <Group
            key={c.key}
            titleKey={c.label}
            count={items.reduce((s, g) => s + g.count, 0)}
            formatMessage={formatMessage}
          >
            {items.map((g) => (
              <div key={g.text} className="affix__row">
                <span className="affix__row-text">{cleanAffixText(g.text)}</span>
                <span className="affix__row-count">
                  {formatMessage({ id: 'affixStats.times' }, { count: g.count })}
                </span>
              </div>
            ))}
          </Group>
        )
      })}

      {stats.others.length > 0 && (
        <Group
          titleKey="affixStats.others"
          count={stats.others.reduce((s, g) => s + g.count, 0)}
          formatMessage={formatMessage}
        >
          {stats.others.map((g) => (
            <div key={g.text} className="affix__row">
              <span className="affix__row-text">{cleanAffixText(g.text)}</span>
              <span className="affix__row-count">
                {formatMessage({ id: 'affixStats.times' }, { count: g.count })}
              </span>
            </div>
          ))}
        </Group>
      )}
    </>
  )
}

export default function AffixStatsPanel({ titleKey, stats, defaultOpen = false }) {
  const { formatMessage } = useIntl()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="affix__panel">
      <button
        type="button"
        className="affix__panel-head"
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="affix__panel-title">{formatMessage({ id: titleKey })}</h3>
        <span className="affix__panel-meta">
          <span className="affix__panel-count">
            {formatMessage({ id: 'affixStats.affixCount' }, { count: countOf(stats) })}
          </span>
          <svg
            className={'affix__chevron' + (open ? ' affix__chevron--open' : '')}
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
        </span>
      </button>
      {open && <AffixGroups stats={stats} formatMessage={formatMessage} />}
    </div>
  )
}
