import { makeAutoObservable } from 'mobx'
import { t } from '../locales/index.js'
import { uuidv4 } from './uuid.js'

const SAVES_INDEX_KEY = 'tob-saves-index'

function getSaveKey(id) {
  return `tob-save-${id}`
}

function loadSavesIndex() {
  try {
    const raw = localStorage.getItem(SAVES_INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistSavesIndex(saves) {
  localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(saves))
}

function readSaveData(id) {
  try {
    const raw = localStorage.getItem(getSaveKey(id))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

class SaveStore {
  constructor() {
    this.saves = loadSavesIndex()
    this.currentSaveId = null
    makeAutoObservable(this)
  }

  get currentSave() {
    return this.saves.find((s) => s.id === this.currentSaveId) ?? null
  }

  setCurrentSaveId(id) {
    this.currentSaveId = id
  }

  createSave(name) {
    const id = uuidv4()
    const now = Date.now()
    const save = {
      id,
      name: name || t('app.unnamed'),
      createdAt: now,
      updatedAt: now,
    }
    this.saves = [...this.saves, save]
    persistSavesIndex(this.saves)
    return save
  }

  deleteSave(id) {
    this.saves = this.saves.filter((s) => s.id !== id)
    persistSavesIndex(this.saves)
    localStorage.removeItem(getSaveKey(id))
    if (this.currentSaveId === id) {
      this.currentSaveId = null
    }
  }

  renameSave(id, name) {
    this.saves = this.saves.map((s) =>
      s.id === id ? { ...s, name, updatedAt: Date.now() } : s
    )
    persistSavesIndex(this.saves)
    const data = readSaveData(id)
    if (data && typeof data === 'object') {
      data.name = name
      localStorage.setItem(getSaveKey(id), JSON.stringify(data))
    }
  }

  loadSave(id) {
    this.currentSaveId = id
    return readSaveData(id)
  }

  saveBuild(id, data) {
    localStorage.setItem(getSaveKey(id), JSON.stringify(data))
    this.saves = this.saves.map((s) =>
      s.id === id ? { ...s, updatedAt: Date.now() } : s
    )
    persistSavesIndex(this.saves)
  }

  persist(data) {
    if (!this.currentSaveId) return false
    this.saveBuild(this.currentSaveId, data)
    return true
  }

  exportToCode(id) {
    const data = readSaveData(id)
    if (!data) return null
    const json = JSON.stringify(data)
    return btoa(unescape(encodeURIComponent(json)))
  }

  importFromCode(code) {
    try {
      const json = decodeURIComponent(escape(atob(code)))
      return JSON.parse(json)
    } catch {
      return null
    }
  }

  importAndSave(code, name) {
    const data = this.importFromCode(code)
    if (!data) return null
    const save = this.createSave(name || data.name || t('app.unnamed'))
    this.saveBuild(save.id, data)
    return save
  }
}

export const saveStore = new SaveStore()
