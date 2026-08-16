import { cleanAffixText } from './affixText.js'
import { AFFIX_CONSUMERS, consumerOf, parseBlessingCapMatches, BLESSING_KEY_BY_NAME } from './affixConsumers.js'
import { normalizeStates } from './combatStates.js'
import { affixDisplayText } from './affixRange.js'
import {
  CORE_BOOST_FACTOR,
  CORE_BOOST_LEVEL,
  affixDescWithValue,
  destinyDisplayText,
  scaleAffixNumbers,
} from './pactAffix.js'
import pactSpiritData from '../assets/json/契灵/契灵词缀.json'
import destinyData from '../assets/json/命运/命运词缀.json'
import {
  buildSlotContext,
  getReverseMultiplier,
  nodeInRangeBox,
  prismCoveringApplies,
  scaleAffixTextByFactor,
  stripPrismAffixPrefix,
} from './talentTree.js'
import { modularAffixPool, skillByFamilyName } from '../data/skillData.js'
import { getShapeCells, GOD_NAMES } from '../data/divinityData.js'

const MORE_RE = /(?:额外|additional)/i
const VALUE_RE = /([+-]?\d+(?:\.\d+)?)\s*%/
// 点伤（附加固定伤害）：如「附加(92–108)-(122–138)点物理伤害」
const FLAT_RE = /点(?:物理|火焰|冰冷|闪电|元素|腐蚀|侵蚀|混乱|时空|虚空)伤害/

// 归总一组原始词缀文本：
// - 普通 `+X%` 为 increase，同文本词缀计数并求和；
// - `额外+X%` / `additional` 为 more，独立乘区，同文本词缀相乘；
// - 附加固定伤害（点伤）为 flat，只计数不求和；
// - 旁路消费者词缀（祝福层数上限/魔灵面板等）各自成组，见 AFFIX_CONSUMERS。
// states 为战斗状态（normalizeStates 后），用于消费者谓词的条件门控（与计算端一致）。
// 返回值：{ increase, more, flat, [consumer.key...], others }
//   increase: [{ text, count, value, total }]   total = value * count
//   more:     [{ text, count, value, multiplier }]  multiplier = (1 + value/100) ^ count
//   flat:     [{ text, count }]  附加固定伤害（点伤词缀）
//   others:   [{ text, count }]  无法解析数值的词缀
export function aggregateAffixTexts(affixTexts, states) {
  const increaseMap = new Map()
  const moreMap = new Map()
  const flatMap = new Map()
  const consumerMaps = new Map(AFFIX_CONSUMERS.map((c) => [c.key, new Map()]))
  const othersMap = new Map()

  for (const raw of affixTexts) {
    const text = cleanAffixText(raw).trim()
    if (!text) continue
    // 旁路消费者词缀：被对应模块（条件配置 / 技能计算 tab 等）计入，归入各自分组而非 others/increase
    const consumer = consumerOf(text, states)
    if (consumer) {
      const m = consumerMaps.get(consumer.key)
      m.set(text, (m.get(text) || 0) + 1)
      continue
    }
    if (FLAT_RE.test(text)) {
      flatMap.set(text, (flatMap.get(text) || 0) + 1)
      continue
    }
    const isMore = MORE_RE.test(text)
    const valueMatch = text.match(VALUE_RE)
    const value = valueMatch ? parseFloat(valueMatch[1]) : null
    if (value == null) {
      othersMap.set(text, (othersMap.get(text) || 0) + 1)
      continue
    }
    const target = isMore ? moreMap : increaseMap
    if (!target.has(text)) {
      target.set(text, { text, count: 0, value })
    }
    target.get(text).count += 1
  }

  const increase = [...increaseMap.values()].map((e) => ({
    ...e,
    total: +(e.value * e.count).toFixed(2),
  }))

  const more = [...moreMap.values()].map((e) => ({
    ...e,
    multiplier: +(Math.pow(1 + e.value / 100, e.count)).toFixed(4),
  }))

  const flat = [...flatMap.entries()].map(([text, count]) => ({ text, count }))

  const consumerBuckets = Object.fromEntries(
    AFFIX_CONSUMERS.map((c) => [
      c.key,
      [...(consumerMaps.get(c.key) || new Map()).entries()].map(([text, count]) => ({
        text,
        count,
      })),
    ])
  )

  const others = [...othersMap.entries()].map(([text, count]) => ({ text, count }))

  increase.sort((a, b) => b.total - a.total)
  more.sort((a, b) => b.multiplier - a.multiplier)
  flat.sort((a, b) => b.count - a.count)
  for (const key of Object.keys(consumerBuckets)) {
    consumerBuckets[key].sort((a, b) => b.count - a.count)
  }
  others.sort((a, b) => b.count - a.count)

  return { increase, more, flat, ...consumerBuckets, others }
}

// 神格石板冥王特性数值适配：
// - 审判：两个审判冥王石板之间（连线经过）的石板，词缀效果提升 70%（数值 ×1.7）
// - 侵染：与侵染冥王石板直接相邻（共享边）的石板，获得其词缀 20% 强度投影（数值 ×0.2）
export const JUDGMENT_BOOST = 1.7
export const INFECTION_PROJECTION = 0.2

function placedSlateCells(slate, placed) {
  return getShapeCells(slate.shape, slate.rotation, slate.flippedH, slate.flippedV).map(
    ([r, c]) => [r + (placed.row || 0), c + (placed.col || 0)]
  )
}

function isOnSegment(x, y, ax, ay, bx, by) {
  const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
  if (Math.abs(cross) > 0.6) return false
  return (
    x >= Math.min(ax, bx) - 0.5 &&
    x <= Math.max(ax, bx) + 0.5 &&
    y >= Math.min(ay, by) - 0.5 &&
    y <= Math.max(ay, by) + 0.5
  )
}

function sharesEdge(cellsA, cellsB) {
  const set = new Set(cellsA.map(([r, c]) => `${r},${c}`))
  for (const [r, c] of cellsB) {
    if (
      set.has(`${r + 1},${c}`) ||
      set.has(`${r - 1},${c}`) ||
      set.has(`${r},${c + 1}`) ||
      set.has(`${r},${c - 1}`)
    ) {
      return true
    }
  }
  return false
}

function slateAffixTexts(slate) {
  const texts = []
  if (Array.isArray(slate.affixes)) {
    for (const affix of slate.affixes) {
      if (affix && typeof affix === 'object' && affix.text) texts.push(affix.text)
      else if (typeof affix === 'string' && affix) texts.push(affix)
    }
  }
  if (slate.inherentAffix) texts.push(slate.inherentAffix)
  return texts
}

function isNetherKingSlate(slate) {
  return !!(slate && slate.isNetherKing)
}

function netherKingKeyword(name) {
  const n = String(name || '')
  if (n.includes('审判')) return '审判'
  if (n.includes('侵染') || n.includes('浸染')) return '侵染'
  if (n.includes('放逐')) return '放逐'
  return ''
}

// 归总神格石板（已放置）天赋点词缀，见 aggregateAffixTexts。
// 同时返回每块石板受冥王特性影响的状态：
//   boostedIds: Set<slateId>  受审判强化（词缀 ×JUDGMENT_BOOST）
//   projectedIds: Map<slateId, {text}[]>  受侵染投影（相邻侵染石板词缀 ×INFECTION_PROJECTION）
export function collectDivinitySlateEffects(build) {
  const divPage = build?.divinityPage
  if (!divPage || !Array.isArray(divPage.placedSlates) || !Array.isArray(divPage.inventory)) {
    return { boostedIds: new Set(), projectedIds: new Map() }
  }

  const slateMap = {}
  for (const s of divPage.inventory) slateMap[s.id] = s

  const placedList = []
  for (const placed of divPage.placedSlates) {
    const slate = slateMap[placed.slateId]
    if (!slate) continue
    placedList.push({ slate, placed })
  }

  const cellsOf = (entry) => placedSlateCells(entry.slate, entry.placed)

  // 审判：冥王石板自身格点之间的连线经过的石板，词缀效果提升。
  // 仅同一行/同一列的部分之间形成审判连线（如 4x4 审判的 3 个部分连成 L 形），
  // 对角线部分之间不判定。对其相邻部分连线（格中心为端点），
  // 候选石板任一格中心落在线段上即视为"连线经过"。
  const judgmentEntries = placedList.filter(
    (e) => isNetherKingSlate(e.slate) && netherKingKeyword(e.slate.netherKingName) === '审判'
  )
  const boostedIds = new Set()
  for (const entry of judgmentEntries) {
    const cells = cellsOf(entry)
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        // 不同行也不同列 = 对角部分，不算审判连线
        if (cells[i][0] !== cells[j][0] && cells[i][1] !== cells[j][1]) continue
        const ax = cells[i][0] + 0.5
        const ay = cells[i][1] + 0.5
        const bx = cells[j][0] + 0.5
        const by = cells[j][1] + 0.5
        for (const cand of placedList) {
          if (isNetherKingSlate(cand.slate)) continue
          const onLine = cellsOf(cand).some(([r, c]) =>
            isOnSegment(r + 0.5, c + 0.5, ax, ay, bx, by)
          )
          if (onLine) boostedIds.add(cand.slate.id)
        }
      }
    }
  }

  // 侵染：与侵染冥王石板直接相邻的石板获得其词缀 20% 投影
  const infectionEntries = placedList.filter(
    (e) => isNetherKingSlate(e.slate) && netherKingKeyword(e.slate.netherKingName) === '侵染'
  )
  const projectedIds = new Map()
  for (const nk of infectionEntries) {
    const nkCells = cellsOf(nk)
    const nkTexts = slateAffixTexts(nk.slate)
    for (const entry of placedList) {
      if (entry.slate.id === nk.slate.id) continue
      if (!sharesEdge(nkCells, cellsOf(entry))) continue
      for (const t of nkTexts) {
        const key = entry.slate.id
        const list = projectedIds.get(key) || []
        list.push({ text: scaleAffixTextByFactor(t, INFECTION_PROJECTION) })
        projectedIds.set(key, list)
      }
    }
  }

  return { boostedIds, projectedIds }
}

// 复制类传奇石板：把相邻石板的天赋复制到自身，无法复制核心天赋。
// - 峨火燎原之刻：复制所有相邻石板（共边）的最后一条天赋。
// - 星星蛾火：按方向词缀复制——每个方向（上/下/左/右）各复制对应方向相邻石板的最后一条天赋。
// - 寰空神隙：固定左/右两个方向，复制对应方向相邻石板上所有"中型/传奇中型/至臻冥王"类型天赋。
// 返回 Map<slateId, Array<{ text, source }>>，source 为来源石板名称（供悬浮提示展示）。
// 只复制石板原有的天赋：跳过"复制…"特殊效果文本（其它复制效果得来的天赋不可再被复制）。
const COPY_DIRECTION_DELTA = { 上: [-1, 0], 下: [1, 0], 左: [0, -1], 右: [0, 1] }

// 寰空神隙可复制的天赋类型：中型/传奇中型（普通石板），至臻冥王（冥王石板）
const LEFT_RIGHT_COPY_TYPES = ['中型天赋', '传奇中型天赋', '至臻冥王天赋点']

function copyDirectionFromText(text) {
  const m = String(text || '').match(/复制([上下左右])侧/)
  return m ? m[1] : ''
}

function copyableAffixesOfTypes(slate, types) {
  const affixes = Array.isArray(slate.affixes) ? slate.affixes : []
  return affixes.filter((a) => {
    const text = typeof a === 'string' ? a : a?.text
    if (!text) return false
    if (String(text).trim().startsWith('复制')) return false
    const nodeType = typeof a === 'string' ? '' : a?.nodeType || ''
    return types.includes(nodeType)
  })
}

function lastCopyableAffix(slate) {
  const affixes = Array.isArray(slate.affixes) ? slate.affixes : []
  return (
    [...affixes]
      .reverse()
      .find((a) => {
        const text = typeof a === 'string' ? a : a?.text
        if (!text) return false
        if (String(text).trim().startsWith('复制')) return false
        const nodeType = typeof a === 'string' ? '' : a?.nodeType || ''
        if (String(nodeType || '').includes('核心')) return false
        return true
      }) || null
  )
}

export function collectDivinityCopiedAffixes(build) {
  const divPage = build?.divinityPage
  if (!divPage || !Array.isArray(divPage.placedSlates) || !Array.isArray(divPage.inventory)) {
    return new Map()
  }

  const slateMap = {}
  for (const s of divPage.inventory) slateMap[s.id] = s

  const placedList = []
  for (const placed of divPage.placedSlates) {
    const slate = slateMap[placed.slateId]
    if (!slate) continue
    placedList.push({ slate, placed })
  }

  const cellsOf = (entry) => placedSlateCells(entry.slate, entry.placed)
  const slateName = (slate) =>
    slate.legendaryName || slate.netherKingName || GOD_NAMES[slate.god] || ''
  const textOf = (a) => (typeof a === 'string' ? a : a.text)

  const copied = new Map()
  for (const entry of placedList) {
    const isAllAround = entry.slate.legendaryName === '蛾火燎原之刻'
    const isDirectional = entry.slate.legendaryName === '星星蛾火'
    const isLeftRight = entry.slate.legendaryName === '寰空神隙'
    if (!isAllAround && !isDirectional && !isLeftRight) continue

    const copiedList = []

    if (isAllAround) {
      // 峨火燎原之刻：复制所有共边相邻石板
      for (const cand of placedList) {
        if (cand.slate.id === entry.slate.id) continue
        if (!sharesEdge(cellsOf(entry), cellsOf(cand))) continue
        const last = lastCopyableAffix(cand.slate)
        if (!last) continue
        copiedList.push({ text: textOf(last), source: slateName(cand.slate) })
      }
    } else {
      // 方向复制：星星蛾火（方向相邻石板最后一条天赋）/ 寰空神隙（左/右相邻石板指定类型天赋）
      const collectTarget = isLeftRight
        ? (slate) => copyableAffixesOfTypes(slate, LEFT_RIGHT_COPY_TYPES)
        : (slate) => {
            const last = lastCopyableAffix(slate)
            return last ? [last] : []
          }
      const findTarget = (dir) => {
        const [dr, dc] = COPY_DIRECTION_DELTA[dir]
        return placedList.find((cand) => {
          if (cand.slate.id === entry.slate.id) return false
          return cellsOf(entry).some(([r, c]) =>
            cellsOf(cand).some(([cr, cc]) => cr === r + dr && cc === c + dc)
          )
        })
      }
      for (const affix of entry.slate.affixes || []) {
        const dir = copyDirectionFromText(textOf(affix))
        if (!dir) continue
        const target = findTarget(dir)
        if (!target) continue
        for (const t of collectTarget(target.slate)) {
          copiedList.push({ text: textOf(t), source: slateName(target.slate) })
        }
      }
    }
    if (copiedList.length) copied.set(entry.slate.id, copiedList)
  }
  return copied
}

export function collectDivinityAffixTexts(build) {
  const divPage = build?.divinityPage
  if (!divPage || !Array.isArray(divPage.placedSlates) || !Array.isArray(divPage.inventory)) {
    return []
  }

  const { boostedIds, projectedIds } = collectDivinitySlateEffects(build)
  const copiedMap = collectDivinityCopiedAffixes(build)

  const affixTexts = []
  for (const [, list] of projectedIds) {
    for (const item of list) affixTexts.push(item.text)
  }

  const slateMap = {}
  for (const s of divPage.inventory) slateMap[s.id] = s

  for (const entry of divPage.placedSlates) {
    const slate = slateMap[entry.slateId]
    if (!slate) continue
    const boosted = boostedIds.has(slate.id)
    for (const t of slateAffixTexts(slate)) {
      affixTexts.push(boosted ? scaleAffixTextByFactor(t, JUDGMENT_BOOST) : t)
    }
    // 复制词缀：峨火燎原之刻额外获得相邻石板的最后一条天赋
    for (const item of copiedMap.get(slate.id) || []) {
      affixTexts.push(boosted ? scaleAffixTextByFactor(item.text, JUDGMENT_BOOST) : item.text)
    }
  }
  return affixTexts
}

export function aggregateDivinityAffixes(build) {
  return aggregateAffixTexts(collectDivinityAffixTexts(build), normalizeStates(build && build.configuration))
}

// 收集 4 个天赋页（槽位）已加点词缀的原始文本：普通节点、核心天赋、逆像（按反像倍率缩放）、
// 棱镜覆盖词缀。返回原始文本数组（供计算引擎 collectEffects 使用）。
export function collectTalentAffixTexts(build) {
  const talents = Array.isArray(build?.talents) ? build.talents : []
  const prismInventory = Array.isArray(build?.prisms?.inventory)
    ? build.prisms.inventory
    : []

  const affixTexts = []

  const pushAffix = (text, count) => {
    if (!text) return
    for (let i = 0; i < count; i += 1) affixTexts.push(text)
  }

  for (const slot of talents) {
    if (!slot || !slot.god || !slot.branch) continue
    const points = slot.points || {}
    const corePoints = slot.corePoints || {}
    const ctx = buildSlotContext(slot, prismInventory)
    const {
      branchData,
      placedPrismBoxes,
      placedReverseEntry,
      reverseTargets,
      reverseClearedIds,
      reverseGhostNodes,
    } = ctx

    for (const node of branchData.normalNodes) {
      if (reverseClearedIds.has(node.id)) continue
      const value = points[node.id] || 0
      if (value <= 0) continue
      const reverseTarget = reverseTargets.get(node.id)
      if (reverseTarget) {
        const mult = getReverseMultiplier(
          placedReverseEntry?.item,
          reverseTarget.source.kind
        )
        pushAffix(scaleAffixTextByFactor(reverseTarget.source.affix, mult), value)
      } else {
        pushAffix(node.affix, value)
      }
      const covering = placedPrismBoxes.filter(
        (p) =>
          p.nodeId !== node.id &&
          nodeInRangeBox(node, p.box) &&
          prismCoveringApplies(p.item, node.kind)
      )
      for (const p of covering) {
        pushAffix(stripPrismAffixPrefix(p.item.affix), value)
      }
    }

    for (const node of reverseGhostNodes) {
      const value = points[node.id] || 0
      if (value <= 0) continue
      const reverseTarget = reverseTargets.get(node.id)
      const mult = getReverseMultiplier(
        placedReverseEntry?.item,
        reverseTarget?.source.kind || node.kind
      )
      pushAffix(
        scaleAffixTextByFactor(reverseTarget?.source.affix || node.affix, mult),
        value
      )
    }

    for (const node of branchData.coreNodes) {
      const value = corePoints[node.name] || 0
      if (value <= 0) continue
      pushAffix(node.desc || node.name, value)
    }
  }

  return affixTexts
}

export function aggregateTalentAffixes(build) {
  return aggregateAffixTexts(collectTalentAffixTexts(build), normalizeStates(build && build.configuration))
}

// 收集已装备（10 槽位）词缀原始文本：基底词缀 + 词条（含侵蚀词条，用已选数值回填）。
// 返回原始文本数组（供计算引擎 collectEffects 使用）。
export function collectEquipmentAffixTexts(build) {
  const equipment = build?.equipment || {}
  const inventory = Array.isArray(build?.equipmentInventory)
    ? build.equipmentInventory
    : []

  const equipMap = {}
  for (const it of inventory) equipMap[it.id] = it

  const affixTexts = []

  const pushAffix = (text, count) => {
    if (!text) return
    for (let i = 0; i < count; i += 1) affixTexts.push(text)
  }

  for (const slot of Object.values(equipment)) {
    if (!slot) continue
    const item = typeof slot === 'object' ? slot : equipMap[slot]
    if (!item) continue

    if (item.baseAffix) pushAffix(item.baseAffix, 1)

    for (const affix of Array.isArray(item.affixes) ? item.affixes : []) {
      if (!affix) continue
      const text = affixDisplayText(affix)
      if (text) pushAffix(text, 1)
    }
  }

  return affixTexts
}

export function aggregateEquipmentAffixes(build) {
  return aggregateAffixTexts(collectEquipmentAffixTexts(build), normalizeStates(build && build.configuration))
}

// 收集契灵（契约链节点 + 宿命天赋）词缀原始文本：
// - 契约链节点：被命运词缀替换的用替换词缀（带所选数值），核心节点用对应等级的升阶词缀（6 级 ×1.33），
//   其余节点用契灵自身的链节点词缀；
// - 宿命槽位：额外添加的命运词缀（小型/中型，带所选数值）。
// 返回原始文本数组（供计算引擎 collectEffects 使用）。
export function collectPactAffixTexts(build) {
  const pactSpirits = Array.isArray(build?.pactSpirits) ? build.pactSpirits : []

  const affixTexts = []

  const pushAffix = (text, count) => {
    if (!text) return
    for (let i = 0; i < count; i += 1) affixTexts.push(text)
  }

  for (const spirit of pactSpirits) {
    const data = pactSpiritData[spirit.name]
    if (!data) continue
    const replacements = spirit.replacements || {}
    const chain = Array.isArray(data.契约链) ? data.契约链 : []

    chain.forEach((slot, i) => {
      const rep = replacements[i]
      const affixName = rep && typeof rep === 'object' ? rep.name : rep
      if (affixName) {
        const dest = destinyData[affixName]
        const value = rep && typeof rep === 'object' ? rep.value : null
        pushAffix(affixDescWithValue(dest && dest.desc, value), 1)
        return
      }
      const isCore = i === chain.length - 1
      if (isCore) {
        const level = Number(spirit.level) || 1
        const ascend = data.升阶词缀 && data.升阶词缀[level - 1]
        const text =
          level === CORE_BOOST_LEVEL && ascend
            ? scaleAffixNumbers(ascend, CORE_BOOST_FACTOR)
            : ascend
        pushAffix(text, 1)
        return
      }
      if (slot.词缀) pushAffix(slot.词缀, 1)
    })

    for (const a of spirit.additions || []) {
      pushAffix(destinyDisplayText(a.name, a.value), 1)
    }
  }

  return affixTexts
}

export function aggregatePactAffixes(build) {
  return aggregateAffixTexts(collectPactAffixTexts(build), normalizeStates(build && build.configuration))
}

// 收集已装备英雄追忆（45/60/75 槽位 + 复苏词缀生成的特殊槽位）词缀原始文本：
// - 基础属性按强化等级缩放（ceil(基准值 × 等级 / 50)，与 HeroPage 展示一致）；
// - 复苏/固有/随机词缀用已选数值回填（affixDisplayText）。
// 返回原始文本数组（供计算引擎 collectEffects 使用）。
export function collectMemoryAffixTexts(build) {
  const heroTraits = build?.heroTraits || {}
  const slots = Array.isArray(heroTraits.memorySlots) ? heroTraits.memorySlots : []
  const inventory = Array.isArray(build?.memoryInventory) ? build.memoryInventory : []

  const itemMap = {}
  for (const it of inventory) itemMap[it.id] = it

  const affixTexts = []

  const pushAffix = (text, count) => {
    if (!text) return
    for (let i = 0; i < count; i += 1) affixTexts.push(text)
  }

  const seen = new Set()
  for (const slot of slots) {
    if (!slot || !slot.memoryId || seen.has(slot.memoryId)) continue
    seen.add(slot.memoryId)
    const item = itemMap[slot.memoryId]
    if (!item) continue

    if (item.baseAttr) {
      const level = Number(item.enhanceLevel) || 0
      const m = String(item.baseAttr).match(/^([+-]?\d+(?:\.\d+)?)(.*)$/)
      const scaled =
        m && level > 0
          ? `${Math.ceil((parseFloat(m[1]) * level) / 50)}${m[2]}`
          : item.baseAttr
      pushAffix(scaled, 1)
    }

    if (item.reviveAffix) pushAffix(affixDisplayText(item.reviveAffix), 1)

    for (const a of Array.isArray(item.inherentAffixes)
      ? item.inherentAffixes
      : [item.inherentAffix]) {
      if (a) pushAffix(affixDisplayText(a), 1)
    }
    for (const a of Array.isArray(item.randomAffixes) ? item.randomAffixes : []) {
      if (a) pushAffix(affixDisplayText(a), 1)
    }
  }

  return affixTexts
}

export function aggregateMemoryAffixes(build) {
  return aggregateAffixTexts(collectMemoryAffixTexts(build), normalizeStates(build && build.configuration))
}

// 辅助技能某等级的等级词缀键文本：把键内「%」前的数值替换为该等级的实际数值。
// 键形如「被辅助技能额外7.4%伤害」，数值形如「37/5」（=7.4）或「6.5,26」（多占位）。
// 解析时保留键自身正负号，仅替换数值（取绝对值），避免「--」双负号。
function supportLevelAffixTexts(skill, level) {
  if (!skill || !Array.isArray(skill.levels)) return []
  const lv = String(level || 1)
  const entry = skill.levels.find((e) => String(e.level) === lv)
  if (!entry) return []

  const texts = []
  for (const key of Object.keys(entry)) {
    if (key === 'level' || key === 'damage' || key === 'Descript') continue
    const raw = String(entry[key] ?? '')
    const vals = raw.split(',').map((p) => {
      const t = p.trim()
      const m = t.match(/^(-?)(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
      if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) / Number(m[3]))
      const n = parseFloat(t)
      return Number.isNaN(n) ? null : n
    })
    let vi = 0
    const text = key.replace(/([+-]?)(\d+(?:\.\d+)?)(%)/g, (m, sign, num, pct) => {
      const v = vals[vi]
      vi += 1
      if (v == null) return m
      return (sign || '') + String(+Math.abs(v).toFixed(2)) + pct
    })
    texts.push(text)
  }
  return texts
}

// 收集技能模块词缀原始文本：
// - 模组化技能栏的模组化词缀：slot.affixes 存词缀名，经 modularAffixPool 还原描述文本；
// - 各辅助技能槽的等级词缀：按辅助技能当前等级代入数值生成词缀文本；
// - 触媒/华贵/崇高类辅助技能无等级词缀，取其静态词缀数组。
// 返回原始文本数组（供计算引擎 collectEffects 使用）。
export function collectSkillAffixTexts(build) {
  const skills = Array.isArray(build?.skills) ? build.skills : []

  const affixTexts = []

  const pushAffix = (text, count) => {
    if (!text) return
    for (let i = 0; i < count; i += 1) affixTexts.push(text)
  }

  for (const slot of skills) {
    if (!slot || !slot.name) continue

    for (const name of Array.isArray(slot.affixes) ? slot.affixes : []) {
      const pool = modularAffixPool[name]
      const text = pool && pool['描述']
      if (text) pushAffix(text, 1)
    }

    for (const sup of Array.isArray(slot.supports) ? slot.supports : []) {
      if (!sup || !sup.name) continue
      const skill = skillByFamilyName(sup.family, sup.name)
      if (!skill) continue
      if (Array.isArray(skill.levels) && skill.levels.length > 0) {
        const levelTexts = supportLevelAffixTexts(skill, sup.level)
        if (levelTexts.length > 0) {
          for (const text of levelTexts) pushAffix(text, 1)
        } else {
          for (const affix of Array.isArray(skill.affixes) ? skill.affixes : []) {
            pushAffix(affix, 1)
          }
        }
      } else {
        for (const affix of Array.isArray(skill.affixes) ? skill.affixes : []) {
          pushAffix(affix, 1)
        }
      }
    }
  }

  return affixTexts
}

export function aggregateSkillAffixes(build) {
  return aggregateAffixTexts(collectSkillAffixTexts(build), normalizeStates(build && build.configuration))
}

// 计算当前 BD 下三种祝福的最大层数（满层）：
// 基础 4 层 + 各模块（神格石板/天赋/装备/追忆/契灵/技能）词缀对层数上限的加/减。
// 神格石板词缀带「神格生效上限：1」时，同类词缀只计一次。
// 祝福层数上限词缀的匹配/取值逻辑集中在 affixConsumers.js（AFFIX_CONSUMERS.blessing）。
export function computeBlessingCaps(build) {
  const BASE = 4
  const caps = { agile: BASE, tough: BASE, focus: BASE }

  const divTexts = Array.isArray(collectDivinityAffixTexts(build))
    ? collectDivinityAffixTexts(build)
    : []
  const otherTexts = [
    ...collectTalentAffixTexts(build),
    ...collectEquipmentAffixTexts(build),
    ...collectMemoryAffixTexts(build),
    ...collectPactAffixTexts(build),
    ...collectSkillAffixTexts(build),
  ]

  const apply = (text) => {
    for (const { name, value } of parseBlessingCapMatches(text)) {
      for (const key of BLESSING_KEY_BY_NAME[name] || []) caps[key] += value
    }
  }

  // 神格石板：同类「神格生效上限：1」词缀只生效一次
  const seenDiv = new Set()
  for (const text of divTexts) {
    const hasCapNote = /神格生效上限/.test(String(text || ''))
    const key = String(text || '').replace(/（神格生效上限：1）/, '')
    if (hasCapNote) {
      if (seenDiv.has(key)) continue
      seenDiv.add(key)
    }
    apply(text)
  }

  for (const text of otherTexts) apply(text)

  return caps
}
