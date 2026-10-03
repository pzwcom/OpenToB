import { useIntl } from 'react-intl'
import { observer } from 'mobx-react-lite'
import { Slider, Switch, Tooltip } from 'antd'
import { buildStore } from '../../stores/buildStore.js'
import { combatStates, applyBlessingCaps, applyTetherCap, applyWarmBreezeCap } from '../../utils/combatStates.js'
import './CombatStatePanel.less'

const CATEGORY_ORDER = ['selfBuff', 'selfDebuff', 'enemyDebuff', 'environment']

// requires 可同时指定多个英雄特性（如 弹药 三个投射物英雄共用）：返回英雄名数组
const requiresTraits = (meta) => {
  if (!meta.requires || !Array.isArray(meta.requires)) return null
  const traits = meta.requires
    .filter((r) => r.startsWith('heroTrait:'))
    .map((r) => r.slice('heroTrait:'.length))
  return traits.length ? traits : null
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
  const states = applyWarmBreezeCap(
    applyTetherCap(
      applyBlessingCaps(cfg, blessingCaps),
      buildStore.tetherCap || 3
    ),
    buildStore.warmBreezeCap || 10
  )
  const heroName = (buildStore.build.heroTraits && buildStore.build.heroTraits.name) || ''

  const isLocked = (meta) => {
    const traits = requiresTraits(meta)
    return traits ? { locked: !traits.includes(heroName), by: traits[0] } : { locked: false, by: null }
  }

  const capByStateKey = {
    blessAgile: blessingCaps.agile,
    blessTough: blessingCaps.tough,
    blessFocus: blessingCaps.focus,
    tetherStacks: buildStore.tetherCap || 3,
    warmBreezeStacks: buildStore.warmBreezeCap || 10,
    moistenStacks: 10,
  }

  return (
    <div className="combat-state">
      <div className="combat-state__hint">{formatMessage({ id: 'config.hint' })}</div>

      {CATEGORY_ORDER.map((cat) => {
        // 不同英雄各自独立的配置项：requires 指定英雄特性的状态（暖风/怒火爆发等）仅对该英雄展示
        const items = Object.entries(combatStates).filter(([, meta]) => {
          if (meta.category !== cat) return false
          const traits = requiresTraits(meta)
          return traits ? traits.includes(heroName) : true
        })
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
