import { IAkariShardInitDispose, Shard } from '@shared/akari-shard'

import { ExtraAssetsMain } from '../extra-assets'
import { GameClientMain } from '../game-client'
import { AkariIpcMain } from '../ipc'
import { LeagueClientMain } from '../league-client'
import { AkariLogger, LoggerFactoryMain } from '../logger-factory'
import { MobxUtilsMain } from '../mobx-utils'
import { AugmentOfferController } from './augment-offer-controller'
import { AUGMENT_OFFER_MAIN_NAMESPACE, type AugmentOfferMainContext } from './context'
import { AugmentOfferIpcHandlers } from './ipc-handlers'
import { AugmentOfferState } from './state'

@Shard(AugmentOfferMain.id)
export class AugmentOfferMain implements IAkariShardInitDispose {
  static id = AUGMENT_OFFER_MAIN_NAMESPACE

  public readonly state = new AugmentOfferState()

  private readonly _logger: AkariLogger
  private readonly _context: AugmentOfferMainContext
  private readonly _controller: AugmentOfferController
  private readonly _ipcHandlers: AugmentOfferIpcHandlers

  constructor(
    extraAssets: ExtraAssetsMain,
    gameClient: GameClientMain,
    ipc: AkariIpcMain,
    leagueClient: LeagueClientMain,
    loggerFactory: LoggerFactoryMain,
    mobxUtils: MobxUtilsMain
  ) {
    this._logger = loggerFactory.create(AugmentOfferMain.id)
    this._context = {
      namespace: AugmentOfferMain.id,
      extraAssets,
      gameClient,
      ipc,
      leagueClient,
      logger: this._logger,
      mobxUtils,
      state: this.state
    }
    this._controller = new AugmentOfferController(this._context)
    this._ipcHandlers = new AugmentOfferIpcHandlers(this._context, this)
  }

  async onInit() {
    this._context.mobxUtils.propSync(AugmentOfferMain.id, 'state', this.state, ['snapshot'])
    this._ipcHandlers.register()
    this._controller.watch()
  }

  async onDispose() {
    this._controller.dispose()
  }

  scanNow() {
    return this._controller.scanNow()
  }
}
