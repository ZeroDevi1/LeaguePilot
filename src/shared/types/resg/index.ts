/** RESG 版本索引中的一项。 */
export interface ResgVersionItem {
  /** 游戏主次版本号，例如 `16.16`。 */
  version: string
  /** RESG 完成该版本数据收集的 ISO 时间。 */
  collectedAt: string
}

/** RESG 英雄列表中的一项。 */
export interface ResgChampionIndexItem {
  /** Riot 英雄数字 ID。 */
  id: number
  /** 英雄称号，例如“河流之王”。 */
  name: string
  /** 英雄短名，例如“塔姆”。 */
  title: string
  /** CommunityDragon 使用的英文别名。 */
  alias: string
  /** RESG 标注的英雄职责。 */
  roles: string[]
  /** RESG 统计样本数。 */
  totalMatches: number
  /** RESG 统计胜场数。 */
  winMatches: number
  /** RESG 统计胜率，范围为 0 到 1。 */
  winRate: number
  /** RESG 梯队标签，例如 `T1`。 */
  tier: string
}

/** RESG 英雄列表响应。 */
export interface ResgChampionIndexResponse {
  /** 按 RESG 默认热度排序的英雄。 */
  items: ResgChampionIndexItem[]
}

/** RESG 英雄基础信息。 */
export interface ResgChampionSummary {
  /** Riot 英雄数字 ID。 */
  id: number
  /** 英雄称号，例如“黑暗之女”。 */
  name: string
  /** 英雄短名，例如“安妮”。 */
  title: string
  /** CommunityDragon 使用的英文别名。 */
  alias: string
  /** RESG 标注的英雄职责。 */
  roles: string[]
  /** RESG 统计样本数。 */
  totalMatches: number
  /** RESG 梯队标签，例如 `T2`。 */
  tier: string
}

/** RESG 排名项中的游戏资源。 */
export interface ResgNamedResource {
  /** Riot 资源 ID；技能优先级中的 Q/W/E 使用 `0`。 */
  id: number
  /** 资源显示名；技能优先级中为 Q/W/E。 */
  name: string
}

/**
 * RESG 对装备或海克斯的引用。
 *
 * 当前静态模块常用纯数字 ID；旧响应则带 `name` 对象。
 */
export type ResgResourceRef = number | ResgNamedResource

/** RESG 通用排名行。 */
export interface ResgRankedBuild {
  /** 该方案在同类方案中的名次。 */
  rank: number
  /** 组成方案的召唤师技能、技能键或装备。 */
  value: ResgNamedResource[]
  /** 方案样本数。 */
  totalMatches: number
  /** 方案胜率，范围为 0 到 1。 */
  winRate: number
  /** 方案选取率，范围为 0 到 1。 */
  pickRate: number
}

/** RESG 海克斯强化信息。 */
export interface ResgAugment {
  /** Riot 海克斯强化 ID。 */
  id: number
  /** 海克斯强化显示名。 */
  name: string
  /** RESG 品质编号。 */
  quality: number
}

/** RESG 海克斯组合下的一套关联出装。 */
export interface ResgAugmentItemBuild {
  /** 按购买顺序排列的装备。 */
  items: ResgResourceRef[]
  /** 该出装在对应海克斯组合下的样本数。 */
  total_matches: number
  /** 该出装在对应海克斯组合下的胜率，范围为 0 到 1。 */
  win_rate: number
}

/** RESG 的一条海克斯组合推荐。 */
export interface ResgAugmentCombo {
  /** 组合在当前分组中的内部 ID。 */
  id: number
  /** 组合名次。 */
  rank: number
  /** 该组合包含的海克斯数量。 */
  size: number
  /** 组合内的海克斯强化；当前模块为纯 ID，旧响应为对象。 */
  augments: Array<number | ResgAugment>
  /** 组合样本数。 */
  totalMatches: number
  /** 组合胜率，范围为 0 到 1。 */
  winRate: number
  /** 与该海克斯组合关联的常见出装。 */
  builds: ResgAugmentItemBuild[]
}

/** RESG 独立装备组合统计。 */
export interface ResgItemCombo {
  /** 组合在同装备数量下的内部 ID。 */
  id: number
  /** 组合名次。 */
  rank: number
  /** 组合内的装备数量。 */
  size: number
  /** 按组合顺序排列的装备。 */
  items: ResgResourceRef[]
  /** 组合样本数。 */
  totalMatches: number
  /** 组合胜率，范围为 0 到 1。 */
  winRate: number
  /** 组合选取率，范围为 0 到 1。 */
  pickRate: number
}

/** RESG 单件装备统计。 */
export interface ResgItemStat {
  /** 单件装备在当前英雄数据中的名次。 */
  rank: number
  /** Riot 装备资源；当前模块可能只有 `id`。 */
  item: ResgResourceRef | { id: number; name?: string }
  /** 使用该装备的样本数。 */
  totalMatches: number
  /** 使用该装备的胜场数。 */
  winMatches: number
  /** 使用该装备的胜率，范围为 0 到 1。 */
  winRate: number
  /** 使用该装备的选取率，范围为 0 到 1。 */
  pickRate: number
}

/** RESG 独立海克斯推荐统计。 */
export interface ResgRecommendedAugment extends ResgAugment {
  /** 该强化的样本数。 */
  totalMatches: number
  /** 该强化的胜率，范围为 0 到 1。 */
  winRate: number
  /** 该强化的选取率，范围为 0 到 1。 */
  pickRate: number
}

/**
 * RESG 英雄详情在适配器展开后使用的字段。
 *
 * 线上模块先把这些段压缩为短名 `b` / `si` / `ia` / `ra` / `ac`。16.17 起，短名下面的每一行又是位置元组，
 * 胜率和选取率是万分比整数。data adapter 会先把元组还原成这里描述的对象，再做信任边界校验；两种形状都不进入应用内模型。
 */
export interface ResgChampionResponse {
  /** 英雄基础信息。 */
  champion: ResgChampionSummary
  /** 按类别组织的排名方案。 */
  builds?: {
    /** 召唤师技能组合。 */
    SPELLS?: ResgRankedBuild[]
    /** 常见鞋子。 */
    BOOTS?: ResgRankedBuild[]
    /** 技能优先级。 */
    SKILL_ORDER?: ResgRankedBuild[]
  }
  /** 起始装备组合。 */
  startingItems?: ResgRankedBuild[]
  /** 独立装备和常见装备组合分析。 */
  itemAnalysis?: {
    /** 单件装备统计。 */
    items?: ResgItemStat[]
    /** 按装备数量分组的常见组合。 */
    combos?: Record<string, ResgItemCombo[]>
  }
  /** 推荐选择的独立海克斯强化。 */
  recommendedAugments?: ResgRecommendedAugment[]
  /** 按海克斯组合数量分组的数据。 */
  augmentCombos?: Record<string, ResgAugmentCombo[]>
}

/** 应用内统一使用的 RESG 排名方案。 */
export interface ResgGuideBuild {
  /** 方案名次。 */
  rank: number
  /** 组成方案的 Riot 资源 ID。 */
  ids: number[]
  /** 组成方案的显示名。 */
  names: string[]
  /** 方案样本数。 */
  play: number
  /** 方案胜率，范围为 0 到 1。 */
  winRate: number
  /** 方案选取率，范围为 0 到 1；无法独立计算时为 `null`。 */
  pickRate: number | null
}

/** 应用内统一使用的 RESG 独立海克斯推荐。 */
export interface ResgGuideAugment {
  /** 展示名次。 */
  rank: number
  /** Riot 海克斯强化 ID。 */
  id: number
  /** 海克斯强化显示名。 */
  name: string
  /** 样本数。 */
  play: number
  /** 胜率，范围为 0 到 1。 */
  winRate: number
  /** 选取率，范围为 0 到 1。 */
  pickRate: number
}

/** RESG 海克斯组合下的一套标准化关联出装。 */
export interface ResgGuideLinkedBuild {
  /** 按购买顺序排列的 Riot 装备 ID。 */
  ids: number[]
  /** 对应装备显示名。 */
  names: string[]
  /** 该出装在对应海克斯组合下的样本数。 */
  play: number
  /** 该出装在对应海克斯组合下的胜率，范围为 0 到 1。 */
  winRate: number
}

/** 应用内统一使用的 RESG 海克斯组合。 */
export interface ResgGuideAugmentCombo {
  /** 组合在同海克斯数量分组中的展示名次。 */
  rank: number
  /** 组合内的海克斯数量。 */
  size: number
  /** 组合内海克斯强化的 Riot ID。 */
  augmentIds: number[]
  /** 组合内海克斯强化的显示名。 */
  augmentNames: string[]
  /** 组合样本数。 */
  play: number
  /** 组合胜率，范围为 0 到 1。 */
  winRate: number
  /** 该海克斯组合下按样本数排序的关联出装。 */
  builds: ResgGuideLinkedBuild[]
}

/** 应用内统一使用的核心装备组合。 */
export interface ResgGuideItemCombo extends ResgGuideBuild {
  /** 组合内的装备数量。 */
  size: number
}

/** 应用内统一使用的单件装备统计。 */
export interface ResgGuideItemStat {
  /** 展示名次。 */
  rank: number
  /** Riot 装备 ID。 */
  id: number
  /** 装备显示名。 */
  name: string
  /** 样本数。 */
  play: number
  /** 胜场数。 */
  win: number
  /** 胜率，范围为 0 到 1。 */
  winRate: number
  /** 选取率，范围为 0 到 1。 */
  pickRate: number
}

/** RESG 英雄详情转换后的稳定视图模型。 */
export interface ResgChampionGuide {
  /** 数据来源的 RESG 版本。 */
  version: string
  /** 英雄基础信息。 */
  champion: ResgChampionSummary
  /** 召唤师技能组合。 */
  spells: ResgGuideBuild[]
  /** 技能优先级。 */
  skillOrders: ResgGuideBuild[]
  /** 起始装备组合。 */
  starterItems: ResgGuideBuild[]
  /** 鞋子方案。 */
  boots: ResgGuideBuild[]
  /** 独立海克斯强化推荐。 */
  augments: ResgGuideAugment[]
  /** 海克斯组合及其全部合法关联出装。 */
  augmentCombos: ResgGuideAugmentCombo[]
  /** 按装备数量分组的核心装备组合统计。 */
  itemCombos: ResgGuideItemCombo[]
  /** 单件装备统计。 */
  items: ResgGuideItemStat[]
  /** 用于一键导入的各装备数量首选组合；旧响应会回退到海克斯关联出装。 */
  itemBuilds: ResgGuideBuild[]
}
