// 技能等级词缀消费判定的单一来源。
// 真正的解析在 skillLevelBonus.collectSkillLevelAffixes（供技能页等级加成）；
// 本模块只导出「哪些词缀文本参与技能等级计算」的判定与共享正则，
// 供 skillLevelBonus 与 affixConsumers（词缀统计/未计入面板）复用，避免消费逻辑两处重写。

// 词缀段分隔符：词缀文本用 ; 或 ； 连接多个效果，仅统计以「数字开头」的技能等级段
const SEG_SPLIT_RE = /[;；]/

// 「技能等级」段正则：如 +1魔灵技能等级 / -5光环技能等级 / +1全部技能等级
export const SKILL_LEVEL_SEG_RE = /^([+-]?\d+(?:\.\d+)?)\s*([\u4e00-\u9fff]+?)技能等级/

// 条件句式（每拥有… / 每个…）以非数字开头，被 SEG_SPLIT + 开头锚点排除

// 判定一条词缀文本是否被技能等级计算计入：任一分段命中「技能等级±N」即视为消费。
export function consumesSkillLevelAffix(text) {
  const t = String(text || '')
  if (!t.includes('技能等级')) return false
  for (const seg of t.split(SEG_SPLIT_RE)) {
    if (SKILL_LEVEL_SEG_RE.test(seg.trim())) return true
  }
  return false
}
