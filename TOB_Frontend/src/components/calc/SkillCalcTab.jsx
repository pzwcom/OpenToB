import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useIntl } from 'react-intl'
import { Drawer, Empty, Select } from 'antd'
import { buildStore } from '../../stores/buildStore.js'
import {
  SKILL_FAMILY,
  skillByFamilyName,
} from '../../data/skillData.js'
import { cleanAffixText } from '../../utils/affixText.js'

const MODULE_LABEL_IDS = {
  divinity: 'affixStats.source.divinity',
  talent: 'affixStats.source.talent',
  equipment: 'affixStats.source.equipment',
  memory: 'affixStats.source.memory',
  pact: 'affixStats.source.pact',
  skill: 'affixStats.source.skill',
}

const FAMILY_LABEL_IDS = {
  [SKILL_FAMILY.active]: 'skills.family.active',
  [SKILL_FAMILY.passive]: 'skills.family.passive',
  [SKILL_FAMILY.support]: 'skills.family.support',
  [SKILL_FAMILY.catalyst]: 'skills.family.catalyst',
  [SKILL_FAMILY.magnificent]: 'skills.family.magnificent',
  [SKILL_FAMILY.sublime]: 'skills.family.sublime',
  [SKILL_FAMILY.modular]: 'skills.family.modular',
}

// 魔灵分支：取决于该魔灵召唤的技能是「攻击」还是「法术」。
// 被动技能自身标签恒为「法术」，但召唤物技能（闪电流星/裂石打击等）决定攻击侧/法术侧暴击值，
// 因此按魔灵名映射分支（数据来自各魔灵召唤物技能的标签）。未收录魔灵默认法术。
const SPIRIT_BRANCH = {
  召唤雷霆之灵: 'attack',
  召唤磐石之灵: 'attack',
}

const DETAIL_META = {
  critDamage: { label: 'calculations.skill.detail.critDamage', pct: true },
  critValueFlat: { label: 'calculations.skill.detail.critValueFlat', pct: false },
  critValuePct: { label: 'calculations.skill.detail.critValuePct', pct: true },
  elementFire: { label: 'calculations.skill.detail.elementFire', pct: true },
  elementCold: { label: 'calculations.skill.detail.elementCold', pct: true },
  elementLightning: { label: 'calculations.skill.detail.elementLightning', pct: true },
  armorPen: { label: 'calculations.skill.detail.armorPen', pct: true },
  erosionPen: { label: 'calculations.skill.detail.erosionPen', pct: true },
  spiritSourceEffect: { label: 'calculations.skill.detail.spiritSourceEffect', pct: true },
  doubleDamageChance: { label: 'calculations.skill.detail.doubleDamage', pct: true },
  countCap: { label: 'calculations.skill.detail.countCap', pct: false, int: true },
  atkSpeed: { label: 'calculations.skill.detail.atkSpeed', pct: true },
  castSpeed: { label: 'calculations.skill.detail.castSpeed', pct: true },
}

function fmt(n) {
  return String(n.toFixed(2))
}

// 数值展示：保留两位小数；计数类（暴击值 flat/数量上限）不带 %
function fmtValue(v, pct) {
  return (pct ? '+' : '') + fmt(v) + (pct ? '%' : '')
}

// 技能某等级的数值文本：主动技能取「伤害倍率」，其余取等级词缀中除元字段外的值
function levelValueAt(skill, level) {
  if (!skill || !Array.isArray(skill.levels)) return ''
  const lv = Number(level || 1)
  const entry = skill.levels.find((e) => String(e.level) === String(lv))
  if (!entry) return ''
  if (entry['伤害倍率'] != null) {
    const v = parseFloat(String(entry['伤害倍率']))
    return Number.isNaN(v) ? String(entry['伤害倍率']) : `${v}%`
  }
  const parts = Object.keys(entry)
    .filter((k) => !['level', 'damage', 'Descript'].includes(k))
    .map((k) => String(entry[k]))
    .filter(Boolean)
  return parts.length ? parts.join(' ') : ''
}

function buildRows(stats, branch, formatMessage) {
  const isAtk = branch === 'attack'
  const rows = [
    {
      key: 'critRate',
      label: formatMessage({
        id: isAtk ? 'calculations.skill.attackCritRate' : 'calculations.skill.spellCritRate',
      }),
      value: stats.critRate,
      suffix: '%',
      detailKeys: ['critValueFlat', 'critValuePct'],
    },
    {
      key: 'critValuePct',
      label: formatMessage({
        id: isAtk
          ? 'calculations.skill.attackCritValuePct'
          : 'calculations.skill.spellCritValuePct',
      }),
      value: stats.critValuePct,
      suffix: '%',
      detailKeys: ['critValuePct'],
    },
    {
      key: 'critDamage',
      label: formatMessage({ id: 'calculations.skill.critDamage' }),
      value: 150 + stats.critDamage,
      suffix: '%',
      detailKeys: ['critDamage'],
    },
  ]

  const penLabel = formatMessage({ id: 'calculations.skill.elementPen' })
  for (const [el, key, labelId] of [
    ['fire', 'elementFire', 'calculations.skill.elementFire'],
    ['cold', 'elementCold', 'calculations.skill.elementCold'],
    ['lightning', 'elementLightning', 'calculations.skill.elementLightning'],
  ]) {
    const v = stats.elementPen[el]
    rows.push({
      key,
      label: `${penLabel} · ${formatMessage({ id: labelId })}`,
      value: v,
      suffix: '%',
      detailKeys: [key],
    })
  }

  rows.push(
    {
      key: 'armorPen',
      label: formatMessage({ id: 'calculations.skill.armorPen' }),
      value: stats.armorPen,
      suffix: '%',
      detailKeys: ['armorPen'],
    },
    {
      key: 'erosionPen',
      label: formatMessage({ id: 'calculations.skill.erosionPen' }),
      value: stats.erosionPen,
      suffix: '%',
      detailKeys: ['erosionPen'],
    },
    {
      key: 'spiritSourceEffect',
      label: formatMessage({ id: 'calculations.skill.spiritSourceEffect' }),
      value: stats.spiritSourceEffect,
      suffix: '%',
      detailKeys: ['spiritSourceEffect'],
    },
    {
      key: 'doubleDamageChance',
      label: formatMessage({ id: 'calculations.skill.doubleDamage' }),
      value: stats.doubleDamageChance,
      suffix: '%',
      detailKeys: ['doubleDamageChance'],
    }
  )

  rows.push({
    key: 'countCap',
    label: formatMessage({ id: 'calculations.skill.countCap' }),
    value: stats.countCapFixed != null ? stats.countCapFixed : stats.countCap,
    suffix: '',
    int: true,
    detailKeys: ['countCap'],
    hint:
      stats.countCapFixed != null
        ? formatMessage(
            { id: 'calculations.skill.countCapFixedHint' },
            { value: stats.countCapFixed }
          )
        : null,
  })

  rows.push(
    isAtk
      ? {
          key: 'atkSpeed',
          label: formatMessage({ id: 'calculations.skill.atkSpeed' }),
          value: stats.atkSpeed,
          suffix: '%',
          detailKeys: ['atkSpeed'],
        }
      : {
          key: 'castSpeed',
          label: formatMessage({ id: 'calculations.skill.castSpeed' }),
          value: stats.castSpeed,
          suffix: '%',
          detailKeys: ['castSpeed'],
        }
  )

  return rows
}

function DetailDrawer({ row, onClose, stats, formatMessage }) {
  return (
    <Drawer
      open={!!row}
      onClose={onClose}
      placement="right"
      width={460}
      title={row ? row.label : ''}
      className="skill-calc__drawer"
    >
      {row && (
        <div className="skill-calc__drawer-body">
          {row.detailKeys.map((dk) => {
            const meta = DETAIL_META[dk]
            const entries = stats.detail[dk] || []
            if (!entries.length) return null
            const groups = {}
            for (const e of entries) {
              ;(groups[e.module] = groups[e.module] || []).push(e)
            }
            return (
              <div key={dk} className="skill-calc__detail-group">
                <div className="skill-calc__detail-title">{formatMessage({ id: meta.label })}</div>
                {Object.keys(MODULE_LABEL_IDS).map((mk) => {
                  const list = groups[mk]
                  if (!list) return null
                  return (
                    <div key={mk} className="skill-calc__detail-module">
                      <div className="skill-calc__detail-module-name">
                        {formatMessage({ id: MODULE_LABEL_IDS[mk] })}
                      </div>
                      {list.map((e, i) => (
                        <div key={i} className="skill-calc__detail-row">
                          <span className="skill-calc__detail-text">{cleanAffixText(e.text)}</span>
                          <span className="skill-calc__detail-value">
                            {meta.int ? e.value : fmtValue(e.value, meta.pct)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}
          {row.detailKeys.every((dk) => !(stats.detail[dk] || []).length) && (
            <div className="skill-calc__empty">
              {formatMessage({ id: 'calculations.skill.drawerEmpty' })}
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}

// 魔灵技能面板：暴击/穿透/魔灵之源等属性行（词缀来自全部 6 个模块）
function MinionPanel({ minion, stats, onOpen, formatMessage }) {
  const branch = SPIRIT_BRANCH[minion.name] || 'spell'
  const rows = buildRows(stats, branch, formatMessage)
  const branchLabel = formatMessage({
    id:
      branch === 'attack' ? 'calculations.skill.branch.attack' : 'calculations.skill.branch.spell',
  })
  return (
    <div className="calc__panel">
      <div className="calc__panel-head">
        <h3 className="calc__panel-title">
          {minion.name} · {formatMessage({ id: 'skills.levelShort' })}
          {minion.level}
        </h3>
        <span className="calc__panel-count">{branchLabel}</span>
      </div>
      <div className="calc__panel-body skill-calc__rows">
        {rows.map((r) => (
          <button key={r.key} type="button" className="skill-calc__row" onClick={() => onOpen(r)}>
            <span className="skill-calc__row-text">{r.label}</span>
            {r.hint && <span className="skill-calc__row-hint">{r.hint}</span>}
            <span className="skill-calc__row-value">
              {r.int ? r.value : fmt(r.value)}
              {r.suffix}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// 主动技能面板：等级、伤害倍率、标签、当前等级数值
function ActiveSkillPanel({ slot, skill, formatMessage }) {
  const familyLabel = formatMessage({
    id: FAMILY_LABEL_IDS[skill.family] || 'skills.family.active',
  })
  const desc = levelValueAt(skill, slot.level)
  return (
    <div className="calc__panel">
      <div className="calc__panel-head">
        <h3 className="calc__panel-title">{slot.name}</h3>
        <span className="calc__panel-count">
          {familyLabel} · {formatMessage({ id: 'skills.levelShort' })}
          {slot.level}
        </span>
      </div>
      <div className="calc__panel-body skill-calc__rows">
        <div className="skill-calc__row">
          <span className="skill-calc__row-text">
            {formatMessage({ id: 'calculations.skill.effectiveness' })}
          </span>
          <span className="skill-calc__row-value">
            {slot.effectiveness > 0 ? `${slot.effectiveness}%` : desc}
          </span>
        </div>
        <div className="skill-calc__row">
          <span className="skill-calc__row-text">{formatMessage({ id: 'calculations.skill.tags' })}</span>
          <span className="skill-calc__row-value">{slot.tags.join('、')}</span>
        </div>
        {(desc || skill.intro) && (
          <div className="skill-calc__desc">
            {desc ? `${desc}` : ''}
            {desc && skill.intro ? '\n' : ''}
            {skill.intro ? cleanAffixText(skill.intro) : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// 光环技能面板：光环效果、标签
function AuraPanel({ slot, skill, formatMessage }) {
  const familyLabel = formatMessage({
    id: FAMILY_LABEL_IDS[skill.family] || 'skills.family.passive',
  })
  return (
    <div className="calc__panel">
      <div className="calc__panel-head">
        <h3 className="calc__panel-title">{slot.name}</h3>
        <span className="calc__panel-count">
          {familyLabel} · {formatMessage({ id: 'skills.levelShort' })}
          {slot.level}
        </span>
      </div>
      <div className="calc__panel-body skill-calc__rows">
        <div className="skill-calc__row">
          <span className="skill-calc__row-text">
            {formatMessage({ id: 'calculations.skill.auraEffect' })}
          </span>
          <span className="skill-calc__row-value">{slot.tags.join('、')}</span>
        </div>
        {skill.intro && <div className="skill-calc__desc">{cleanAffixText(skill.intro)}</div>}
      </div>
    </div>
  )
}

function SkillCalcTab() {
  const { formatMessage } = useIntl()
  const [selectedKey, setSelectedKey] = useState(null)
  const [openRow, setOpenRow] = useState(null)
  const stats = buildStore.minionAffixStats

  const mainSlots = (buildStore.build.skills || []).filter(
    (s) => s && s.name && s.group === 'main'
  )
  const passiveSlots = (buildStore.build.skills || []).filter(
    (s) => s && s.name && s.group === 'passive'
  )
  const slots = [...mainSlots, ...passiveSlots]
  const selected =
    slots.find((s) => `${s.group}-${s.index}` === selectedKey) || slots[0] || null
  const skill = selected ? skillByFamilyName(selected.family, selected.name) : null
  const isSpirit = skill && Array.isArray(skill.tags) && skill.tags.includes('魔灵')

  const options = [
    mainSlots.length
      ? {
          label: formatMessage({ id: 'skills.group.main' }),
          options: mainSlots.map((s) => ({
            value: `${s.group}-${s.index}`,
            label: `${s.name} · ${formatMessage({ id: 'skills.levelShort' })}${s.level}`,
          })),
        }
      : null,
    passiveSlots.length
      ? {
          label: formatMessage({ id: 'skills.group.passive' }),
          options: passiveSlots.map((s) => ({
            value: `${s.group}-${s.index}`,
            label: `${s.name} · ${formatMessage({ id: 'skills.levelShort' })}${s.level}`,
          })),
        }
      : null,
  ].filter(Boolean)

  return (
    <div className="skill-calc">
      {slots.length === 0 ? (
        <div className="calc__panel">
          <div className="calc__panel-head">
            <h3 className="calc__panel-title">
              {formatMessage({ id: 'calculations.skill.title' })}
            </h3>
          </div>
          <div className="calc__panel-body">
            <Empty description={formatMessage({ id: 'calculations.skill.noSkill' })} />
          </div>
        </div>
      ) : (
        <>
          <div className="skill-calc__selector">
            <Select
              value={selected ? `${selected.group}-${selected.index}` : undefined}
              onChange={setSelectedKey}
              options={options}
              style={{ minWidth: 260 }}
              className="skill-calc__select"
            />
          </div>
          {selected && skill && isSpirit ? (
            <MinionPanel
              minion={{ name: selected.name, level: selected.level, tags: skill.tags }}
              stats={stats}
              onOpen={setOpenRow}
              formatMessage={formatMessage}
            />
          ) : selected && skill ? (
            selected.group === 'main' ? (
              <ActiveSkillPanel slot={selected} skill={skill} formatMessage={formatMessage} />
            ) : (
              <AuraPanel slot={selected} skill={skill} formatMessage={formatMessage} />
            )
          ) : (
            <div className="calc__panel">
              <div className="calc__panel-head">
                <h3 className="calc__panel-title">
                  {formatMessage({ id: 'calculations.skill.title' })}
                </h3>
              </div>
              <div className="calc__panel-body">
                <Empty description={formatMessage({ id: 'calculations.skill.noSkill' })} />
              </div>
            </div>
          )}
        </>
      )}

      <DetailDrawer
        row={openRow}
        onClose={() => setOpenRow(null)}
        stats={stats}
        formatMessage={formatMessage}
      />
    </div>
  )
}

export default observer(SkillCalcTab)
