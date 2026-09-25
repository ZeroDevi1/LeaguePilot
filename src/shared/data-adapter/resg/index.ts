import type {
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
  ResgNamedResource,
  ResgVersionItem
} from '@shared/types/resg'

import { expandResgCompactChampionDetail } from './compact-detail'

/** RESG 当前静态模块把样本数压缩为 `tm`；旧模块使用 `totalMatches`。 */
const TOTAL_MATCHES_KEYS = ['totalMatches', 'tm'] as const
/** RESG 当前静态模块把胜场数压缩为 `wm`；旧模块使用 `winMatches`。 */
const WIN_MATCHES_KEYS = ['winMatches', 'wm'] as const
/** RESG 当前静态模块把胜率压缩为 `wr`；旧模块使用 `winRate`。 */
const WIN_RATE_KEYS = ['winRate', 'wr'] as const
/** RESG 当前静态模块把选取率压缩为 `pr`；旧模块使用 `pickRate`。 */
const PICK_RATE_KEYS = ['pickRate', 'pr'] as const
/** 海克斯关联出装仍可能使用 snake_case；当前模块改为 `tm`。 */
const AUGMENT_BUILD_MATCHES_KEYS = ['total_matches', 'tm'] as const
/** 海克斯关联出装仍可能使用 snake_case；当前模块改为 `wr`。 */
const AUGMENT_BUILD_WIN_RATE_KEYS = ['win_rate', 'wr'] as const

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
 * RESG 当前静态模块把统计字段压缩为 `tm` / `wm` / `wr`；旧模块使用全称。
 * 适配器同时接受两种字段，并输出应用内稳定的全称模型。
 *
 * @param response 未经信任的 RESG JSON 响应。
 * @returns 至少含一个合法英雄时返回标准列表，否则返回 `null`。
 */
export function adaptResgChampionIndex(response: unknown): ResgChampionIndexResponse | null {
  if (!isRecord(response) || !Array.isArray(response.items)) {
    return null
  }

  const items = response.items.flatMap((item) => {
    const mapped = toChampionIndexItem(item)
    return mapped ? [mapped] : []
  })
  return items.length > 0 ? { items } : null
}

/**
 * 把 RESG 的 `T0` 到 `T4` 梯队标签转换为攻略窗口通用的梯队编号。
 *
 * @param tier RESG 梯队标签，例如 `T1`；大小写不敏感。
 * @returns 0 到 4 的梯队编号；无法解析时返回 5，让 UI 使用默认弱化配色。
 */
export function parseResgTierLevel(tier: string): number {
  const value = Number(tier.replace(/^T/i, ''))
  return Number.isInteger(value) && value >= 0 ? value : 5
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
 * 当前模块把详情段压缩为 `b` / `si` / `ia` / `ra` / `ac`。16.17 起这些段里的每一行又进一步变成位置元组，胜率和选取率用万分比整数表示。
 * 适配器会先把元组展开成对象，再接受旧的全称或短名对象；两种历史响应都仍然有效。
 *
 * @param response 未经信任的 RESG 英雄详情 JSON。
 * @param version 该响应对应的 RESG 数据版本。
 * @returns 标准化攻略；英雄或详情结构非法时返回 `null`。
 */
export function adaptResgChampionGuide(
  response: unknown,
  version: string
): ResgChampionGuide | null {
  const source = expandResgCompactChampionDetail(response)
  if (!isRecord(source)) {
    return null
  }

  const champion = toChampionSummary(source.champion)
  if (!champion) {
    return null
  }

  const builds = asRecord(readField(source, ['builds', 'b']))
  const itemAnalysis = asRecord(readField(source, ['itemAnalysis', 'ia']))
  const recommendedAugments = readField(source, ['recommendedAugments', 'ra'])
  const startingItems = readField(source, ['startingItems', 'si'])
  const augmentGroups = readField(source, ['augmentCombos', 'ac'])
  const augmentNameById = toAugmentNameById(recommendedAugments)
  const augmentCombos = toGuideAugmentCombos(augmentGroups, augmentNameById)
  const itemCombos = toGuideItemCombos(itemAnalysis.combos)

  return {
    version,
    champion,
    spells: toGuideBuilds(builds.SPELLS),
    skillOrders: toGuideBuilds(builds.SKILL_ORDER),
    starterItems: toGuideBuilds(startingItems),
    boots: toGuideBuilds(builds.BOOTS),
    augments: toGuideAugments(recommendedAugments),
    augmentCombos,
    itemCombos,
    items: toGuideItems(itemAnalysis.items),
    itemBuilds: collectItemBuilds(itemCombos, augmentGroups)
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

  return rows.flatMap((row) => {
    const build = toGuideBuild(row)
    return build ? [build] : []
  })
}

/**
 * 把一行排名方案转换成攻略窗口模型。
 *
 * @param value 未经信任的排名行，统计字段可为全称或短名。
 * @returns 合法方案；结构或统计字段非法时返回 `null`。
 */
function toGuideBuild(value: unknown): ResgGuideBuild | null {
  if (!isRecord(value)) {
    return null
  }

  const rank = readPositiveInteger(value.rank)
  if (
    rank === null ||
    !Array.isArray(value.value) ||
    value.value.length === 0 ||
    !value.value.every(isNamedResource)
  ) {
    return null
  }

  const play = readNonNegativeNumber(value, TOTAL_MATCHES_KEYS)
  const winRate = readRate(value, WIN_RATE_KEYS)
  const pickRate = readRate(value, PICK_RATE_KEYS)
  if (play === null || winRate === null || pickRate === null) {
    return null
  }

  return {
    rank,
    ids: value.value.map((item) => item.id).filter((id) => id > 0),
    names: value.value.map((item) => item.name),
    play,
    winRate,
    pickRate
  }
}

/** 把独立海克斯统计转换为攻略窗口模型。 */
function toGuideAugments(augments: unknown): ResgGuideAugment[] {
  if (!Array.isArray(augments)) {
    return []
  }

  return augments
    .flatMap((augment) => {
      const mapped = toGuideAugment(augment)
      return mapped ? [mapped] : []
    })
    .toSorted((left, right) => right.pickRate - left.pickRate)
    .map((augment, index) => ({ ...augment, rank: index + 1 }))
}

/**
 * 把一条独立海克斯推荐转换成攻略窗口模型。
 *
 * @param value 未经信任的海克斯统计，统计字段可为全称或短名。
 * @returns 合法推荐；结构或统计字段非法时返回 `null`。
 */
function toGuideAugment(value: unknown): Omit<ResgGuideAugment, 'rank'> | null {
  if (!isRecord(value)) {
    return null
  }

  const id = readPositiveInteger(value.id)
  if (id === null || typeof value.name !== 'string' || !isFiniteNumber(value.quality)) {
    return null
  }

  const play = readNonNegativeNumber(value, TOTAL_MATCHES_KEYS)
  const winRate = readRate(value, WIN_RATE_KEYS)
  const pickRate = readRate(value, PICK_RATE_KEYS)
  if (play === null || winRate === null || pickRate === null) {
    return null
  }

  return {
    id,
    name: value.name,
    play,
    winRate,
    pickRate
  }
}

/** 判断海克斯组合是否至少含一个有效强化。 */
function hasUsableAugments(combo: ParsedAugmentCombo): boolean {
  return combo.augments.ids.length > 0
}

/** 按海克斯数量分组并转换全部合法组合。 */
function toGuideAugmentCombos(
  groups: unknown,
  namesById: Map<number, string>
): ResgGuideAugmentCombo[] {
  const combos = collectValidAugmentCombos(groups).filter(hasUsableAugments)
  const sizes = [...new Set(combos.map((combo) => combo.size))].toSorted(
    (left, right) => left - right
  )

  return sizes.flatMap((size) =>
    combos
      .filter((combo) => combo.size === size)
      .toSorted((left, right) => left.rank - right.rank)
      .map((combo) => toGuideAugmentCombo(combo, namesById))
  )
}

/** 把海克斯组合及其关联出装转换成只依赖 Riot ID 的视图模型。 */
function toGuideAugmentCombo(
  combo: ParsedAugmentCombo,
  namesById: Map<number, string>
): ResgGuideAugmentCombo {
  return {
    rank: combo.rank,
    size: combo.size,
    augmentIds: combo.augments.ids,
    augmentNames: combo.augments.ids.map(
      (id, index) => namesById.get(id) || combo.augments.names[index] || ''
    ),
    play: combo.totalMatches,
    winRate: combo.winRate,
    builds: combo.builds
      .filter((build) => build.ids.length > 0)
      .toSorted((left, right) => right.play - left.play)
  }
}

/** 按装备数量分组并保留全部合法核心装备组合。 */
function toGuideItemCombos(groups: unknown): ResgGuideItemCombo[] {
  return recordArrayValues(groups)
    .flatMap((combo) => {
      const mapped = toGuideItemCombo(combo)
      return mapped ? [mapped] : []
    })
    .filter((combo) => combo.ids.length > 0)
    .toSorted((left, right) => left.size - right.size || left.rank - right.rank)
}

/**
 * 把一条独立装备组合转换成攻略窗口模型。
 *
 * @param value 未经信任的装备组合，统计字段可为全称或短名。
 * @returns 合法组合；结构或统计字段非法时返回 `null`。
 */
function toGuideItemCombo(value: unknown): ResgGuideItemCombo | null {
  if (!isRecord(value)) {
    return null
  }

  const rank = readPositiveInteger(value.rank)
  const size = readIntegerInRange(value.size, 1, 5)
  if (rank === null || size === null || readInteger(value.id) === null) {
    return null
  }

  const items = readResourceRefs(value.items)
  const play = readNonNegativeNumber(value, TOTAL_MATCHES_KEYS)
  const winRate = readRate(value, WIN_RATE_KEYS)
  const pickRate = readRate(value, PICK_RATE_KEYS)
  if (
    !items ||
    items.ids.length !== size ||
    play === null ||
    winRate === null ||
    pickRate === null
  ) {
    return null
  }

  return {
    rank,
    size,
    ids: items.ids,
    names: items.names,
    play,
    winRate,
    pickRate
  }
}

/** 把单件装备统计转换成稳定视图模型。 */
function toGuideItems(rows: unknown): ResgGuideItemStat[] {
  if (!Array.isArray(rows)) {
    return []
  }

  return rows
    .flatMap((row) => {
      const mapped = toGuideItem(row)
      return mapped ? [mapped] : []
    })
    .toSorted((left, right) => left.rank - right.rank)
}

/**
 * 把一条单件装备统计转换成攻略窗口模型。
 *
 * @param value 未经信任的装备统计，统计字段可为全称或短名。
 * @returns 合法统计；结构或统计字段非法时返回 `null`。
 */
function toGuideItem(value: unknown): ResgGuideItemStat | null {
  if (!isRecord(value)) {
    return null
  }

  const rank = readPositiveInteger(value.rank)
  const id = toPositiveId(value.item)
  const play = readNonNegativeNumber(value, TOTAL_MATCHES_KEYS)
  const win = readNonNegativeNumber(value, WIN_MATCHES_KEYS)
  const winRate = readRate(value, WIN_RATE_KEYS)
  const pickRate = readRate(value, PICK_RATE_KEYS)
  if (
    rank === null ||
    id === null ||
    play === null ||
    win === null ||
    winRate === null ||
    pickRate === null
  ) {
    return null
  }

  return {
    rank,
    id,
    name: resourceName(value.item),
    play,
    win,
    winRate,
    pickRate
  }
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
      if (build.ids.length === 0) {
        continue
      }

      const key = build.ids.join('-')
      const previous = uniqueBuilds.get(key)
      if (!previous || build.play > previous.play) {
        uniqueBuilds.set(key, {
          rank: 0,
          ids: build.ids,
          names: build.names,
          play: build.play,
          winRate: build.winRate,
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

/**
 * 把未知值整理成对象；其它类型视为空对象。
 *
 * @param value 未经信任的值。
 * @returns 普通对象，或空对象。
 */
function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

/**
 * 读取对象上第一个已定义的候选字段。
 *
 * @param record 未经信任的对象。
 * @param keys 按优先级排列的字段名，全称在前、RESG 短名在后。
 * @returns 第一个不是 `undefined` 的字段值；都不存在时返回 `undefined`。
 */
function readField(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key]
    }
  }
  return undefined
}

/**
 * 读取对象上第一个有限数字字段。
 *
 * @param record 未经信任的对象。
 * @param keys 按优先级排列的字段名。
 * @returns 有限数字；都不合法时返回 `null`。
 */
function readFiniteNumber(record: Record<string, unknown>, keys: readonly string[]): number | null {
  const value = readField(record, keys)
  return isFiniteNumber(value) ? value : null
}

/**
 * 读取对象上第一个非负有限数字字段。
 *
 * @param record 未经信任的对象。
 * @param keys 按优先级排列的字段名。
 * @returns 非负有限数字；都不合法时返回 `null`。
 */
function readNonNegativeNumber(
  record: Record<string, unknown>,
  keys: readonly string[]
): number | null {
  const value = readFiniteNumber(record, keys)
  return value !== null && value >= 0 ? value : null
}

/**
 * 读取对象上第一个 0 到 1 的比率字段。
 *
 * @param record 未经信任的对象。
 * @param keys 按优先级排列的字段名。
 * @returns 合法比率；都不合法时返回 `null`。
 */
function readRate(record: Record<string, unknown>, keys: readonly string[]): number | null {
  const value = readFiniteNumber(record, keys)
  return value !== null && isRate(value) ? value : null
}

/** 判断值是否为有限数字。 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 读取一个整数。
 *
 * @param value 未经信任的值。
 * @returns 整数；否则返回 `null`。
 */
function readInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

/**
 * 读取一个正整数。
 *
 * @param value 未经信任的值。
 * @returns 大于 0 的整数；否则返回 `null`。
 */
function readPositiveInteger(value: unknown): number | null {
  const valueAsInteger = readInteger(value)
  return valueAsInteger !== null && valueAsInteger > 0 ? valueAsInteger : null
}

/**
 * 读取一个闭区间内的整数。
 *
 * @param value 未经信任的值。
 * @param min 允许的最小整数，含边界。
 * @param max 允许的最大整数，含边界。
 * @returns 落在区间内的整数；否则返回 `null`。
 */
function readIntegerInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return null
  }
  return value
}

/** 判断值是否为 0 到 1 的比率。 */
function isRate(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1
}

/** 从纯 ID 或 `{ id }` 读取正数 Riot ID。 */
function toPositiveId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (
    isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isInteger(value.id) &&
    value.id > 0
  ) {
    return value.id
  }

  return null
}

/** 读取资源显示名；纯 ID 引用没有名称。 */
function resourceName(value: unknown): string {
  return isRecord(value) && typeof value.name === 'string' ? value.name : ''
}

/** 把装备或海克斯引用列表整理成平行的 ID / 名称数组。 */
function readResourceRefs(value: unknown): { ids: number[]; names: string[] } | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  const ids: number[] = []
  const names: string[] = []
  for (const item of value) {
    const id = toPositiveId(item)
    if (id === null) {
      return null
    }
    ids.push(id)
    names.push(resourceName(item))
  }

  return { ids, names }
}

/** 用独立海克斯推荐补全组合里缺失的名称。 */
function toAugmentNameById(augments: unknown): Map<number, string> {
  const names = new Map<number, string>()
  if (!Array.isArray(augments)) {
    return names
  }

  for (const augment of augments) {
    const mapped = toGuideAugment(augment)
    if (mapped) {
      names.set(mapped.id, mapped.name)
    }
  }

  return names
}

/**
 * 把英雄列表行整理成应用内稳定模型。
 *
 * @param value 未经信任的英雄列表项，统计字段可为全称或短名。
 * @returns 合法英雄项；结构或统计字段非法时返回 `null`。
 */
function toChampionIndexItem(value: unknown): ResgChampionIndexItem | null {
  const summary = toChampionSummary(value)
  if (!summary || !isRecord(value)) {
    return null
  }

  const winMatches = readFiniteNumber(value, WIN_MATCHES_KEYS)
  const winRate = readRate(value, WIN_RATE_KEYS)
  if (winMatches === null || winRate === null) {
    return null
  }

  return {
    ...summary,
    winMatches,
    winRate
  }
}

/**
 * 把英雄基础信息整理成应用内稳定模型。
 *
 * @param value 未经信任的英雄对象，样本数字段可为 `totalMatches` 或 `tm`。
 * @returns 合法英雄基础信息；结构非法时返回 `null`。
 */
function toChampionSummary(value: unknown): ResgChampionSummary | null {
  if (!isRecord(value)) {
    return null
  }

  const id = readPositiveInteger(value.id)
  if (
    id === null ||
    typeof value.name !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.alias !== 'string' ||
    typeof value.tier !== 'string' ||
    !Array.isArray(value.roles) ||
    !value.roles.every((role) => typeof role === 'string')
  ) {
    return null
  }

  const totalMatches = readFiniteNumber(value, TOTAL_MATCHES_KEYS)
  if (totalMatches === null) {
    return null
  }

  return {
    id,
    name: value.name,
    title: value.title,
    alias: value.alias,
    roles: value.roles,
    totalMatches,
    tier: value.tier
  }
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

/** 已通过信任边界的海克斯组合。 */
type ParsedAugmentCombo = {
  /** 组合在当前分组中的内部 ID。 */
  id: number
  /** 组合名次。 */
  rank: number
  /** 该组合包含的海克斯数量。 */
  size: number
  /** 组合内海克斯的 Riot ID 和可选名称。 */
  augments: { ids: number[]; names: string[] }
  /** 组合样本数。 */
  totalMatches: number
  /** 组合胜率，范围为 0 到 1。 */
  winRate: number
  /** 已过滤损坏项后的关联出装。 */
  builds: ResgGuideLinkedBuild[]
}

/**
 * 把一条海克斯关联出装转换成稳定视图模型。
 *
 * @param value 未经信任的关联出装，样本/胜率字段可为 snake_case 或短名。
 * @returns 合法出装；结构或统计字段非法时返回 `null`。
 */
function toLinkedBuild(value: unknown): ResgGuideLinkedBuild | null {
  if (!isRecord(value)) {
    return null
  }

  const items = readResourceRefs(value.items)
  const play = readNonNegativeNumber(value, AUGMENT_BUILD_MATCHES_KEYS)
  const winRate = readRate(value, AUGMENT_BUILD_WIN_RATE_KEYS)
  if (!items || play === null || winRate === null) {
    return null
  }

  return {
    ids: items.ids,
    names: items.names,
    play,
    winRate
  }
}

/**
 * 把一条海克斯组合整理成内部模型。
 *
 * @param value 未经信任的海克斯组合，强化列表字段可为 `augments` 或 `a`，出装字段可为 `builds` 或 `b`。
 * @returns 合法组合；结构或统计字段非法时返回 `null`。
 */
function toParsedAugmentCombo(value: unknown): ParsedAugmentCombo | null {
  if (!isRecord(value)) {
    return null
  }

  const id = readInteger(value.id)
  const rank = readPositiveInteger(value.rank)
  const size = readIntegerInRange(value.size, 1, 4)
  if (id === null || rank === null || size === null) {
    return null
  }

  const augments = readResourceRefs(readField(value, ['augments', 'a']))
  const play = readNonNegativeNumber(value, TOTAL_MATCHES_KEYS)
  const winRate = readRate(value, WIN_RATE_KEYS)
  const builds = readField(value, ['builds', 'b'])
  if (
    !augments ||
    augments.ids.length !== size ||
    play === null ||
    winRate === null ||
    !Array.isArray(builds)
  ) {
    return null
  }

  return {
    id,
    rank,
    size,
    augments,
    totalMatches: play,
    winRate,
    builds: builds.flatMap((build) => {
      const mapped = toLinkedBuild(build)
      return mapped ? [mapped] : []
    })
  }
}

/** 保留合法海克斯组合，并仅丢弃各组合内损坏的关联出装。 */
function collectValidAugmentCombos(groups: unknown): ParsedAugmentCombo[] {
  return recordArrayValues(groups).flatMap((combo) => {
    const mapped = toParsedAugmentCombo(combo)
    return mapped ? [mapped] : []
  })
}
