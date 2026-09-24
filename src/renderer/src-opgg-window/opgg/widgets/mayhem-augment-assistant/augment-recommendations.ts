import type { OpggAramMayhemChampionAugmentsResponse } from '@shared/types/opgg'
import type { ResgChampionGuide, ResgGuideAugmentCombo, ResgGuideBuild } from '@shared/types/resg'

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
  /**
   * 该候选没有热门组合时仍可沿用的出装推进。
   * 来自英雄的核心装备路径，不依赖它是否进入某个组合。
   */
  itemProgression: ResgGuideBuild[]
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

/**
 * 胜率的 Wilson 95% 置信下界。
 *
 * 用于对小样本降权：11 场 90% 的组合不应排在 3000 场 60% 的组合前面。
 *
 * @param winRate 胜率，0 到 1。
 * @param play 样本场次。
 * @returns 置信下界，0 到 1；样本为 0 时返回 0。
 */
export function wilsonLowerBound(winRate: number, play: number): number {
  if (play <= 0) return 0
  const z = 1.96
  const z2 = z * z
  const denominator = 1 + z2 / play
  const center = winRate + z2 / (2 * play)
  const margin = z * Math.sqrt((winRate * (1 - winRate)) / play + z2 / (4 * play * play))
  return Math.max(0, (center - margin) / denominator)
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
 * 找出 RESG 中包含全部给定强化的组合，按胜率置信下界降序（小样本自动靠后）。
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
      // 单个强化不构成“组合”，其统计已由单体榜给出。
      if (combo.augmentIds.length < 2) return false
      const ids = new Set(combo.augmentIds)
      for (const id of required) {
        if (!ids.has(id)) return false
      }
      return true
    })
    .toSorted(
      (left, right) =>
        wilsonLowerBound(right.winRate, right.play) - wilsonLowerBound(left.winRate, left.play) ||
        right.play - left.play
    )
}

/**
 * 为某个候选找出仍能成立的组合。
 *
 * 已选里若有强化进不了任何包含该候选的热门组合，就不再拿它当必选条件；
 * 其余已选仍要同时出现在组合里。这样一次一般的选择不会挡住其他强化继续搭配。
 * 若这些能搭配的已选无法同时出现在同一条组合中，则分别保留各自能成立的组合。
 *
 * @param combos RESG 组合列表。
 * @param pickedAugmentIds 之前轮次已经选择的强化。
 * @param candidateId 本轮正在评估的候选强化。
 * @returns 按胜率置信下界降序的组合；候选本身不在任何组合中时返回空数组。
 */
export function findCombosForCandidate(
  combos: ResgGuideAugmentCombo[],
  pickedAugmentIds: number[],
  candidateId: number
): ResgGuideAugmentCombo[] {
  const withCandidate = combos.filter(
    (combo) => combo.augmentIds.length >= 2 && combo.augmentIds.includes(candidateId)
  )
  const viablePicks = pickedAugmentIds.filter((id) =>
    withCandidate.some((combo) => combo.augmentIds.includes(id))
  )
  const matched = findCombosContaining(withCandidate, [candidateId, ...viablePicks])
  if (matched.length > 0 || viablePicks.length === 0) {
    return matched
  }

  const viable = new Set(viablePicks)
  return withCandidate
    .filter((combo) => combo.augmentIds.some((id) => viable.has(id)))
    .toSorted(
      (left, right) =>
        overlapCount(right.augmentIds, viable) - overlapCount(left.augmentIds, viable) ||
        wilsonLowerBound(right.winRate, right.play) - wilsonLowerBound(left.winRate, left.play) ||
        right.play - left.play
    )
}

/**
 * 统计组合里覆盖了多少个仍能搭配的已选强化。
 *
 * @param augmentIds 组合内的强化 ID。
 * @param viablePicks 与当前候选存在共同组合的已选强化。
 * @returns 覆盖数量。
 */
function overlapCount(augmentIds: number[], viablePicks: Set<number>): number {
  return augmentIds.filter((id) => viablePicks.has(id)).length
}

/**
 * 为一轮强化选择生成候选列表及其统计。
 *
 * 有录入候选时只评估这些候选；否则按当前数据源榜单补充推荐（排除已选）。
 * RESG 通道给出与该候选仍能成立的组合；进不了热门组合时保留英雄出装推进。
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
        .toSorted(
          (left, right) =>
            wilsonLowerBound(right.winRate, right.play) - wilsonLowerBound(left.winRate, left.play)
        )
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
      ? findCombosForCandidate(resgGuide.augmentCombos, pickedAugmentIds, augmentId)
      : []
    const itemProgression =
      resgGuide && combos.every((combo) => combo.builds.length === 0) ? resgGuide.itemBuilds : []

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

    // RESG 以“最佳组合”的胜率置信下界优先，没有组合时退回单体置信下界；
    // OP.GG/101 以梯队和表现分排序。
    const score = resgGuide
      ? combos[0]
        ? wilsonLowerBound(combos[0].winRate, combos[0].play)
        : resg
          ? wilsonLowerBound(resg.winRate, resg.play)
          : -1
      : stats.tier !== null
        ? 100 - stats.tier * 10 + (stats.performance ?? 0) / 1000
        : (stats.performance ?? -1)

    return { augmentId, offered, stats, combos, itemProgression, score }
  })

  // 综合分相同时退回单体胜率 / 表现分，保证排序稳定且可解释。
  return candidates.toSorted(
    (left, right) =>
      right.score - left.score ||
      (right.stats.winRate ?? -1) - (left.stats.winRate ?? -1) ||
      (right.stats.performance ?? -1) - (left.stats.performance ?? -1)
  )
}
