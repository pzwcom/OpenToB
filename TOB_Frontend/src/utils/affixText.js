const TRIM_SYMBOLS = /^[\s;；|,，、]+|[\s;；|,，、]+$/g

// 清洗词缀文本首尾的符号（; ； | , ， 、 及空白），避免出现 "xxxx;;" / ";;;" 等展示
export function cleanAffixText(text) {
  if (text == null) return ''
  return String(text).replace(TRIM_SYMBOLS, '')
}
