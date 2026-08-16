import { lazy, Suspense, useEffect, useRef } from 'react'
import { Redirect, Route, Switch, useHistory, useLocation } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { buildStore } from '../stores/buildStore.js'
import { saveStore } from '../stores/saveStore.js'
import AppHeader from '../components/layout/AppHeader.jsx'
import AppSidebar from '../components/layout/AppSidebar.jsx'
import ModulePresetDrawer from '../components/module/ModulePresetDrawer.jsx'
import './BuilderView.less'
import EquipmentPage from './EquipmentPage.jsx'
import TalentsPage from './TalentsPage.jsx'
import SkillsPage from './SkillsPage.jsx'
import HeroPage from './HeroPage.jsx'
import PactSpiritPage from './PactSpiritPage.jsx'
import DivinityPage from './DivinityPage.jsx'
import CalculationsPage from './CalculationsPage.jsx'

const EncyclopediaPage = lazy(() =>
  import('./EncyclopediaPage.jsx').then((m) => ({ default: m.default }))
)

const tabs = [
  { to: '/builder/hero', label: '英雄' },
  { to: '/builder/talents', label: '天赋' },
  { to: '/builder/equipment', label: '装备' },
  { to: '/builder/skills', label: '技能' },
  { to: '/builder/divinity', label: '神格石板' },
  { to: '/builder/pactspirit', label: '契灵&命运' },
  { to: '/builder/calculations', label: '计算' },
  { to: '/builder/encyclopedia', label: '火炬百科' },
]

function BuilderView() {
  const history = useHistory()
  const location = useLocation()

  const initialized = useRef(false)

  const buildStoreRef = useRef(buildStore)
  const saveStoreRef = useRef(saveStore)

  useEffect(() => {
    buildStoreRef.current = buildStore
    saveStoreRef.current = saveStore
  })

  useEffect(() => {
    const st = saveStoreRef.current
    if (initialized.current) return
    initialized.current = true
    if (!st.currentSaveId) {
      const save = st.createSave('未命名构建')
      st.setCurrentSaveId(save.id)
    }
  }, [])

  useEffect(() => {
    const st = saveStoreRef.current
    const bt = buildStoreRef.current
    if (!st.currentSaveId) return
    const data = st.loadSave(st.currentSaveId)
    if (data) bt.loadFromData(data)
  }, [saveStore.currentSaveId])

  function isActive(path) {
    const current = location.pathname
    if (path === '/builder/equipment') return current === '/builder/equipment'
    return current.startsWith(path)
  }

  return (
    <div className="builder">
        <AppHeader saveStatus={buildStore.saveStatus} />
      <div className="builder__body">
        <AppSidebar />
        <main className="builder__main">
          <div className="builder__tabbar">
            <div className="builder__tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.to}
                  type="button"
                  onClick={() => history.push(tab.to)}
                  className={`builder__tab ${
                    isActive(tab.to) ? 'builder__tab--active' : ''
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <ModulePresetDrawer />
          <Switch>
            <Route path="/builder/equipment" component={EquipmentPage} />
            <Route path="/builder/talents/:slot?" component={TalentsPage} />
            <Route path="/builder/skills" component={SkillsPage} />
            <Route path="/builder/hero" component={HeroPage} />
            <Route path="/builder/pactspirit" component={PactSpiritPage} />
            <Route path="/builder/divinity" component={DivinityPage} />
            <Route path="/builder/calculations" component={CalculationsPage} />
            <Route
              path="/builder/encyclopedia"
              render={() => (
                <Suspense fallback={null}>
                  <EncyclopediaPage />
                </Suspense>
              )}
            />
            <Redirect from="/builder" to="/builder/hero" />
          </Switch>
        </main>
      </div>
    </div>
  )
}

export default observer(BuilderView)
