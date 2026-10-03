import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useIntl } from 'react-intl'
import { Button, Empty, Input, InputNumber, Modal, Slider, Tooltip, message } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { buildStore } from '../stores/buildStore.js'
import { modulePresetStore } from '../stores/modulePresetStore.js'
import {
  SKILL_FAMILY,
  activeSkills,
  passiveSkills,
  supportSkills,
  catalystSkills,
  magnificentSkills,
  sublimeSkills,
  modularSkills,
  modularAffixPool,
  MODULAR_MAX_AFFIXES,
  effectivenessAt,
  skillByFamilyName,
  matchesSupport,
  magnificentSupports,
} from '../data/skillData.js'
import { cleanAffixText } from '../utils/affixText.js'
import { skillLevelBonusFor } from '../utils/skillLevelBonus.js'
import './SkillsPage.less'

const FAMILY_LABEL_KEYS = {
  [SKILL_FAMILY.active]: 'skills.family.active',
  [SKILL_FAMILY.passive]: 'skills.family.passive',
  [SKILL_FAMILY.support]: 'skills.family.support',
  [SKILL_FAMILY.catalyst]: 'skills.family.catalyst',
  [SKILL_FAMILY.magnificent]: 'skills.family.magnificent',
  [SKILL_FAMILY.sublime]: 'skills.family.sublime',
  [SKILL_FAMILY.modular]: 'skills.family.modular',
}

const FAMILY_COLORS = {
  [SKILL_FAMILY.support]: '#22c55e',
  [SKILL_FAMILY.catalyst]: '#eab308',
  [SKILL_FAMILY.magnificent]: '#f59e0b',
  [SKILL_FAMILY.sublime]: '#d946ef',
  [SKILL_FAMILY.modular]: '#06b6d4',
}

const FAMILY_SKILLS = {
  [SKILL_FAMILY.active]: activeSkills,
  [SKILL_FAMILY.passive]: passiveSkills,
  [SKILL_FAMILY.support]: supportSkills,
  [SKILL_FAMILY.catalyst]: catalystSkills,
  [SKILL_FAMILY.magnificent]: magnificentSkills,
  [SKILL_FAMILY.sublime]: sublimeSkills,
  [SKILL_FAMILY.modular]: modularSkills,
}

// 被动技能（召唤类）声明的召唤物技能名集合：这些技能是魔灵/召唤物使用的，
// 不能配置到主动技能槽，仅作为魔灵属性下方的展示信息
const MINION_SKILL_NAMES = new Set(
  passiveSkills.flatMap((s) => (Array.isArray(s.summonSkills) ? s.summonSkills : []))
)

// 魔灵「基础属性」字段 → i18n key（展示用）
const MINION_BASE_FIELDS = [
  ['mana', 'skills.minion.mana'],
  ['shield', 'skills.minion.shield'],
  ['hit', 'skills.minion.hit'],
  ['dodge', 'skills.minion.dodge'],
  ['attack_block', 'skills.minion.attackBlock'],
  ['spell_block', 'skills.minion.spellBlock'],
  ['火焰抗性', 'skills.minion.fireRes'],
  ['冰冷抗性', 'skills.minion.coldRes'],
  ['闪电抗性', 'skills.minion.lightningRes'],
  ['腐蚀抗性', 'skills.minion.erosionRes'],
  ['暴击值', 'skills.minion.critValue'],
  ['暴击伤害', 'skills.minion.critDamage'],
  ['hp_recovery', 'skills.minion.hpRecovery'],
  ['mana_recovery', 'skills.minion.manaRecovery'],
  ['move_speed', 'skills.minion.moveSpeed'],
  ['defend_range', 'skills.minion.defendRange'],
  ['teleport_range', 'skills.minion.teleportRange'],
]

const MIN_LEVEL = 1
// 技能等级手动调整上限（游戏内手动最高 21 级，其余由「+技能等级」词缀补足）
const MAX_LEVEL = 21

// 辅助技能槽（1 起）可放入的技能族：触媒只能进第 1 槽，华贵只能进第 3 槽，崇高只能进第 5 槽
function allowedSupportFamilies(socketNumber) {
  if (socketNumber === 1) {
    return [SKILL_FAMILY.support, SKILL_FAMILY.catalyst]
  }
  if (socketNumber === 3) {
    return [SKILL_FAMILY.support, SKILL_FAMILY.magnificent]
  }
  if (socketNumber === 5) {
    return [SKILL_FAMILY.support, SKILL_FAMILY.sublime]
  }
  return [SKILL_FAMILY.support]
}

function makeSkillEntry(skill, level = 1) {
  return {
    name: skill.name,
    family: skill.family,
    level,
    effectiveness: effectivenessAt(skill, level),
    imgPath: skill.imgPath,
    intro: skill.intro,
    tags: skill.tags || [],
  }
}

// 技能某等级的数值展示文本：主动技能取「伤害倍率」，其余取等级词缀中除元字段外的值
function skillLevelValues(skill) {
  if (!skill || !Array.isArray(skill.levels)) return []
  return skill.levels
    .map((e) => {
      const level = e && e.level
      if (e['伤害倍率'] != null) {
        const v = parseFloat(String(e['伤害倍率']))
        return { level, text: Number.isNaN(v) ? String(e['伤害倍率']) : `${v}%` }
      }
      const parts = Object.keys(e)
        .filter((k) => !['level', 'damage', 'Descript'].includes(k))
        .map((k) => String(e[k]))
        .filter(Boolean)
      return { level, text: parts.length ? parts.join(' ') : '' }
    })
    .filter((x) => x.level != null && x.text)
}

// 解析可缩放数值：支持整数、小数与分数（如 37/5 → 7.4）
function parseScaledValue(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (s.includes('/')) {
    const [a, b] = s.split('/')
    const na = parseFloat(a)
    const nb = parseFloat(b)
    if (Number.isNaN(na) || Number.isNaN(nb) || nb === 0) return null
    return na / nb
  }
  const v = parseFloat(s)
  return Number.isNaN(v) ? null : v
}

// 按 (LvN:V) 断点表线性插值取等级值，越界取最近端点
function interpolateLevelValue(points, lv) {
  if (!points.length) return null
  const sorted = [...points].sort((a, b) => a.lv - b.lv)
  if (lv <= sorted[0].lv) return sorted[0].v
  const last = sorted[sorted.length - 1]
  if (lv >= last.lv) return last.v
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (lv >= a.lv && lv <= b.lv) {
      if (b.lv === a.lv) return a.v
      const t = (lv - a.lv) / (b.lv - a.lv)
      return a.v + (b.v - a.v) * t
    }
  }
  return last.v
}

function formatScaledValue(v) {
  if (v == null) return ''
  const r = Math.round(v * 100) / 100
  return Number.isInteger(r) ? String(r) : String(r)
}

// 替换文本中内嵌的 (LvN:V) 断点表为当前等级取值，并同步更新表前的基准数值
function applyLevelTables(text, lv) {
  const tableRe = /\(Lv\d+:[^)]*\)/g
  const matches = Array.from(text.matchAll(tableRe))
  if (!matches.length) return text
  const points = matches.map((m) => {
    const inner = m[0].slice(1, -1)
    const sep = inner.indexOf(':')
    return { lv: Number(inner.slice(0, sep)), v: parseScaledValue(inner.slice(sep + 1)) }
  })
  if (points.some((p) => p.v == null)) return text.replace(tableRe, '')
  const val = interpolateLevelValue(points, lv)
  if (val == null) return text.replace(tableRe, '')
  const firstIdx = matches[0].index
  const before = text.slice(0, firstIdx)
  const after = text.slice(firstIdx).replace(tableRe, '')
  const numMatch = before.match(/^(.*?)(\d+(?:\.\d+)?)([^0-9]*)$/)
  if (numMatch) return numMatch[1] + formatScaledValue(val) + numMatch[3] + after
  return before + formatScaledValue(val) + after
}

// 技能介绍随等级变化：
// 1) 介绍内嵌 (LvN:V) 断点表 → 插值替换；
// 2) 被动技能 → 介绍是静态摘要，改用当前等级完整描述（Descript）；
// 3) 主动等技能 → 替换「造成X%武器攻击伤害」为当前等级伤害倍率
function introAtLevel(intro, skill, level) {
  if (!intro) return intro
  const lv = Number(level) || 1
  let text = intro

  // 1) 内嵌 (LvN:V) 断点表：整体替换为当前等级取值
  text = applyLevelTables(text, lv)
  if (/\(Lv\d+:[^)]*\)/.test(intro)) return text

  // 2) 被动技能：介绍是静态摘要 → 采用当前等级完整描述（Descript），去掉开头「技能名：」前缀
  if (skill && skill.family === SKILL_FAMILY.passive) {
    const entry =
      skill && Array.isArray(skill.levels)
        ? skill.levels.find((e) => String(e.level) === String(lv))
        : null
    if (entry && entry.Descript) {
      let d = String(entry.Descript)
      const prefix = skill.name ? `${skill.name}：` : ''
      if (prefix && d.indexOf(prefix) === 0) d = d.slice(prefix.length)
      return applyLevelTables(d, lv)
    }
    return text
  }

  // 3) 主动等技能：把「造成X%武器攻击伤害」的百分比替换为当前等级的伤害倍率
  //    数据中仅 1~20 级有伤害倍率，21 级及以上为空 → 回退到最近可用等级（20 级）数值
  const usable =
    skill && Array.isArray(skill.levels)
      ? skill.levels
          .filter((e) => e && e['伤害倍率'] != null && String(e['伤害倍率']).trim() !== '')
          .sort((a, b) => Number(a.level) - Number(b.level))
      : []
  if (usable.length) {
    const entry = usable.filter((e) => Number(e.level) <= lv).pop() || usable[0]
    const pct = String(entry['伤害倍率']).replace('%', '')
    return text.replace(/造成(\d+(?:\.\d+)?)%武器攻击伤害/, `造成${pct}%武器攻击伤害`)
  }
  return text
}

function SkillTooltipContent({ skill }) {
  const { formatMessage } = useIntl()
  if (!skill) return null
  const values = skillLevelValues(skill)
  const familyLabel = formatMessage({
    id: FAMILY_LABEL_KEYS[skill.family] || 'skills.family.support',
  })
  return (
    <div className="sk-tip">
      <div className="sk-tip__head">
        <span className="sk-tip__name">{skill.name}</span>
        <span className="sk-tip__family">{familyLabel}</span>
      </div>
      {skill.tags && skill.tags.length > 0 && (
        <div className="sk-tip__tags">{skill.tags.join(' | ')}</div>
      )}
      {skill.intro && <div className="sk-tip__intro">{skill.intro}</div>}
      {values.length > 0 && (
        <div className="sk-tip__values">
          {values.map((v) => (
            <span key={v.level} className="sk-tip__value">
              Lv.{v.level} {v.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SkillTip({ skill, placement, children }) {
  if (!skill) return children
  return (
    <Tooltip title={<SkillTooltipContent skill={skill} />} placement={placement} mouseEnterDelay={0.2}>
      {children}
    </Tooltip>
  )
}

function SkillHex({ slot, family, label, onClick }) {
  const skill = slot.name ? skillByFamilyName(family, slot.name) : null
  const hex = (
    <button
      type="button"
      className="sk-hex"
      aria-label={label}
      title={slot.name || undefined}
      onClick={onClick}
    >
      <svg viewBox="0 0 48 48" className="sk-hex__frame" aria-hidden="true">
        <path d="M24 1.5 L43.4856 12.75 L43.4856 35.25 L24 46.5 L4.5144 35.25 L4.5144 12.75 Z" />
      </svg>
      {slot.name && slot.imgPath ? (
        <img src={slot.imgPath} alt={slot.name} className="sk-hex__img" />
      ) : (
        <svg viewBox="0 0 48 48" className="sk-hex__plus" aria-hidden="true">
          <path d="M24 20V28M20 24H28" />
        </svg>
      )}
    </button>
  )
  return (
    <SkillTip skill={skill} placement="right">
      {hex}
    </SkillTip>
  )
}

function SupportSocket({ support, locked, socketNumber, title, matched = true, onClick }) {
  if (locked) {
    return (
      <span className="sk-socket sk-socket--locked" title={title}>
        <svg viewBox="0 0 11 11" className="sk-socket__slash" preserveAspectRatio="none" aria-hidden="true">
          <path d="M10.5 0.5L0.5 10.5" />
        </svg>
      </span>
    )
  }
  const color = support && matched ? FAMILY_COLORS[support.family] : undefined
  const skill = support ? skillByFamilyName(support.family, support.name) : null
  const socket = (
    <button
      type="button"
      className={`sk-socket ${support && !matched ? 'sk-socket--mismatch' : ''}`}
      style={color ? { borderColor: color } : undefined}
      aria-label={title}
      title={title}
      onClick={onClick}
    >
      {support ? (
        <img src={support.imgPath} alt={support.name} className="sk-socket__img" />
      ) : socketNumber === 1 ? (
        <PlusOutlined className="sk-socket__plus" />
      ) : (
        <svg viewBox="0 0 11 11" className="sk-socket__slash" preserveAspectRatio="none" aria-hidden="true">
          <path d="M10.5 0.5L0.5 10.5" />
        </svg>
      )}
    </button>
  )
  return (
    <SkillTip skill={skill} placement="right">
      {socket}
    </SkillTip>
  )
}

// 主技能标签是否包含某辅助技能的约束标签；主技能为空或辅助无约束时视为匹配
function supportMatched(slot, sup) {
  if (!slot || !slot.name || !sup) return true
  const skill = skillByFamilyName(sup.family, sup.name)
  if (!skill) return true
  let tags = Array.isArray(slot.tags) ? slot.tags : []
  if (tags.length === 0) {
    const mainFamily = slot.family || SKILL_FAMILY.active
    const mainSkill = skillByFamilyName(mainFamily, slot.name)
    tags = mainSkill && Array.isArray(mainSkill.tags) ? mainSkill.tags : []
  }
  if (sup.family === SKILL_FAMILY.magnificent || sup.family === SKILL_FAMILY.sublime) {
    return magnificentSupports(tags, slot.name, skill, slot.family)
  }
  return matchesSupport(tags, skill)
}

function SkillsPage() {
  const { formatMessage } = useIntl()

  // picker: { group, index, socketIdx? }；socketIdx 有值表示在选辅助技能，否则选主/被动技能
  const [picker, setPicker] = useState(null)
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState(null)

  const mainSlots = buildStore.build.skills.filter((s) => s.group === 'main')
  const passiveSlots = buildStore.build.skills.filter((s) => s.group === 'passive')

  function slotOf(group, index) {
    return buildStore.build.skills.find((s) => s.group === group && s.index === index)
  }

  function openMainPicker(group, index) {
    setFocus({ group, index })
    setPicker({ group, index })
    setSearch('')
  }

  function openSupportPicker(group, index, socketIdx) {
    setFocus({ group, index })
    setPicker({ group, index, socketIdx })
    setSearch('')
  }

  function pickSkill(skill) {
    if (!picker) return
    const { group, index, socketIdx } = picker
    if (socketIdx != null) {
      buildStore.setSkillSupport(group, index, socketIdx, {
        ...makeSkillEntry(skill),
        family: skill.family,
      })
    } else {
      buildStore.setSkillSlot(group, index, makeSkillEntry(skill))
    }
    setPicker(null)
    setSearch('')
  }

  function clearSlot(group, index) {
    buildStore.clearSkillSlot(group, index)
  }

  function setLevel(group, index, level) {
    const slot = slotOf(group, index)
    if (!slot) return
    const family =
      slot.family || (group === 'main' ? SKILL_FAMILY.active : SKILL_FAMILY.passive)
    const skill = skillByFamilyName(family, slot.name)
    const effectiveness = skill ? effectivenessAt(skill, level) : slot.effectiveness
    buildStore.setSkillSlot(group, index, { level, effectiveness })
  }

  function setSupportLevel(group, index, socketIdx, level) {
    const slot = slotOf(group, index)
    const sup = slot && slot.supports ? slot.supports[socketIdx] : null
    if (!sup) return
    buildStore.setSkillSupport(group, index, socketIdx, { ...sup, level })
  }

  function removeSupport(group, index, socketIdx) {
    buildStore.removeSkillSupport(group, index, socketIdx)
  }

  function toggleModularAffix(affix) {
    if (!focus) return
    const slot = slotOf(focus.group, focus.index)
    if (!slot) return
    const current = Array.isArray(slot.affixes) ? slot.affixes : []
    if (current.includes(affix)) {
      buildStore.setSkillAffixes(focus.group, focus.index, current.filter((a) => a !== affix))
    } else if (current.length < MODULAR_MAX_AFFIXES) {
      buildStore.setSkillAffixes(focus.group, focus.index, [...current, affix])
    }
  }

  function clearAllSkills() {
    buildStore.clearAllSkills()
    setFocus(null)
    message.success(formatMessage({ id: 'skills.cleared' }))
  }

  const pickerFamilies = (() => {
    if (!picker) return []
    if (picker.socketIdx != null) {
      return allowedSupportFamilies(picker.socketIdx + 1)
    }
    if (picker.group === 'main') {
      return [SKILL_FAMILY.active, SKILL_FAMILY.modular]
    }
    return [SKILL_FAMILY.passive]
  })()

  // 正在为其选辅助技能的主技能槽（socketIdx 非空时），用于标签过滤
  const pickingForSlot =
    picker && picker.socketIdx != null ? slotOf(picker.group, picker.index) : null
  const pickingForSlotName = pickingForSlot && pickingForSlot.name ? pickingForSlot.name : ''
  const pickingForTags = (() => {
    if (!pickingForSlot || !pickingForSlot.name) return null
    if (Array.isArray(pickingForSlot.tags) && pickingForSlot.tags.length > 0) {
      return pickingForSlot.tags
    }
    const mainFamily = pickingForSlot.family || SKILL_FAMILY.active
    const mainSkill = skillByFamilyName(mainFamily, pickingForSlot.name)
    return mainSkill && Array.isArray(mainSkill.tags) ? mainSkill.tags : null
  })()

  // 当前构建中已使用的辅助技能（全槽位），保证同一辅助技能只装一次
  const usedSupportNames = new Set(
    buildStore.build.skills.flatMap((s) =>
      (s.supports || []).filter(Boolean).map((sup) => sup.name)
    )
  )
  if (
    picker &&
    picker.socketIdx != null &&
    pickingForSlot &&
    pickingForSlot.supports &&
    pickingForSlot.supports[picker.socketIdx]
  ) {
    usedSupportNames.delete(
      pickingForSlot.supports[picker.socketIdx].name
    )
  }

  const pickerGroups = pickerFamilies
    .map((family) => ({
      family,
      label: formatMessage({ id: FAMILY_LABEL_KEYS[family] }),
      items: FAMILY_SKILLS[family].filter((s) => {
        if (usedSupportNames.has(s.name)) return false
        if (family === SKILL_FAMILY.active && MINION_SKILL_NAMES.has(s.name)) return false
        if (
          family === SKILL_FAMILY.magnificent ||
          family === SKILL_FAMILY.sublime
        ) {
          if (
            pickingForTags &&
            !magnificentSupports(pickingForTags, pickingForSlotName, s, pickingForSlot && pickingForSlot.family)
          ) {
            return false
          }
        } else if (pickingForTags && !matchesSupport(pickingForTags, s)) {
          return false
        }
        if (!search || s.name.toLowerCase().includes(search.toLowerCase())) return true
        return false
      }),
    }))
    .filter((g) => g.items.length > 0)

  const pickerTitle = picker
    ? picker.socketIdx != null
      ? formatMessage({ id: 'skills.pickSupportTitle' })
      : picker.group === 'main'
        ? formatMessage({ id: 'skills.pickMainTitle' })
        : formatMessage({ id: 'skills.pickPassiveTitle' })
    : ''

  function renderMainCell(slot) {
    const isCore = slot.index === 1
    return (
      <div key={`main-${slot.index}`} className={`sk-cell ${isCore ? 'sk-cell--wide' : ''}`}>
        <div className="sk-cell__inner">
          <div className="sk-cell__left">
            <SkillHex
              slot={slot}
              family={slot.family || SKILL_FAMILY.active}
              label={formatMessage({ id: 'skills.openMainPicker' })}
              onClick={() => openMainPicker('main', slot.index)}
            />
            <div className="sk-sockets">
              {slot.supports.map((sup, i) => (
                <SupportSocket
                  key={i}
                  support={sup}
                  socketNumber={i + 1}
                  matched={supportMatched(slot, sup)}
                  title={
                    sup
                      ? `${sup.name} · Lv.${sup.level}`
                      : `${formatMessage({ id: 'skills.supportSocket' })} ${i + 1}`
                  }
                  onClick={() => openSupportPicker('main', slot.index, i)}
                />
              ))}
            </div>
          </div>
          <p className="sk-cell__no" aria-label={formatMessage({ id: 'skills.slotNumber' })}>
            <span className="sk-cell__no-hash">#</span>
            <span className="sk-cell__no-num">{slot.index}</span>
          </p>
        </div>
      </div>
    )
  }

  function renderPassiveCell(slot) {
    return (
      <div key={`passive-${slot.index}`} className="sk-cell">
        <div className="sk-cell__inner">
          <div className="sk-cell__left">
            <SkillHex
              slot={slot}
              family={slot.family || SKILL_FAMILY.passive}
              label={formatMessage({ id: 'skills.openMainPicker' })}
              onClick={() => openMainPicker('passive', slot.index)}
            />
            <div className="sk-sockets">
              {slot.supports.map((sup, i) => (
                <SupportSocket
                  key={i}
                  support={sup}
                  socketNumber={i + 1}
                  matched={supportMatched(slot, sup)}
                  title={
                    sup
                      ? `${sup.name} · Lv.${sup.level}`
                      : `${formatMessage({ id: 'skills.supportSocket' })} ${i + 1}`
                  }
                  onClick={() => openSupportPicker('passive', slot.index, i)}
                />
              ))}
            </div>
          </div>
          <p className="sk-cell__no" aria-label={formatMessage({ id: 'skills.slotNumber' })}>
            <span className="sk-cell__no-hash">#</span>
            <span className="sk-cell__no-num">{slot.index}</span>
          </p>
        </div>
      </div>
    )
  }

  function renderDetail() {
    if (!focus) {
      return (
        <div className="sk-detail__empty">
          <Empty description={formatMessage({ id: 'skills.noSelection' })} />
        </div>
      )
    }
    const slot = slotOf(focus.group, focus.index)
    if (!slot) {
      return (
        <div className="sk-detail__empty">
          <Empty description={formatMessage({ id: 'skills.noSelection' })} />
        </div>
      )
    }
    if (!slot.name) {
      return (
        <div className="sk-detail__empty">
          <Empty description={formatMessage({ id: 'skills.slotEmptyHint' })} />
        </div>
      )
    }
    const isPassive = focus.group === 'passive'
    const slotFamily = slot.family || (isPassive ? SKILL_FAMILY.passive : SKILL_FAMILY.active)
    const familyLabel = formatMessage({
      id: FAMILY_LABEL_KEYS[slotFamily] || 'skills.family.support',
    })
    const modularSkill = slotFamily === SKILL_FAMILY.modular
      ? skillByFamilyName(SKILL_FAMILY.modular, slot.name)
      : null
    const levelSkill = modularSkill || (slot.name ? skillByFamilyName(slotFamily, slot.name) : null)

    // 词缀「+N技能等级」加成（按技能标签匹配），有效等级 = 手动等级 + 加成
    const slotTags =
      Array.isArray(slot.tags) && slot.tags.length > 0
        ? slot.tags
        : levelSkill && Array.isArray(levelSkill.tags)
          ? levelSkill.tags
          : []
    const levelBonus = skillLevelBonusFor(
      { name: slot.name, group: focus.group, index: focus.index, family: slotFamily, tags: slotTags },
      buildStore.skillLevelAffixes
    )
    const manualLevel = Math.min(slot.level, MAX_LEVEL)
    const effectiveLevel = manualLevel + levelBonus
    const effAt = levelSkill ? effectivenessAt(levelSkill, effectiveLevel) : slot.effectiveness
    return (
      <div className="sk-detail">
        <div className="sk-detail__head">
          {slot.imgPath && <img src={slot.imgPath} alt="" className="sk-detail__img" />}
          <div className="sk-detail__head-main">
            <div className="sk-detail__name">{slot.name}</div>
            <div className="sk-detail__meta">
              {familyLabel} · {formatMessage({ id: 'skills.levelShort' })} {effectiveLevel}
              {!isPassive && effAt > 0 && (
                <span className="sk-detail__eff"> · {effAt}%</span>
              )}
              {levelBonus !== 0 && (
                <span className="sk-detail__bonus">
                  {' '}
                  · {formatMessage({ id: 'skills.levelBonus' })}
                  {levelBonus > 0 ? `+${levelBonus}` : levelBonus}
                </span>
              )}
            </div>
          </div>
          <Button size="small" danger onClick={() => clearSlot(focus.group, focus.index)}>
            {formatMessage({ id: 'skills.remove' })}
          </Button>
        </div>

        <div className="sk-detail__level">
          <div className="sk-detail__row">
            <span className="sk-detail__label">{formatMessage({ id: 'skills.level' })}</span>
            <Slider
              className="sk-detail__slider"
              min={MIN_LEVEL}
              max={MAX_LEVEL}
              value={manualLevel}
              onChange={(v) => setLevel(focus.group, focus.index, v)}
            />
            <InputNumber
              size="small"
              min={MIN_LEVEL}
              max={MAX_LEVEL}
              value={manualLevel}
              onChange={(v) => setLevel(focus.group, focus.index, v || MIN_LEVEL)}
            />
            {levelBonus !== 0 && (
              <span
                className={`sk-detail__manual-bonus ${levelBonus > 0 ? 'sk-detail__manual-bonus--pos' : 'sk-detail__manual-bonus--neg'}`}
              >
                {formatMessage({ id: 'skills.manualLevel' })} {manualLevel} (
                {levelBonus > 0 ? `+${levelBonus}` : levelBonus})
              </span>
            )}
          </div>
        </div>

        {slot.intro && (
          <div className="sk-detail__intro">
            {introAtLevel(slot.intro, levelSkill, effectiveLevel)}
          </div>
        )}

        {levelSkill && levelSkill.minion && levelSkill.minion['基础属性'] && (
          <div className="sk-detail__minion">
            <div className="sk-detail__sub-title">
              {formatMessage({ id: 'skills.minionTitle' })}
            </div>
            <div className="sk-detail__minion-growth">
              {(() => {
                const growthList = Array.isArray(levelSkill.minion['成长词缀'])
                  ? levelSkill.minion['成长词缀']
                  : []
                const growth =
                  growthList.filter((g) => g && String(g.skill_level) === String(effectiveLevel))[0] ||
                  [...growthList]
                    .filter((g) => g && Number(g.skill_level) <= effectiveLevel)
                    .sort((a, b) => Number(b.skill_level) - Number(a.skill_level))[0]
                  if (!growth) return null
                return (
                  <div className="sk-detail__minion-growth-row">
                    <span>
                      {formatMessage({ id: 'skills.minion.hp' })} {growth.hp}
                    </span>
                    <span>
                      {formatMessage({ id: 'skills.minion.damage' })} {growth.damage}
                    </span>
                    <span>
                      {formatMessage({ id: 'skills.minion.armour' })} {growth.armour}
                    </span>
                  </div>
                )
              })()}
            </div>
            <div className="sk-detail__minion-grid">
              {MINION_BASE_FIELDS.map(([field, labelId]) => {
                const v = levelSkill.minion['基础属性'][field]
                if (v == null || v === '') return null
                return (
                  <span key={field} className="sk-detail__minion-item">
                    <span className="sk-detail__minion-label">
                      {formatMessage({ id: labelId })}
                    </span>
                    <span className="sk-detail__minion-value">{v}</span>
                  </span>
                )
              })}
            </div>
            {levelSkill.summonSkills && levelSkill.summonSkills.length > 0 && (
              <div className="sk-detail__minion-skills">
                <div className="sk-detail__sub-title">
                  {formatMessage({ id: 'skills.minion.summonSkills' })}
                </div>
                <div className="sk-detail__minion-skill-list">
                  {levelSkill.summonSkills.map((name) => {
                    const minionSkill = skillByFamilyName(SKILL_FAMILY.active, name)
                    return (
                      <div key={name} className="sk-detail__minion-skill">
                        {minionSkill && minionSkill.imgPath && (
                          <img
                            src={minionSkill.imgPath}
                            alt={name}
                            className="sk-detail__minion-skill-img"
                          />
                        )}
                        <span className="sk-detail__minion-skill-name">{name}</span>
                        <span className="sk-detail__minion-skill-info">
                          {minionSkill && minionSkill.tags && minionSkill.tags.length > 0 && (
                            <span className="sk-detail__minion-skill-tags">
                              {minionSkill.tags.join(' · ')}
                            </span>
                          )}
                          {minionSkill && minionSkill.intro && (
                            <span className="sk-detail__minion-skill-intro">
                              {cleanAffixText(minionSkill.intro)}
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {modularSkill && (
          <div className="sk-detail__modular">
            <div className="sk-detail__sub-title">
              {formatMessage({ id: 'skills.modularAffixes' })} ({slot.affixes.length}/
              {MODULAR_MAX_AFFIXES})
            </div>
            <div className="sk-detail__modular-grid">
              {(modularSkill.affixes || []).map((affix) => {
                const active = (slot.affixes || []).includes(affix)
                const full = (slot.affixes || []).length >= MODULAR_MAX_AFFIXES
                const pool = modularAffixPool[affix]
                return (
                  <button
                    type="button"
                    key={affix}
                    className={`sk-detail__modular-item ${active ? 'sk-detail__modular-item--active' : ''} ${!active && full ? 'sk-detail__modular-item--full' : ''}`}
                    onClick={() => toggleModularAffix(affix)}
                    disabled={!active && full}
                  >
                    <span className="sk-detail__modular-name">{affix}</span>
                    {pool && pool.描述 && (
                      <span className="sk-detail__modular-desc">{cleanAffixText(pool.描述)}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {slot.supports.some(Boolean) && (
          <div className="sk-detail__supports">
            <div className="sk-detail__sub-title">
              {formatMessage({ id: 'skills.supports' })}
            </div>
            {slot.supports.map((sup, i) => {
              if (!sup) return null
              const supSkill = sup.family ? skillByFamilyName(sup.family, sup.name) : null
              const supTags =
                Array.isArray(sup.tags) && sup.tags.length > 0
                  ? sup.tags
                  : supSkill && Array.isArray(supSkill.tags)
                    ? supSkill.tags
                    : []
              const supBonus = skillLevelBonusFor(
                { name: sup.name, group: focus.group, index: focus.index, family: sup.family, tags: supTags },
                buildStore.skillLevelAffixes
              )
              const supManual = Math.min(sup.level, MAX_LEVEL)
              return sup ? (
                <div key={`${sup.id}-${i}`} className="sk-detail__support">
                  {sup.imgPath && <img src={sup.imgPath} alt="" className="sk-detail__support-img" />}
                  <div className="sk-detail__support-main">
                    <div className="sk-detail__support-name">
                      <span
                        className="sk-detail__support-dot"
                        style={
                          FAMILY_COLORS[sup.family]
                            ? { backgroundColor: FAMILY_COLORS[sup.family] }
                            : undefined
                        }
                      />
                      {sup.name}
                      <span className="sk-detail__support-family">
                        {formatMessage({ id: FAMILY_LABEL_KEYS[sup.family] || 'skills.family.support' })}
                      </span>
                      {supportMatched(slot, sup) ? (
                        <span
                          className="sk-detail__support-status sk-detail__support-status--ok"
                          title={formatMessage({ id: 'skills.supportMatched' })}
                        />
                      ) : (
                        <span
                          className="sk-detail__support-status sk-detail__support-status--bad"
                          title={formatMessage({ id: 'skills.supportMismatch' })}
                        />
                      )}
                    </div>
                    <div className="sk-detail__row">
                      <span className="sk-detail__label">{formatMessage({ id: 'skills.level' })}</span>
                      <Slider
                        className="sk-detail__slider"
                        min={MIN_LEVEL}
                        max={MAX_LEVEL}
                        value={supManual}
                        onChange={(v) => setSupportLevel(focus.group, focus.index, i, v)}
                      />
                      <InputNumber
                        size="small"
                        min={MIN_LEVEL}
                        max={MAX_LEVEL}
                        value={supManual}
                        onChange={(v) => setSupportLevel(focus.group, focus.index, i, v || MIN_LEVEL)}
                      />
                      {supBonus !== 0 && (
                        <span
                          className={`sk-detail__manual-bonus ${supBonus > 0 ? 'sk-detail__manual-bonus--pos' : 'sk-detail__manual-bonus--neg'}`}
                        >
                          {formatMessage({ id: 'skills.manualLevel' })} {supManual} (
                          {supBonus > 0 ? `+${supBonus}` : supBonus})
                        </span>
                      )}
                      <Button size="small" onClick={() => removeSupport(focus.group, focus.index, i)}>
                        {formatMessage({ id: 'skills.removeSupport' })}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="sk">
      <div className="sk__header">
        <h2 className="sk__title">{formatMessage({ id: 'tab.skills' })}</h2>
        <div className="sk__header-actions">
          <Button size="small" onClick={() => modulePresetStore.openDrawer('skills')}>
            {formatMessage({ id: 'preset.open' })}
          </Button>
          <Button size="small" onClick={clearAllSkills}>
            {formatMessage({ id: 'skills.resetAll' })}
          </Button>
        </div>
      </div>

      <div className="sk__body">
        <div className="sk__box sk__box--bars">
          <div className="sk__bars">
            <div className="sk__group">
              <div className="sk__group-title">
                {formatMessage({ id: 'skills.group.main' })}
              </div>
              <div className="sk-grid sk-grid--main">{mainSlots.map(renderMainCell)}</div>
            </div>

            <div className="sk__group">
              <div className="sk__group-title">
                {formatMessage({ id: 'skills.group.passive' })}
              </div>
              <div className="sk-grid sk-grid--passive">{passiveSlots.map(renderPassiveCell)}</div>
            </div>
          </div>
        </div>

        <div className="sk__box sk__box--detail">
          <div className="sk__box-title">{formatMessage({ id: 'skills.box.adjust' })}</div>
          <div className="sk__detail-panel">{renderDetail()}</div>
        </div>
      </div>

      <Modal
        title={pickerTitle}
        visible={!!picker}
        onCancel={() => setPicker(null)}
        footer={null}
        width={760}
        className="sk-picker"
      >
        <Input
          className="sk-picker__search"
          size="small"
          allowClear
          prefix={<SearchOutlined />}
          placeholder={formatMessage({ id: 'skills.search' })}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="sk-picker__list">
          {pickerGroups.length === 0 ? (
            <div className="sk-picker__none">{formatMessage({ id: 'skills.empty' })}</div>
          ) : (
            pickerGroups.map((g) => (
              <div key={g.family} className="sk-picker__group">
                <div className="sk-picker__group-title">
                  {g.label} ({g.items.length})
                </div>
                <div className="sk-picker__grid">
                  {g.items.map((skill) => (
                    <SkillTip key={skill.key} skill={skill} placement="right">
                      <button type="button" className="sk-picker__item" onClick={() => pickSkill(skill)}>
                        {skill.imgPath && (
                          <span className="sk-picker__item-img">
                            <img src={skill.imgPath} alt="" />
                          </span>
                        )}
                        <span className="sk-picker__item-name">{skill.name}</span>
                      </button>
                    </SkillTip>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}

export default observer(SkillsPage)
