export const combatStates = {
  isInCombat: { category: 'environment', kind: 'toggle', default: true, label: 'state.isInCombat' },
  isFullLife: { category: 'selfBuff', kind: 'toggle', default: true, label: 'state.isFullLife' },
  isLowLife: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.isLowLife' },
  isStationary: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.isStationary' },
  isMoving: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.isMoving' },
  hasCharges: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.hasCharges' },
  enemyIsIgnited: { category: 'enemyDebuff', kind: 'toggle', default: false, label: 'state.enemyIsIgnited' },
  enemyIsShocked: { category: 'enemyDebuff', kind: 'toggle', default: false, label: 'state.enemyIsShocked' },
  enemyIsChilled: { category: 'enemyDebuff', kind: 'toggle', default: false, label: 'state.enemyIsChilled' },
  rageBurst: {
    category: 'selfBuff',
    kind: 'toggle',
    default: false,
    label: 'state.rageBurst',
    requires: ['heroTrait:怒火'],
  },
  battleIntent: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 100, label: 'state.battleIntent' },
  enemyTrauma: { category: 'enemyDebuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.enemyTrauma' },
  enemyWither: { category: 'enemyDebuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.enemyWither' },
  enemyWorsen: { category: 'enemyDebuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.enemyWorsen' },
  enemyPoison: { category: 'enemyDebuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.enemyPoison' },
  blessAgile: { category: 'selfBuff', kind: 'number', default: 1, min: 0, max: 99, switchMax: true, label: 'state.blessAgile' },
  blessTough: { category: 'selfBuff', kind: 'number', default: 1, min: 0, max: 99, switchMax: true, label: 'state.blessTough' },
  blessFocus: { category: 'selfBuff', kind: 'number', default: 1, min: 0, max: 99, switchMax: true, label: 'state.blessFocus' },
  recentlyKilled: { category: 'environment', kind: 'toggle', default: false, label: 'state.recentlyKilled' },
  enemyArmorReduced: { category: 'enemyDebuff', kind: 'toggle', default: false, label: 'state.enemyArmorReduced' },
  enemyCount: { category: 'environment', kind: 'number', default: 1, min: 1, max: 10, label: 'state.enemyCount' },
  enemyIsCursed: { category: 'enemyDebuff', kind: 'toggle', default: false, label: 'state.enemyIsCursed' },
  enemyIsFar: { category: 'environment', kind: 'toggle', default: false, label: 'state.enemyIsFar' },
  isBlocking: { category: 'selfBuff', kind: 'toggle', default: false, label: 'state.isBlocking' },
  minionCount: { category: 'environment', kind: 'number', default: 0, min: 0, max: 20, label: 'state.minionCount' },
  victorySong: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.victorySong' },
  warIntent: { category: 'selfBuff', kind: 'number', default: 0, min: 0, max: 10, label: 'state.warIntent' },
  growthValue: { category: 'environment', kind: 'number', default: 0, min: 0, max: 5000, label: 'state.growthValue' },
}

export function normalizeStates(raw) {
  const out = {}
  for (const [key, meta] of Object.entries(combatStates)) {
    const given = raw && raw[key] !== undefined ? raw[key] : meta.default
    if (meta.kind === 'number') {
      const n = Number(given)
      out[key] = Number.isFinite(n)
        ? Math.max(meta.min ?? -Infinity, Math.min(meta.max ?? Infinity, n))
        : meta.default
    } else {
      out[key] = Boolean(given)
    }
  }
  return out
}

export function evaluateCondition(condition, states) {
  if (condition == null) return true
  if (typeof condition === 'function') return Boolean(condition({ states }))
  if (typeof condition !== 'object') return true
  const value = states[condition.state]
  if (condition.value !== undefined) return value === condition.value
  if (condition.min !== undefined || condition.max !== undefined) {
    const lo = condition.min === undefined || value >= condition.min
    const hi = condition.max === undefined || value <= condition.max
    return lo && hi
  }
  return Boolean(value)
}

export function blessingStacks(states) {
  return (states?.blessAgile || 0) + (states?.blessTough || 0) + (states?.blessFocus || 0)
}

// 祝福开关：存 0（无）/ 正数（有），按当前 BD 的满层数值动态换算实际层数。
// caps 由 computeBlessingCaps(build) 计算（基础 4 + 各模块上限词缀）。
export function applyBlessingCaps(raw, caps) {
  const states = normalizeStates(raw)
  return {
    ...states,
    blessAgile: states.blessAgile > 0 ? caps.agile : 0,
    blessTough: states.blessTough > 0 ? caps.tough : 0,
    blessFocus: states.blessFocus > 0 ? caps.focus : 0,
  }
}
