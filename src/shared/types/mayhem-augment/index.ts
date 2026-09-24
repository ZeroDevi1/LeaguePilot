/**
 * 海克斯大乱斗（ARAM: Mayhem，LCU 模式标识 `KIWI`）中出现强化选择的英雄等级。
 *
 * 顺序即轮次顺序：第 1 轮在 3 级，第 4 轮在 15 级。
 */
export const MAYHEM_AUGMENT_ROUND_LEVELS = [3, 7, 11, 15] as const

/** 一局海克斯大乱斗中的一轮强化选择。 */
export interface MayhemAugmentRound {
  /** 轮次序号，从 0 开始，对应 `MAYHEM_AUGMENT_ROUND_LEVELS` 的下标。 */
  index: number
  /** 出现该轮选择的英雄等级。 */
  level: number
  /** 玩家等级是否已经到达该轮，即游戏内是否已经弹出过该轮三选一。 */
  reached: boolean
  /**
   * 玩家手动录入的本轮可选强化 ID。
   *
   * 客户端没有公开接口暴露三选一内容，因此该列表来自用户在攻略窗口中的选择；
   * 最多 3 个，为空表示尚未录入。
   */
  offeredAugmentIds: number[]
  /** 玩家本轮最终选择的强化 ID；未录入时为 `null`。 */
  pickedAugmentId: number | null
}

/** 当前（或刚结束的）一局海克斯大乱斗的强化选择进度。 */
export interface MayhemAugmentSession {
  /** LCU gameflow 会话中的对局 ID，用于区分不同对局。 */
  gameId: number
  /** 本地玩家所用英雄；无法从 gameflow 会话解析时为 `null`。 */
  championId: number | null
  /** Live Client Data API 报告的本地玩家等级；尚未读到时为 0。 */
  level: number
  /** 四轮强化选择的进度。 */
  rounds: MayhemAugmentRound[]
  /** 最近一次成功读取等级的 Unix 毫秒时间；尚未读到时为 `null`。 */
  updatedAt: number | null
}

/**
 * 创建一局新的空进度。
 *
 * @param gameId 对局 ID。
 * @param championId 本地玩家英雄 ID。
 * @returns 四轮均未到达、未录入的会话。
 */
export function createMayhemAugmentSession(
  gameId: number,
  championId: number | null
): MayhemAugmentSession {
  return {
    gameId,
    championId,
    level: 0,
    rounds: MAYHEM_AUGMENT_ROUND_LEVELS.map((level, index) => ({
      index,
      level,
      reached: false,
      offeredAugmentIds: [],
      pickedAugmentId: null
    })),
    updatedAt: null
  }
}
