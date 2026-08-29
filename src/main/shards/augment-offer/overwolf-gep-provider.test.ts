import { describe, expect, test, vi } from 'vitest'

import { AUGMENT_OFFER_REASON } from './constants'
import { OverwolfGepProvider, type OverwolfGepProviderListener } from './overwolf-gep-provider'

function collectListener() {
  const events: string[] = []
  const listener: OverwolfGepProviderListener = {
    onUnsupported: (reason) => events.push(`unsupported:${reason}`),
    onUnavailable: (reason) => events.push(`unavailable:${reason}`),
    onReady: () => events.push('ready'),
    onError: (reason) => events.push(`error:${reason}`),
    onInfoUpdate: () => undefined,
    onGameSessionStarted: () => undefined,
    onGameSessionEnded: () => undefined
  }

  return { events, listener }
}

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
} as any

describe('OverwolfGepProvider start', () => {
  test.skipIf(process.platform !== 'win32')(
    'vanilla Electron without Overwolf API is unsupported',
    () => {
      const { events, listener } = collectListener()
      new OverwolfGepProvider({}, { logger, listener }).start()
      expect(events).toEqual([`unsupported:${AUGMENT_OFFER_REASON.gepRuntimeMissing}`])
    }
  )

  test.skipIf(process.platform !== 'win32')('OW-Electron without packages is unavailable', () => {
    const { events, listener } = collectListener()
    new OverwolfGepProvider({ overwolf: {} }, { logger, listener }).start()
    expect(events).toEqual([`unavailable:${AUGMENT_OFFER_REASON.gepPackageFailed}`])
  })
})
