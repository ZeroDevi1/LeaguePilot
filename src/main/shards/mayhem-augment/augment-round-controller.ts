import {
  MAYHEM_AUGMENT_ROUND_LEVELS,
  type MayhemAugmentSession,
  createMayhemAugmentSession
} from '@shared/types/mayhem-augment'
import { formatError } from '@shared/utils/errors'
import { compareShallow } from 'mobx'

import {
  MAYHEM_AUGMENT_POLL_INTERVAL,
  MAYHEM_GAME_MODE,
  type MayhemAugmentMainContext
} from './context'

/** 对局已结束但仍应保留本局进度供回看的 gameflow 阶段。 */
const POST_GAME_PHASES = new Set(['WaitingForStats', 'PreEndOfGame', 'EndOfGame'])

/**
 * 跟踪海克斯大乱斗对局中的强化选择轮次。
 *
 * 官方 Live Client Data API 不暴露三选一的具体内容，本控制器只负责两件确定能做的事：
 * 1. 按 LCU gameflow 判定是否处于海克斯大乱斗对局，并管理会话的创建、保留和清理；
 * 2. 对局进行中轮询本地玩家等级，把到达 3 / 7 / 11 / 15 级的轮次标记为已出现。
 * 每轮的候选与最终选择由 renderer 通过 IPC 写入。
 */
export class MayhemAugmentRoundController {
  private _timerId: NodeJS.Timeout | null = null
  private _isPolling = false

  constructor(private readonly context: MayhemAugmentMainContext) {}

  watch() {
    const { leagueClient, mobxUtils } = this.context

    mobxUtils.reaction(
      () => {
        const session = leagueClient.data.gameflow.session
        return [
          leagueClient.data.gameflow.phase,
          session?.gameData.gameId ?? null,
          session?.gameData.queue.gameMode ?? null
        ] as const
      },
      ([phase, gameId, gameMode]) => this._applyGameflow(phase, gameId, gameMode),
      { equals: compareShallow, fireImmediately: true }
    )
  }

  dispose() {
    this._stopPolling()
  }

  /**
   * 记录某一轮玩家看到的候选强化。
   *
   * @param roundIndex 轮次下标，0 到 3。
   * @param augmentIds 候选强化 ID；会去重并最多保留 3 个，非正整数会被丢弃。
   * @returns 更新后的会话；当前没有会话或轮次非法时返回 `null`。
   */
  setOfferedAugments(roundIndex: number, augmentIds: number[]): MayhemAugmentSession | null {
    const normalized = [...new Set(augmentIds.filter(isPositiveInteger))].slice(0, 3)
    return this._updateRound(roundIndex, (round) => ({
      ...round,
      offeredAugmentIds: normalized,
      pickedAugmentId:
        round.pickedAugmentId !== null && !normalized.includes(round.pickedAugmentId)
          ? null
          : round.pickedAugmentId
    }))
  }

  /**
   * 记录某一轮的最终选择。
   *
   * @param roundIndex 轮次下标，0 到 3。
   * @param augmentId 选中的强化 ID；传 `null` 清除选择。若该 ID 不在候选中，会一并加入候选。
   * @returns 更新后的会话；当前没有会话、轮次非法或 ID 非法时返回 `null`。
   */
  setPickedAugment(roundIndex: number, augmentId: number | null): MayhemAugmentSession | null {
    if (augmentId !== null && !isPositiveInteger(augmentId)) {
      return null
    }

    return this._updateRound(roundIndex, (round) => {
      const offeredAugmentIds =
        augmentId !== null && !round.offeredAugmentIds.includes(augmentId)
          ? [...round.offeredAugmentIds, augmentId].slice(-3)
          : round.offeredAugmentIds
      return { ...round, offeredAugmentIds, pickedAugmentId: augmentId }
    })
  }

  /**
   * 清空当前会话中所有手动录入的候选和选择，保留等级进度。
   *
   * @returns 更新后的会话；没有会话时返回 `null`。
   */
  clearManualEntries(): MayhemAugmentSession | null {
    const session = this.context.state.session
    if (!session) {
      return null
    }

    const next: MayhemAugmentSession = {
      ...session,
      rounds: session.rounds.map((round) => ({
        ...round,
        offeredAugmentIds: [],
        pickedAugmentId: null
      }))
    }
    this.context.state.setSession(next)
    return next
  }

  private _applyGameflow(phase: string | null, gameId: number | null, gameMode: string | null) {
    const { state, logger } = this.context

    if (phase === 'InProgress' && gameMode === MAYHEM_GAME_MODE && gameId !== null) {
      if (!state.session || state.session.gameId !== gameId) {
        logger.info(`Mayhem game ${gameId} started, tracking augment rounds`)
        state.setSession(createMayhemAugmentSession(gameId, this._resolveSelfChampionId()))
      } else if (state.session.championId === null) {
        const championId = this._resolveSelfChampionId()
        if (championId !== null) {
          state.setSession({ ...state.session, championId })
        }
      }
      this._startPolling()
      return
    }

    this._stopPolling()

    // 结算阶段保留本局进度，方便玩家回看；进入下一阶段（大厅、匹配等）后再清理。
    if (state.session && phase !== null && POST_GAME_PHASES.has(phase)) {
      return
    }

    if (state.session) {
      logger.info(`Leaving mayhem game ${state.session.gameId}, clearing augment rounds`)
      state.setSession(null)
    }
  }

  private _resolveSelfChampionId(): number | null {
    const { leagueClient } = this.context
    const puuid = leagueClient.data.summoner.me?.puuid
    const selections = leagueClient.data.gameflow.session?.gameData.playerChampionSelections
    if (!puuid || !selections) {
      return null
    }

    const championId = selections.find((item) => item.puuid === puuid)?.championId
    return championId && championId > 0 ? championId : null
  }

  private _startPolling() {
    if (this._isPolling) {
      return
    }

    this._isPolling = true
    this.context.logger.info('Mayhem augment level polling started')
    void this._pollLevel()
    this._timerId = setInterval(() => void this._pollLevel(), MAYHEM_AUGMENT_POLL_INTERVAL)
  }

  private _stopPolling() {
    if (!this._isPolling) {
      return
    }

    this._isPolling = false
    if (this._timerId) {
      clearInterval(this._timerId)
      this._timerId = null
    }
    this.context.logger.info('Mayhem augment level polling stopped')
  }

  /**
   * 读取本地玩家等级并刷新轮次到达状态。
   *
   * 游戏加载阶段 2999 端口尚未就绪会持续报错，这是正常路径，只在等级变化时记录日志。
   */
  private async _pollLevel() {
    const { gameClient, state } = this.context
    const session = state.session
    if (!session) {
      return
    }

    let level: number
    try {
      const { data } = await gameClient.api.getActivePlayer()
      if (typeof data?.level !== 'number' || !Number.isFinite(data.level)) {
        return
      }
      level = data.level
    } catch (error) {
      this.context.logger.debug('Mayhem augment level poll failed', formatError(error))
      return
    }

    if (state.session !== session) {
      return
    }

    if (level === session.level && session.updatedAt !== null) {
      return
    }

    const rounds = session.rounds.map((round, index) => ({
      ...round,
      reached: level >= MAYHEM_AUGMENT_ROUND_LEVELS[index]
    }))
    const reachedCount = rounds.filter((round) => round.reached).length
    const previousReachedCount = session.rounds.filter((round) => round.reached).length
    if (reachedCount !== previousReachedCount) {
      this.context.logger.info(`Mayhem augment round ${reachedCount} reached at level ${level}`)
    }

    state.setSession({ ...session, level, rounds, updatedAt: Date.now() })
  }

  private _updateRound(
    roundIndex: number,
    updater: (
      round: MayhemAugmentSession['rounds'][number]
    ) => MayhemAugmentSession['rounds'][number]
  ): MayhemAugmentSession | null {
    const session = this.context.state.session
    if (!session || !Number.isInteger(roundIndex) || !session.rounds[roundIndex]) {
      return null
    }

    const next: MayhemAugmentSession = {
      ...session,
      rounds: session.rounds.map((round) => (round.index === roundIndex ? updater(round) : round))
    }
    this.context.state.setSession(next)
    return next
  }
}

/** 强化 ID 必须是正整数。 */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}
