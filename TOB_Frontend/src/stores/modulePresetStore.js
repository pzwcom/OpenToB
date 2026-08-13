import { makeAutoObservable } from 'mobx'
import { buildStore } from './buildStore.js'
import { uuidv4 } from './uuid.js'
import { t } from '../locales/index.js'

const STORAGE_KEY = 'tob-module-presets'

// 模块定义：extract 提取当前 build 中该模块的切片；label 用于抽屉 tab 文案
export const MODULE_DEFS = {
  talents: {
    key: 'talents',
    label: 'preset.module.talents',
    extract(build) {
      return {
        talents: build.talents,
        prismsInventory: build.prisms?.inventory || [],
      }
    },
  },
  hero: {
    key: 'hero',
    label: 'preset.module.hero',
    extract(build) {
      return {
        heroTraits: build.heroTraits,
        memoryInventory: build.memoryInventory || [],
      }
    },
  },
  equipment: {
    key: 'equipment',
    label: 'preset.module.equipment',
    extract(build) {
      return {
        equipment: build.equipment,
        equipmentInventory: build.equipmentInventory || [],
      }
    },
  },
  skills: {
    key: 'skills',
    label: 'preset.module.skills',
    extract(build) {
      return {
        skills: build.skills || [],
      }
    },
  },
  pactSpirit: {
    key: 'pactSpirit',
    label: 'preset.module.pactSpirit',
    extract(build) {
      return {
        pactSpirits: build.pactSpirits || [],
      }
    },
  },
}

function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistPresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

function clone(data) {
  return JSON.parse(JSON.stringify(data))
}

class ModulePresetStore {
  constructor() {
    this.presets = loadPresets()
    this.drawerOpen = false
    this.activeModule = 'talents'
    this.savingName = ''
    makeAutoObservable(this)
  }

  get activePresets() {
    return this.presets.filter((p) => p.module === this.activeModule)
  }

  get activeModuleDef() {
    return MODULE_DEFS[this.activeModule]
  }

  // 当前 build 中该模块切片与某预设一致 → 视为"正在应用"该预设
  get activePresetId() {
    const def = this.activeModuleDef
    if (!def) return null
    const current = def.extract(buildStore.build)
    const found = this.presets.find(
      (p) =>
        p.module === this.activeModule &&
        JSON.stringify(p.data) === JSON.stringify(current)
    )
    return found ? found.id : null
  }

  openDrawer(module) {
    if (module && MODULE_DEFS[module]) this.activeModule = module
    this.drawerOpen = true
  }

  closeDrawer() {
    this.drawerOpen = false
    this.savingName = ''
  }

  setActiveModule(module) {
    if (MODULE_DEFS[module]) this.activeModule = module
  }

  // 保存当前模块切片为预设
  savePreset(name) {
    const def = this.activeModuleDef
    if (!def) return null
    const preset = {
      id: uuidv4(),
      module: def.key,
      name: name || t('preset.unnamed'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: clone(def.extract(buildStore.build)),
    }
    this.presets = [...this.presets, preset]
    persistPresets(this.presets)
    this.savingName = ''
    return preset
  }

  // 应用预设到当前 build（其他模块不动）
  applyPreset(id) {
    const preset = this.presets.find((p) => p.id === id)
    if (!preset) return false
    if (preset.module === 'talents') {
      return buildStore.applyTalentsPreset(preset.data)
    }
    if (preset.module === 'hero') {
      return buildStore.applyHeroPreset(preset.data)
    }
    if (preset.module === 'equipment') {
      return buildStore.applyEquipmentPreset(preset.data)
    }
    if (preset.module === 'skills') {
      return buildStore.applySkillsPreset(preset.data)
    }
    if (preset.module === 'pactSpirit') {
      return buildStore.applyPactSpiritPreset(preset.data)
    }
    return false
  }

  renamePreset(id, name) {
    this.presets = this.presets.map((p) =>
      p.id === id ? { ...p, name: name || p.name, updatedAt: Date.now() } : p
    )
    persistPresets(this.presets)
  }

  deletePreset(id) {
    this.presets = this.presets.filter((p) => p.id !== id)
    persistPresets(this.presets)
  }
}

export const modulePresetStore = new ModulePresetStore()
