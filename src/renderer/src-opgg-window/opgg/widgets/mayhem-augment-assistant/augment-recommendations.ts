import type { OpggAramMayhemChampionAugmentsResponse } from '@shared/types/opgg'
import type { ResgChampionGuide, ResgGuideAugmentCombo } from '@shared/types/resg'

/** 单个候选强化在当前数据源下的统计。 */
export interface AugmentCandidateStats {
  /** RESG：样本场次。 */
  play: number | null
  /** RESG：胜率，0 到 1。 */
  winRate: number | null
  /** RESG：选取率，0 到 1。 */
  pickRate: number | null
  /** RESG：在当前英雄单海克斯榜中的名次。 */
  rank: number | null
  /** OP.GG / 101：梯队编号，0 为最高。 */
  tier: number | null
  /** OP.GG / 101：表现分。 */
  performance: number | null
  /** OP.GG / 101：热度。 */
  popular: number | null
}

/** 面向 UI 的候选强化推荐条目。 */
export interface AugmentCandidate {
  augmentId: number
  /** 该候选是否由玩家录入为本轮可选项；`false` 表示由统计榜单补充的推荐。 */
  offered: boolean
  stats: AugmentCandidateStats
  /**
   * RESG 中同时包含“已选强化 + 该候选”的组合，按胜率降序。
   * 只在 RESG 数据可用时非空。
   */
  combos: ResgGuideAugmentCombo[]
  /** 用于排序的综合分；不同数据源含义不同，只在同一来源内比较。 */
  score: number
}

export interface BuildAugmentCandidatesInput {
  /** 玩家录入的本轮候选；为空时从统计榜单补充推荐。 */
  offeredAugmentIds: number[]
  /** 之前轮次已经选择的强化，用于筛选组合并排除重复推荐。 */
  pickedAugmentIds: number[]
  /** RESG 英雄详情；RESG 通道下提供。 */
  resgGuide: ResgChampionGuide | null
  /** OP.GG / 101 的海克斯榜；champion-data 通道下提供。 */
  kiwiAugments: OpggAramMayhemChampionAugmentsResponse | null
  /** 没有录入候选时最多补充的推荐数量。 */
  suggestionLimit?: number
}

const EMPTY_STATS: AugmentCandidateStats = {
  play: null,
  winRate: null,
  pickRate: null,
  rank: null,
  tier: null,
  performance: null,
  popular: null
}

/**
 * 找出 RESG 中包含全部给定强化的组合，按胜率降序。
 *
 * @param combos RESG 组合列表。
 * @param requiredAugmentIds 组合必须包含的强化 ID。
 * @returns 满足条件的组合；`requiredAugmentIds` 为空时返回空数组，避免把全部组合当作推荐。
 */
export function findCombosContaining(
  combos: ResgGuideAugmentCombo[],
  requiredAugmentIds: number[]
): ResgGuideAugmentCombo[] {
  if (requiredAugmentIds.length === 0) {
    return []
  }

  const required = new Set(requiredAugmentIds)
  return combos
    .filter((combo) => {
      const ids = new Set(combo.augmentIds)
      for (const id of required) {
        if (!ids.has(id)) return false
      }
      return true
    })
    .toSorted((left, right) => right.winRate - left.winRate || right.play - left.play)
}

/**
 * 为一轮强化选择生成候选列表及其统计。
 *
 * 有录入候选时只评估这些候选；否则按当前数据源榜单补充推荐（排除已选）。
 * RESG 通道额外给出包含“已选 + 候选”的组合，作为多海克斯搭配推荐。
 *
 * @param input 候选、已选和两种数据源的数据。
 * @returns 按综合分降序排列的候选列表。
 */
export function buildAugmentCandidates(input: BuildAugmentCandidatesInput): AugmentCandidate[] {
  const { offeredAugmentIds, pickedAugmentIds, resgGuide, kiwiAugments } = input
  const suggestionLimit = input.suggestionLimit ?? 8
  const picked = new Set(pickedAugmentIds)

  const resgStats = new Map(resgGuide?.augments.map((item) => [item.id, item]) ?? [])
  const kiwiStats = new Map(kiwiAugments?.data.map((item) => [item.id, item]) ?? [])

  let candidateIds: number[]
  let offered: boolean
  if (offeredAugmentIds.length > 0) {
    candidateIds = offeredAugmentIds
    offered = true
  } else {
    offered = false
    if (resgGuide) {
      candidateIds = resgGuide.augments
        .filter((item) => !picked.has(item.id))
        .toSorted((left, right) => right.winRate - left.winRate)
        .slice(0, suggestionLimit)
        .map((item) => item.id)
    } else if (kiwiAugments) {
      candidateIds = kiwiAugments.data
        .filter((item) => !picked.has(item.id))
        .toSorted(
          (left, right) =>
            (left.tier ?? Infinity) - (right.tier ?? Infinity) ||
            right.performance - left.performance
        )
        .slice(0, suggestionLimit)
        .map((item) => item.id)
    } else {
      candidateIds = []
    }
  }

  const candidates = candidateIds.map((augmentId): AugmentCandidate => {
    const resg = resgStats.get(augmentId)
    const kiwi = kiwiStats.get(augmentId)
    const combos = resgGuide
      ? findCombosContaining(resgGuide.augmentCombos, [...pickedAugmentIds, augmentId])
      : []

    const stats: AugmentCandidateStats = {
      ...EMPTY_STATS,
      play: resg?.play ?? null,
      winRate: resg?.winRate ?? null,
      pickRate: resg?.pickRate ?? null,
      rank: resg?.rank ?? null,
      tier: kiwi?.tier ?? null,
      performance: kiwi?.performance ?? null,
      popular: kiwi?.popular ?? null
    }

    // RESG 以“最佳组合胜率”优先，其次单体胜率；OP.GG/101 以梯队和表现分排序。
    const score = resgGuide
      ? (combos[0]?.winRate ?? stats.winRate ?? -1)
      : stats.tier !== null
        ? 100 - stats.tier * 10 + (stats.performance ?? 0) / 1000
        : (stats.performance ?? -1)

    return { augmentId, offered, stats, combos, score }
  })

  // 综合分相同时退回单体胜率 / 表现分，保证排序稳定且可解释。
  return candidates.toSorted(
    (left, right) =>
      right.score - left.score ||
      (right.stats.winRate ?? -1) - (left.stats.winRate ?? -1) ||
      (right.stats.performance ?? -1) - (left.stats.performance ?? -1)
  )
}
