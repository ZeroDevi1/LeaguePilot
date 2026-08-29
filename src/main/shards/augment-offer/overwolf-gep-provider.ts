import type { AkariLogger } from '../logger-factory'
import { AUGMENTS_GEP_FEATURE, AUGMENT_OFFER_REASON, LOL_GEP_GAME_ID } from './constants'
import type { GepInfoUpdateLike } from './gep-payload'
import {
  OVERWOLF_GEP_PACKAGE_NAME,
  type OverwolfGepPackage,
  type OverwolfPackages,
  hasOverwolfApi,
  isGepLaunchEvent,
  resolveOverwolfRuntime
} from './overwolf-runtime'
import { shouldUseOverwolfGepProvider } from './platform'

const SET_REQUIRED_FEATURES_ATTEMPTS = 8
const SET_REQUIRED_FEATURES_RETRY_MS = 1000

export interface OverwolfGepProviderListener {
  onUnsupported: (reason: string) => void
  onUnavailable: (reason: string) => void
  onReady: () => void
  onError: (reason: string) => void
  onInfoUpdate: (update: GepInfoUpdateLike) => void
  onGameSessionStarted: (gameId: number) => void
  onGameSessionEnded: (gameId: number) => void
}

export interface OverwolfGepProviderHost {
  logger: AkariLogger
  listener: OverwolfGepProviderListener
  resolveRuntime?: (electronApp: unknown) => ReturnType<typeof resolveOverwolfRuntime>
  sleep?: (ms: number) => Promise<void>
}

/**
 * 只负责 OW-Electron `app.overwolf.packages.gep` 的可用性、feature 注册和原始事件。
 */
export class OverwolfGepProvider {
  private readonly _logger: AkariLogger
  private readonly _listener: OverwolfGepProviderListener
  private readonly _resolveRuntime: (
    electronApp: unknown
  ) => ReturnType<typeof resolveOverwolfRuntime>
  private readonly _sleep: (ms: number) => Promise<void>

  private _packages: OverwolfPackages | null = null
  private _gep: OverwolfGepPackage | null = null
  private _stopped = false
  private _boundGameDetected = this._onGameDetected.bind(this)
  private _boundInfoUpdate = this._onInfoUpdate.bind(this)
  private _boundGameExit = this._onGameExit.bind(this)
  private _boundError = this._onGepError.bind(this)
  private _boundElevated = this._onElevatedPrivilegesRequired.bind(this)
  private _boundPackageReady = this._onPackageReady.bind(this)
  private _boundPackageFailed = this._onPackageFailed.bind(this)

  constructor(
    private readonly _electronApp: unknown,
    host: OverwolfGepProviderHost
  ) {
    this._logger = host.logger
    this._listener = host.listener
    this._resolveRuntime = host.resolveRuntime ?? resolveOverwolfRuntime
    this._sleep = host.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  start() {
    if (!shouldUseOverwolfGepProvider()) {
      this._listener.onUnsupported(AUGMENT_OFFER_REASON.platformUnsupported)
      return
    }

    const runtime = this._resolveRuntime(this._electronApp)
    if (!runtime) {
      if (hasOverwolfApi(this._electronApp)) {
        this._listener.onUnavailable(AUGMENT_OFFER_REASON.gepPackageFailed)
        return
      }

      this._listener.onUnsupported(AUGMENT_OFFER_REASON.gepRuntimeMissing)
      return
    }

    this._packages = runtime.packages
    this._packages.on('ready', this._boundPackageReady)
    this._packages.on('failed', this._boundPackageFailed)

    if (this._packages.gep) {
      this._attachGep(this._packages.gep)
    }
  }

  stop() {
    this._stopped = true
    this._detachGep()

    if (this._packages?.off) {
      this._packages.off('ready', this._boundPackageReady)
      this._packages.off('failed', this._boundPackageFailed)
    }

    this._packages = null
  }

  async recoverCurrentGameInfo(gameId: number = LOL_GEP_GAME_ID): Promise<unknown | null> {
    if (!this._gep) {
      return null
    }

    try {
      return await this._gep.getInfo(gameId)
    } catch (error) {
      this._logger.warn('GEP getInfo failed', error)
      return null
    }
  }

  private _onPackageReady(_event: unknown, name: string) {
    if (this._stopped || name !== OVERWOLF_GEP_PACKAGE_NAME) {
      return
    }

    const gep = this._packages?.gep
    if (!gep) {
      this._logger.warn('GEP package ready event fired without gep API')
      this._listener.onUnavailable(AUGMENT_OFFER_REASON.gepPackageFailed)
      return
    }

    this._attachGep(gep)
  }

  private _onPackageFailed(_event: unknown, name: string) {
    if (this._stopped || name !== OVERWOLF_GEP_PACKAGE_NAME) {
      return
    }

    this._logger.warn('GEP package failed to load')
    this._listener.onUnavailable(AUGMENT_OFFER_REASON.gepPackageFailed)
  }

  private _attachGep(gep: OverwolfGepPackage) {
    this._detachGep()
    this._gep = gep

    gep.on('game-detected', this._boundGameDetected)
    gep.on('new-info-update', this._boundInfoUpdate)
    gep.on('game-exit', this._boundGameExit)
    gep.on('error', this._boundError)
    gep.on('elevated-privileges-required', this._boundElevated)

    this._logger.info('Overwolf GEP package attached')
    this._listener.onReady()
  }

  private _detachGep() {
    if (!this._gep) {
      return
    }

    if (this._gep.off) {
      this._gep.off('game-detected', this._boundGameDetected)
      this._gep.off('new-info-update', this._boundInfoUpdate)
      this._gep.off('game-exit', this._boundGameExit)
      this._gep.off('error', this._boundError)
      this._gep.off('elevated-privileges-required', this._boundElevated)
    } else {
      this._gep.removeAllListeners?.()
    }

    this._gep = null
  }

  private _onGameDetected(event: unknown, gameId: number) {
    if (this._stopped || gameId !== LOL_GEP_GAME_ID) {
      return
    }

    if (isGepLaunchEvent(event)) {
      event.enable()
    }

    this._listener.onGameSessionStarted(gameId)
    void this._registerLoLAugmentsFeature(gameId)
  }

  private _onInfoUpdate(_event: unknown, gameId: number, data: GepInfoUpdateLike) {
    if (this._stopped || gameId !== LOL_GEP_GAME_ID) {
      return
    }

    this._listener.onInfoUpdate(data)
  }

  private _onGameExit(_event: unknown, gameId: number) {
    if (this._stopped || gameId !== LOL_GEP_GAME_ID) {
      return
    }

    this._listener.onGameSessionEnded(gameId)
  }

  private _onGepError(_event: unknown, gameId: number, error: unknown) {
    if (this._stopped || (gameId && gameId !== LOL_GEP_GAME_ID)) {
      return
    }

    this._logger.warn('GEP error', typeof error === 'string' ? error : 'unknown')
    this._listener.onError(AUGMENT_OFFER_REASON.gepPackageFailed)
  }

  private _onElevatedPrivilegesRequired(_event: unknown, gameId: number) {
    if (this._stopped || gameId !== LOL_GEP_GAME_ID) {
      return
    }

    this._logger.warn('GEP requires elevated privileges to read League of Legends')
    this._listener.onError(AUGMENT_OFFER_REASON.elevatedPrivilegesRequired)
  }

  private async _registerLoLAugmentsFeature(gameId: number) {
    if (!this._gep) {
      return
    }

    for (let attempt = 1; attempt <= SET_REQUIRED_FEATURES_ATTEMPTS; attempt++) {
      if (this._stopped) {
        return
      }

      try {
        await this._gep.setRequiredFeatures(gameId, [AUGMENTS_GEP_FEATURE])
        this._logger.info(`GEP required features registered for ${gameId}`)
        return
      } catch (error) {
        this._logger.warn(
          `GEP setRequiredFeatures failed (attempt ${attempt}/${SET_REQUIRED_FEATURES_ATTEMPTS})`
        )
        if (attempt === SET_REQUIRED_FEATURES_ATTEMPTS) {
          this._listener.onError(AUGMENT_OFFER_REASON.setRequiredFeaturesFailed)
          return
        }
        await this._sleep(SET_REQUIRED_FEATURES_RETRY_MS)
      }
    }
  }
}
