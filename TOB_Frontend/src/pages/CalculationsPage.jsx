import { useIntl } from 'react-intl'
import { observer } from 'mobx-react-lite'
import { Tabs } from 'antd'
import { buildStore } from '../stores/buildStore.js'
import AffixStatsPanel from '../components/affix/AffixStatsPanel.jsx'
import UnconsumedAffixPanel from '../components/affix/UnconsumedAffixPanel.jsx'
import SkillCalcTab from '../components/calc/SkillCalcTab.jsx'
import CombatStatePanel from '../components/calc/CombatStatePanel.jsx'
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

function BaseAttrsTab({ stats, charStats, formatMessage }) {
  return (
    <div className="calc__panel">
      <div className="calc__panel-body">
        <StatRow label={formatMessage({ id: 'stat.str' })} value={stats.stats?.str ?? 0} />
        <StatRow label={formatMessage({ id: 'stat.dex' })} value={stats.stats?.dex ?? 0} />
        <StatRow label={formatMessage({ id: 'stat.int' })} value={stats.stats?.int ?? 0} />
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
          label={formatMessage({ id: 'stat.moveSpeedBonus' })}
          value={charStats.moveSpeed}
          suffix="%"
        />
        <StatRow
          label={formatMessage({ id: 'stat.skillDuration' })}
          value={charStats.skillDuration}
          suffix="%"
        />
        <StatRow
          label={formatMessage({ id: 'stat.sealCompensation' })}
          value={charStats.sealCompensation}
          suffix="%"
        />
        <StatRow
          label={formatMessage({ id: 'stat.mechSummonCap' })}
          value={charStats.mechCap}
        />
        <StatRow
          label={formatMessage({ id: 'stat.minionSummonCap' })}
          value={charStats.minionCap}
        />
      </div>
    </div>
  )
}

function SurvivalTab({ stats, survStats, formatMessage }) {
  return (
    <div className="calc__panel">
      <div className="calc__panel-body">
        <StatRow
          label={formatMessage({ id: 'stat.fireRes' })}
          value={stats.res?.fire ?? 0}
          suffix="%"
          className="calc__row-value--red"
        />
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
          label={formatMessage({ id: 'stat.erosionRes' })}
          value={stats.res?.erosion ?? 0}
          suffix="%"
          className="calc__row-value--purple"
        />
        <StatRow
          label={formatMessage({ id: 'stat.totalArmor' })}
          value={survStats.armorTotal}
          className="calc__row-value--orange"
        />
        <StatRow
          label={formatMessage({ id: 'stat.armorInc' })}
          value={survStats.armorInc}
          suffix="%"
          className="calc__row-value--orange"
        />
        <StatRow
          label={formatMessage({ id: 'stat.armorMore' })}
          value={survStats.armorMore}
          suffix="%"
          className="calc__row-value--orange"
        />
        <StatRow
          label={formatMessage({ id: 'stat.totalEvasion' })}
          value={survStats.evasionTotal}
          className="calc__row-value--purple"
        />
        <StatRow
          label={formatMessage({ id: 'stat.evasionInc' })}
          value={survStats.evasionInc}
          suffix="%"
          className="calc__row-value--purple"
        />
        <StatRow
          label={formatMessage({ id: 'stat.evasionMore' })}
          value={survStats.evasionMore}
          suffix="%"
          className="calc__row-value--purple"
        />
        <StatRow
          label={formatMessage({ id: 'stat.manaRegen' })}
          value={survStats.manaRegen}
          className="calc__row-value--cyan"
        />
        <StatRow
          label={formatMessage({ id: 'stat.lifeReturn' })}
          value={survStats.lifeReturn}
          suffix="%"
          className="calc__row-value--green"
        />
        <StatRow
          label={formatMessage({ id: 'stat.lifeReturnInterval' })}
          value={survStats.lifeReturnInterval}
          suffix="%"
          className="calc__row-value--green"
        />
        <StatRow
          label={formatMessage({ id: 'stat.shieldReturn' })}
          value={survStats.shieldReturn}
          suffix="%"
          className="calc__row-value--blue"
        />
        <StatRow
          label={formatMessage({ id: 'stat.shieldReturnInterval' })}
          value={survStats.shieldReturnInterval}
          suffix="%"
          className="calc__row-value--blue"
        />
        <StatRow
          label={formatMessage({ id: 'stat.shieldCharge' })}
          value={survStats.shieldChargePct}
          suffix="%"
          className="calc__row-value--blue"
        />
        <StatRow
          label={formatMessage({ id: 'stat.shieldRechargeDelay' })}
          value={survStats.shieldRechargeDelay}
          suffix="s"
          className="calc__row-value--blue"
        />
      </div>
    </div>
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

function CalculationsPage() {
  const { formatMessage } = useIntl()
  const stats = buildStore.engineStats
  const charStats = buildStore.characterStats
  const survStats = buildStore.survivalStats

  const items = [
    {
      key: 'affix',
      label: formatMessage({ id: 'calculations.tab.affix' }),
      children: <AffixStatsTab />,
    },
    {
      key: 'config',
      label: formatMessage({ id: 'calculations.tab.config' }),
      children: <CombatStatePanel />,
    },
    {
      key: 'base',
      label: formatMessage({ id: 'calculations.tab.base' }),
      children: (
        <BaseAttrsTab stats={stats} charStats={charStats} formatMessage={formatMessage} />
      ),
    },
    {
      key: 'survival',
      label: formatMessage({ id: 'calculations.tab.survival' }),
      children: <SurvivalTab stats={stats} survStats={survStats} formatMessage={formatMessage} />,
    },
    {
      key: 'calc',
      label: formatMessage({ id: 'calculations.tab.skill' }),
      children: <SkillCalcTab />,
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
