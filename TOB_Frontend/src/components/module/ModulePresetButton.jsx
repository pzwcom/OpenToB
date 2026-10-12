import { Button } from 'antd'
import { useIntl } from 'react-intl'
import { modulePresetStore } from '../../stores/modulePresetStore.js'

// 全站统一的「预设」按钮：样式一致（antd 小号默认按钮），固定放在页面头部右上角的 actions 区首位
export default function ModulePresetButton({ module }) {
  const { formatMessage } = useIntl()
  return (
    <Button size="small" onClick={() => modulePresetStore.openDrawer(module)}>
      {formatMessage({ id: 'preset.open' })}
    </Button>
  )
}
