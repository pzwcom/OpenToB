import { makeAutoObservable } from 'mobx'
import { buildStore, canonicalConfiguration } from './buildStore.js'
import { uuidv4 } from './uuid.js'
import { t } from '../locales/index.js'

const STORAGE_KEY = 'tob-module-presets'

// 模块定义：
//   extract     提取当前 build 中该模块的切片（保存预设 / 应用预设都用这份数据）
//   identityKey 判定"正在应用哪个预设"时只比较这个切片字段；不填则整体比较
//   label       抽屉 tab 文案
// identityKey 存在的原因：talents / hero / equipment 的 apply 是"替换切片 + 把预设引用的
// 库存条目 mergeInventoryById 进现有库存"，所以应用后 extract 出来的库存会大于预设里的库存，
// 整体比较永远不相等，黄色"已应用"高亮就永不出现。这些模块只比被替换的那部分切片。
export const MODULE_DEFS = {
  talents: {
    key: 'talents',
    label: 'preset.module.talents',
    identityKey: 'talents',
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
    identityKey: 'heroTraits',
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
    identityKey: 'equipment',
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
    identityKey: 'skills',
    extract(build) {
      return {
        skills: build.skills || [],
      }
    },
  },
  pactSpirit: {
    key: 'pactSpirit',
    label: 'preset.module.pactSpirit',
    identityKey: 'pactSpirits',
    extract(build) {
      return {
        pactSpirits: build.pactSpirits || [],
      }
    },
  },
  divinity: {
    key: 'divinity',
    label: 'preset.module.divinity',
    extract(build) {
      return {
        inventory: build.divinityPage?.inventory || [],
        placedSlates: build.divinityPage?.placedSlates || [],
      }
    },
  },
  calculations: {
    key: 'calculations',
    label: 'preset.module.calculations',
    // 配置对象里"哪些状态 key 被写过"取决于用户操作历史，必须经 canonicalConfiguration
    // 规范成完整形态，保存/应用/判定三处才可比
    extract(build) {
      return {
        configuration: canonicalConfiguration(build.configuration),
      }
    },
    // 改动前保存的老预设里状态 key 可能不全，比较前同样规范化，否则会"应用了却不亮"
    canonicalize(data) {
      return {
        configuration: canonicalConfiguration(data?.configuration),
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

// 键序无关的序列化：预设数据的键顺序取决于保存时的写入顺序，用 JSON.stringify 直接比会误判
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value === undefined ? null : value)
}

function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b)
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

  // 当前 build 中该模块切片与某预设一致 → 视为"正在应用"该预设（抽屉里显示黄色方框）
  get activePresetId() {
    const def = this.activeModuleDef
    if (!def) return null
    const canonicalize = def.canonicalize || ((d) => d)
    const current = canonicalize(def.extract(buildStore.build))
    const found = this.presets.find((p) => {
      if (p.module !== this.activeModule) return false
      const stored = canonicalize(p.data)
      if (def.identityKey) {
        return deepEqual(current?.[def.identityKey], stored?.[def.identityKey])
      }
      return deepEqual(current, stored)
    })
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
    if (preset.module === 'divinity') {
      return buildStore.applyDivinityPreset(preset.data)
    }
    if (preset.module === 'calculations') {
      return buildStore.applyCalculationsPreset(preset.data)
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
