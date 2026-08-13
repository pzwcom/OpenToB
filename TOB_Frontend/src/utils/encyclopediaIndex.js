import { cleanAffixText } from './affixText.js'

import legendEquipData from '../assets/json/装备/传奇装备/传奇装备.json'
import normalEquipData from '../assets/json/装备/普通装备/普通装备.json'
import normalBaseData from '../assets/json/装备/普通装备/基础词缀.json'
import normalCraftData from '../assets/json/装备/普通装备/打造词缀.json'
import graftBaseData from '../assets/json/装备/渴瘾装备/基础词缀.json'
import graftCraftData from '../assets/json/装备/渴瘾装备/打造词缀.json'
import graftLegendData from '../assets/json/装备/渴瘾装备/传奇词缀.json'
import towerSeqData from '../assets/json/装备/高塔序列/高塔序列词缀.json'
import reviveData from '../assets/json/装备/英雄追忆/追忆复苏词缀.json'
import reviveMoonData from '../assets/json/装备/英雄追忆/复苏词缀（月相）.json'
import memoryRandomData from '../assets/json/装备/英雄追忆/英雄追忆随机词缀.json'
import memoryBaseData from '../assets/json/装备/英雄追忆/英雄追忆基础属性.json'
import memoryInherentData from '../assets/json/装备/英雄追忆/英雄追忆固有词缀.json'
import memoryImgData from '../assets/json/装备/英雄追忆/英雄追忆图片位置.json'
import slateTalentData from '../assets/json/装备/神格石板/非传奇神格石板词缀.json'
import slateLegendTalentData from '../assets/json/装备/神格石板/传奇神格石板天赋词缀.json'
import slateLegendData from '../assets/json/装备/神格石板/传奇神格石板词缀.json'
import netherPointData from '../assets/json/装备/神格石板/冥王天赋/冥王天赋点.json'
import netherSlateData from '../assets/json/装备/神格石板/冥王天赋/冥王神格石板.json'
import exileBaseData from '../assets/json/装备/神格石板/冥王天赋/放逐基底词缀.json'
import prismKindData from '../assets/json/装备/棱镜/棱镜图片及种类.json'
import prismBaseData from '../assets/json/装备/棱镜/基础词缀.json'
import prismRandomData from '../assets/json/装备/棱镜/随机词缀.json'
import perfumeData from '../assets/json/装备/调香/调香词缀.json'

import activeSkillData from '../assets/json/技能/主动技能词缀.json'
import supportSkillData from '../assets/json/技能/辅助技能词缀.json'
import passiveSkillData from '../assets/json/技能/被动技能词缀.json'
import sublimeSkillData from '../assets/json/技能/崇高技能词缀.json'
import refinedSkillData from '../assets/json/技能/华贵技能词缀.json'
import catalystSkillData from '../assets/json/技能/触媒技能词缀.json'
import modularSkillData from '../assets/json/技能/模组化技能词缀.json'
import modularPoolData from '../assets/json/技能/模组化技能词缀池.json'

import heroTraitData from '../assets/json/角色/角色特性.json'
import heroTraitImgData from '../assets/json/角色/角色特性图片位置.json'
import spiritData from '../assets/json/契灵/契灵词缀.json'
import fateData from '../assets/json/命运/命运词缀.json'
import statusData from '../assets/json/状态/状态说明.json'
import talentImgData from '../assets/json/天赋/天赋所对应的图片位置.json'

export const CATEGORY_KEY = {
  equip: 'equip',
  skill: 'skill',
  talent: 'talent',
  hero: 'hero',
  spirit: 'spirit',
  fate: 'fate',
  status: 'status',
  prism: 'prism',
}

const CATEGORY_ORDER = [
  CATEGORY_KEY.equip,
  CATEGORY_KEY.skill,
  CATEGORY_KEY.talent,
  CATEGORY_KEY.hero,
  CATEGORY_KEY.spirit,
  CATEGORY_KEY.fate,
  CATEGORY_KEY.status,
  CATEGORY_KEY.prism,
]

// 装备大类内子分类展示顺序（未列出的按出现顺序追加）
const EQUIP_SUB_ORDER = [
  '传奇装备',
  '普通装备',
  '渴瘾装备',
  '英雄追忆',
  '神格石板',
  '词缀库-普通',
  '词缀库-渴瘾',
  '词缀库-追忆',
  '高塔序列',
  '调香',
]

const SKILL_SUB_ORDER = [
  '主动技能',
  '辅助技能',
  '被动技能',
  '崇高技能',
  '华贵技能',
  '触媒技能',
  '模组化技能',
]

const TALENT_SUB_ORDER = [
  '天赋节点',
  '神格石板天赋',
  '冥王天赋',
  '调香',
]

// tier 着色：T0/T0+=红、T1=橙、T2~T7=紫
export function tierColorClass(tier) {
  const t = String(tier ?? '')
  if (t === '0' || t === '0+') return 'ency__line--red'
  if (t === '1') return 'ency__line--orange'
  if (/^[2-7]$/.test(t)) return 'ency__line--purple'
  return ''
}

function pushLine(lines, text, tier) {
  const cleaned = cleanAffixText(text)
  if (!cleaned) return
  lines.push({ text: cleaned, tier: tierColorClass(tier) })
}

function pushSearch(search, ...texts) {
  for (const t of texts) {
    const cleaned = cleanAffixText(t)
    if (cleaned) search.push(cleaned.toLowerCase())
  }
}

let entrySeq = 0
function makeEntry(category, subCategory, name, image, search, lines, opts = {}) {
  entrySeq += 1
  return {
    id: `ency_${entrySeq}`,
    category,
    subCategory,
    name: cleanAffixText(name) || '未命名',
    image: image || '',
    search,
    lines,
    ...opts,
  }
}

const entries = []

// ---------- 传奇装备 ----------
for (const [name, item] of Object.entries(legendEquipData)) {
  const search = []
  const lines = []
  pushSearch(search, name, item.类别, item.细分类, item.需求等级, item.基底词缀)
  for (const a of item.词条 || []) {
    pushSearch(search, a)
    pushLine(lines, a, '')
  }
  for (const a of item.侵蚀词条 || []) {
    pushSearch(search, a)
    pushLine(lines, `侵蚀：${a}`, '')
  }
  pushLine(lines, `基底词缀：${item.基底词缀}`, '')
  pushLine(lines, item.需求等级, '')
  entries.push(
    makeEntry(
      CATEGORY_KEY.equip,
      '传奇装备',
      name,
      item.图片地址,
      search,
      lines,
      { brief: true }
    )
  )
}

// ---------- 普通装备 ----------
for (const [name, item] of Object.entries(normalEquipData)) {
  const search = []
  const lines = []
  pushSearch(search, name, item.类别, item.细分类, item.需求等级, item.基底词缀)
  pushLine(lines, `需求等级：${item.需求等级}`, '')
  pushLine(lines, `基底词缀：${item.基底词缀}`, '')
  entries.push(
    makeEntry(
      CATEGORY_KEY.equip,
      '普通装备',
      name,
      item.图片地址,
      search,
      lines
    )
  )
}

// ---------- 渴瘾装备（传奇） ----------
for (const [slot, items] of Object.entries(graftLegendData)) {
  for (const [name, item] of Object.entries(items)) {
    const search = []
    const lines = []
    pushSearch(search, name, slot, item.物品名称, item.需求等级)
    for (const a of item.词条 || []) {
      pushSearch(search, a)
      pushLine(lines, a, '')
    }
    entries.push(
      makeEntry(CATEGORY_KEY.equip, '渴瘾装备', name, '', search, lines)
    )
  }
}

// ---------- 英雄追忆 ----------
for (const kind of ['固有词缀', '随机词缀', '基础属性']) {
  const pool =
    kind === '固有词缀'
      ? memoryInherentData
      : kind === '随机词缀'
        ? memoryRandomData
        : memoryBaseData
  for (const [name, affixes] of Object.entries(pool || {})) {
    const img = memoryImgData[name] || ''
    for (const a of affixes || []) {
      const search = []
      const lines = []
      pushSearch(search, name, a.Modifier, kind)
      pushLine(lines, a.Modifier, a.Tier)
      entries.push(
        makeEntry(
          CATEGORY_KEY.equip,
          '英雄追忆',
          `${name}（${kind}）`,
          img,
          search,
          lines
        )
      )
    }
  }
}

// ---------- 普通装备词缀库 ----------
for (const [sub, affixes] of Object.entries(normalBaseData || {})) {
  for (const a of affixes || []) {
    const search = []
    const lines = []
    pushSearch(search, sub, a.Entry, '基础词缀')
    pushLine(lines, `[${sub}] 基础词缀`, '')
    pushLine(lines, a.Entry, a.Tier)
    entries.push(
      makeEntry(CATEGORY_KEY.equip, '词缀库-普通', a.Entry, '', search, lines)
    )
  }
}
for (const [sub, { 前缀 = [], 后缀 = [] }] of Object.entries(
  normalCraftData || {}
)) {
  for (const a of 前缀) {
    const search = []
    const lines = []
    pushSearch(search, sub, a.Entry, a.Library, '打造-前缀')
    pushLine(lines, `[${sub}] 打造前缀（${a.Library || ''}）`, '')
    pushLine(lines, a.Entry, a.Tier)
    entries.push(
      makeEntry(CATEGORY_KEY.equip, '词缀库-普通', a.Entry, '', search, lines)
    )
  }
  for (const a of 后缀) {
    const search = []
    const lines = []
    pushSearch(search, sub, a.Entry, a.Library, '打造-后缀')
    pushLine(lines, `[${sub}] 打造后缀（${a.Library || ''}）`, '')
    pushLine(lines, a.Entry, a.Tier)
    entries.push(
      makeEntry(CATEGORY_KEY.equip, '词缀库-普通', a.Entry, '', search, lines)
    )
  }
}

// ---------- 渴瘾词缀库 ----------
for (const [slot, affixes] of Object.entries(graftBaseData || {})) {
  for (const a of affixes || []) {
    const search = []
    const lines = []
    pushSearch(search, slot, a.Entry, '基础词缀')
    pushLine(lines, `[${slot}] 基础词缀`, '')
    pushLine(lines, a.Entry, a.Tier)
    entries.push(
      makeEntry(CATEGORY_KEY.equip, '词缀库-渴瘾', a.Entry, '', search, lines)
    )
  }
}
for (const [slot, { 前缀 = [], 后缀 = [] }] of Object.entries(
  graftCraftData || {}
)) {
  for (const a of 前缀) {
    const search = []
    const lines = []
    pushSearch(search, slot, a.Entry, a.Library, '打造-前缀')
    pushLine(lines, `[${slot}] 打造前缀（${a.Library || ''}）`, '')
    pushLine(lines, a.Entry, a.Tier)
    entries.push(
      makeEntry(CATEGORY_KEY.equip, '词缀库-渴瘾', a.Entry, '', search, lines)
    )
  }
  for (const a of 后缀) {
    const search = []
    const lines = []
    pushSearch(search, slot, a.Entry, a.Library, '打造-后缀')
    pushLine(lines, `[${slot}] 打造后缀（${a.Library || ''}）`, '')
    pushLine(lines, a.Entry, a.Tier)
    entries.push(
      makeEntry(CATEGORY_KEY.equip, '词缀库-渴瘾', a.Entry, '', search, lines)
    )
  }
}

// ---------- 追忆复苏词缀 ----------
for (const a of reviveData || []) {
  const search = []
  const lines = []
  pushSearch(search, a.Entry, '追忆复苏')
  pushLine(lines, '追忆复苏词缀', '')
  pushLine(lines, a.Entry, a.Tier)
  entries.push(
    makeEntry(CATEGORY_KEY.equip, '词缀库-追忆', a.Entry, '', search, lines)
  )
}
for (const a of reviveMoonData || []) {
  const search = []
  const lines = []
  pushSearch(search, a.Entry, a.EntryDesc, '月相')
  pushLine(lines, '复苏词缀（月相）', '')
  pushLine(lines, a.Entry, a.Tier)
  pushLine(lines, a.EntryDesc, '')
  entries.push(
    makeEntry(CATEGORY_KEY.equip, '词缀库-追忆', a.Entry, '', search, lines)
  )
}

// ---------- 高塔序列 ----------
for (const [cat, affixes] of Object.entries(towerSeqData || {})) {
  for (const [text, series] of affixes || []) {
    const search = []
    const lines = []
    pushSearch(search, cat, text, series)
    pushLine(lines, `[${cat}] ${series}`, '')
    pushLine(lines, text, '')
    entries.push(
      makeEntry(CATEGORY_KEY.equip, '高塔序列', text, '', search, lines)
    )
  }
}

// ---------- 神格石板（传奇 + 冥王） ----------
for (const [name, item] of Object.entries(slateLegendData || {})) {
  const search = []
  const lines = []
  pushSearch(search, name, item.名称, item.等级需求)
  for (const a of item.词缀 || []) {
    pushSearch(search, a)
    pushLine(lines, a, '')
  }
  for (const [k, v] of Object.entries(item.提示 || {})) {
    pushSearch(search, k, v)
  }
  entries.push(
    makeEntry(CATEGORY_KEY.equip, '神格石板', name, item.图片地址, search, lines)
  )
}
for (const [name, item] of Object.entries(netherSlateData || {})) {
  const search = []
  const lines = []
  pushSearch(search, name, item.名称)
  pushLine(lines, item.词缀, '')
  for (const v of Object.values(item.提示 || {})) {
    pushSearch(search, v)
  }
  entries.push(
    makeEntry(CATEGORY_KEY.equip, '神格石板', name, item.图片地址, search, lines)
  )
}
for (const [name, item] of Object.entries(exileBaseData || {})) {
  const search = []
  const lines = []
  pushSearch(search, name, item.名称, item.描述)
  pushLine(lines, item.描述, '')
  entries.push(makeEntry(CATEGORY_KEY.equip, '神格石板', name, '', search, lines))
}

// ---------- 棱镜 ----------
for (const [name, item] of Object.entries(prismKindData || {})) {
  const search = []
  const lines = []
  pushSearch(search, name, item.name, item.desc, item.rarety)
  pushLine(lines, `稀有度：${item.rarety || '未知'}`, '')
  pushLine(lines, item.desc, '')
  entries.push(
    makeEntry(CATEGORY_KEY.prism, '棱镜', name, item.imgPath, search, lines)
  )
}
for (const text of prismBaseData || []) {
  const search = []
  const lines = []
  pushSearch(search, text, '基础词缀')
  pushLine(lines, text, '')
  entries.push(makeEntry(CATEGORY_KEY.prism, '棱镜', text, '', search, lines))
}
const prismRandomSeen = new Set()
for (const a of prismRandomData || []) {
  if (prismRandomSeen.has(a.entry)) continue
  prismRandomSeen.add(a.entry)
  const search = []
  const lines = []
  pushSearch(search, a.entry, a.category)
  if (a.category) pushLine(lines, `[${a.category}]`, '')
  pushLine(lines, a.entry, a.rarety ? a.rarety : '')
  entries.push(
    makeEntry(CATEGORY_KEY.prism, '棱镜', a.entry, '', search, lines)
  )
}

// ---------- 调香 ----------
for (const [type, affixes] of Object.entries(perfumeData || {})) {
  if (type === '异香天赋') {
    for (const item of affixes || []) {
      const search = []
      const lines = []
      pushSearch(search, item.名称, item.描述, type)
      pushLine(lines, item.描述, '')
      entries.push(
        makeEntry(CATEGORY_KEY.talent, '调香', item.名称, '', search, lines)
      )
    }
  } else {
    for (const text of affixes || []) {
      const search = []
      const lines = []
      pushSearch(search, text, type)
      pushLine(lines, text, '')
      entries.push(makeEntry(CATEGORY_KEY.talent, '调香', text, '', search, lines))
    }
  }
}

// ---------- 天赋节点（从天赋树图片文件名解析词缀文本） ----------
// 坐标前缀格式：{x}_{y}_{w}_{h}_{n}_小型天赋_词缀.jpg
const NODE_FILE_RE = /^(?:\d+_){5}([^_]+)_(.+)$/
// 核心天赋格式：核心天赋_节点名_词缀.jpg
const CORE_FILE_RE = /^核心天赋_(.+?)_(.+)$/
const talentNodeMap = new Map()
for (const [mainGod, branches] of Object.entries(talentImgData || {})) {
  for (const [subGod, paths] of Object.entries(branches)) {
    for (const p of paths || []) {
      const base = String(p).split('/').pop() || ''
      const bare = base.replace(/\.(?:jpg|webp|png)$/i, '').replace(/_小图$/, '')
      let kind = ''
      let name = bare
      let affix = ''
      let m = bare.match(NODE_FILE_RE)
      if (m) {
        kind = m[1].replace('天赋', '')
        affix = m[2]
        name = affix
      } else {
        m = bare.match(CORE_FILE_RE)
        if (m) {
          kind = '核心'
          name = m[1]
          affix = m[2]
        }
      }
      const loc = `${mainGod}·${subGod}`
      if (!talentNodeMap.has(base)) {
        talentNodeMap.set(base, { name, affix, kind, locs: new Set(), image: p })
      }
      talentNodeMap.get(base).locs.add(loc)
    }
  }
}
for (const { name, affix, kind, locs, image } of talentNodeMap.values()) {
  const search = []
  const lines = []
  const locText = [...locs].join(' / ')
  pushSearch(search, name, affix, kind)
  pushLine(lines, `[${locText}] ${kind}`, '')
  pushLine(lines, affix, '')
  entries.push(makeEntry(CATEGORY_KEY.talent, '天赋节点', name, image, search, lines))
}

// ---------- 神格石板天赋（非传奇 + 传奇天赋词缀） ----------
const GENERIC_SLATE_TYPES = new Set([
  '小型天赋',
  '中型天赋',
  '传奇中型天赋',
  '小型冥王天赋点',
  '中型冥王天赋点',
  '传奇中型冥王天赋点',
  '至臻冥王天赋点',
])
const slateTalentMap = new Map()
function buildSlateTalentEntries(data) {
  for (const [mainGod, branches] of Object.entries(data || {})) {
    for (const [subGod, nodes] of Object.entries(branches)) {
      for (const node of nodes || []) {
        const key = `${node.天赋类型}|${node.天赋词缀}`
        if (!slateTalentMap.has(key)) {
          slateTalentMap.set(key, {
            type: node.天赋类型,
            source: node.天赋来源,
            affix: node.天赋词缀,
            hint: node.天赋提示 || {},
            locs: new Set(),
          })
        }
        slateTalentMap.get(key).locs.add(`${mainGod}·${subGod}`)
      }
    }
  }
}
buildSlateTalentEntries(slateTalentData)
buildSlateTalentEntries(slateLegendTalentData)
for (const { type, source, affix, hint, locs } of slateTalentMap.values()) {
  const search = []
  const lines = []
  const generic = GENERIC_SLATE_TYPES.has(type)
  const name = generic ? affix : type
  const kind = generic ? type : ''
  const hints = Object.values(hint)
  pushSearch(search, name, type, source, affix)
  for (const [k, v] of Object.entries(hint)) pushSearch(search, k, v)
  pushLine(lines, `[${[...locs].join(' / ')}]${kind ? ` ${kind}` : ''}`, '')
  pushLine(lines, affix, '')
  entries.push(
    makeEntry(
      CATEGORY_KEY.talent,
      '神格石板天赋',
      name,
      '',
      search,
      lines,
      { hints }
    )
  )
}

// ---------- 冥王天赋 ----------
for (const [cat, points] of Object.entries(netherPointData || {})) {
  for (const p of points || []) {
    const search = []
    const lines = []
    const hints = Object.values(p.提示 || {})
    pushSearch(search, cat, p.名称, p.词缀)
    for (const v of hints) pushSearch(search, v)
    pushLine(lines, `[${cat}]`, '')
    pushLine(lines, p.词缀, '')
    entries.push(
      makeEntry(CATEGORY_KEY.talent, '冥王天赋', p.词缀, '', search, lines, {
        hints,
      })
    )
  }
}

// ---------- 主动/辅助/被动技能 ----------
function buildTieredSkillEntries(data, subCategory) {
  for (const [name, skill] of Object.entries(data || {})) {
    const search = []
    const lines = []
    pushSearch(search, name, skill.介绍)
    for (const t of skill.标签 || []) pushSearch(search, t)
    for (const lv of skill.等级词缀 || []) {
      pushSearch(search, lv.damage, lv.Descript)
      for (const [k, v] of Object.entries(lv)) {
        if (k === 'level' || k === '伤害倍率' || k === 'damage' || k === 'Descript') {
          pushSearch(search, k, v)
        } else {
          pushSearch(search, k, v)
        }
      }
    }
    pushLine(lines, skill.标签?.length ? `标签：${skill.标签.join(' / ')}` : '', '')
    if (skill.介绍) pushLine(lines, skill.介绍, '')
    const lv1 = (skill.等级词缀 || [])[0]
    if (lv1) {
      for (const [k, v] of Object.entries(lv1)) {
        if (k === 'level') continue
        if (k === 'Descript') continue
        pushLine(lines, `${k}：${v}`, '')
      }
    }
    entries.push(
      makeEntry(CATEGORY_KEY.skill, subCategory, name, skill.图片地址, search, lines)
    )
  }
}
buildTieredSkillEntries(activeSkillData, '主动技能')
buildTieredSkillEntries(supportSkillData, '辅助技能')
buildTieredSkillEntries(passiveSkillData, '被动技能')

// ---------- 崇高/华贵/触媒技能 ----------
function buildSimpleSkillEntries(data, subCategory) {
  for (const [name, skill] of Object.entries(data || {})) {
    const search = []
    const lines = []
    pushSearch(search, name, skill.介绍)
    for (const a of skill.词缀 || []) pushSearch(search, a)
    if (skill.介绍) pushLine(lines, skill.介绍, '')
    for (const a of skill.词缀 || []) pushLine(lines, a, '')
    entries.push(
      makeEntry(CATEGORY_KEY.skill, subCategory, name, skill.图片地址, search, lines)
    )
  }
}
buildSimpleSkillEntries(sublimeSkillData, '崇高技能')
buildSimpleSkillEntries(refinedSkillData, '华贵技能')
buildSimpleSkillEntries(catalystSkillData, '触媒技能')

// ---------- 模组化技能 + 词缀池 ----------
for (const [name, skill] of Object.entries(modularSkillData || {})) {
  const search = []
  const lines = []
  pushSearch(
    search,
    name,
    skill.名称,
    skill.赛季,
    skill.介绍,
    skill.召唤物技能?.join(' ')
  )
  for (const [k, v] of Object.entries(skill.属性 || {})) pushSearch(search, k, v)
  for (const t of skill.标签 || []) pushSearch(search, t)
  for (const lv of skill.等级词缀 || []) {
    for (const [k, v] of Object.entries(lv)) {
      if (k !== 'level') pushSearch(search, k, v)
    }
  }
  pushLine(lines, skill.赛季 ? `赛季：${skill.赛季}` : '', '')
  pushLine(lines, skill.标签?.length ? `标签：${skill.标签.join(' / ')}` : '', '')
  for (const [k, v] of Object.entries(skill.属性 || {})) {
    pushLine(lines, `${k}：${v}`, '')
  }
  if (skill.召唤物技能?.length) {
    pushLine(lines, `召唤物技能：${skill.召唤物技能.join(' / ')}`, '')
  }
  if (skill.介绍) pushLine(lines, skill.介绍, '')
  entries.push(
    makeEntry(CATEGORY_KEY.skill, '模组化技能', name, skill.图片地址, search, lines)
  )
}
for (const [name, item] of Object.entries(modularPoolData || {})) {
  const search = []
  const lines = []
  pushSearch(search, name, item.名称, item.描述)
  pushLine(lines, item.描述, '')
  entries.push(
    makeEntry(CATEGORY_KEY.skill, '模组化技能', name, '', search, lines)
  )
}

// ---------- 英雄特性（每个英雄一个子 tab） ----------
for (const [hero, traits] of Object.entries(heroTraitData || {})) {
  for (const [traitName, item] of Object.entries(traits)) {
    const search = []
    const lines = []
    pushSearch(search, hero, traitName, item.desc, item.level_up_time)
    pushLine(lines, item.level_up_time, '')
    pushLine(lines, item.desc, '')
    const img = heroTraitImgData?.[hero]?.[traitName] || ''
    entries.push(
      makeEntry(CATEGORY_KEY.hero, hero, traitName, img, search, lines)
    )
  }
}

// ---------- 契灵 ----------
// 节点/词缀可能是数组（如 [{词缀:路径}]）或对象（如 {词缀:路径}），统一取出词缀文本。
// 普通词缀是节点词条的汇总，会与小型/中型/核心/宿命重复，用 seen 去重。
function collectSpiritLines(target, group, seen) {
  const list = Array.isArray(group)
    ? group
    : Object.entries(group || {}).map(([k, v]) => ({ [k]: v }))
  for (const item of list) {
    if (item && typeof item === 'object') {
      const text = Object.keys(item)[0]
      if (text && !seen.has(text)) {
        seen.add(text)
        pushSearch(target.search, text)
        pushLine(target.lines, text, '')
      }
    } else if (item && !seen.has(item)) {
      seen.add(item)
      pushSearch(target.search, item)
      pushLine(target.lines, item, '')
    }
  }
}
for (const [name, spirit] of Object.entries(spiritData || {})) {
  const search = []
  const lines = []
  const seen = new Set()
  pushSearch(search, name, spirit.稀有分类, spirit.战斗分类)
  pushLine(lines, `稀有分类：${spirit.稀有分类 || '未知'}；战斗分类：${spirit.战斗分类 || '未知'}`, '')
  const ctx = { search, lines }
  collectSpiritLines(ctx, spirit.小型节点, seen)
  collectSpiritLines(ctx, spirit.中型节点, seen)
  collectSpiritLines(ctx, spirit.核心天赋, seen)
  collectSpiritLines(ctx, spirit.宿命, seen)
  collectSpiritLines(ctx, spirit.普通词缀, seen)
  for (const item of spirit.契约链 || []) {
    pushSearch(search, item.词缀, item.类型)
  }
  for (const a of spirit.升阶词缀 || []) {
    pushSearch(search, a)
    pushLine(lines, `升阶：${a}`, '')
  }
  entries.push(
    makeEntry(
      CATEGORY_KEY.spirit,
      '契灵',
      name,
      spirit.契灵本身图片 || spirit.图片地址 || '',
      search,
      lines,
      { brief: true }
    )
  )
}

// ---------- 命运词缀 ----------
for (const [name, item] of Object.entries(fateData || {})) {
  const search = []
  const lines = []
  pushSearch(search, name, item.name, item.desc)
  pushLine(lines, item.desc, '')
  entries.push(
    makeEntry(CATEGORY_KEY.fate, '命运词缀', name, item.imgPath, search, lines)
  )
}

// ---------- 状态说明 ----------
for (const [cat, statuses] of Object.entries(statusData || {})) {
  for (const [name, item] of Object.entries(statuses)) {
    const search = []
    const lines = []
    const hints = item.说明 ? [item.说明] : []
    pushSearch(search, name, item.名称, item.类别, item.说明)
    pushLine(lines, `[${cat}]`, '')
    pushLine(lines, item.名称, '')
    entries.push(
      makeEntry(CATEGORY_KEY.status, '状态', name, '', search, lines, { hints })
    )
  }
}

function subOrderFor(category) {
  if (category === CATEGORY_KEY.equip) return EQUIP_SUB_ORDER
  if (category === CATEGORY_KEY.skill) return SKILL_SUB_ORDER
  if (category === CATEGORY_KEY.talent) return TALENT_SUB_ORDER
  return []
}

// 搜索结果：分组结构
export function searchEncyclopedia(query) {
  const q = cleanAffixText(query).toLowerCase()
  if (!q) return []
  const result = []
  for (const e of entries) {
    if (e.search.some((s) => s.includes(q))) result.push(e)
  }
  const byCategory = new Map()
  for (const e of result) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, new Map())
    const subs = byCategory.get(e.category)
    if (!subs.has(e.subCategory)) subs.set(e.subCategory, [])
    subs.get(e.subCategory).push(e)
  }
  const order = subOrderFor
  return CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => {
    const subs = byCategory.get(cat)
    const subList = [...subs.entries()].sort((a, b) => {
      const ia = order(cat).indexOf(a[0])
      const ib = order(cat).indexOf(b[0])
      const oa = ia === -1 ? 999 : ia
      const ob = ib === -1 ? 999 : ib
      return oa - ob
    })
    const total = subList.reduce((s, [, list]) => s + list.length, 0)
    return {
      category: cat,
      total,
      subs: subList.map(([name, list]) => ({ name, count: list.length, items: list })),
    }
  })
}
