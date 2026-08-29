import { describe, expect, test } from 'vitest'

import {
  disableOverwolfAnonymousAnalytics,
  hasOverwolfApi,
  resolveOverwolfRuntime
} from './overwolf-runtime'

describe('Overwolf runtime detection', () => {
  test('returns null on vanilla Electron apps', () => {
    expect(hasOverwolfApi({})).toBe(false)
    expect(hasOverwolfApi({ overwolf: {} })).toBe(true)
    expect(resolveOverwolfRuntime({})).toBeNull()
    expect(resolveOverwolfRuntime({ overwolf: {} })).toBeNull()
    expect(resolveOverwolfRuntime(null)).toBeNull()
  })

  test('returns the packages object when OW-Electron exposes it', () => {
    const packages = {
      on: () => undefined
    }

    expect(resolveOverwolfRuntime({ overwolf: { packages } })).toEqual({ packages })
  })

  test('opts out of Overwolf anonymous analytics when the API exists', () => {
    const calls: string[] = []
    expect(
      disableOverwolfAnonymousAnalytics({
        overwolf: {
          disableAnonymousAnalytics: () => {
            calls.push('disabled')
          }
        }
      })
    ).toBe(true)
    expect(calls).toEqual(['disabled'])
    expect(disableOverwolfAnonymousAnalytics({})).toBe(false)
  })
})
