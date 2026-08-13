import { useIntl } from 'react-intl'
import { observer } from 'mobx-react-lite'
import { Tabs } from 'antd'
import { buildStore } from '../stores/buildStore.js'
import AffixStatsPanel from '../components/affix/AffixStatsPanel.jsx'
import UnconsumedAffixPanel from '../components/affix/UnconsumedAffixPanel.jsx'
import './CalculationsPage.less'

function StatRow({ label, value, className, suffix }) {
  return (
    <div className="calc__row">
      <span className="calc__row-text">{label}</span>
      <span className={`calc__row-value ${className || ''}`}>
        {value}
        {suffix || ''}
      </span>
    </div>
  )
}

function DamageRow({ label, per, formatMessage }) {
  const avg = per && per.flat
  const raw = per && +(per.flat * (1 + (per.inc || 0) / 100)).toFixed(0)
  const adj = per && per.final
  return (
    <div className="calc__row calc__row--damage">
      <span className="calc__row-text">{label}</span>
      <span className="calc__row-sub">
        {formatMessage({ id: 'calculations.avg' })}: {avg}
      </span>
      <span className="calc__row-sub">
        {formatMessage({ id: 'calculations.raw' })}: {raw}
      </span>
      <span className="calc__row-sub calc__row-sub--adj">
        {formatMessage({ id: 'calculations.adjusted' })}: {adj}
      </span>
    </div>
  )
}

function BaseAttrsTab({ stats, formatMessage }) {
  return (
    <>
      <div className="calc__panel">
        <div className="calc__panel-head">
          <h3 className="calc__panel-title">{formatMessage({ id: 'calculations.attributeTitle' })}</h3>
        </div>
        <div className="calc__panel-body">
          <StatRow label={formatMessage({ id: 'stat.str' })} value={stats.stats?.str ?? 0} />
          <StatRow label={formatMessage({ id: 'stat.dex' })} value={stats.stats?.dex ?? 0} />
          <StatRow label={formatMessage({ id: 'stat.int' })} value={stats.stats?.int ?? 0} />
        </div>
      </div>

      <div className="calc__panel">
        <div className="calc__panel-head">
          <h3 className="calc__panel-title">{formatMessage({ id: 'calculations.defenseTitle' })}</h3>
        </div>
        <div className="calc__panel-body">
          <StatRow
            label={formatMessage({ id: 'stat.maxLife' })}
            value={stats.maxLife}
            className="calc__row-value--green"
          />
          <StatRow
            label={formatMessage({ id: 'stat.maxMana' })}
            value={stats.maxMana}
            className="calc__row-value--cyan"
          />
          <StatRow
            label={formatMessage({ id: 'stat.energyShield' })}
            value={stats.energyShield}
            className="calc__row-value--blue"
          />
          <StatRow
            label={formatMessage({ id: 'stat.armor' })}
            value={stats.armor}
            className="calc__row-value--orange"
          />
          <StatRow
            label={formatMessage({ id: 'stat.evasion' })}
            value={stats.evasion}
            className="calc__row-value--purple"
          />
        </div>
      </div>

      <div className="calc__panel">
        <div className="calc__panel-head">
          <h3 className="calc__panel-title">{formatMessage({ id: 'calculations.resistTitle' })}</h3>
        </div>
        <div className="calc__panel-body">
          <StatRow
            label={formatMessage({ id: 'stat.coldRes' })}
            value={stats.res?.cold ?? 0}
            suffix="%"
            className="calc__row-value--cyan"
          />
          <StatRow
            label={formatMessage({ id: 'stat.lightningRes' })}
            value={stats.res?.lightning ?? 0}
            suffix="%"
            className="calc__row-value--amber"
          />
          <StatRow
            label={formatMessage({ id: 'stat.fireRes' })}
            value={stats.res?.fire ?? 0}
            suffix="%"
            className="calc__row-value--red"
          />
          <StatRow
            label={formatMessage({ id: 'stat.erosionRes' })}
            value={stats.res?.erosion ?? 0}
            suffix="%"
            className="calc__row-value--purple"
          />
        </div>
      </div>

      <div className="calc__panel">
        <div className="calc__panel-head">
          <h3 className="calc__panel-title">{formatMessage({ id: 'calculations.attackTitle' })}</h3>
        </div>
        <div className="calc__panel-body">
          <StatRow
            label={formatMessage({ id: 'stat.atkSpeed' })}
            value={stats.atkSpeed}
            suffix="/s"
            className="calc__row-value--amber"
          />
          <StatRow
            label={formatMessage({ id: 'calculations.castSpeed' })}
            value={stats.castSpeed}
            suffix="/s"
            className="calc__row-value--amber"
          />
          <StatRow
            label={formatMessage({ id: 'stat.critChance' })}
            value={stats.critChance}
            suffix="%"
            className="calc__row-value--cyan"
          />
          <StatRow
            label={formatMessage({ id: 'stat.critMulti' })}
            value={stats.critMulti}
            suffix="%"
            className="calc__row-value--pink"
          />
        </div>
      </div>
    </>
  )
}

function AffixStatsTab() {
  const panels = [
    {
      title: 'affixStats.talentAffixTitle',
      stats: buildStore.divinityAffixStats,
    },
    {
      title: 'affixStats.talentTreeAffixTitle',
      stats: buildStore.talentAffixStats,
    },
    {
      title: 'affixStats.equipmentAffixTitle',
      stats: buildStore.equipmentAffixStats,
    },
    {
      title: 'affixStats.memoryAffixTitle',
      stats: buildStore.memoryAffixStats,
    },
    {
      title: 'affixStats.pactAffixTitle',
      stats: buildStore.pactAffixStats,
    },
    {
      title: 'affixStats.skillAffixTitle',
      stats: buildStore.skillAffixStats,
    },
  ]

  return (
    <>
      <UnconsumedAffixPanel groups={buildStore.unconsumedAffixGroups} />

      {panels.map((p) => (
        <AffixStatsPanel key={p.title} titleKey={p.title} stats={p.stats} />
      ))}
    </>
  )
}

function CalcTab({ stats, formatMessage }) {
  const per = stats.perElement || {}
  const minion = stats.minion || {}

  const minionHasDamage =
    minion.buckets &&
    Object.values(minion.buckets).some(
      (b) => b && (b.flat > 0 || b.inc > 0 || (b.mores && b.mores.length > 0))
    )

  return (
    <>
      <div className="calc__panel">
        <div className="calc__panel-head">
          <h3 className="calc__panel-title">{formatMessage({ id: 'calculations.damageTitle' })}</h3>
          <span className="calc__panel-count">
            {formatMessage({ id: 'calculations.totalFlat' })}：{stats.totalFlat}
          </span>
        </div>
        <div className="calc__panel-body">
          <DamageRow
            label={formatMessage({ id: 'calculations.physDamage' })}
            per={per.physical}
            formatMessage={formatMessage}
          />
          <DamageRow
            label={formatMessage({ id: 'calculations.coldDamage' })}
            per={per.cold}
            formatMessage={formatMessage}
          />
          <DamageRow
            label={formatMessage({ id: 'calculations.fireDamage' })}
            per={per.fire}
            formatMessage={formatMessage}
          />
          <DamageRow
            label={formatMessage({ id: 'calculations.lightningDamage' })}
            per={per.lightning}
            formatMessage={formatMessage}
          />
          <DamageRow
            label={formatMessage({ id: 'calculations.erosionDamage' })}
            per={per.erosion}
            formatMessage={formatMessage}
          />
          <DamageRow
            label={formatMessage({ id: 'calculations.chaosDamage' })}
            per={per.chaos}
            formatMessage={formatMessage}
          />
        </div>
      </div>

      {minionHasDamage && (
        <div className="calc__panel">
          <div className="calc__panel-head">
            <h3 className="calc__panel-title">{formatMessage({ id: 'calculations.minionTitle' })}</h3>
          </div>
          <div className="calc__panel-body">
            {['physical', 'cold', 'fire', 'lightning', 'erosion', 'chaos'].map((el) => {
              const b = minion.buckets ? minion.buckets[el] : null
              if (!b || (b.flat <= 0 && b.inc <= 0 && !(b.mores && b.mores.length > 0))) return null
              const more = (b.mores || []).reduce((m, v) => m * v, 1)
              const final = +(b.flat * (1 + b.inc) * more).toFixed(0)
              return (
                <StatRow
                  key={el}
                  label={formatMessage({ id: `calculations.${el}Damage` })}
                  value={final}
                  className="calc__row-value--amber"
                />
              )
            })}
          </div>
        </div>
      )}

      {(stats.dot?.hasBase || stats.dot?.hasBoost) && (
        <div className="calc__panel">
          <div className="calc__panel-head">
            <h3 className="calc__panel-title">{formatMessage({ id: 'calculations.dotTitle' })}</h3>
          </div>
          <div className="calc__panel-body">
            {['ignite', 'wither', 'trauma', 'worsen', 'aggravate'].map((dt) => {
              const b = stats.dot ? stats.dot[dt] : null
              if (!b || (b.flat <= 0 && b.inc === 0 && b.more === 0)) return null
              return (
                <div className="calc__row calc__row--dot" key={dt}>
                  <span className="calc__row-text">
                    {formatMessage({ id: `calculations.dot${dt[0].toUpperCase()}${dt.slice(1)}` })}
                  </span>
                  <span className="calc__row-sub">
                    {formatMessage({ id: 'calculations.avg' })}: {b.final}/s
                  </span>
                  {b.inc !== 0 && (
                    <span className="calc__row-sub">
                      {formatMessage({ id: 'calculations.dotIncrease' })}: {b.inc}%
                    </span>
                  )}
                  {b.more !== 0 && (
                    <span className="calc__row-sub">
                      {formatMessage({ id: 'calculations.dotMore' })}: {b.more}%
                    </span>
                  )}
                </div>
              )
            })}
            {!stats.dot.hasBase && (
              <div className="calc__row calc__row--hint">{formatMessage({ id: 'calculations.dotNoBase' })}</div>
            )}
            <div className="calc__row calc__row--hint">{formatMessage({ id: 'calculations.dotHint' })}</div>
          </div>
        </div>
      )}

      <div className="calc__panel">
        <div className="calc__panel-head">
          <h3 className="calc__panel-title">{formatMessage({ id: 'calculations.dpsTitle' })}</h3>
        </div>
        <div className="calc__panel-body">
          <StatRow
            label={formatMessage({ id: 'stat.dps' })}
            value={stats.dps}
            className="calc__row-value--amber calc__row-value--big"
          />
        </div>
      </div>
    </>
  )
}

function CalculationsPage() {
  const { formatMessage } = useIntl()
  const stats = buildStore.engineStats

  const items = [
    {
      key: 'base',
      label: formatMessage({ id: 'calculations.tab.base' }),
      children: <BaseAttrsTab stats={stats} formatMessage={formatMessage} />,
    },
    {
      key: 'affix',
      label: formatMessage({ id: 'calculations.tab.affix' }),
      children: <AffixStatsTab />,
    },
    {
      key: 'calc',
      label: formatMessage({ id: 'calculations.tab.calc' }),
      children: <CalcTab stats={stats} formatMessage={formatMessage} />,
    },
  ]

  return (
    <div className="calc">
      <div className="calc__header">
        <h2 className="calc__title">{formatMessage({ id: 'calculations.title' })}</h2>
      </div>

      <Tabs className="calc__tabs" items={items} />
    </div>
  )
}

export default observer(CalculationsPage)
