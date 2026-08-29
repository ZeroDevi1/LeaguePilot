import { IntervalTask } from '@main/utils/timer'
import type { GtimgKiwiAugments } from '@shared/data-sources/gtimg'
import type { AugmentOfferItem } from '@shared/types/augment-offer'
import { riotId, summonerName } from '@shared/utils/name'
import { type NativeImage, desktopCapturer, nativeImage, screen } from 'electron'

import type { ExtraAssetsMain } from '../extra-assets'
import type { GameClientMain } from '../game-client'
import type { LeagueClientMain } from '../league-client'
import type { AkariLogger } from '../logger-factory'
import { AUGMENT_OFFER_REASON } from './constants'
import { shouldUseScreenVisionProvider } from './platform'
import { buildKiwiIconHashCatalog } from './vision-icon-catalog'
import {
  VISION_HASH_SIZE,
  type VisionHashCatalogEntry,
  differenceHashFromBgra,
  iconRectsForOfferBand,
  isNearlyBlackBgra,
  matchIconHash,
  shouldScanForAugmentOffer,
  uniqueMatchedIds
} from './vision-match'

const LIVE_CLIENT_POLL_MS = 1000
const STABLE_SCAN_COUNT = 2
const MISSING_SCAN_COUNT = 4

export interface ScreenVisionListener {
  onReady: () => void
  onUnavailable: (reason: string) => void
  onError: (reason: string) => void
  onOffers: (items: AugmentOfferItem[]) => void
  onOffersCleared: () => void
}

export interface ScreenVisionHost {
  extraAssets: ExtraAssetsMain
  gameClient: GameClientMain
  leagueClient: LeagueClientMain
  logger: AkariLogger
  listener: ScreenVisionListener
  captureScreen?: () => Promise<NativeImage | null>
}

export interface ScreenVisionScanResult {
  ok: boolean
  offers: AugmentOfferItem[]
  reason: string | null
}

/**
 * 用 Live Client 等级门控 + 主屏截图 + kiwi 图标 dHash 识别当前三选一。
 *
 * 不读内存、不注入、不自动点击。独占全屏可能得到黑帧，需要无边框或窗口模式。
 */
export class ScreenVisionProvider {
  private readonly _pollTask = new IntervalTask(this._tick.bind(this), {
    interval: LIVE_CLIENT_POLL_MS
  })
  private _stopped = true
  private _scanning = false
  private _catalog: VisionHashCatalogEntry[] = []
  private _catalogKey = ''
  private _catalogPromise: Promise<VisionHashCatalogEntry[]> | null = null
  private _completedRounds = 0
  private _hasCurrentOffers = false
  private _pendingIds: string | null = null
  private _pendingCount = 0
  private _missingCount = 0
  private _emptyCatalogReported = false
  private _capture: () => Promise<NativeImage | null>

  constructor(private readonly _host: ScreenVisionHost) {
    this._capture = _host.captureScreen ?? capturePrimaryScreen
  }

  start() {
    if (!shouldUseScreenVisionProvider()) {
      this._host.listener.onUnavailable(AUGMENT_OFFER_REASON.platformUnsupported)
      return
    }

    this._stopped = false
    this.resetMatch()
    this._host.listener.onReady()
    void this._ensureCatalog()
    this._pollTask.start({ runImmediately: true, interval: LIVE_CLIENT_POLL_MS })
  }

  stop() {
    this._stopped = true
    this._pollTask.cancel()
    this.resetMatch()
  }

  resetMatch() {
    this._completedRounds = 0
    this._hasCurrentOffers = false
    this._pendingIds = null
    this._pendingCount = 0
    this._missingCount = 0
  }

  /**
   * 立即截屏识别一次，忽略轮次门控。供用户手动扫描。
   */
  async scanNow(): Promise<ScreenVisionScanResult> {
    if (this._stopped) {
      return { ok: false, offers: [], reason: AUGMENT_OFFER_REASON.screenCaptureUnavailable }
    }

    const offers = await this._scanFrame()
    if (!offers) {
      this._missingCount += 1
      if (this._missingCount >= MISSING_SCAN_COUNT && this._hasCurrentOffers) {
        this._clearCurrentOffers()
      }
      return { ok: false, offers: [], reason: AUGMENT_OFFER_REASON.noOfferDetected }
    }

    this._commitOffers(offers)
    return { ok: true, offers, reason: null }
  }

  private async _tick() {
    if (this._stopped || this._scanning) {
      return
    }

    const leagueClient = this._host.leagueClient
    const gameMode = leagueClient.data.gameflow.session?.map.gameMode ?? null
    const phase = leagueClient.data.gameflow.phase
    const self = await this._readSelfPlayer()

    if (
      !shouldScanForAugmentOffer({
        gameMode,
        phase,
        level: self?.level ?? null,
        completedRounds: this._completedRounds,
        hasCurrentOffers: this._hasCurrentOffers
      })
    ) {
      return
    }

    const offers = await this._scanFrame()
    if (!offers) {
      this._pendingIds = null
      this._pendingCount = 0
      this._missingCount += 1
      if (this._missingCount >= MISSING_SCAN_COUNT && this._hasCurrentOffers) {
        this._clearCurrentOffers()
      }
      return
    }

    this._missingCount = 0
    const fingerprint = offers.map((item) => item.id).join(',')
    if (this._pendingIds === fingerprint) {
      this._pendingCount += 1
    } else {
      this._pendingIds = fingerprint
      this._pendingCount = 1
    }

    if (this._pendingCount === STABLE_SCAN_COUNT) {
      this._commitOffers(offers)
    }
  }

  private async _scanFrame(): Promise<AugmentOfferItem[] | null> {
    this._scanning = true
    try {
      const catalog = await this._ensureCatalog()
      if (catalog.length === 0) {
        if (this._host.extraAssets.gtimg.kiwiAugments?.length && !this._emptyCatalogReported) {
          this._emptyCatalogReported = true
          this._host.listener.onError(AUGMENT_OFFER_REASON.iconCatalogEmpty)
        }
        return null
      }

      const shot = await this._capture()
      if (!shot || shot.isEmpty()) {
        return null
      }

      const size = shot.getSize()
      const fullBitmap = shot.toBitmap()
      if (isNearlyBlackBgra(fullBitmap, size.width, size.height)) {
        return null
      }

      const byId = new Map(catalog.map((entry) => [entry.id, entry]))
      const slotMatches = iconRectsForOfferBand(size.width, size.height).map((rect) => {
        const cropped = shot.crop(rect)
        if (cropped.isEmpty()) {
          return null
        }

        const resized = cropped.resize({
          width: VISION_HASH_SIZE.width,
          height: VISION_HASH_SIZE.height,
          quality: 'best'
        })
        const resizedSize = resized.getSize()
        const bitmap = resized.toBitmap()
        if (isNearlyBlackBgra(bitmap, resizedSize.width, resizedSize.height)) {
          return null
        }

        return matchIconHash(
          differenceHashFromBgra(bitmap, resizedSize.width, resizedSize.height),
          catalog
        )
      })

      const ids = uniqueMatchedIds(slotMatches)
      if (!ids) {
        return null
      }

      return ids.map((id, index) => {
        const entry = byId.get(id)
        return {
          slot: index + 1,
          id,
          sourceName: entry?.nameCn || entry?.nameEn || String(id)
        }
      })
    } catch (error) {
      this._host.logger.warn('screen-vision: capture or match failed', error)
      return null
    } finally {
      this._scanning = false
    }
  }

  private async _ensureCatalog(): Promise<VisionHashCatalogEntry[]> {
    const kiwiAugments = this._host.extraAssets.gtimg.kiwiAugments
    if (!kiwiAugments?.length) {
      return this._catalog
    }
    const key = catalogKey(kiwiAugments)
    if (key === this._catalogKey && this._catalog.length > 0) {
      return this._catalog
    }

    if (this._catalogPromise) {
      return this._catalogPromise
    }

    this._catalogPromise = buildKiwiIconHashCatalog(
      kiwiAugments,
      this._host.extraAssets.gtimgApi.http
    )
      .then((catalog) => {
        this._catalog = catalog
        this._catalogKey = key
        this._catalogPromise = null
        if (catalog.length > 0) {
          this._emptyCatalogReported = false
        }
        this._host.logger.info(`screen-vision: icon catalog ready (${catalog.length} hashes)`)
        return catalog
      })
      .catch((error) => {
        this._catalogPromise = null
        this._host.logger.warn('screen-vision: failed to build icon catalog', error)
        return []
      })

    return this._catalogPromise
  }

  private async _readSelfPlayer() {
    const me = this._host.leagueClient.data.summoner.me
    if (!me) {
      return null
    }

    try {
      const playerList = (await this._host.gameClient.api.getLiveClientDataPlayerList()).data
      return (
        playerList.find((player) => {
          if (player.riotId) {
            return player.riotId === riotId(me)
          }

          if (player.summonerName) {
            return summonerName(player.summonerName) === riotId(me)
          }

          return player.summonerName === me.internalName
        }) ?? null
      )
    } catch {
      return null
    }
  }

  private _commitOffers(offers: AugmentOfferItem[]) {
    this._hasCurrentOffers = true
    this._pendingIds = offers.map((item) => item.id).join(',')
    this._pendingCount = STABLE_SCAN_COUNT
    this._missingCount = 0
    this._host.listener.onOffers(offers)
  }

  private _clearCurrentOffers() {
    if (!this._hasCurrentOffers) {
      return
    }

    this._hasCurrentOffers = false
    this._completedRounds += 1
    this._pendingIds = null
    this._pendingCount = 0
    this._missingCount = 0
    this._host.listener.onOffersCleared()
  }
}

async function capturePrimaryScreen(): Promise<NativeImage | null> {
  const display = screen.getPrimaryDisplay()
  const size = {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor)
  }
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: size
  })
  const source =
    sources.find((item) => String(item.display_id) === String(display.id)) ?? sources[0]
  return source?.thumbnail ?? nativeImage.createEmpty()
}

function catalogKey(augments: GtimgKiwiAugments[] | null) {
  if (!augments?.length) {
    return ''
  }

  return `${augments.length}:${augments[0].augmentID}:${augments[augments.length - 1].augmentID}`
}
