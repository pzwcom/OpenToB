const TRIM_SYMBOLS = /^[\s;；|,，、]+|[\s;；|,，、]+$/g

// 清洗词缀文本首尾的符号（; ； | , ， 、 及空白），避免出现 "xxxx;;" / ";;;" 等展示
export function cleanAffixText(text) {
  if (text == null) return ''
  return String(text).replace(TRIM_SYMBOLS, '')
}

// 数值括号归一：游戏数据里 `(-20–-15)%` / `(-24)%` 这类「括号包裹的带符号数值/范围」是数值格式的一部分
//（正数不加括号，负数必须加括号与连字符区分）。引擎正则大多形如 `[+-]?\d+%`，括号外的 `%` 会匹配失败，
// 消费判定/数值解析前先剥离该括号，仅作用于匹配路径，不影响展示层的原始文本。
const VALUE_PAREN_RE = /[（(]([+-]?\d+(?:\.\d+)?(?:\s*[~〜～\-－—–]\s*[+-]?\d+(?:\.\d+)?)?)[）)]/g
export function normalizeAffixNumbers(text) {
  if (text == null) return ''
  return String(text).replace(VALUE_PAREN_RE, '$1')
}
