import ReactDOM from 'react-dom'
import { IntlProvider } from 'react-intl'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/es/locale/zh_CN'
import 'antd/dist/antd.dark.css'
import App from './App.jsx'
import messages from './locales/index.js'
import './index.less'

ReactDOM.render(
  <IntlProvider locale="zh-CN" messages={messages}>
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>
  </IntlProvider>,
  document.getElementById('root')
)
