// 条件词缀门控的单一来源（无依赖叶子模块，避免循环引用）。
// 计算端（computeShield/computeVitalsMax/各 aggregate*Stats）与统计端谓词（consumes*Affix）
// 共用 splitLeadingCondition / forEachGatedClause，保证「统计已计入 ⇔ 计算真实计入」一致。

// 魔灵面板条件规则：命中映射规则返回开关结果 + 条件之后剩余文本。
const ailmentActive = (s) =>
  !!s.enemyIsIgnited ||
  !!s.enemyIsShocked ||
  !!s.enemyIsChilled ||
  (s.enemyTrauma || 0) > 0 ||
  (s.enemyWither || 0) > 0 ||
  (s.enemyWorsen || 0) > 0 ||
  (s.enemyPoison || 0) > 0

const CONDITION_RULES = [
  { re: /满血时|生命健康时|生命全满时/, test: (s) => !!s.isFullLife },
  { re: /生命濒危时|低血时/, test: (s) => !!s.isLowLife },
  { re: /非生命濒危时/, test: (s) => !s.isLowLife },
  { re: /移动时/, test: (s) => !!s.isMoving },
  { re: /站立时|站定时/, test: (s) => !!s.isStationary },
  { re: /持盾时|格挡时/, test: (s) => !!s.isBlocking },
  { re: /拥有充能|充能时/, test: (s) => !!s.hasCharges },
  { re: /战斗中|处于战斗/, test: (s) => !!s.isInCombat },
  { re: /对有异常状态的敌人|敌人有异常状态|敌人处于异常状态/, test: ailmentActive },
  { re: /对(?:被)?点燃的敌人|敌人被点燃/, test: (s) => !!s.enemyIsIgnited },
  { re: /对(?:被)?感电的敌人|敌人被感电/, test: (s) => !!s.enemyIsShocked },
  { re: /对(?:被)?冰冻的敌人|敌人被冰冻|对冰结的敌人/, test: (s) => !!s.enemyIsChilled },
  { re: /对(?:被)?创伤的敌人|创伤状态/, test: (s) => (s.enemyTrauma || 0) > 0 },
  { re: /对(?:被)?凋零的敌人|凋零状态/, test: (s) => (s.enemyWither || 0) > 0 },
  { re: /对(?:被)?恶化的敌人|恶化状态/, test: (s) => (s.enemyWorsen || 0) > 0 },
  { re: /中毒/, test: (s) => (s.enemyPoison || 0) > 0 },
  { re: /被诅咒/, test: (s) => !!s.enemyIsCursed },
  { re: /对远处的敌人/, test: (s) => !!s.enemyIsFar },
  { re: /近期击杀/, test: (s) => !!s.recentlyKilled },
  { re: /(?:召唤物|被辅助技能召唤的召唤物)?存在时/, test: (s) => (s.minionCount || 0) > 0 },
  {
    re: /周围只有\s*(\d+)\s*个敌人/,
    test: (s, m) => (s.enemyCount || 0) === Number(m[1]),
  },
  { re: /周围(?:有|存在)?敌人/, test: (s) => (s.enemyCount || 0) > 0 || !!s.isInCombat },
]

// 未映射到开关的条件句式标记：命中即视为条件子句，保守不计入。
const LEADING_COND_RE =
  /^(?:每当|当|如果|若|只要|在|处于|受到|直到|对[^，,;；。]{0,16}的敌人|被[^，,;；。]{0,14}(?:时|状态下|期间)|每(?:拥有|有|当|受到|释放|造成|使用|存在|击败|击中|拾取)[^，,;；。]{0,14}|(?:[^，,;；。]{0,16})时(?:，|,|$))/

// 判定子句是否带前置条件：命中映射规则返回开关结果 + 条件之后剩余文本；
// 命中未映射标记返回 false（保守不计入）；无条件返回 { gated: null }。
export function splitLeadingCondition(text, states) {
  for (const rule of CONDITION_RULES) {
    const m = text.match(rule.re)
    if (m) {
      const rest = text
        .slice(m.index + m[0].length)
        .trim()
        .replace(/^[，,、\s]+/, '')
      return { gated: rule.test(states, m), rest }
    }
  }
  const lm = text.match(LEADING_COND_RE)
  if (lm) {
    const rest = text
      .slice(lm.index + lm[0].length)
      .trim()
      .replace(/^[，,、\s]+/, '')
    return { gated: false, rest }
  }
  return { gated: null, rest: text }
}

// 按「段(;)→子句(，,)」遍历词缀文本，仅对门控通过的子句调用 cb。
// 与计算端各 loop 语义完全一致：前置条件子句设置 pendingGate，仅作用于紧随其后的数值子句。
export function forEachGatedClause(text, states, cb) {
  for (const seg of String(text || '').split(/[;；]/)) {
    const clauses = seg.split(/[，,]/)
    let pendingGate = true
    for (const clauseRaw of clauses) {
      const clause = clauseRaw.trim()
      if (!clause) continue
      const { gated, rest } = splitLeadingCondition(clause, states)
      if (gated !== null) pendingGate = gated

      const t = rest.trim()
      if (!t) continue
      if (!pendingGate) {
        pendingGate = true
        continue
      }
      pendingGate = true
      cb(t)
    }
  }
}
