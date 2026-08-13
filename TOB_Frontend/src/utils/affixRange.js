const RANGE_RE = /(\d+(?:\.\d+)?)\s*[~〜～\-－—–]\s*(\d+(?:\.\d+)?)/g

const midValue = (r) => Math.round((r.min + r.max) / 2)

export function parseAffixRanges(text) {
  const ranges = []
  if (!text) return ranges
  const re = new RegExp(RANGE_RE.source, 'g')
  let m
  while ((m = re.exec(text)) !== null) {
    ranges.push({
      min: parseFloat(m[1]),
      max: parseFloat(m[2]),
      raw: m[0],
      index: m.index,
    })
  }
  return ranges
}

export function resolveAffixText(text, values) {
  if (!text) return text
  const ranges = parseAffixRanges(text)
  if (ranges.length === 0) return text
  let out = ''
  let lastIndex = 0
  ranges.forEach((r, i) => {
    const prev = text[r.index - 1]
    const next = text[r.index + r.raw.length]
    const hasParens = (prev === '(' || prev === '（') && (next === ')' || next === '）')
    out += text.slice(lastIndex, hasParens ? r.index - 1 : r.index)
    out += values && values[i] !== undefined ? values[i] : midValue(r)
    lastIndex = r.index + r.raw.length + (hasParens ? 1 : 0)
  })
  out += text.slice(lastIndex)
  return out
}

export function affixTextOf(a) {
  if (!a) return ''
  return typeof a === 'object' ? a.text || '' : String(a)
}

export function affixValuesOf(a) {
  if (a && typeof a === 'object' && Array.isArray(a.value)) return a.value
  return []
}

export function affixDisplayText(a) {
  return resolveAffixText(affixTextOf(a), affixValuesOf(a))
}

export function defaultAffixValues(text) {
  return parseAffixRanges(text).map((r) => midValue(r))
}

export function makeAffix(text, values) {
  if (text && typeof text === 'object') {
    const out = { text: text.text || '', value: Array.isArray(text.value) ? text.value : [] }
    if (text.corrupted) out.corrupted = true
    // 保留渴瘾等场景的词缀来源元数据（传奇移植/打造，Tier 着色用）
    for (const k of Object.keys(text)) {
      if (k.startsWith('graft')) out[k] = text[k]
    }
    return out
  }
  const v = Array.isArray(values) && values.length ? values : defaultAffixValues(text)
  return { text, value: v }
}

export function normalizeAffix(a) {
  if (!a) return null
  if (typeof a === 'string') return a ? { text: a, value: [] } : null
  if (typeof a === 'object' && typeof a.text === 'string' && a.text) {
    return { text: a.text, value: Array.isArray(a.value) ? a.value : [] }
  }
  return null
}
