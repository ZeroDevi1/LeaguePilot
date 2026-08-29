import { describe, expect, test } from 'vitest'

import { filledAugmentIds } from './augments'

describe('filledAugmentIds', () => {
  test('keeps picked hextech ids and drops empty slots', () => {
    expect(filledAugmentIds([1133, 1032, 1073, 1346, 0, 0])).toEqual([1133, 1032, 1073, 1346])
    expect(filledAugmentIds([])).toEqual([])
    expect(filledAugmentIds(undefined)).toEqual([])
  })
})
