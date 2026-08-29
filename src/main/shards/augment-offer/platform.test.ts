import { describe, expect, test } from 'vitest'

import { shouldUseOverwolfGepProvider, shouldUseScreenVisionProvider } from './platform'

describe('augment-offer platform guards', () => {
  test('only enables the Overwolf GEP provider on Windows', () => {
    expect(shouldUseOverwolfGepProvider('win32')).toBe(true)
    expect(shouldUseOverwolfGepProvider('darwin')).toBe(false)
    expect(shouldUseOverwolfGepProvider('linux')).toBe(false)
  })

  test('enables screen-vision capture on desktop platforms', () => {
    expect(shouldUseScreenVisionProvider('win32')).toBe(true)
    expect(shouldUseScreenVisionProvider('darwin')).toBe(true)
    expect(shouldUseScreenVisionProvider('linux')).toBe(true)
  })
})
