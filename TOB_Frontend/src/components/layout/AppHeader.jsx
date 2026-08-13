import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useIntl } from 'react-intl'
import { useHistory } from 'react-router-dom'
import { buildStore } from '../../stores/buildStore.js'
import { saveStore } from '../../stores/saveStore.js'
import BaseButton from '../ui/BaseButton.jsx'
import BaseModal from '../ui/BaseModal.jsx'
import './AppHeader.less'

function AppHeader({ saveStatus }) {
  const history = useHistory()
  const { formatMessage } = useIntl()

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportCode, setExportCode] = useState('')
  const [copied, setCopied] = useState(false)

  function onNameChange(e) {
    const name = e.target.value
    buildStore.setName(name)
    if (saveStore.currentSaveId) {
      saveStore.renameSave(saveStore.currentSaveId, name)
    }
  }

  function doSave() {
    if (!saveStore.currentSaveId) return
    saveStore.persist(buildStore.exportData())
  }

  function doExport() {
    let id = saveStore.currentSaveId
    if (!id) {
      const save = saveStore.createSave(buildStore.build.name)
      saveStore.setCurrentSaveId(save.id)
      id = save.id
    }
    saveStore.saveBuild(id, buildStore.exportData())
    const code = saveStore.exportToCode(id)
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
    <header className="app-header">
      <button
        type="button"
        className="app-header__back"
        onClick={() => history.push('/')}
        aria-label={formatMessage({ id: 'app.back' })}
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
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <h1 className="app-header__title">{formatMessage({ id: 'app.title' })}</h1>
      <div className="app-header__name-wrap">
        <input
          value={buildStore.build.name}
          onChange={onNameChange}
          className="app-header__name"
          placeholder={formatMessage({ id: 'app.unnamed' })}
        />
      </div>
      <div className="app-header__actions">
        {saveStore.currentSaveId && (
          <span className="app-header__save-name">{saveStore.currentSave?.name}</span>
        )}
        {saveStatus === 'saving' && (
          <span className="app-header__status app-header__status--saving">
            {formatMessage({ id: 'app.saving' })}
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="app-header__status app-header__status--saved">
            {formatMessage({ id: 'app.saved' })}
          </span>
        )}
        <BaseButton variant="secondary" size="sm" onClick={doSave}>
          {formatMessage({ id: 'app.save' })}
        </BaseButton>
        <BaseButton variant="ghost" size="sm" onClick={doExport}>
          {formatMessage({ id: 'app.export' })}
        </BaseButton>
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
    </header>
  )
}

export default observer(AppHeader)
