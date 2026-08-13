import { createIntl, createIntlCache } from 'react-intl'
import zhCN from './zh-CN.js'

const cache = createIntlCache()
const intl = createIntl({ locale: 'zh-CN', messages: zhCN }, cache)

export function t(id, values) {
  return intl.formatMessage({ id }, values)
}

export default zhCN
