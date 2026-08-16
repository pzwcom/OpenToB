// Divinity data extracted from TLIPOB build planner
// Gods, trees, talent nodes, shapes, and legendary templates

export const GODS = ['Might', 'Hunting', 'Knowledge', 'War', 'Deception', 'Machines']

export const GOD_COLORS = {
  Might:     { bg: 'bg-orange-700',     border: 'border-orange-600',   fill: 'rgba(194,65,12,0.25)',      stroke: '#c2410c' },
  Hunting:   { bg: 'bg-emerald-600',    border: 'border-emerald-500',  fill: 'rgba(5,150,105,0.25)',     stroke: '#059669' },
  Knowledge: { bg: 'bg-blue-600',       border: 'border-blue-500',     fill: 'rgba(37,99,235,0.25)',     stroke: '#2563eb' },
  War:       { bg: 'bg-red-600',        border: 'border-red-500',      fill: 'rgba(220,38,38,0.25)',     stroke: '#dc2626' },
  Deception: { bg: 'bg-purple-600',     border: 'border-purple-500',   fill: 'rgba(147,51,234,0.25)',    stroke: '#9333ea' },
  Machines:  { bg: 'bg-cyan-600',       border: 'border-cyan-500',     fill: 'rgba(8,145,178,0.25)',     stroke: '#0891b2' },
}

export const LEGENDARY_SLATE_COLOR = {
  bg: 'bg-yellow-600', border: 'border-yellow-500', fill: 'rgba(234,179,8,0.25)', stroke: '#eab308',
}

export const NETHER_KING_COLOR = {
  bg: 'bg-blue-900', border: 'border-blue-800', fill: 'rgba(30,58,138,0.25)', stroke: '#1e3a8a',
}

// Type name -> Nether King slate shape key
export const NETHER_KING_SHAPES = {
  '冥王的神格：审判': 'NetherKingJudgment',
  '冥王的神格：侵染': 'NetherKingInfection',
  '冥王的神格：放逐': 'NetherKingBanishment',
  '冥王的残缺神格：审判': 'NetherKingJudgmentIncomplete',
  '冥王的残缺神格：浸染': 'NetherKingInfectionIncomplete',
}

// Grid constants
export const GRID_ROWS = 6
export const GRID_COLS = 6
export const CELL_SIZE = 48
export const DISPLAY_PAD = 1 // +1 cell padding on each side for out-of-bounds display
export const MAX_SLATE_AFFIXES = 5

// 6x6 hexagonal-ish playable area mask (true = playable)
export const GRID_MASK = [
  [false, false, true,  true,  false, false],
  [false, true,  true,  true,  true,  false],
  [true,  true,  true,  true,  true,  true ],
  [true,  true,  true,  true,  true,  true ],
  [false, true,  true,  true,  true,  false],
  [false, false, true,  true,  false, false],
]

export function isValidGridCell(row, col) {
  return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS && GRID_MASK[row][col]
}

export function isOnGrid(row, col) {
  return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS
}

// 是否已放置冥王石板（全部冥王石板合计最多 1 块，excludeSlateId 用于排除正在拖动的石板）
export function hasPlacedNetherKing(placedSlates, inventory, excludeSlateId) {
  return placedSlates.some(
    (p) => p.slateId !== excludeSlateId && inventory.find((s) => s.id === p.slateId)?.isNetherKing
  )
}

// 特定传奇石板放置数量上限（按传奇名称）
export const LEGENDARY_SLATE_LIMITS = {
  '神之谱系': 1,
  '神性一角': 3,
  '群星辉陨': 3,
  '蛾火燎原之刻': 1,
}

// 已放置的同名传奇石板数量（excludeSlateId 排除自身）
export function placedLegendaryCount(placedSlates, inventory, legendaryName, excludeSlateId) {
  return placedSlates.reduce((n, p) => {
    if (p.slateId === excludeSlateId) return n
    const slate = inventory.find((s) => s.id === p.slateId)
    return slate && slate.legendaryName === legendaryName ? n + 1 : n
  }, 0)
}

export const GOD_NAMES = {
  Might:     '巨力之神',
  Hunting:   '狩猎之神',
  Knowledge: '知识之神',
  War:       '征战之神',
  Deception: '欺诈之神',
  Machines:  '机械之神',
}

export const TREES = {
  Might:     ['God of Might', 'The Brave', 'Onslaughter', 'Warlord', 'Warrior'],
  Hunting:   ['Goddess of Hunting', 'Marksman', 'Bladerunner', 'Assassin', 'Druid'],
  Knowledge: ['Goddess of Knowledge', 'Magister', 'Arcanist', 'Elementalist', 'Prophet'],
  War:       ['God of War', 'Shadowdancer', 'Ranger', 'Ronin', 'Sentinel'],
  Deception: ['Goddess of Deception', 'Shadowmaster', 'Psychic', 'Warlock', 'Lich'],
  Machines:  ['God of Machines', 'Machinist', 'Artisan', 'Alchemist', 'Steel Vanguard'],
}

export const TALENT_TYPES = ['小型天赋', '中型天赋', '传奇中型天赋', '核心天赋']

export const TALENT_TYPE_LABELS = {
  '小型天赋': '小型天赋',
  '中型天赋': '中型天赋',
  '传奇中型天赋': '传奇中型天赋',
  '核心天赋': '核心天赋',
}

// 旧存档兼容：英文天赋类型 -> 中文
export const TALENT_TYPE_EN_TO_ZH = {
  Micro: '小型天赋',
  Medium: '中型天赋',
  'Legendary Medium': '传奇中型天赋',
  Core: '核心天赋',
}

export function normalizeTalentType(type) {
  if (!type) return type
  return TALENT_TYPE_EN_TO_ZH[type] || type
}

// Shape definitions: cells are [row, col] offsets
export const SHAPE_DEFS = {
  O:       { cells: [[0,0],[0,1],[1,0],[1,1]], size: [2,2], label: '2x2 方形' },
  L:       { cells: [[0,0],[1,0],[2,0],[2,1]], size: [3,2], label: 'L型' },
  Z:       { cells: [[0,0],[0,1],[1,1],[1,2]], size: [2,3], label: 'Z型' },
  T:       { cells: [[0,0],[0,1],[0,2],[1,1]], size: [2,3], label: 'T型' },
  Single:  { cells: [[0,0]], size: [1,1], label: '单格' },
  CornerL: { cells: [[0,0],[0,1],[1,0]], size: [2,2], label: '角L型' },
  Vertical2:{ cells: [[0,0],[1,0]], size: [2,1], label: '竖两格' },
  Vertical6:{ cells: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]], size: [6,1], label: '竖六格' },
  Pedigree:{ cells: [[0,0],[0,1],[1,0],[1,1],[1,2],[2,1],[2,2]], size: [3,3], label: '谱系型' },
  NetherKing: { cells: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]], size: [3,3], label: '冥王神格' },
  NetherKingJudgment: { cells: [[0,0],[0,3],[3,3]], size: [4,4], label: '冥王·审判' },
  NetherKingInfection: { cells: [[0,0],[1,0],[2,0]], size: [3,1], label: '冥王·侵染' },
  NetherKingBanishment: { cells: [[0,2],[1,1],[2,0]], size: [3,3], label: '冥王·放逐' },
  NetherKingJudgmentIncomplete: { cells: [[0,0],[0,3]], size: [1,4], label: '冥王·残缺审判' },
  NetherKingInfectionIncomplete: { cells: [[0,0],[1,0]], size: [2,1], label: '冥王·残缺侵染' },
}

export const REGULAR_SHAPES = ['O', 'L', 'Z', 'T']
export const LEGENDARY_SHAPES = ['Single', 'CornerL', 'Vertical2', 'Vertical6', 'Pedigree']

// Talent nodes grouped by god then tree
// All data extracted from TLIPOB compiled assets
const TALENT_NODES = {}

// ---- Might ----
TALENT_NODES['Might_God of Might'] = [
  { type:'Core', name:'Elimination', effect:'Attacks eliminate enemies under 18% Life on hit' },
  { type:'Core', name:'Momentum', effect:'+30% additional Attack Damage for next Main Skill every 0.5s. Refreshes on defeat' },
  { type:'Core', name:'Tenacity', effect:'+100% chance to gain 1 Tenacity Blessing on hit, +1 Max Tenacity Stacks' },
  { type:'Core', name:'Great Strength', effect:'-10% Attack Speed, +30% additional Ailment Damage by attacks' },
  { type:'Core', name:'Hidden Mastery', effect:'Unable to evade, +15% AS & +15% Attack Dmg with Attack Aggression' },
  { type:'Core', name:'Judgment', effect:'+100% chance for Attacks to Paralysis, +25% Crit Dmg vs Paralyzed' },
  { type:'Micro', name:'', effect:'+9% damage' },
  { type:'Micro', name:'', effect:'+3% Attack Speed' },
  { type:'Medium', name:'', effect:'+18% damage' },
  { type:'Legendary Medium', name:'', effect:'+1 to Max Tenacity Blessing Stacks' },
  { type:'Legendary Medium', name:'', effect:'+1 to Attack Skill Level' },
  { type:'Legendary Medium', name:'', effect:'+2% Life Regen Speed per Tenacity, +25 Life/sec per Tenacity' },
  { type:'Legendary Medium', name:'', effect:'+8% additional Attack Damage if used Warcry recently' },
]
TALENT_NODES['Might_The Brave'] = [
  { type:'Core', name:'Static', effect:'Up to +48% additional damage while standing still' },
  { type:'Core', name:'Formless', effect:'Doubles Max Warcry Effects, +66% Warcry Skill Area' },
  { type:'Core', name:'Resolve', effect:'+4% additional Armor per Tenacity stack' },
  { type:'Core', name:'Ember Armor', effect:'+25% Armor Effective Rate for Non-Physical Damage' },
  { type:'Legendary Medium', name:'', effect:'+40% Defense gained from Chest Armor' },
  { type:'Legendary Medium', name:'', effect:'+8% additional Attack Damage when holding One-Handed' },
  { type:'Legendary Medium', name:'', effect:'+5% Block Ratio when holding a Shield' },
  { type:'Legendary Medium', name:'', effect:'+4 minimum Warcry targets' },
  { type:'Legendary Medium', name:'', effect:'+6% Armor per Tenacity stack' },
  { type:'Legendary Medium', name:'', effect:'+1% Armor for every 24 Strength' },
]
TALENT_NODES['Might_Onslaughter'] = [
  { type:'Core', name:'Sweep', effect:'+25% Attack Dmg holding Two-Handed, +25% Area' },
  { type:'Core', name:'Focused Strike', effect:'Area Skills deal up to +32% dmg to center enemies' },
  { type:'Core', name:'Sacrifice', effect:'Tenacity Blessing base: +8% additional damage' },
  { type:'Core', name:'Well Matched', effect:'Up to +40% dmg to nearby enemies, -15% dmg taken from nearby' },
  { type:'Legendary Medium', name:'', effect:'Gains 1 Tenacity/sec at Full Life' },
  { type:'Legendary Medium', name:'', effect:'-6% additional damage taken' },
  { type:'Legendary Medium', name:'', effect:'+40% Skill Area if Main Skill not used recently' },
  { type:'Legendary Medium', name:'', effect:'+10% additional Base Damage for Two-Handed Weapons' },
  { type:'Legendary Medium', name:'', effect:'+80% Paralysis Effect with Two-Handed' },
  { type:'Legendary Medium', name:'', effect:'+12% Strength' },
]
TALENT_NODES['Might_Warlord'] = [
  { type:'Core', name:'Starfire', effect:'+1 Ignite limit, Ignite spreads to enemies within 10m' },
  { type:'Core', name:'Fueling', effect:'Nearby enemy Fire Res fixed at 0' },
  { type:'Core', name:'Rock', effect:'Convert 5% Phys taken to Fire per Tenacity stack' },
  { type:'Core', name:'True Flame', effect:'65% Affliction Dmg taken bonus applied to Fire Hit Dmg' },
  { type:'Legendary Medium', name:'', effect:'+4% Max Fire Resistance' },
  { type:'Legendary Medium', name:'', effect:'Immune to Ignite, Minions immune to Fire Dmg' },
  { type:'Legendary Medium', name:'', effect:'Convert 100% Phys to Fire' },
  { type:'Legendary Medium', name:'', effect:'Inflicts Fire Infiltration on Ignited enemies' },
  { type:'Legendary Medium', name:'', effect:'+1% Fire Damage per 12 Strength' },
]
TALENT_NODES['Might_Warrior'] = [
  { type:'Core', name:'Arcane', effect:'Convert Mana Cost to Life Cost, +25% Max Life' },
  { type:'Core', name:'No Loose Ends', effect:'+40% Attack Dmg at Low Life, ES fixed at 0' },
  { type:'Core', name:'Life Path', effect:'Double Life Regain, only at <50% Life' },
  { type:'Core', name:'Survival Will', effect:'+30% dmg when not Low Life, restore 40% Life at Low Life' },
  { type:'Legendary Medium', name:'', effect:'0.3% Attack Speed per 1% Life lost' },
  { type:'Legendary Medium', name:'', effect:'-15% Life Regain Interval, consume 2% Life on Attack' },
  { type:'Legendary Medium', name:'', effect:'Restore 3% Life on defeat' },
  { type:'Legendary Medium', name:'', effect:'+8% additional damage if lost Life recently' },
  { type:'Legendary Medium', name:'', effect:'+25% additional damage vs Low Life enemies' },
  { type:'Legendary Medium', name:'', effect:'+1 Max Life per 5 Strength' },
]

// ---- Hunting ----
TALENT_NODES['Hunting_Goddess of Hunting'] = [
  { type:'Core', name:'Perception', effect:'+100% chance Agility Blessing on hit, +1 Max Stacks' },
  { type:'Core', name:'Third time\'s a charm', effect:'Has Hasten, +7% AS/CS per 3m moved recently' },
  { type:'Core', name:'Impermanence', effect:'-90% Min Phys, +80% Max Phys, +32% Max Damage' },
  { type:'Core', name:'Rushed', effect:'+30% additional damage if moved >5m recently' },
  { type:'Core', name:'Three Birds with One Stone', effect:'Projectile +2, +10% Projectile Damage' },
  { type:'Core', name:'Steady Accumulation', effect:'+40% Hit Damage, -30% Skill Duration' },
  { type:'Legendary Medium', name:'', effect:'+5% dmg & +1% MS on defeat, up to 8 stacks' },
  { type:'Legendary Medium', name:'', effect:'+10% additional dmg 4s after Mobility Skill' },
  { type:'Legendary Medium', name:'', effect:'+6% additional Attack Speed if Crit recently' },
  { type:'Legendary Medium', name:'', effect:'+6% additional Cast Speed if Crit recently' },
  { type:'Legendary Medium', name:'', effect:'+1 to Max Agility Blessing Stacks' },
]
TALENT_NODES['Hunting_Marksman'] = [
  { type:'Core', name:'Gale', effect:'60% Projectile Speed bonus applies to Projectile Damage' },
  { type:'Core', name:'Euphoria', effect:'+4% additional Evasion per Agility stack' },
  { type:'Core', name:'Close Range Fire', effect:'Projectiles deal up to +35% dmg to nearby enemies' },
  { type:'Core', name:'Master Escapist', effect:'+1 Max Deflection, gain Deflection per 5m moved' },
  { type:'Legendary Medium', name:'', effect:'+8% Projectile Speed, up to +48% dmg at distance' },
  { type:'Legendary Medium', name:'', effect:'+1 Parabolic Projectile Splits' },
  { type:'Legendary Medium', name:'', effect:'+1 Jumps' },
  { type:'Legendary Medium', name:'', effect:'+2 Horizontal Projectile Penetrations' },
  { type:'Legendary Medium', name:'', effect:'+6% Evasion per Agility stack' },
]
TALENT_NODES['Hunting_Bladerunner'] = [
  { type:'Core', name:'Waiting Attack', effect:'Consumes Agility stacks for +5% dmg each per 8s' },
  { type:'Core', name:'Joined Force', effect:'Off-Hand: add 60% dmg to Main-Hand, no off-hand attacks' },
  { type:'Core', name:'Quick Advancement', effect:'Multistrikes deal 55% increasing damage' },
  { type:'Core', name:'Preemptive Strike', effect:'+1 initial Multistrike, -20% AS during' },
  { type:'Legendary Medium', name:'', effect:'25% chance Attack Aggression on defeat' },
]
TALENT_NODES['Hunting_Assassin'] = [
  { type:'Core', name:'Conductive', effect:'Numbed base: +11% Lightning dmg taken' },
  { type:'Core', name:'Transition', effect:'50% chance +16% dmg, 10% chance +80% dmg per cast' },
  { type:'Core', name:'Queer Angle', effect:'Lucky Damage vs Numbed enemies' },
  { type:'Core', name:'Thunderclap', effect:'Consume Agility for +35% Lightning dmg on cast' },
  { type:'Legendary Medium', name:'', effect:'Convert 100% Phys to Lightning' },
  { type:'Legendary Medium', name:'', effect:'Convert 50% Lightning to Fire' },
  { type:'Legendary Medium', name:'', effect:'Convert 50% Lightning to Cold' },
  { type:'Legendary Medium', name:'', effect:'+12% Dexterity' },
]
TALENT_NODES['Hunting_Druid'] = [
  { type:'Core', name:'Cultivation', effect:'+8% AS/CS per Regain, up to 8 stacks' },
  { type:'Core', name:'Full Load', effect:'Double Life & ES Regain 6s on Defensive Skill, 8s CD' },
  { type:'Core', name:'Rebirth', effect:'Convert 50% Regain to Restoration Over Time, -50% Regain Interval' },
  { type:'Core', name:'Poisoned Relief', effect:'+25% Injury Buffer, -15% dmg taken at Low Life' },
]

// ---- Knowledge ----
TALENT_NODES['Knowledge_Goddess of Knowledge'] = [
  { type:'Core', name:'Beacon', effect:'+2 Max Spell Burst' },
  { type:'Core', name:'Insight', effect:'+30% additional Spell Damage, +25% Skill Cost' },
  { type:'Core', name:'Peculiar Vibe', effect:'+1 Tangle on enemies, -30% Tangle Duration' },
  { type:'Core', name:'Chilly', effect:'+100% Focus on hit, +1 Max Focus Stacks' },
  { type:'Core', name:'Burning Touch', effect:'Has Spell Aggression, up to +100% effect' },
  { type:'Core', name:'Acquaintance', effect:'Has Dormant Entanglement, +1 Max Tangle Qty' },
  { type:'Legendary Medium', name:'', effect:'+1 Spell Skill Level' },
  { type:'Legendary Medium', name:'', effect:'+1 to Max Focus Blessing Stacks' },
  { type:'Legendary Medium', name:'', effect:'+2% Movement Speed per activated Tangle' },
  { type:'Legendary Medium', name:'', effect:'Energy Shield charge uninterruptible 1s' },
]
TALENT_NODES['Knowledge_Magister'] = [
  { type:'Core', name:'Bunch', effect:'+1 Max Focus, +3% Spell Dmg per Focus stack' },
  { type:'Core', name:'Play Safe', effect:'100% Cast Speed bonus to Burst Charge, +40% Burst Hit Dmg' },
  { type:'Core', name:'Shell', effect:'+35% Max Energy Shield, Life fixed at 100' },
  { type:'Core', name:'Barrier of Radiance', effect:'ES Charge uninterrupted, +50% Charge Speed' },
  { type:'Legendary Medium', name:'', effect:'Burst/Tangle starts ES Charge, 2s CD' },
  { type:'Legendary Medium', name:'', effect:'Gains 1 Focus when Burst/Tangle' },
  { type:'Legendary Medium', name:'', effect:'+12% Intelligence' },
  { type:'Legendary Medium', name:'', effect:'+2 Max ES per 5 Intelligence' },
  { type:'Legendary Medium', name:'', effect:'+1 Max Spell Burst' },
  { type:'Legendary Medium', name:'', effect:'+5% Spell Crit Dmg per Focus stack' },
]
TALENT_NODES['Knowledge_Arcanist'] = [
  { type:'Core', name:'Mana', effect:'20% damage taken from Mana, +12% Max Mana' },
  { type:'Core', name:'Mind Focus', effect:'Focus adds Phys Dmg = 1% of Max Mana' },
  { type:'Core', name:'Quick Wits', effect:'+25% Spell Dmg when ES not low, -20% taken at Low ES' },
  { type:'Core', name:'Preparation', effect:'+1 Max ES per 50 Mana consumed recently' },
  { type:'Legendary Medium', name:'', effect:'+20% AS/CS at Full Mana, +15% Max Mana' },
  { type:'Legendary Medium', name:'', effect:'+20% Spell Dmg at Low Mana, +15% Max Mana' },
  { type:'Legendary Medium', name:'', effect:'+1 Mana per 6 Intelligence' },
  { type:'Legendary Medium', name:'', effect:'Consume 4% Mana on cast, +8% Spell Dmg' },
]
TALENT_NODES['Knowledge_Elementalist'] = [
  { type:'Core', name:'Translucent', effect:'Cyclic +25% Lightning/Cold/Fire if dealt other element' },
  { type:'Core', name:'Penetrating', effect:'+8% Elemental Dmg per Infiltration type on enemy' },
  { type:'Core', name:'Focus', effect:'+1 Max Channeled Stacks, +6% dmg per Channeled Stack' },
  { type:'Core', name:'Quick Ritual', effect:'Min Channeled +1, +20% Channeled Skill dmg' },
  { type:'Legendary Medium', name:'', effect:'+60% damage while standing still' },
  { type:'Legendary Medium', name:'', effect:'-5% Elemental taken per element received recently' },
  { type:'Legendary Medium', name:'', effect:'+1 to Max Channeled Stacks' },
  { type:'Legendary Medium', name:'', effect:'+40% additional Beam Length' },
  { type:'Legendary Medium', name:'', effect:'+1 Fire Skill Level' },
  { type:'Legendary Medium', name:'', effect:'+1 Lightning Skill Level' },
  { type:'Legendary Medium', name:'', effect:'+1 Cold Skill Level' },
]
TALENT_NODES['Knowledge_Prophet'] = [
  { type:'Core', name:'Frostbitten', effect:'Hit Cold inflicts Frostbite, +40% Frostbite Effect' },
  { type:'Core', name:'Extreme Coldness', effect:'+50 Max Frostbite, only Cold Damage' },
  { type:'Core', name:'Mind Blade', effect:'+30% Phys as Cold, +25% Cold dmg with Wand/Staff' },
  { type:'Core', name:'Frozen Lotus', effect:'+25% additional Cold Dmg, no Mana cost' },
  { type:'Legendary Medium', name:'', effect:'Inflicts Frostbite on Hit Cold' },
  { type:'Legendary Medium', name:'', effect:'Cold Infiltration on dmg to Frozen' },
  { type:'Legendary Medium', name:'', effect:'+10% additional dmg vs Frozen' },
  { type:'Legendary Medium', name:'', effect:'+20% Frostbite Effect' },
  { type:'Legendary Medium', name:'', effect:'Focus on dmg to Frostbitten enemy' },
  { type:'Legendary Medium', name:'', effect:'Convert 100% Phys to Cold' },
]

// ---- War ----
TALENT_NODES['War_God of War'] = [
  { type:'Core', name:'Cohesion', effect:'+50% additional Crit Rating every 1s for next Main Skill' },
  { type:'Core', name:'Blunt', effect:'+30% additional Physical Dmg, enemies +20% Injury Buffer' },
  { type:'Core', name:'Determined', effect:'50% chance to survive fatal hit with 1 Life' },
  { type:'Core', name:'Ambition', effect:'+100% chance gain 10 Fervor on hit' },
  { type:'Core', name:'Gravity', effect:'+25% Melee Dmg, reversed knockback' },
  { type:'Core', name:'Shooting Arrows', effect:'+25% Projectile Dmg, +50% Knockback' },
  { type:'Legendary Medium', name:'', effect:'10% restore 15% Life/ES/Mana on Block' },
  { type:'Legendary Medium', name:'', effect:'+1 Physical Skill Level' },
  { type:'Legendary Medium', name:'', effect:'+8% additional Physical Damage with Fervor' },
]
TALENT_NODES['War_Shadowdancer'] = [
  { type:'Core', name:'Brutality', effect:'+30% additional Physical Damage' },
  { type:'Legendary Medium', name:'', effect:'+5% additional Physical Damage per stack of Fervor' },
]
TALENT_NODES['War_Ranger'] = [
  { type:'Core', name:'Tactical', effect:'+15% additional Projectile Damage' },
]
TALENT_NODES['War_Ronin'] = [
  { type:'Core', name:'Lone Wolf', effect:'+20% additional damage when no Minions' },
]
TALENT_NODES['War_Sentinel'] = [
  { type:'Core', name:'Shield Wall', effect:'+15% additional Block Chance' },
]

// ---- Deception ----
TALENT_NODES['Deception_Goddess of Deception'] = [
  { type:'Core', name:'Plague', effect:'+20% MS when defeating Wilted, +15% Wilt Damage' },
  { type:'Core', name:'Mixture', effect:'+50% Deterioration Chance' },
  { type:'Core', name:'Affliction', effect:'+30 Affliction/sec, +30% Affliction effect' },
  { type:'Core', name:'Subtle Impact', effect:'+30% DoT dmg while Blur active' },
  { type:'Core', name:'Forbidden Power', effect:'+35% Erosion Dmg, -10% Elemental Res' },
  { type:'Legendary Medium', name:'', effect:'+100% chance Blur on defeat' },
  { type:'Legendary Medium', name:'', effect:'+18% Ill Omen Efficiency' },
  { type:'Legendary Medium', name:'', effect:'+1 Persistent Skill Level' },
  { type:'Legendary Medium', name:'', effect:'10% +1 Deterioration, -15% Deterioration Duration' },
]
TALENT_NODES['Deception_Shadowmaster'] = [
  { type:'Core', name:'Dirt', effect:'+15% Erosion Dmg, 10% dmg applied to Life' },
  { type:'Core', name:'Stealth Stab', effect:'-15% dmg taken with Blur, +25% dmg 3s after Blur ends' },
  { type:'Core', name:'Beyond Cure', effect:'Up to +60% Wilt Dmg vs high Life enemies' },
  { type:'Core', name:'Twisted Belief', effect:'+3 Erosion Skill Level, -5% Max Erosion Res' },
  { type:'Legendary Medium', name:'', effect:'Immune to Wilt, Minions immune to Erosion' },
  { type:'Legendary Medium', name:'', effect:'Gains Profane when inflicting Wilt/Deterioration' },
  { type:'Legendary Medium', name:'', effect:'+1 Erosion Skill Level' },
  { type:'Legendary Medium', name:'', effect:'Gains Blur per 5 Wilt stacks' },
  { type:'Legendary Medium', name:'', effect:'Convert 100% Phys to Erosion' },
]
TALENT_NODES['Deception_Psychic'] = [
  { type:'Core', name:'Windwalk', effect:'+60% Reaping Duration vs max Affliction, 4s' },
  { type:'Core', name:'Holiness', effect:'-95% Curse on you, -15% dmg from Cursed' },
  { type:'Core', name:'Inexorable Doom', effect:'+1 Ill Omen stacks, spreads to nearby' },
  { type:'Core', name:'Reap Purification', effect:'Ill Omen deals 4% Max Life True Dmg per stack' },
]
TALENT_NODES['Deception_Warlock'] = [
  { type:'Core', name:'Verbal Abuse', effect:'+1 Curse, +10% Curse Effect' },
  { type:'Core', name:'Vile', effect:'+10% Reaping Duration per Damaging Ailment type' },
  { type:'Core', name:'Dirty Tricks', effect:'+12% Hit Dmg per Ailment type on enemy' },
  { type:'Core', name:'Daze', effect:'+40% CC Effect, +25% Ailment Dmg while Blur' },
  { type:'Legendary Medium', name:'', effect:'+8% additional dmg vs Cursed' },
  { type:'Legendary Medium', name:'', effect:'+30% chance Damaging Ailments (reflected)' },
]
TALENT_NODES['Deception_Lich'] = [
  { type:'Core', name:'Indifference', effect:'+1% dmg per 5 Energy, up to +50%' },
  { type:'Core', name:'Ward', effect:'+13% Sealed Mana as ES, +13% Sealed Life as ES' },
  { type:'Core', name:'Off The Beaten Track', effect:'+4 Support Skill Level, Mana Mult fixed 95%' },
  { type:'Core', name:'Stab In The Back', effect:'Lose Blur on cast for +40% dmg' },
  { type:'Legendary Medium', name:'', effect:'+1 All Skills Level' },
  { type:'Legendary Medium', name:'', effect:'+8% CDR, +1 Max Charges' },
]

// ---- Machines ----
TALENT_NODES['Machines_God of Machines'] = [
  { type:'Core', name:'Orders', effect:'+25% Minion Dmg, -90% dmg taken by Minions' },
  { type:'Core', name:'Sentry', effect:'+1 Max Sentry, +100% Cast Speed for Sentry' },
  { type:'Core', name:'Shrink Back', effect:'Gains Barrier/sec, +50% Barrier Shield' },
  { type:'Core', name:'Mighty Guard', effect:'+2 Minion Skill Level, +40 initial Growth' },
  { type:'Core', name:'Overly Modified', effect:'+30% Sentry Dmg, -50% non-Sentry Active dmg' },
  { type:'Legendary Medium', name:'', effect:'+1 Minion Skill Level' },
  { type:'Legendary Medium', name:'', effect:'Gains Attack Aggression on Minion Crit' },
  { type:'Legendary Medium', name:'', effect:'Gains Spell Aggression on Minion Spell Crit' },
]
TALENT_NODES['Machines_Machinist'] = [
  { type:'Core', name:'Boss', effect:'+1 Max Summonable Synthetic Troops' },
]
TALENT_NODES['Machines_Artisan'] = [
  { type:'Legendary Medium', name:'', effect:'+8% Barrier Absorption Rate' },
  { type:'Legendary Medium', name:'', effect:'+40% Barrier Shield' },
]
TALENT_NODES['Machines_Alchemist'] = [
  { type:'Core', name:'Potion Master', effect:'+30% Elixir Effect' },
]
TALENT_NODES['Machines_Steel Vanguard'] = [
  { type:'Core', name:'Bastion', effect:'+20% additional Armor' },
]

// ---- New God ----
TALENT_NODES['New God_New God'] = [
  { type:'Core', name:'Dying Dragon', effect:'+60% Skill Area, +30% dmg after devouring Tenacity' },
  { type:'Core', name:'Falling Stars', effect:'Next hits don\'t lose Deflection after devouring Agility' },
  { type:'Core', name:'Broken Dream', effect:'+100% Double Dmg after devouring Focus' },
  { type:'Core', name:'End of War', effect:'+1% additional Crit Dmg per Fervor devoured' },
  { type:'Core', name:'Revealed Truth', effect:'1.5% avoid Ailments/CC per Blur Rating devoured' },
  { type:'Core', name:'Ruined City', effect:'Restores 1.5 Life/ES per Barrier devoured' },
]


// ---- Helper functions ----
export function getGodColor(god) {
  if (!god || !GOD_COLORS[god]) return GOD_COLORS['Might']
  return GOD_COLORS[god]
}

export function getSlateColor(slate) {
  if (slate.isNetherKing) return NETHER_KING_COLOR
  if (slate.isLegendary) return LEGENDARY_SLATE_COLOR
  return getGodColor(slate.god)
}

/**
 * Calculate edge detection for a placed slate's cells.
 * Returns an object where keys are "row,col" and values are {top,right,bottom,left} booleans.
 * A cell edge is true (visible) if the adjacent cell in that direction is NOT part of the same slate.
 */
export function computeSlateEdges(placedSlates, inventory) {
  const occupiedBy = {} // "row,col" -> slateId
  for (const p of placedSlates) {
    const slate = inventory.find(s => s.id === p.slateId)
    if (!slate) continue
    const cells = getShapeCells(slate.shape, slate.rotation, slate.flippedH, slate.flippedV)
    for (const [r, c] of cells) {
      const key = `${p.row + r},${p.col + c}`
      occupiedBy[key] = p.slateId
    }
  }
  const edges = {} // "row,col" -> {top,right,bottom,left}
  for (const p of placedSlates) {
    const slate = inventory.find(s => s.id === p.slateId)
    if (!slate) continue
    const cells = getShapeCells(slate.shape, slate.rotation, slate.flippedH, slate.flippedV)
    for (const [r, c] of cells) {
      const key = `${p.row + r},${p.col + c}`
      edges[key] = {
        top: occupiedBy[`${p.row + r - 1},${p.col + c}`] !== p.slateId,
        bottom: occupiedBy[`${p.row + r + 1},${p.col + c}`] !== p.slateId,
        left: occupiedBy[`${p.row + r},${p.col + c - 1}`] !== p.slateId,
        right: occupiedBy[`${p.row + r},${p.col + c + 1}`] !== p.slateId,
      }
    }
  }
  return edges
}

/**
 * Find overlapping cells (multiple slates on same cell)
 */
export function findOverlappingCells(placedSlates, inventory) {
  const occupancy = {} // "row,col" -> count
  for (const p of placedSlates) {
    const slate = inventory.find(s => s.id === p.slateId)
    if (!slate) continue
    const cells = getShapeCells(slate.shape, slate.rotation, slate.flippedH, slate.flippedV)
    for (const [r, c] of cells) {
      const key = `${p.row + r},${p.col + c}`
      occupancy[key] = (occupancy[key] || 0) + 1
    }
  }
  return Object.entries(occupancy).filter(([,count]) => count > 1).map(([key]) => {
    const [r, c] = key.split(',').map(Number)
    return { row: r, col: c }
  })
}

/**
 * Find out-of-bounds cells
 */
export function findOutOfBoundsCells(placedSlates, inventory) {
  const invalid = []
  for (const p of placedSlates) {
    const slate = inventory.find(s => s.id === p.slateId)
    if (!slate) continue
    const cells = getShapeCells(slate.shape, slate.rotation, slate.flippedH, slate.flippedV)
    for (const [r, c] of cells) {
      const row = p.row + r
      const col = p.col + c
      if (!isValidGridCell(row, col)) {
        invalid.push({ row, col })
      }
    }
  }
  return invalid
}

export function getTrees(god) {
  return TREES[god] || []
}

export function getTalentNodes(god, tree) {
  const key = `${god}_${tree}`
  return TALENT_NODES[key] || []
}

export function getAllTalentNodes(god) {
  const trees = getTrees(god)
  return trees.flatMap(tree => getTalentNodes(god, tree))
}

export function getNodesByType(god, tree, type) {
  return getTalentNodes(god, tree).filter(n => n.type === type)
}

export function getShapeCells(shape, rotation = 0, flippedH = false, flippedV = false) {
  const def = SHAPE_DEFS[shape]
  if (!def) return []
  let cells = def.cells.map(([r, c]) => [r, c])

  if (flippedV) cells = cells.map(([r, c]) => [-r, c])
  if (flippedH) cells = cells.map(([r, c]) => [r, -c])

  for (let i = 0; i < (rotation / 90) % 4; i++) {
    cells = cells.map(([r, c]) => [c, -r])
  }

  const minR = Math.min(...cells.map(([r]) => r))
  const minC = Math.min(...cells.map(([, c]) => c))
  return cells.map(([r, c]) => [r - minR, c - minC])
}

export function getShapeBounds(shape, rotation = 0, flippedH = false, flippedV = false) {
  const cells = getShapeCells(shape, rotation, flippedH, flippedV)
  const rows = Math.max(...cells.map(([r]) => r)) + 1
  const cols = Math.max(...cells.map(([, c]) => c)) + 1
  return { rows, cols }
}

export function getShapeLabel(shape) {
  return SHAPE_DEFS[shape]?.label || shape
}

let _slateIdCounter = 0
export function createSlateId() {
  return `slate-${Date.now().toString(36)}-${++_slateIdCounter}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptySlate(shape = 'O', god = 'Might') {
  const def = SHAPE_DEFS[shape]
  const cellCount = def ? def.cells.length : 4
  const affixes = Array.from({ length: cellCount }, (_, i) => ({
    slotIndex: i,
    node: null, // { type, name, effect }
    isUsed: false,
  }))
  return {
    id: createSlateId(),
    god,
    shape,
    rotation: 0,
    flippedH: false,
    flippedV: false,
    affixes,
    isLegendary: false,
    legendaryName: undefined,
  }
}
