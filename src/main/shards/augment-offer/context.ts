import type { ExtraAssetsMain } from '../extra-assets'
import type { GameClientMain } from '../game-client'
import type { AkariIpcMain } from '../ipc'
import type { LeagueClientMain } from '../league-client'
import type { AkariLogger } from '../logger-factory'
import type { MobxUtilsMain } from '../mobx-utils'
import type { AugmentOfferState } from './state'

export const AUGMENT_OFFER_MAIN_NAMESPACE = 'augment-offer-main'

export interface AugmentOfferMainContext {
  namespace: string
  extraAssets: ExtraAssetsMain
  gameClient: GameClientMain
  ipc: AkariIpcMain
  leagueClient: LeagueClientMain
  logger: AkariLogger
  mobxUtils: MobxUtilsMain
  state: AugmentOfferState
}
