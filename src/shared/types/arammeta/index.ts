/** arammeta 公开 payload 使用的海克斯稀有度键。 */
export const ARAMMETA_HEX_RARITIES = ['kPrismatic', 'kGold', 'kSilver'] as const

/** Mayhem 四次三选一对应的英雄等级节点。 */
export const ARAMMETA_HEX_SLOT_LEVELS = [3, 7, 11, 15] as const

/** 海克斯大乱斗三选一的稀有度。 */
export type ArammetaHexRarity = (typeof ARAMMETA_HEX_RARITIES)[number]

/** 单个海克斯在某一轮（3 / 7 / 11 / 15）上的样本。 */
export interface ArammetaHexSlotStat {
  /** 该轮次样本数。 */
  games: number
  /** 该轮次胜率，范围为 0 到 1。 */
  winRate: number
}

/** 英雄在某一稀有度下的一条海克斯历史统计。 */
export interface ArammetaHexPick {
  /** Riot 海克斯强化 ID，与 LCU / CommunityDragon `cherry-augments.json` 的 `id` 对齐。 */
  id: number
  /** 该英雄携带此海克斯的样本数。 */
  games: number
  /** 经贝叶斯收缩后的展示胜率，范围为 0 到 1。 */
  winRate: number
  /** 相对该英雄自身基准胜率的提升，可为负。 */
  lift: number
  /** 相对同稀有度的选取率，范围为 0 到 1。 */
  pickRate: number
  /** 按 3 / 7 / 11 / 15 四级节点排列的轮次统计；缺失轮次为 `null`。 */
  slots: Array<ArammetaHexSlotStat | null>
}

/** 一个英雄的海克斯历史推荐。 */
export interface ArammetaChampionHexPicks {
  /** 各稀有度下按适配分排序的最佳海克斯。 */
  top: Record<ArammetaHexRarity, ArammetaHexPick[]>
}

/** 从 arammeta 公开 JSON 抽出的海克斯目录。 */
export interface ArammetaHexCatalog {
  /** 统计对应的游戏主次版本前缀，例如 `16.17`。 */
  patchPrefix: string | null
  /** 按 Riot 英雄数字 ID 索引的海克斯推荐。 */
  champions: Record<number, ArammetaChampionHexPicks>
}
