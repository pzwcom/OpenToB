const RE_MOON = ';;人造月亮：'

const VALUE_TOKEN_RE = /^[+-]?\d+(?:\.\d+)?%?$/

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 提取人造月亮段：支持 `;;人造月亮：;` 与 `;;人造月亮：`（无分号）两种标记
function splitMoon(desc) {
  const idx = desc.indexOf(RE_MOON)
  if (idx === -1) return { main: desc, moon: '' }
  let after = desc.slice(idx + RE_MOON.length)
  if (after[0] === ';') after = after.slice(1)
  return { main: desc.slice(0, idx), moon: after }
}

function commonPrefix(strings) {
  let p = strings[0] || ''
  for (const s of strings) {
    let i = 0
    while (i < p.length && i < s.length && p[i] === s[i]) i++
    p = p.slice(0, i)
    if (p === '') break
  }
  return p
}

function commonSuffix(strings) {
  let q = strings[0] || ''
  for (const s of strings) {
    let i = 0
    while (i < q.length && i < s.length && q[q.length - 1 - i] === s[s.length - 1 - i]) i++
    q = q.slice(q.length - i)
    if (q === '') break
  }
  return q
}

// 把 `等级N` 各段折叠为带 (v1/v2/...) 斜杠分组的单条模板（数值处保留分组），无法折叠返回 null
function collapseSegments(segments) {
  const n = segments.length
  if (n === 0) return ''
  if (n === 1) return segments[0]
  __collapseBudget = 0
  const p = commonPrefix(segments)
  const rest = segments.map((s) => s.slice(p.length))
  const q = commonSuffix(rest)
  const mids = rest.map((s) => (q ? s.slice(0, s.length - q.length) : s))
  if (mids.every((m) => m === mids[0])) return p + mids[0] + q
  const inner = collapseRegion(mids)
  if (inner !== null) return p + inner + q
  // 启发式折叠失败时，用 LCS 差异对齐做通用折叠；段落长度悬殊（某级被大段截断）时差异对齐不可靠，回退逐段展示
  const lens = segments.map((s) => s.length)
  const minLen = Math.min(...lens)
  const maxLen = Math.max(...lens)
  if (minLen * 2 < maxLen) return null
  __collapseBudget = 0
  return diffCollapse(segments)
}

// 折叠工作量预算：源数据异常（如末段被截断/重排）时避免递归爆炸，超限返回 null 回退逐段展示
let __collapseBudget = 0
const COLLAPSE_BUDGET = 3000

function collapseRegion(vals) {
  if (++__collapseBudget > COLLAPSE_BUDGET) return null
  const nonEmpty = vals.filter((v) => v !== '')
  // 全为单值 token（含空位 → 0）：直接折成一个括号组
  if (vals.every((v) => v === '' || VALUE_TOKEN_RE.test(v))) {
    return '(' + vals.map((v) => (v === '' ? '0' : v)).join('/') + ')'
  }
  // 共享「前缀 + 数值 + 后缀」包裹结构（数值可变）：把数值折成括号组
  const wrapped = sharedWrapperCollapse(vals, false)
  if (wrapped !== null) return wrapped
  // 容错版：后缀允许被部分级别截断（源数据末段缺尾）
  const wrappedTolerant = sharedWrapperCollapse(vals, true)
  if (wrappedTolerant !== null) return wrappedTolerant
  // 递归剥公共前后缀
  const pp = commonPrefix(vals)
  if (pp.length > 0) {
    const inner = collapseRegion(vals.map((v) => v.slice(pp.length)))
    if (inner !== null) return pp + inner
  }
  // 空位容错：公共前缀只取非空值（空位级视为缺失 → 0）
  const np = commonPrefix(nonEmpty)
  if (np.length > 0 && nonEmpty.length < vals.length) {
    const inner = collapseRegion(vals.map((v) => (v === '' ? '' : v.slice(np.length))))
    if (inner !== null) return np + inner
  }
  const qq = commonSuffix(vals)
  if (qq.length > 0) {
    const inner = collapseRegion(vals.map((v) => v.slice(0, v.length - qq.length)))
    if (inner !== null) return inner + qq
  }
  const nq = commonSuffix(nonEmpty)
  if (nq.length > 0 && nonEmpty.length < vals.length) {
    const inner = collapseRegion(vals.map((v) => (v === '' ? '' : v.slice(0, v.length - nq.length))))
    if (inner !== null) return inner + nq
  }
  // 多数派后缀：多数级别共享同一段尾部（少数截断/缺失的级别是其前缀或空），剥掉后继续折叠
  const ref = nonEmpty.reduce((a, b) => (b.length > a.length ? b : a), '')
  if (ref.length > 0) {
    for (let L = ref.length - 1; L >= 1; L--) {
      const tail = ref.slice(-L)
      const enders = vals.filter((v) => v.endsWith(tail))
      if (enders.length < Math.ceil(vals.length / 2)) continue
      const others = vals.filter((v) => !v.endsWith(tail))
      if (!others.every((v) => v === '' || ref.startsWith(v))) continue
      const stripped = vals.map((v) => (v.endsWith(tail) ? v.slice(0, v.length - L) : v))
      const inner = collapseRegion(stripped)
      if (inner !== null) return inner + tail
    }
  }
  return null
}

// 共享包裹结构折叠；tolerant 时后缀允许部分级别截断（取多数派的完整后缀）
function sharedWrapperCollapse(vals, tolerant) {
  const parsed = vals.map((v) => {
    if (v === '') return { empty: true }
    const m = v.match(/^([^0-9]*?)([+-]?\d+(?:\.\d+)?)(.*)$/)
    if (!m) return null
    return { before: m[1], num: m[2], after: m[3] }
  })
  if (!parsed.every((x) => x !== null)) return null
  const refs = parsed.filter((x) => !x.empty)
  if (refs.length === 0) return null
  if (!refs.every((x) => x.before === refs[0].before)) return null
  let useAfter = refs[0].after
  if (tolerant) {
    const longest = refs.reduce((a, b) => (b.after.length > a.after.length ? b : a))
    const majority = refs.filter((x) => x.after === longest.after).length >= 2
    const compatible = refs.every(
      (x) => longest.after.startsWith(x.after) || x.after.startsWith(longest.after)
    )
    if (!majority || !compatible) return null
    useAfter = longest.after
  } else if (!refs.every((x) => x.after === refs[0].after)) {
    return null
  }
  return (
    refs[0].before +
    '(' +
    parsed.map((x) => (x.empty ? '0' : x.num)).join('/') +
    ')' +
    useAfter
  )
}

// ---- 通用折叠：LCS 差异对齐 + 逐级折叠 ----

function lcsDiff(a, b) {
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i]
    const next = dp[i + 1]
    for (let j = m - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1])
    }
  }
  const ops = []
  let i = 0
  let j = 0
  let eq = ''
  let del = ''
  let ins = ''
  const flush = () => {
    if (eq) ops.push({ t: 'eq', s: eq })
    if (del) ops.push({ t: 'del', s: del })
    if (ins) ops.push({ t: 'ins', s: ins })
    eq = del = ins = ''
  }
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flush()
      eq += a[i]
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      flush()
      del += a[i]
      i++
    } else {
      flush()
      ins += b[j]
      j++
    }
  }
  flush()
  while (i < n) {
    del += a[i]
    i++
  }
  while (j < m) {
    ins += b[j]
    j++
  }
  flush()
  return ops
}

function mergeAdjacent(parts) {
  const out = []
  for (const p of parts) {
    const last = out[out.length - 1]
    if (p.lit !== undefined) {
      if (last && last.lit !== undefined) last.lit += p.lit
      else out.push({ lit: p.lit })
    } else if (last && last.var) {
      p.var.forEach((v, idx) => {
        last.var[idx] = (last.var[idx] || '') + v
      })
    } else {
      out.push({ var: [...p.var] })
    }
  }
  return out
}

// 两段文本的差异 → 模板（lit 公共文字 / var 分级差异值）
function pairTemplate(a, b) {
  const ops = lcsDiff(a, b)
  const parts = []
  for (const op of ops) {
    if (op.t === 'eq') parts.push({ lit: op.s })
    else if (op.t === 'del') parts.push({ var: [op.s, ''] })
    else parts.push({ var: ['', op.s] })
  }
  return mergeAdjacent(parts)
}

// 把下一级文本并入模板：逐 lit 对齐，级间差异记入对应 var；某级截断缺失时余下部分记入前一个 var
function foldTemplate(parts, seg, levelIndex) {
  const newParts = []
  let cursor = 0
  let pendingVar = null
  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx]
    if (part.lit !== undefined) {
      const at = seg.indexOf(part.lit, cursor)
      if (at === -1) {
        const rest = seg.slice(cursor)
        if (rest) {
          if (pendingVar) pendingVar.var.push(rest)
          else newParts.push({ var: [rest] })
        } else if (pendingVar) {
          pendingVar.var.push('')
        }
        for (let k = idx + 1; k < parts.length; k++) {
          const later = parts[k]
          if (later.lit !== undefined) newParts.push({ lit: later.lit })
          else newParts.push({ var: [...later.var, ''] })
        }
        for (const p of newParts) if (p.var) while (p.var.length < levelIndex + 1) p.var.push('')
        return newParts
      }
      const gap = seg.slice(cursor, at)
      if (gap) {
        if (pendingVar) {
          pendingVar.var.push(gap)
          pendingVar = null
        } else {
          newParts.push({ var: [gap] })
        }
      }
      newParts.push({ lit: part.lit })
      cursor = at + part.lit.length
    } else {
      const vp = { var: [...part.var] }
      newParts.push(vp)
      pendingVar = vp
    }
  }
  const tail = seg.slice(cursor)
  if (tail) {
    if (pendingVar) pendingVar.var.push(tail)
    else newParts.push({ var: [tail] })
  } else if (pendingVar) {
    pendingVar.var.push('')
  }
  for (const p of newParts) if (p.var) while (p.var.length < levelIndex + 1) p.var.push('')
  return newParts
}

// 通用折叠入口：对每段两两做差异对齐，差异槽位再交给启发式 collapseRegion 压缩成 () 组
function diffCollapse(segments) {
  const n = segments.length
  if (n === 0) return ''
  if (n === 1) return segments[0]
  let parts = pairTemplate(segments[0], segments[1])
  for (let k = 2; k < n; k++) {
    const next = foldTemplate(parts, segments[k], k)
    if (next === null) return null
    parts = next
  }
  let out = ''
  for (const part of parts) {
    if (part.lit !== undefined) {
      out += part.lit
    } else {
      const collapsed = collapseRegion(part.var)
      if (collapsed === null) return null
      out += collapsed
    }
  }
  return out
}

export function parseTraitDesc(desc, name) {
  if (!desc) return { segments: [], moon: '', isLevelSeg: false }
  const { main: text0, moon } = splitMoon(desc)
  const stripRe = new RegExp('^' + escapeRegex(name) + '需求等级\\d+')
  const text = text0.replace(stripRe, '')
  if (/等级(?=\d)/.test(text)) {
    const parts = text.split(/等级\d/)
    return { segments: parts.slice(1), moon, isLevelSeg: true }
  }
  const segments = []
  for (let lvl = 1; lvl <= 5; lvl++) {
    segments.push(
      text.replace(/\(([^()]*)\)/g, (_, g) => {
        const p = g.split('/')
        if (p.length < 2) return g
        return p[Math.min(lvl - 1, p.length - 1)]
      })
    )
  }
  return { segments, moon, isLevelSeg: false }
}

export function getTraitEffectAtLevel(desc, name, level) {
  const r = parseTraitDesc(desc, name)
  if (!level || level < 1 || r.segments.length === 0) return ''
  return r.segments[Math.min(level - 1, r.segments.length - 1)] || ''
}

export function getTraitTooltipText(desc, name) {
  if (!desc) return { text: '', moon: '' }
  const { main: text0, moon } = splitMoon(desc)
  const stripRe = new RegExp('^' + escapeRegex(name) + '需求等级\\d+')
  const text = text0.replace(stripRe, '')
  if (/等级(?=\d)/.test(text)) {
    const parts = text.split(/等级\d/)
    return { text: parts[1] || '', moon }
  }
  return { text, moon }
}

// 未装备追忆时的全档展示：不锁定为单一等级，展示 lv1~lv5 全档数值。
// - 斜杠分组（`(a/b/c/d/e)`）：保留原始括号分组，一行内列出 lv1~lv5 全档。
// - `等级N` 分段：优先折叠为单条模板（数值处用 (v1/v2/...) 斜杠分组），折叠失败才逐段展示。
export function getTraitAllLevelsTooltip(desc, name) {
  if (!desc) return { lines: [], moon: '', isLevelSeg: false }
  const { main: text0, moon } = splitMoon(desc)
  const stripRe = new RegExp('^' + escapeRegex(name) + '需求等级\\d+')
  const text = text0.replace(stripRe, '')
  if (/等级(?=\d)/.test(text)) {
    const parts = text.split(/等级\d/)
    const segments = parts.slice(1)
    const collapsed = collapseSegments(segments)
    if (collapsed !== null) {
      return { lines: [collapsed], moon, isLevelSeg: false }
    }
    return { lines: segments, moon, isLevelSeg: true }
  }
  return { lines: [text], moon, isLevelSeg: false }
}
