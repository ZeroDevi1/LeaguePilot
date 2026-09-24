import { IAkariShardInitDispose, Shard } from '@shared/akari-shard'

import { GameClientMain } from '../game-client'
import { AkariIpcMain } from '../ipc'
import { LeagueClientMain } from '../league-client'
import { AkariLogger, LoggerFactoryMain } from '../logger-factory'
import { MobxUtilsMain } from '../mobx-utils'
import { MayhemAugmentRoundController } from './augment-round-controller'
import { MAYHEM_AUGMENT_MAIN_NAMESPACE, type MayhemAugmentMainContext } from './context'
import { MayhemAugmentIpcHandlers } from './ipc-handlers'
import { MayhemAugmentState } from './state'

/**
 * 海克斯大乱斗强化选择助手（main 侧）。
 *
 * 跟踪本地玩家在海克斯大乱斗对局中到达 3 / 7 / 11 / 15 级的强化选择轮次，
 * 并保存玩家手动录入的候选与选择，供攻略窗口按当前数据源给出统计与组合推荐。
 */
@Shard(MayhemAugmentMain.id)
export class MayhemAugmentMain implements IAkariShardInitDispose {
  static id = MAYHEM_AUGMENT_MAIN_NAMESPACE

  public readonly state = new MayhemAugmentState()

  private readonly _logger: AkariLogger
  private readonly _context: MayhemAugmentMainContext
  private readonly _controller: MayhemAugmentRoundController
  private readonly _ipcHandlers: MayhemAugmentIpcHandlers

  constructor(
    private readonly _gameClient: GameClientMain,
    private readonly _ipc: AkariIpcMain,
    private readonly _leagueClient: LeagueClientMain,
    _loggerFactory: LoggerFactoryMain,
    private readonly _mobxUtils: MobxUtilsMain
  ) {
    this._logger = _loggerFactory.create(MayhemAugmentMain.id)
    this._context = {
      namespace: MayhemAugmentMain.id,
      gameClient: this._gameClient,
      leagueClient: this._leagueClient,
      logger: this._logger,
      mobxUtils: this._mobxUtils,
      state: this.state
    }
    this._controller = new MayhemAugmentRoundController(this._context)
    this._ipcHandlers = new MayhemAugmentIpcHandlers(this._context, this._ipc, this._controller)
  }

  async onInit() {
    this._mobxUtils.propSync(MayhemAugmentMain.id, 'state', this.state, ['session'])
    this._ipcHandlers.register()
    this._controller.watch()
  }

  async onDispose() {
    this._controller.dispose()
  }
}
