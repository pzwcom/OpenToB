import { observer } from 'mobx-react-lite'
import { useIntl } from 'react-intl'
import { Drawer, Input, Button, Modal, message } from 'antd'
import { useState } from 'react'
import { modulePresetStore, MODULE_DEFS } from '../../stores/modulePresetStore.js'
import './ModulePresetDrawer.less'

const MODULE_TABS = Object.values(MODULE_DEFS)

function ModulePresetDrawer() {
  const { formatMessage } = useIntl()
  const [name, setName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renamingName, setRenamingName] = useState('')

  function saveCurrent() {
    if (!name.trim()) {
      message.warning(formatMessage({ id: 'preset.nameRequired' }))
      return
    }
    modulePresetStore.savePreset(name.trim())
    setName('')
    message.success(formatMessage({ id: 'preset.saved' }))
  }

  function applyPreset(id) {
    const ok = modulePresetStore.applyPreset(id)
    if (ok) message.success(formatMessage({ id: 'preset.applied' }))
    else message.error(formatMessage({ id: 'preset.applyFailed' }))
  }

  function startRename(p) {
    setRenamingId(p.id)
    setRenamingName(p.name)
  }

  function confirmRename() {
    if (!renamingId) return
    if (!renamingName.trim()) {
      message.warning(formatMessage({ id: 'preset.nameRequired' }))
      return
    }
    modulePresetStore.renamePreset(renamingId, renamingName.trim())
    setRenamingId(null)
    setRenamingName('')
    message.success(formatMessage({ id: 'preset.renamed' }))
  }

  function cancelRename() {
    setRenamingId(null)
    setRenamingName('')
  }

  function deletePreset(p) {
    Modal.confirm({
      title: formatMessage({ id: 'preset.deleteConfirm' }),
      content: p.name,
      okText: formatMessage({ id: 'preset.deleteOk' }),
      cancelText: formatMessage({ id: 'app.close' }),
      onOk() {
        modulePresetStore.deletePreset(p.id)
        message.success(formatMessage({ id: 'preset.deleted' }))
      },
    })
  }

  const presets = modulePresetStore.activePresets
  const activeDef = modulePresetStore.activeModuleDef
  const activePresetId = modulePresetStore.activePresetId

  return (
    <Drawer
      open={modulePresetStore.drawerOpen}
      onClose={() => modulePresetStore.closeDrawer()}
      title={formatMessage({ id: 'preset.title' })}
      placement="right"
      width={420}
      className="preset-drawer"
    >
      <div className="preset__tabs">
        {MODULE_TABS.map((def) => (
          <button
            key={def.key}
            type="button"
            className={`preset__tab ${
              modulePresetStore.activeModule === def.key ? 'preset__tab--active' : ''
            }`}
            onClick={() => modulePresetStore.setActiveModule(def.key)}
          >
            {formatMessage({ id: def.label })}
          </button>
        ))}
      </div>

      <div className="preset__save">
        <div className="preset__save-label">
          {formatMessage({ id: 'preset.saveLabel' }, { module: formatMessage({ id: activeDef.label }) })}
        </div>
        <div className="preset__save-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={saveCurrent}
            placeholder={formatMessage({ id: 'preset.namePlaceholder' })}
            maxLength={30}
          />
          <Button type="primary" onClick={saveCurrent}>
            {formatMessage({ id: 'preset.save' })}
          </Button>
        </div>
      </div>

      <div className="preset__list">
        {presets.length === 0 ? (
          <div className="preset__empty">{formatMessage({ id: 'preset.empty' })}</div>
        ) : (
          presets.map((p) => (
            <div
              key={p.id}
              className={`preset__card ${
                activePresetId === p.id ? 'preset__card--active' : ''
              }`}
            >
              <div className="preset__card-head">
                {renamingId === p.id ? (
                  <Input
                    value={renamingName}
                    onChange={(e) => setRenamingName(e.target.value)}
                    onPressEnter={confirmRename}
                    onBlur={cancelRename}
                    autoFocus
                    size="small"
                    maxLength={30}
                  />
                ) : (
                  <span className="preset__card-name">{p.name}</span>
                )}
                <span className="preset__card-time">
                  {new Date(p.updatedAt || p.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="preset__card-actions">
                <Button type="primary" size="small" onClick={() => applyPreset(p.id)}>
                  {formatMessage({ id: 'preset.apply' })}
                </Button>
                <Button size="small" onClick={() => startRename(p)}>
                  {formatMessage({ id: 'preset.rename' })}
                </Button>
                <Button size="small" danger onClick={() => deletePreset(p)}>
                  {formatMessage({ id: 'preset.delete' })}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Drawer>
  )
}

export default observer(ModulePresetDrawer)
