import { describe, expect, test } from 'vitest'

import { pinLiveItems, shouldShowLiveAugmentOffer } from './live-augment-offer'

describe('live augment offer helpers', () => {
  test('shows the banner for KIWI so the player can scan the current offer', () => {
    expect(
      shouldShowLiveAugmentOffer(
        {
          availability: 'waiting',
          source: 'screen-vision',
          gameId: null,
          offers: [],
          picked: null,
          updatedAt: null,
          reason: null
        },
        'KIWI'
      )
    ).toBe(true)
  })

  test('hides the banner outside KIWI when there is no live offer', () => {
    expect(
      shouldShowLiveAugmentOffer(
        {
          availability: 'waiting',
          source: 'screen-vision',
          gameId: null,
          offers: [],
          picked: null,
          updatedAt: null,
          reason: null
        },
        'ARAM'
      )
    ).toBe(false)
  })

  test('shows the banner when an offer is present', () => {
    expect(
      shouldShowLiveAugmentOffer(
        {
          availability: 'ready',
          source: 'screen-vision',
          gameId: null,
          offers: [{ slot: 1, sourceName: 'Soul Eater', id: 1 }],
          picked: null,
          updatedAt: 1,
          reason: null
        },
        'ARAM'
      )
    ).toBe(true)
  })

  test('pins live items in front without dropping the rest', () => {
    expect(
      pinLiveItems(
        [
          { id: 1, name: 'a' },
          { id: 2, name: 'b' },
          { id: 3, name: 'c' }
        ],
        (item) => item.id === 3 || item.id === 2
      )
    ).toEqual([
      { id: 2, name: 'b' },
      { id: 3, name: 'c' },
      { id: 1, name: 'a' }
    ])
  })
})
