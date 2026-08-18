import type {
  ResgAugment,
  ResgAugmentCombo,
  ResgAugmentItemBuild,
  ResgChampionGuide,
  ResgChampionIndexItem,
  ResgChampionIndexResponse,
  ResgChampionSummary,
  ResgGuideAugment,
  ResgGuideAugmentCombo,
  ResgGuideBuild,
  ResgGuideItemCombo,
  ResgGuideItemStat,
  ResgGuideLinkedBuild,
  ResgItemCombo,
  ResgItemStat,
  ResgNamedResource,
  ResgRankedBuild,
  ResgRecommendedAugment,
  ResgVersionItem
} from '@shared/types/resg'

/**
 * 校验并整理 RESG 版本索引。
 *
 * @param response 未经信任的 RESG JSON 响应。
 * @returns 结构合法且版本号可解析的版本项。
 */
export function adaptResgVersions(response: unknown): ResgVersionItem[] {
  if (!Array.isArray(response)) {
    return []
  }

  return response.filter(
    (item): item is ResgVersionItem =>
      isRecord(item) &&
      typeof item.version === 'string' &&
      /^\d+(?:\.\d+)*$/.test(item.version) &&
      typeof item.collectedAt === 'string'
  )
}

/**
 * 校验并整理 RESG 英雄列表。
 *
 * @param response 未经信任的 RESG JSON 响应。
 * @returns 至少含一个合法英雄时返回标准列表，否则返回 `null`。
 */
export function adaptResgChampionIndex(response: unknown): ResgChampionIndexResponse | null {
  if (!isRecord(response) || !Array.isArray(response.items)) {
    return null
  }

  const items = response.items.filter(isChampionIndexItem)
  return items.length > 0 ? { items } : null
}

/**
 * 从 RESG 版本索引中选择数值最大的主次版本。
 *
 * @param versions RESG 版本索引；数组顺序不作为新旧依据。
 * @returns 最新版本号；列表为空或没有合法版本时返回 `null`。
 */
export function selectLatestResgVersion(versions: ResgVersionItem[]): string | null {
  return (
    versions
      .map((item) => item.version)
      .filter((version) => /^\d+(?:\.\d+)*$/.test(version))
      .toSorted(compareVersions)
      .at(-1) ?? null
  )
}

/**
 * 把 RESG 英雄详情转换为攻略窗口使用的稳定视图模型。
 *
 * 转换会在信任边界校验所有被消费的嵌套字段，去掉传输层图标路径，并把当前版本的海克斯关联出装整理成可展示和写入客户端的装备组。
 *
 * @param response 未经信任的 RESG 英雄详情 JSON。
 * @param version 该响应对应的 RESG 数据版本。
 * @returns 标准化攻略；英雄或详情结构非法时返回 `null`。
 */
export function adaptResgChampionGuide(
  response: unknown,
  version: string
): ResgChampionGuide | null {
  if (!isRecord(response) || !isChampionSummary(response.champion)) {
    return null
  }

  const builds = isRecord(response.builds) ? response.builds : {}
  const itemAnalysis = isRecord(response.itemAnalysis) ? response.itemAnalysis : {}
  const augmentCombos = toGuideAugmentCombos(response.augmentCombos)
  const itemCombos = toGuideItemCombos(itemAnalysis.combos)

  return {
    version,
    champion: response.champion,
    spells: toGuideBuilds(builds.SPELLS),
    skillOrders: toGuideBuilds(builds.SKILL_ORDER),
    starterItems: toGuideBuilds(response.startingItems),
    boots: toGuideBuilds(builds.BOOTS),
    augments: toGuideAugments(response.recommendedAugments),
    augmentCombos,
    itemCombos,
    items: toGuideItems(itemAnalysis.items),
    itemBuilds: collectItemBuilds(itemCombos, response.augmentCombos)
  }
}

/**
 * 判断标准化后的 RESG 攻略是否包含用户可消费的数据。
 *
 * @param guide 待检查的标准化攻略。
 * @returns 至少存在召唤师技能、技能优先级、装备或海克斯组合时返回 `true`。
 */
export function isResgGuideUsable(guide: ResgChampionGuide): boolean {
  return (
    guide.spells.length > 0 ||
    guide.skillOrders.length > 0 ||
    guide.starterItems.length > 0 ||
    guide.boots.length > 0 ||
    guide.augments.length > 0 ||
    guide.augmentCombos.length > 0 ||
    guide.itemCombos.length > 0 ||
    guide.items.length > 0 ||
    guide.itemBuilds.length > 0
  )
}

/** 按数字段逐段比较版本号。 */
function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }

  return 0
}

/** 把通用排名行转换成攻略窗口模型。 */
function toGuideBuilds(rows: unknown): ResgGuideBuild[] {
  if (!Array.isArray(rows)) {
    return []
  }

  return rows.filter(isRankedBuild).map((row) => ({
    rank: row.rank,
    ids: row.value.map((item) => item.id).filter((id) => id > 0),
    names: row.value.map((item) => item.name),
    play: row.totalMatches,
    winRate: row.winRate,
    pickRate: row.pickRate
  }))
}

/** 把独立海克斯统计转换为攻略窗口模型。 */
function toGuideAugments(augments: unknown): ResgGuideAugment[] {
  if (!Array.isArray(augments)) {
    return []
  }

  return augments
    .filter(isRecommendedAugment)
    .toSorted((left, right) => right.pickRate - left.pickRate)
    .map((augment, index) => ({
      rank: index + 1,
      id: augment.id,
      name: augment.name,
      play: augment.totalMatches,
      winRate: augment.winRate,
      pickRate: augment.pickRate
    }))
}

/** 判断海克斯组合是否至少含一个有效强化。 */
function hasUsableAugments(combo: ResgAugmentCombo): boolean {
  return combo.augments.some((augment) => augment.id > 0)
}

/** 按海克斯数量分组并转换全部合法组合。 */
function toGuideAugmentCombos(groups: unknown): ResgGuideAugmentCombo[] {
  const combos = collectValidAugmentCombos(groups).filter(hasUsableAugments)
  const sizes = [...new Set(combos.map((combo) => combo.size))].toSorted(
    (left, right) => left - right
  )

  return sizes.flatMap((size) =>
    combos
      .filter((combo) => combo.size === size)
      .toSorted((left, right) => left.rank - right.rank)
      .map(toGuideAugmentCombo)
  )
}

/** 把海克斯组合及其关联出装转换成只依赖 Riot ID 的视图模型。 */
function toGuideAugmentCombo(combo: ResgAugmentCombo): ResgGuideAugmentCombo {
  return {
    rank: combo.rank,
    size: combo.size,
    augmentIds: combo.augments.map((augment) => augment.id),
    augmentNames: combo.augments.map((augment) => augment.name),
    play: combo.totalMatches,
    winRate: combo.winRate,
    builds: combo.builds
      .map(toGuideLinkedBuild)
      .filter((build) => build.ids.length > 0)
      .toSorted((left, right) => right.play - left.play)
  }
}

/** 把海克斯组合关联出装转换成稳定视图模型。 */
function toGuideLinkedBuild(build: ResgAugmentItemBuild): ResgGuideLinkedBuild {
  const items = build.items.filter((item) => item.id > 0)
  return {
    ids: items.map((item) => item.id),
    names: items.map((item) => item.name),
    play: build.total_matches,
    winRate: build.win_rate
  }
}

/** 按装备数量分组并保留全部合法核心装备组合。 */
function toGuideItemCombos(groups: unknown): ResgGuideItemCombo[] {
  return recordArrayValues(groups)
    .filter(isItemCombo)
    .map((combo) => ({
      rank: combo.rank,
      size: combo.size,
      ids: combo.items.map((item) => item.id).filter((id) => id > 0),
      names: combo.items.map((item) => item.name),
      play: combo.totalMatches,
      winRate: combo.winRate,
      pickRate: combo.pickRate
    }))
    .filter((combo) => combo.ids.length > 0)
    .toSorted((left, right) => left.size - right.size || left.rank - right.rank)
}

/** 把单件装备统计转换成稳定视图模型。 */
function toGuideItems(rows: unknown): ResgGuideItemStat[] {
  if (!Array.isArray(rows)) {
    return []
  }

  return rows
    .filter(isItemStat)
    .map((row) => ({
      rank: row.rank,
      id: row.item.id,
      name: row.item.name,
      play: row.totalMatches,
      win: row.winMatches,
      winRate: row.winRate,
      pickRate: row.pickRate
    }))
    .toSorted((left, right) => left.rank - right.rank)
}

/** 从独立装备分析中选取各阶段首选组合，旧响应则回退到海克斯关联出装。 */
function collectItemBuilds(
  itemCombos: ResgGuideItemCombo[],
  augmentGroups: unknown
): ResgGuideBuild[] {
  const analyzedBuilds = itemCombos
    .filter((combo) => combo.size >= 2)
    .reduce<Map<number, ResgGuideItemCombo>>((bestBySize, combo) => {
      const current = bestBySize.get(combo.size)
      if (!current || combo.play > current.play) {
        bestBySize.set(combo.size, combo)
      }
      return bestBySize
    }, new Map())

  const analyzedGuideBuilds = [...analyzedBuilds.values()]
    .toSorted((left, right) => left.size - right.size)
    .map((combo, index) => ({
      rank: index + 1,
      ids: combo.ids,
      names: combo.names,
      play: combo.play,
      winRate: combo.winRate,
      pickRate: combo.pickRate
    }))

  if (analyzedGuideBuilds.length > 0) {
    return analyzedGuideBuilds
  }

  const uniqueBuilds = new Map<string, ResgGuideBuild>()

  for (const combo of collectValidAugmentCombos(augmentGroups)) {
    for (const build of combo.builds) {
      const items = build.items.filter((item) => item.id > 0)
      const ids = items.map((item) => item.id)
      if (ids.length === 0) {
        continue
      }

      const key = ids.join('-')
      const previous = uniqueBuilds.get(key)
      if (!previous || build.total_matches > previous.play) {
        uniqueBuilds.set(key, {
          rank: 0,
          ids,
          names: items.map((item) => item.name),
          play: build.total_matches,
          winRate: build.win_rate,
          pickRate: null
        })
      }
    }
  }

  return [...uniqueBuilds.values()]
    .toSorted((left, right) => right.play - left.play)
    .map((build, index) => ({ ...build, rank: index + 1 }))
}

/** 返回对象中所有数组元素；其它输入视为空集合。 */
function recordArrayValues(value: unknown): unknown[] {
  if (!isRecord(value)) {
    return []
  }

  return Object.values(value).flatMap((group) => (Array.isArray(group) ? group : []))
}

/** 判断值是否为普通键值对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 判断值是否为有限数字。 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 判断值是否为 0 到 1 的比率。 */
function isRate(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1
}

/** 校验英雄列表行。 */
function isChampionIndexItem(value: unknown): value is ResgChampionIndexItem {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    (value.id as number) > 0 &&
    typeof value.name === 'string' &&
    typeof value.title === 'string' &&
    typeof value.alias === 'string' &&
    Array.isArray(value.roles) &&
    value.roles.every((role) => typeof role === 'string') &&
    isFiniteNumber(value.totalMatches) &&
    isFiniteNumber(value.winMatches) &&
    isRate(value.winRate) &&
    typeof value.tier === 'string'
  )
}

/** 校验单英雄基础信息。 */
function isChampionSummary(value: unknown): value is ResgChampionSummary {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    (value.id as number) > 0 &&
    typeof value.name === 'string' &&
    typeof value.title === 'string' &&
    typeof value.alias === 'string' &&
    Array.isArray(value.roles) &&
    value.roles.every((role) => typeof role === 'string') &&
    isFiniteNumber(value.totalMatches) &&
    typeof value.tier === 'string'
  )
}

/** 校验一个 Riot 资源引用。 */
function isNamedResource(value: unknown): value is ResgNamedResource {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    (value.id as number) >= 0 &&
    typeof value.name === 'string'
  )
}

/** 校验通用排名行。 */
function isRankedBuild(value: unknown): value is ResgRankedBuild {
  return (
    isRecord(value) &&
    Number.isInteger(value.rank) &&
    (value.rank as number) > 0 &&
    Array.isArray(value.value) &&
    value.value.length > 0 &&
    value.value.every(isNamedResource) &&
    isFiniteNumber(value.totalMatches) &&
    value.totalMatches >= 0 &&
    isRate(value.winRate) &&
    isRate(value.pickRate)
  )
}

/** 校验海克斯强化。 */
function isAugment(value: unknown): value is ResgAugment {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    (value.id as number) > 0 &&
    typeof value.name === 'string' &&
    isFiniteNumber(value.quality)
  )
}

/** 校验单件装备统计。 */
function isItemStat(value: unknown): value is ResgItemStat {
  return (
    isRecord(value) &&
    Number.isInteger(value.rank) &&
    (value.rank as number) > 0 &&
    isItemResource(value.item) &&
    isFiniteNumber(value.totalMatches) &&
    value.totalMatches >= 0 &&
    isFiniteNumber(value.winMatches) &&
    value.winMatches >= 0 &&
    isRate(value.winRate) &&
    isRate(value.pickRate)
  )
}

/** 校验带独立统计的海克斯强化。 */
function isRecommendedAugment(value: unknown): value is ResgRecommendedAugment {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    (value.id as number) > 0 &&
    typeof value.name === 'string' &&
    isFiniteNumber(value.quality) &&
    isFiniteNumber(value.totalMatches) &&
    value.totalMatches >= 0 &&
    isRate(value.winRate) &&
    isRate(value.pickRate)
  )
}

/** 校验装备资源引用；装备 ID 必须为正数。 */
function isItemResource(value: unknown): value is ResgNamedResource {
  return isNamedResource(value) && value.id > 0
}

/** 校验海克斯组合关联出装。 */
function isAugmentItemBuild(value: unknown): value is ResgAugmentItemBuild {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.length > 0 &&
    value.items.every(isItemResource) &&
    isFiniteNumber(value.total_matches) &&
    value.total_matches >= 0 &&
    isRate(value.win_rate)
  )
}

type ResgAugmentComboCandidate = Omit<ResgAugmentCombo, 'builds'> & { builds: unknown[] }

/** 校验海克斯组合本体；关联出装由子项校验独立过滤。 */
function isAugmentComboCandidate(value: unknown): value is ResgAugmentComboCandidate {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    Number.isInteger(value.rank) &&
    (value.rank as number) > 0 &&
    Number.isInteger(value.size) &&
    (value.size as number) >= 1 &&
    (value.size as number) <= 4 &&
    Array.isArray(value.augments) &&
    value.augments.length === value.size &&
    value.augments.every(isAugment) &&
    isFiniteNumber(value.totalMatches) &&
    value.totalMatches >= 0 &&
    isRate(value.winRate) &&
    Array.isArray(value.builds)
  )
}

/** 保留合法海克斯组合，并仅丢弃各组合内损坏的关联出装。 */
function collectValidAugmentCombos(groups: unknown): ResgAugmentCombo[] {
  return recordArrayValues(groups)
    .filter(isAugmentComboCandidate)
    .map((combo) => ({
      ...combo,
      builds: combo.builds.filter(isAugmentItemBuild)
    }))
}

/** 校验独立装备组合。 */
function isItemCombo(value: unknown): value is ResgItemCombo {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    Number.isInteger(value.rank) &&
    (value.rank as number) > 0 &&
    Number.isInteger(value.size) &&
    (value.size as number) >= 1 &&
    (value.size as number) <= 5 &&
    Array.isArray(value.items) &&
    value.items.length === value.size &&
    value.items.every(isItemResource) &&
    isFiniteNumber(value.totalMatches) &&
    value.totalMatches >= 0 &&
    isRate(value.winRate) &&
    isRate(value.pickRate)
  )
}
