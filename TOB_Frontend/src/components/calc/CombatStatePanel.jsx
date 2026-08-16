import { useIntl } from 'react-intl'
import { observer } from 'mobx-react-lite'
import { Slider, Switch, Tooltip } from 'antd'
import { buildStore } from '../../stores/buildStore.js'
import { combatStates, applyBlessingCaps } from '../../utils/combatStates.js'
import './CombatStatePanel.less'

const CATEGORY_ORDER = ['selfBuff', 'selfDebuff', 'enemyDebuff', 'environment']

const requiresTrait = (meta) => {
  if (!meta.requires || !Array.isArray(meta.requires)) return null
  return meta.requires[0] && meta.requires[0].startsWith('heroTrait:')
    ? meta.requires[0].slice('heroTrait:'.length)
    : null
}

function StateControl({ stateKey, meta, value, locked, lockedBy, maxOverride }) {
  const { formatMessage } = useIntl()
  const update = (patch) => buildStore.updateConfiguration(patch)
  const title = lockedBy
    ? formatMessage({ id: 'config.stateLocked' }, { trait: lockedBy })
    : ''
  const max = maxOverride != null ? maxOverride : meta.max

  const body =
    meta.switchMax ? (
      <Switch
        checked={value > 0}
        disabled={locked}
        onChange={(on) => update({ [stateKey]: on ? max : 0 })}
      />
    ) : meta.kind === 'number' ? (
      <Slider
        className="combat-state__slider"
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
    <div className="combat-state__row">
      <span className="combat-state__row-label">
        {formatMessage({ id: meta.label })}
        {meta.switchMax && (
          <span className="combat-state__row-hint">
            {formatMessage({ id: 'config.blessHint' }, { max })}
          </span>
        )}
        {locked && (
          <Tooltip title={title}>
            <span className="combat-state__row-lock">*</span>
          </Tooltip>
        )}
      </span>
      <span className="combat-state__row-value">{value}</span>
      {body}
    </div>
  )
}

function CombatStatePanel() {
  const { formatMessage } = useIntl()
  const cfg = buildStore.build.configuration || {}
  const blessingCaps = buildStore.blessingCaps || {}
  const states = applyBlessingCaps(cfg, blessingCaps)
  const heroName = (buildStore.build.heroTraits && buildStore.build.heroTraits.name) || ''

  const isLocked = (meta) => {
    const trait = requiresTrait(meta)
    return trait ? { locked: trait !== heroName, by: trait } : { locked: false, by: null }
  }

  const capByStateKey = {
    blessAgile: blessingCaps.agile,
    blessTough: blessingCaps.tough,
    blessFocus: blessingCaps.focus,
  }

  return (
    <div className="combat-state">
      <div className="combat-state__hint">{formatMessage({ id: 'config.hint' })}</div>

      {CATEGORY_ORDER.map((cat) => {
        const items = Object.entries(combatStates).filter(
          ([, meta]) => meta.category === cat
        )
        if (items.length === 0) return null
        return (
          <div className="combat-state__panel" key={cat}>
            <div className="combat-state__panel-head">
              <h3 className="combat-state__panel-title">
                {formatMessage({ id: `config.group.${cat}` })}
              </h3>
            </div>
            <div className="combat-state__panel-body">
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
                    maxOverride={capByStateKey[stateKey]}
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

export default observer(CombatStatePanel)
