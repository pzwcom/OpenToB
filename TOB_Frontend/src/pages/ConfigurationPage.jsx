import { useIntl } from 'react-intl'
import { observer } from 'mobx-react-lite'
import { Slider, Switch, Tooltip } from 'antd'
import { buildStore } from '../stores/buildStore.js'
import { combatStates, normalizeStates } from '../utils/combatStates.js'
import './ConfigurationPage.less'

const CATEGORY_ORDER = ['selfBuff', 'selfDebuff', 'enemyDebuff', 'environment']

const requiresTrait = (meta) => {
  if (!meta.requires || !Array.isArray(meta.requires)) return null
  return meta.requires[0] && meta.requires[0].startsWith('heroTrait:')
    ? meta.requires[0].slice('heroTrait:'.length)
    : null
}

function StateControl({ stateKey, meta, value, locked, lockedBy }) {
  const { formatMessage } = useIntl()
  const update = (patch) => buildStore.updateConfiguration(patch)
  const title = lockedBy
    ? formatMessage({ id: 'config.stateLocked' }, { trait: lockedBy })
    : ''

  const body =
    meta.kind === 'number' ? (
      <Slider
        className="config__slider"
        min={meta.min}
        max={meta.max}
        step={1}
        value={value}
        disabled={locked}
        onChange={(v) => update({ [stateKey]: v })}
      />
    ) : (
      <Switch checked={value} disabled={locked} onChange={(v) => update({ [stateKey]: v })} />
    )

  return (
    <div className="config__row">
      <span className="config__row-label">
        {formatMessage({ id: meta.label })}
        {locked && (
          <Tooltip title={title}>
            <span className="config__row-lock">*</span>
          </Tooltip>
        )}
      </span>
      <span className="config__row-value">{value}</span>
      {body}
    </div>
  )
}

function ConfigurationPage() {
  const { formatMessage } = useIntl()
  const cfg = buildStore.build.configuration || {}
  const states = normalizeStates(cfg)
  const heroName = (buildStore.build.heroTraits && buildStore.build.heroTraits.name) || ''

  const isLocked = (meta) => {
    const trait = requiresTrait(meta)
    return trait ? { locked: trait !== heroName, by: trait } : { locked: false, by: null }
  }

  return (
    <div className="config">
      <div className="config__header">
        <h2 className="config__title">{formatMessage({ id: 'tab.configuration' })}</h2>
        <span className="config__hint">{formatMessage({ id: 'config.hint' })}</span>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const items = Object.entries(combatStates).filter(
          ([, meta]) => meta.category === cat
        )
        if (items.length === 0) return null
        return (
          <div className="config__panel" key={cat}>
            <div className="config__panel-head">
              <h3 className="config__panel-title">
                {formatMessage({ id: `config.group.${cat}` })}
              </h3>
            </div>
            <div className="config__panel-body">
              {items.map(([stateKey, meta]) => {
                const lock = isLocked(meta)
                return (
                  <StateControl
                    key={stateKey}
                    stateKey={stateKey}
                    meta={meta}
                    value={states[stateKey]}
                    locked={lock.locked}
                    lockedBy={lock.by}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default observer(ConfigurationPage)
