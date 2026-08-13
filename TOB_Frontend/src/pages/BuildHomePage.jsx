import { useState } from 'react'
import { useHistory } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { useIntl } from 'react-intl'
import { Empty, Checkbox, Input, Modal, Popconfirm, message } from 'antd'
import { saveStore } from '../stores/saveStore.js'
import { buildStore } from '../stores/buildStore.js'
import BaseButton from '../components/ui/BaseButton.jsx'
import './BuildHomePage.less'

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function BuildHomePage() {
  const history = useHistory()
  const { formatMessage } = useIntl()

  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [createName, setCreateName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  function confirmCreate() {
    const name = createName.trim()
    buildStore.reset()
    const save = saveStore.createSave(name || formatMessage({ id: 'app.unnamed' }))
    saveStore.setCurrentSaveId(save.id)
    history.push('/builder/hero')
  }

  function enterBuild(id) {
    saveStore.setCurrentSaveId(id)
    history.push('/builder/hero')
  }

  function toggleSelect(id, checked) {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    )
  }

  function toggleSelectAll(checked) {
    setSelectedIds(checked ? saveStore.saves.map((s) => s.id) : [])
  }

  function deleteSelected() {
    selectedIds.forEach((id) => saveStore.deleteSave(id))
    setSelectedIds([])
    message.success(formatMessage({ id: 'home.deleted' }))
  }

  function openRename(save) {
    setRenameTarget(save)
    setRenameValue(save.name)
  }

  function confirmRename() {
    const name = renameValue.trim()
    if (!name || !renameTarget) return
    saveStore.renameSave(renameTarget.id, name)
    setRenameTarget(null)
    message.success(formatMessage({ id: 'home.renamed' }))
  }

  function deleteBuild(id) {
    saveStore.deleteSave(id)
    message.success(formatMessage({ id: 'home.deleted' }))
  }

  return (
    <div className="build-home">
      <header className="build-home__header">
        <h1 className="build-home__title">{formatMessage({ id: 'home.title' })}</h1>
        <p className="build-home__subtitle">{formatMessage({ id: 'home.subtitle' })}</p>
        <BaseButton
          variant="primary"
          size="lg"
          onClick={() => setShowCreateModal(true)}
        >
          {formatMessage({ id: 'home.create' })}
        </BaseButton>
      </header>

      {saveStore.saves.length === 0 ? (
        <div className="build-home__empty">
          <Empty description={formatMessage({ id: 'home.empty' })} />
        </div>
      ) : (
        <>
          {selectedIds.length > 0 && (
            <div className="build-home__toolbar">
              <Checkbox
                checked={selectedIds.length === saveStore.saves.length}
                indeterminate={
                  selectedIds.length > 0 &&
                  selectedIds.length < saveStore.saves.length
                }
                onChange={(e) => toggleSelectAll(e.target.checked)}
              >
                {formatMessage({ id: 'home.selectAll' })}
              </Checkbox>
              <span className="build-home__toolbar-count">
                {formatMessage({ id: 'home.selected' }, { count: selectedIds.length })}
              </span>
              <Popconfirm
                title={formatMessage(
                  { id: 'home.batchDeleteConfirm' },
                  { count: selectedIds.length }
                )}
                okText={formatMessage({ id: 'home.deleteOk' })}
                cancelText={formatMessage({ id: 'app.cancel' })}
                okButtonProps={{ danger: true }}
                onConfirm={deleteSelected}
              >
                <BaseButton variant="danger" size="sm">
                  {formatMessage({ id: 'home.batchDelete' })}
                </BaseButton>
              </Popconfirm>
            </div>
          )}
          <div className="build-home__grid">
            {saveStore.saves.map((save) => (
              <div
                key={save.id}
                className={`build-home__card ${
                  selectedIds.includes(save.id) ? 'build-home__card--selected' : ''
                }`}
                onClick={() => enterBuild(save.id)}
              >
                <Checkbox
                  className="build-home__card-check"
                  checked={selectedIds.includes(save.id)}
                  onChange={(e) => toggleSelect(save.id, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="build-home__card-body">
                  <h3 className="build-home__card-name">{save.name}</h3>
                  <p className="build-home__card-meta">
                    {formatMessage({ id: 'home.updatedAt' })}：{formatDate(save.updatedAt)}
                  </p>
                </div>
                <div
                  className="build-home__card-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <BaseButton
                    variant="ghost"
                    size="sm"
                    onClick={() => openRename(save)}
                  >
                    {formatMessage({ id: 'home.rename' })}
                  </BaseButton>
                  <Popconfirm
                    title={formatMessage({ id: 'home.deleteConfirm' }, { name: save.name })}
                    okText={formatMessage({ id: 'home.deleteOk' })}
                    cancelText={formatMessage({ id: 'app.cancel' })}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteBuild(save.id)}
                  >
                    <BaseButton variant="danger" size="sm">
                      {formatMessage({ id: 'home.delete' })}
                    </BaseButton>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        title={formatMessage({ id: 'home.createTitle' })}
        open={showCreateModal}
        onCancel={() => {
          setShowCreateModal(false)
          setCreateName('')
        }}
        onOk={confirmCreate}
        okText={formatMessage({ id: 'home.createConfirm' })}
        cancelText={formatMessage({ id: 'app.cancel' })}
        centered
      >
        <Input
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          onPressEnter={confirmCreate}
          placeholder={formatMessage({ id: 'home.createPlaceholder' })}
          maxLength={40}
          autoFocus
        />
      </Modal>

      <Modal
        title={formatMessage({ id: 'home.renameTitle' })}
        open={!!renameTarget}
        onCancel={() => setRenameTarget(null)}
        onOk={confirmRename}
        okText={formatMessage({ id: 'app.save' })}
        cancelText={formatMessage({ id: 'app.cancel' })}
        centered
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={confirmRename}
          maxLength={40}
        />
      </Modal>
    </div>
  )
}

export default observer(BuildHomePage)
