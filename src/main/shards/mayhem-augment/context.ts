import type { GameClientMain } from '../game-client'
import type { LeagueClientMain } from '../league-client'
import type { AkariLogger } from '../logger-factory'
import type { MobxUtilsMain } from '../mobx-utils'
import type { MayhemAugmentState } from './state'

export const MAYHEM_AUGMENT_MAIN_NAMESPACE = 'mayhem-augment-main'

/** 海克斯大乱斗的 LCU gameMode 标识。 */
export const MAYHEM_GAME_MODE = 'KIWI'

/** 对局进行中轮询本地玩家等级的间隔（毫秒）；等级变化很慢，无需高频。 */
export const MAYHEM_AUGMENT_POLL_INTERVAL = 2000

export interface MayhemAugmentMainContext {
  namespace: string
  gameClient: GameClientMain
  leagueClient: LeagueClientMain
  logger: AkariLogger
  mobxUtils: MobxUtilsMain
  state: MayhemAugmentState
}
