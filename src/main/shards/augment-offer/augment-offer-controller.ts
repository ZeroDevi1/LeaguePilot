import type { AugmentOfferItem } from '@shared/types/augment-offer'
import type { GameflowPhase } from '@shared/types/league-client/gameflow'
import { runInAction } from 'mobx'

import { createAugmentNameMapper } from './augment-name-mapper'
import { type AugmentOfferEvent, reduceAugmentOfferSnapshot } from './augment-offer-reducer'
import { AUGMENT_OFFER_REASON } from './constants'
import type { AugmentOfferMainContext } from './context'
import { ScreenVisionProvider } from './screen-vision-provider'

const KIWI_ENDED_PHASES = new Set<GameflowPhase | null>([
  null,
  'None',
  'Lobby',
  'EndOfGame',
  'PreEndOfGame',
  'WaitingForStats',
  'TerminatedInError',
  'WatchInProgress'
])

export class AugmentOfferController {
  private _mapper = createAugmentNameMapper(null, null)
  private _provider: ScreenVisionProvider | null = null
  private _sequence = 0

  constructor(private readonly _context: AugmentOfferMainContext) {}

  watch() {
    this._watchNameSources()
    this._watchKiwiMatchBoundary()
    this._startProvider()
  }

  dispose() {
    this._provider?.stop()
    this._provider = null
  }

  async scanNow() {
    if (!this._provider) {
      return {
        ok: false,
        offers: [] as AugmentOfferItem[],
        reason: AUGMENT_OFFER_REASON.screenCaptureUnavailable
      }
    }

    return this._provider.scanNow()
  }

  private _watchNameSources() {
    const { extraAssets, leagueClient, mobxUtils } = this._context

    mobxUtils.reaction(
      () => [extraAssets.gtimg.kiwiAugments, leagueClient.data.gameData.augments] as const,
      ([kiwiAugments, lcuAugments]) => {
        this._mapper = createAugmentNameMapper(kiwiAugments, lcuAugments)
        if (this._mapper.diagnostics.conflicts.length > 0) {
          this._context.logger.warn('Augment name mapper has conflicting names', {
            count: this._mapper.diagnostics.conflicts.length
          })
        }
        this._apply({ type: 'remap', mapName: (name) => this._mapper.mapName(name) })
      },
      { fireImmediately: true }
    )
  }

  private _watchKiwiMatchBoundary() {
    const { leagueClient, mobxUtils } = this._context

    mobxUtils.reaction(
      () =>
        [
          leagueClient.data.gameflow.phase,
          leagueClient.data.gameflow.session?.map.gameMode ?? null
        ] as const,
      ([phase, gameMode]) => {
        if (!this._shouldRetainKiwiMatch(phase, gameMode)) {
          this._apply({ type: 'clear-match' })
          this._provider?.resetMatch()
        }
      },
      { fireImmediately: true }
    )
  }

  private _startProvider() {
    this._provider?.stop()
    this._provider = new ScreenVisionProvider({
      extraAssets: this._context.extraAssets,
      gameClient: this._context.gameClient,
      leagueClient: this._context.leagueClient,
      logger: this._context.logger,
      listener: {
        onReady: () => this._apply({ type: 'provider-ready', source: 'screen-vision' }),
        onUnavailable: (reason) =>
          this._apply({ type: 'unavailable', source: 'screen-vision', reason }),
        onError: (reason) => this._apply({ type: 'error', source: 'screen-vision', reason }),
        onOffers: (items) =>
          this._apply({
            type: 'offers',
            source: 'screen-vision',
            receivedAt: ++this._sequence,
            items
          }),
        onOffersCleared: () => this._apply({ type: 'clear-offers' })
      }
    })
    this._provider.start()
  }

  private _shouldRetainKiwiMatch(phase: GameflowPhase | null, gameMode: string | null) {
    if (KIWI_ENDED_PHASES.has(phase)) {
      return false
    }

    if (gameMode && gameMode !== 'KIWI') {
      return false
    }

    return true
  }

  private _apply(event: AugmentOfferEvent) {
    const { state } = this._context
    const next = reduceAugmentOfferSnapshot(state.snapshot, event)
    if (next === state.snapshot) {
      return
    }

    runInAction(() => {
      state.snapshot = next
    })
  }
}
