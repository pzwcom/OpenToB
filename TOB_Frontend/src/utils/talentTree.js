import talentImageData from '../assets/json/天赋/天赋所对应的图片位置.json'
import talentConnectionData from '../assets/json/天赋/天赋所对应的连接位置.json'

export const IMG_SIZE = 64
export const SVG_PAD = 8
export const SVG_WIDTH = 832 + IMG_SIZE + SVG_PAD * 2
export const SVG_HEIGHT = 432 + IMG_SIZE + SVG_PAD * 2

export const MIRROR_X = 896
export const MIRROR_Y = 480
export const ROW_STEP = 96
export const COL_STEP = 128
export const REVERSE_COLUMNS = [64, 192, 704, 832]

export const KIND_LEVEL = {
  小型天赋: 3,
  中型天赋: 3,
  传奇中型天赋: 1,
}

export const KIND_CLASS = {
  小型天赋: 'talent-common',
  中型天赋: 'talent-medium',
  传奇中型天赋: 'talent-legendary',
}

export function parseNodePath(path) {
  const fn = path.split('/').pop().replace(/\.jpg$/, '')
  if (fn.startsWith('核心天赋_')) {
    const rest = fn.slice('核心天赋_'.length)
    const idx = rest.indexOf('_')
    const name = idx === -1 ? rest : rest.slice(0, idx)
    const desc = idx === -1 ? '' : rest.slice(idx + 1)
    return {
      isCore: true,
      id: `核心天赋_${name}`,
      name,
      desc,
      limit: 1,
      path,
    }
  }
  const parts = fn.split('_')
  return {
    isCore: false,
    id: `${parts[0]}_${parts[1]}`,
    x: parseInt(parts[0], 10),
    y: parseInt(parts[1], 10),
    w: parseInt(parts[2], 10) || IMG_SIZE,
    h: parseInt(parts[3], 10) || IMG_SIZE,
    limit: parseInt(parts[4], 10) || KIND_LEVEL[parts[5]] || 1,
    kind: parts[5],
    affix: parts.slice(6).join('_'),
    path,
  }
}

export function buildBranchData(god, branch) {
  const paths = talentImageData?.[god]?.[branch] || []
  const coreNodes = []
  const normalNodes = []
  const edgeToNode = new Map()

  const nodeKey = (x, y) => `${x}_${y}`

  for (const p of paths) {
    const node = parseNodePath(p)
    if (node.isCore) {
      coreNodes.push(node)
      continue
    }
    normalNodes.push(node)
    const edges = [
      [node.x, node.y + 34],
      [node.x + node.w, node.y + 34],
      [node.x + node.w / 2, node.y],
      [node.x + node.w / 2, node.y + node.h],
    ]
    for (const [ex, ey] of edges) {
      edgeToNode.set(`${ex}_${ey}`, nodeKey(node.x, node.y))
    }
  }

  const lines = (talentConnectionData?.[god]?.[branch] || [])
    .map((ln) => {
      const from = edgeToNode.get(`${ln[0]}_${ln[1]}`)
      const to = edgeToNode.get(`${ln[2]}_${ln[3]}`)
      if (!from || !to || from === to) return null
      return {
        key: `${from}-${to}`,
        from,
        to,
        x1: parseFloat(ln[0]),
        y1: parseFloat(ln[1]),
        x2: parseFloat(ln[2]),
        y2: parseFloat(ln[3]),
      }
    })
    .filter(Boolean)

  const hasTwoGroups = coreNodes.length > 4
  coreNodes.forEach((node, i) => {
    node.group = hasTwoGroups ? (i < 3 ? 0 : 1) : 0
  })

  const nodeLimitByKey = new Map()
  for (const n of normalNodes) {
    nodeLimitByKey.set(nodeKey(n.x, n.y), n.limit)
  }

  const prereq = new Map()
  for (const ln of lines) {
    const from = edgeToNode.get(`${ln.x1}_${ln.y1}`)
    const to = edgeToNode.get(`${ln.x2}_${ln.y2}`)
    if (!from || !to || from === to) continue
    const left = ln.x1 <= ln.x2 ? from : to
    const right = left === from ? to : from
    if (!prereq.has(right)) prereq.set(right, new Set())
    prereq.get(right).add(left)
  }

  return { coreNodes, normalNodes, lines, prereq, nodeLimitByKey }
}

export function parsePrismRange(rangeText) {
  const m = rangeText?.match(/(\d+)\s*[×x]\s*(\d+)/)
  if (!m) return null
  return { cols: parseInt(m[1], 10), rows: parseInt(m[2], 10) }
}

export function buildRangeBox(nodeX, nodeY, rangeText) {
  const r = parsePrismRange(rangeText)
  if (!r) return null
  const cx = nodeX + IMG_SIZE / 2
  const cy = nodeY + IMG_SIZE / 2
  const halfColsL = Math.floor((r.cols - 1) / 2)
  const halfColsR = Math.ceil((r.cols - 1) / 2)
  const halfRowsT = Math.floor((r.rows - 1) / 2)
  const halfRowsB = Math.ceil((r.rows - 1) / 2)
  return {
    x1: cx - halfColsL * COL_STEP - IMG_SIZE / 2,
    x2: cx + halfColsR * COL_STEP + IMG_SIZE / 2,
    y1: cy - halfRowsT * ROW_STEP - IMG_SIZE / 2,
    y2: cy + halfRowsB * ROW_STEP + IMG_SIZE / 2,
    width: (halfColsL + halfColsR) * COL_STEP + IMG_SIZE,
    height: (halfRowsT + halfRowsB) * ROW_STEP + IMG_SIZE,
  }
}

export function nodeInRangeBox(node, box) {
  if (!box) return false
  const cx = node.x + IMG_SIZE / 2
  const cy = node.y + IMG_SIZE / 2
  return cx >= box.x1 && cx <= box.x2 && cy >= box.y1 && cy <= box.y2
}

const AFFIX_NUM_RE = /[+-]\d+(?:\.\d+)?%?|(?<!\d)\d+(?:\.\d+)?%/g

export function formatAffixNum(v, src) {
  const s = String(src || '')
  const decimals = s.includes('.') ? s.split('.')[1].length : 0
  return Number(v.toFixed(decimals)).toString()
}

export function scaleAffixText(text, n) {
  if (!text || n <= 1) return text
  return text.replace(AFFIX_NUM_RE, (m) => {
    const sign = m[0] === '+' || m[0] === '-' ? m[0] : ''
    const percent = m.endsWith('%') ? '%' : ''
    const v = Math.abs(parseFloat(m)) * n
    return `${sign}${formatAffixNum(v, m)}${percent}`
  })
}

export function scaleAffixTextByFactor(text, factor) {
  if (!text || factor === 1) return text
  return text.replace(AFFIX_NUM_RE, (m) => {
    const sign = m[0] === '+' || m[0] === '-' ? m[0] : ''
    const percent = m.endsWith('%') ? '%' : ''
    const v = Math.abs(parseFloat(m)) * factor
    return `${sign}${formatAffixNum(v, m)}${percent}`
  })
}

export function getReverseMultiplier(item, kind) {
  if (!item) return 1
  const pct =
    kind === '小型天赋'
      ? item.small
      : kind === '中型天赋'
        ? item.medium
        : kind === '传奇中型天赋'
          ? item.legendary
          : 0
  return 1 + (pct || 0) / 100
}

export function stripPrismAffixPrefix(text) {
  if (!text) return text
  return text.replace(/^范围内的所有(?:小型|中型|传奇中型)?天赋还获得：/, '')
}

export function getPrismAffixKind(text) {
  if (!text) return null
  const m = text.match(/^范围内的所有(小型|中型|传奇中型)天赋/)
  if (!m) return null
  return `${m[1]}天赋`
}

export function parsePrismAffix2Effects(text) {
  if (!text) return []
  const result = []
  for (const seg of text.split(';')) {
    const extra = seg.match(
      /^范围内的所有(小型|中型|传奇中型)天赋可额外加点(\d+)次$/
    )
    if (extra) {
      result.push({
        text: seg,
        kind: `${extra[1]}天赋`,
        extra: parseInt(extra[2], 10),
      })
      continue
    }
    const ignore = seg.match(
      /^范围内的所有(小型|中型|传奇中型)天赋可无视前置点数要求$/
    )
    if (ignore) {
      result.push({ text: seg, kind: `${ignore[1]}天赋`, ignorePrereq: true })
    }
  }
  return result
}

export function prismCoveringApplies(item, kind) {
  const k1 = getPrismAffixKind(item.affix)
  if (!k1 || k1 === kind) return true
  const k2 = getPrismAffixKind(item.affix2)
  if (k2 === kind) return true
  return parsePrismAffix2Effects(item.affix2).some((e) => e.kind === kind)
}

// 构建单个天赋页（槽位）的完整上下文：分支数据、已放置棱镜/逆像、镜像目标与幽灵节点。
// 供 TalentsPage 渲染与天赋词缀归总共用。
export function buildSlotContext(
  { god, branch, prisms = {} },
  prismInventory
) {
  const branchData =
    !god || !branch
      ? { coreNodes: [], normalNodes: [], lines: [] }
      : buildBranchData(god, branch)

  const nodeById = new Map(branchData.normalNodes.map((n) => [n.id, n]))
  const prismPlaced = prisms.placed || {}

  const placedPrismBoxes = Object.entries(prismPlaced)
    .map(([nodeId, itemId]) => {
      const item = prismInventory.find((it) => it.id === itemId)
      if (!item || item.type !== 'prism') return null
      const [nx, ny] = nodeId.split('_').map(Number)
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null
      return {
        item,
        nodeId,
        box: buildRangeBox(nx, ny, item.range),
      }
    })
    .filter(Boolean)

  const placedReverseEntry = Object.entries(prismPlaced)
    .map(([nid, iid]) => ({
      nid,
      item: prismInventory.find((it) => it.id === iid),
    }))
    .find((x) => x.item?.type === 'reverse')

  const reverseTargets = new Map()
  const reverseRegionNodeIds = new Set()
  const reverseClearedIds = new Set()
  const reverseGhostNodes = []
  let reverseMirrorId = null
  let reverseRangeBox = null
  let reverseMirrorBox = null
  if (placedReverseEntry) {
    const centerNode = nodeById.get(placedReverseEntry.nid)
    if (centerNode) {
      const mx = MIRROR_X - centerNode.x
      const my = MIRROR_Y - centerNode.y
      reverseMirrorId = `${mx}_${my}`
      reverseRangeBox = buildRangeBox(centerNode.x, centerNode.y, '3×3')
      reverseMirrorBox = buildRangeBox(mx, my, '3×3')
      const minX = centerNode.x - COL_STEP
      const maxX = centerNode.x + COL_STEP
      const minY = centerNode.y - ROW_STEP
      const maxY = centerNode.y + ROW_STEP
      for (const src of branchData.normalNodes) {
        if (src.x < minX || src.x > maxX || src.y < minY || src.y > maxY) continue
        const tid = `${MIRROR_X - src.x}_${MIRROR_Y - src.y}`
        reverseTargets.set(tid, { source: src })
      }
      for (const n of branchData.normalNodes) {
        if (!nodeInRangeBox(n, reverseMirrorBox)) continue
        reverseRegionNodeIds.add(n.id)
        if (reverseTargets.has(n.id)) continue
        reverseClearedIds.add(n.id)
      }
    }
  }
  for (const [tid, rt] of reverseTargets) {
    if (nodeById.has(tid)) continue
    const [gx, gy] = tid.split('_').map(Number)
    reverseGhostNodes.push({
      id: tid,
      x: gx,
      y: gy,
      w: IMG_SIZE,
      h: IMG_SIZE,
      isCore: false,
      limit: rt.source.limit,
      kind: rt.source.kind,
      affix: rt.source.affix,
      path: rt.source.path,
    })
  }

  return {
    branchData,
    nodeById,
    prismPlaced,
    placedPrismBoxes,
    placedReverseEntry,
    reverseTargets,
    reverseRegionNodeIds,
    reverseClearedIds,
    reverseGhostNodes,
    reverseMirrorId,
    reverseRangeBox,
    reverseMirrorBox,
  }
}
