import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useIntl } from 'react-intl'
import { buildStore } from '../../stores/buildStore.js'
import { saveStore } from '../../stores/saveStore.js'
import BaseButton from '../ui/BaseButton.jsx'
import BaseModal from '../ui/BaseModal.jsx'
import './AppSidebar.less'

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function AppSidebar() {
  const stats = buildStore.engineStats
  const sum = buildStore.summary
  const { formatMessage } = useIntl()

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportCode, setExportCode] = useState('')
  const [copied, setCopied] = useState(false)

  function doExport() {
    const code = saveStore.exportToCode(saveStore.currentSaveId)
    if (!code) return
    setExportCode(code)
    setCopied(false)
    setShowExportModal(true)
  }

  function copyExportCode() {
    navigator.clipboard
      .writeText(exportCode)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <aside className="app-sidebar">
      {saveStore.currentSave && (
        <div>
          <div className="app-sidebar__title-row">
            <h3 className="app-sidebar__title app-sidebar__title--row">
              {formatMessage({ id: 'sidebar.currentBuild' })}
            </h3>
            <button
              type="button"
              className="app-sidebar__export-btn"
              title={formatMessage({ id: 'app.exportTitle' })}
              onClick={doExport}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
          <p className="app-sidebar__current-name">{saveStore.currentSave.name}</p>
        </div>
      )}

      <div>
        <h3 className="app-sidebar__title">{formatMessage({ id: 'sidebar.summary' })}</h3>
        <div className="app-sidebar__card app-sidebar__card--summary">
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.eqCount' })}</span>
            <span className="app-sidebar__value">{sum.eqCount} / 10</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.talentPoints' })}</span>
            <span className="app-sidebar__value app-sidebar__value--amber">{sum.talentPoints}</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.skillCount' })}</span>
            <span className="app-sidebar__value">{sum.skillCount}</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.spiritCount' })}</span>
            <span className="app-sidebar__value">{sum.spiritCount}</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.slateCount' })}</span>
            <span className="app-sidebar__value">{sum.slateCount}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="app-sidebar__title">{formatMessage({ id: 'sidebar.attack' })}</h3>
        <div className="app-sidebar__card">
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.atkSpeed' })}</span>
            <span className="app-sidebar__value app-sidebar__value--amber">{stats.atkSpeed}/s</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.critChance' })}</span>
            <span className="app-sidebar__value app-sidebar__value--cyan">{stats.critChance}%</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.critMulti' })}</span>
            <span className="app-sidebar__value app-sidebar__value--pink">{stats.critMulti}%</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.avgHit' })}</span>
            <span className="app-sidebar__value">{formatNum(stats.totalFlat)}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="app-sidebar__title">{formatMessage({ id: 'sidebar.stats' })}</h3>
        <div className="app-sidebar__card">
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.str' })}</span>
            <span className="app-sidebar__value">{stats.stats?.str ?? 0}</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.dex' })}</span>
            <span className="app-sidebar__value">{stats.stats?.dex ?? 0}</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.int' })}</span>
            <span className="app-sidebar__value">{stats.stats?.int ?? 0}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="app-sidebar__title">{formatMessage({ id: 'sidebar.defense' })}</h3>
        <div className="app-sidebar__card">
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.maxLife' })}</span>
            <span className="app-sidebar__value app-sidebar__value--green">{stats.maxLife}</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.maxMana' })}</span>
            <span className="app-sidebar__value app-sidebar__value--cyan">{stats.maxMana}</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.energyShield' })}</span>
            <span className="app-sidebar__value app-sidebar__value--blue">{stats.energyShield}</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.armor' })}</span>
            <span className="app-sidebar__value app-sidebar__value--orange">{stats.armor}</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.evasion' })}</span>
            <span className="app-sidebar__value app-sidebar__value--purple">{stats.evasion}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="app-sidebar__title">{formatMessage({ id: 'sidebar.resistances' })}</h3>
        <div className="app-sidebar__card">
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.coldRes' })}</span>
            <span className="app-sidebar__value app-sidebar__value--cyan">{stats.res?.cold ?? 0}%</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.lightningRes' })}</span>
            <span className="app-sidebar__value app-sidebar__value--amber">{stats.res?.lightning ?? 0}%</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.fireRes' })}</span>
            <span className="app-sidebar__value app-sidebar__value--red">{stats.res?.fire ?? 0}%</span>
          </div>
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.erosionRes' })}</span>
            <span className="app-sidebar__value app-sidebar__value--purple">{stats.res?.erosion ?? 0}%</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="app-sidebar__title">{formatMessage({ id: 'sidebar.output' })}</h3>
        <div className="app-sidebar__card">
          <div className="app-sidebar__row">
            <span className="app-sidebar__label">{formatMessage({ id: 'stat.dps' })}</span>
            <span className="app-sidebar__value app-sidebar__value--amber">{stats.dps}</span>
          </div>
        </div>
      </div>

      <BaseModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        size="sm"
        title={formatMessage({ id: 'app.exportTitle' })}
      >
        <div className="export-modal">
          <p className="export-modal__desc">{formatMessage({ id: 'app.exportDesc' })}</p>
          <textarea
            readOnly
            value={exportCode}
            onFocus={(e) => e.target.select()}
            className="export-modal__textarea"
          />
          <button type="button" className="export-modal__copy" onClick={copyExportCode}>
            {copied
              ? formatMessage({ id: 'app.copied' })
              : formatMessage({ id: 'app.copy' })}
          </button>
        </div>
        <div className="modal-footer-row">
          <BaseButton variant="ghost" onClick={() => setShowExportModal(false)}>
            {formatMessage({ id: 'app.close' })}
          </BaseButton>
        </div>
      </BaseModal>
    </aside>
  )
}

export default observer(AppSidebar)
