import type { GepInfoUpdateLike } from './gep-payload'

export const OVERWOLF_GEP_PACKAGE_NAME = 'gep'

export interface OverwolfGepLaunchEvent {
  enable: () => void
}

export interface OverwolfGepPackage {
  setRequiredFeatures: (gameId: number, features: string[] | null) => Promise<void>
  getInfo: (gameId: number) => Promise<unknown>
  on: (eventName: string, listener: (...args: any[]) => void) => void
  off?: (eventName: string, listener: (...args: any[]) => void) => void
  removeAllListeners?: (eventName?: string) => void
}

export interface OverwolfPackages {
  gep?: OverwolfGepPackage
  on: (
    eventName: 'ready' | 'failed',
    listener: (event: unknown, name: string, extra?: unknown) => void
  ) => void
  off?: (eventName: 'ready' | 'failed', listener: (...args: any[]) => void) => void
}

export interface OverwolfRuntime {
  packages: OverwolfPackages
}

export function hasOverwolfApi(electronApp: unknown): boolean {
  return Boolean(
    electronApp &&
    typeof electronApp === 'object' &&
    (electronApp as { overwolf?: unknown }).overwolf
  )
}

export function resolveOverwolfRuntime(electronApp: unknown): OverwolfRuntime | null {
  if (!hasOverwolfApi(electronApp)) {
    return null
  }

  const overwolf = (electronApp as { overwolf?: OverwolfRuntime }).overwolf
  if (!overwolf?.packages) {
    return null
  }

  return overwolf
}

export function disableOverwolfAnonymousAnalytics(electronApp: unknown): boolean {
  if (!hasOverwolfApi(electronApp)) {
    return false
  }

  const overwolf = (
    electronApp as {
      overwolf?: { disableAnonymousAnalytics?: () => void }
    }
  ).overwolf

  if (typeof overwolf?.disableAnonymousAnalytics !== 'function') {
    return false
  }

  overwolf.disableAnonymousAnalytics()
  return true
}

export function isGepLaunchEvent(value: unknown): value is OverwolfGepLaunchEvent {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as OverwolfGepLaunchEvent).enable === 'function'
  )
}

export type OverwolfGepInfoUpdate = GepInfoUpdateLike
