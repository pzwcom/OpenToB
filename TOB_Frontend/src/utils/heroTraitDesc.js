const RE_MOON = ';;人造月亮：;'

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseTraitDesc(desc, name) {
  if (!desc) return { segments: [], moon: '', isLevelSeg: false }
  let moon = ''
  let main = desc
  const moonIdx = main.indexOf(RE_MOON)
  if (moonIdx !== -1) {
    moon = main.slice(moonIdx + RE_MOON.length)
    main = main.slice(0, moonIdx)
  }
  const stripRe = new RegExp('^' + escapeRegex(name) + '需求等级\\d+')
  const text = main.replace(stripRe, '')
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
  let moon = ''
  let main = desc
  const moonIdx = main.indexOf(RE_MOON)
  if (moonIdx !== -1) {
    moon = main.slice(moonIdx + RE_MOON.length)
    main = main.slice(0, moonIdx)
  }
  const stripRe = new RegExp('^' + escapeRegex(name) + '需求等级\\d+')
  const text = main.replace(stripRe, '')
  if (/等级(?=\d)/.test(text)) {
    const parts = text.split(/等级\d/)
    return { text: parts[1] || '', moon }
  }
  return { text, moon }
}

// 未装备追忆时的全档展示：不锁定为单一等级，展示 lv1~lv5 全档数值。
// - 斜杠分组（`(a/b/c/d/e)`）：保留原始括号分组，一行内列出 lv1~lv5 全档。
// - `等级N` 分段：逐段全展示（每段带等级号）。
export function getTraitAllLevelsTooltip(desc, name) {
  if (!desc) return { lines: [], moon: '', isLevelSeg: false }
  let moon = ''
  let main = desc
  const moonIdx = main.indexOf(RE_MOON)
  if (moonIdx !== -1) {
    moon = main.slice(moonIdx + RE_MOON.length)
    main = main.slice(0, moonIdx)
  }
  const stripRe = new RegExp('^' + escapeRegex(name) + '需求等级\\d+')
  const text = main.replace(stripRe, '')
  if (/等级(?=\d)/.test(text)) {
    const parts = text.split(/等级\d/)
    return { lines: parts.slice(1), moon, isLevelSeg: true }
  }
  return { lines: [text], moon, isLevelSeg: false }
}
