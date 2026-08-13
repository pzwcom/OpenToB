import { useIntl } from 'react-intl'
import './TabPlaceholder.less'

export default function TabPlaceholder({ title }) {
  const { formatMessage } = useIntl()
  return (
    <div className="tab-placeholder">
      <div className="tab-placeholder__content">
        <h2>{title}</h2>
        <p>{formatMessage({ id: 'placeholder.notImplemented' })}</p>
      </div>
    </div>
  )
}
