import { describe, expect, test } from 'vitest'

import { reduceAugmentOfferSnapshot } from './augment-offer-reducer'
import { AUGMENT_OFFER_REASON, createEmptyAugmentOfferSnapshot } from './constants'

describe('augment offer snapshot reducer', () => {
  test('keeps vanilla Electron on an explicit unsupported path', () => {
    const next = reduceAugmentOfferSnapshot(createEmptyAugmentOfferSnapshot(), {
      type: 'unsupported',
      reason: AUGMENT_OFFER_REASON.gepRuntimeMissing
    })

    expect(next.availability).toBe('unsupported')
    expect(next.source).toBe('unsupported')
    expect(next.offers).toEqual([])
    expect(next.reason).toBe(AUGMENT_OFFER_REASON.gepRuntimeMissing)
  })

  test('replaces the previous round and clears picked when a new offer arrives', () => {
    const waiting = reduceAugmentOfferSnapshot(createEmptyAugmentOfferSnapshot(), {
      type: 'provider-ready'
    })
    const firstRound = reduceAugmentOfferSnapshot(waiting, {
      type: 'offers',
      receivedAt: 1,
      items: [{ slot: 1, sourceName: 'Scopier Weapons', id: 1 }]
    })
    const afterPick = reduceAugmentOfferSnapshot(firstRound, {
      type: 'picked',
      receivedAt: 2,
      item: { slot: 0, sourceName: 'Scopier Weapons', id: 1 }
    })
    const secondRound = reduceAugmentOfferSnapshot(afterPick, {
      type: 'offers',
      receivedAt: 3,
      items: [{ slot: 1, sourceName: 'Soul Eater', id: 2 }]
    })

    expect(afterPick.picked?.sourceName).toBe('Scopier Weapons')
    expect(secondRound.offers).toEqual([{ slot: 1, sourceName: 'Soul Eater', id: 2 }])
    expect(secondRound.picked).toBeNull()
    expect(secondRound.availability).toBe('ready')
  })

  test('marks degraded when any offer name cannot be mapped', () => {
    const waiting = reduceAugmentOfferSnapshot(createEmptyAugmentOfferSnapshot(), {
      type: 'provider-ready'
    })
    const next = reduceAugmentOfferSnapshot(waiting, {
      type: 'offers',
      receivedAt: 1,
      items: [
        { slot: 1, sourceName: 'Scopier Weapons', id: 1 },
        { slot: 2, sourceName: 'Unknown Hex', id: null }
      ]
    })

    expect(next.availability).toBe('degraded')
    expect(next.reason).toBe(AUGMENT_OFFER_REASON.nameUnmapped)
    expect(next.offers[1].sourceName).toBe('Unknown Hex')
  })

  test('keeps screen-vision ids when later name remaps cannot resolve the label', () => {
    const ready = reduceAugmentOfferSnapshot(
      reduceAugmentOfferSnapshot(createEmptyAugmentOfferSnapshot(), { type: 'provider-ready' }),
      {
        type: 'offers',
        receivedAt: 1,
        items: [{ slot: 1, sourceName: '海克斯名称', id: 42 }]
      }
    )
    const remapped = reduceAugmentOfferSnapshot(ready, {
      type: 'remap',
      mapName: () => null
    })

    expect(remapped.offers[0].id).toBe(42)
    expect(remapped.availability).toBe('ready')
  })

  test('ignores duplicate offer payloads and remaps retained names', () => {
    const waiting = reduceAugmentOfferSnapshot(createEmptyAugmentOfferSnapshot(), {
      type: 'provider-ready'
    })
    const offers = [{ slot: 1, sourceName: 'Scopier Weapons', id: null }]
    const first = reduceAugmentOfferSnapshot(waiting, {
      type: 'offers',
      receivedAt: 1,
      items: offers
    })
    const duplicate = reduceAugmentOfferSnapshot(first, {
      type: 'offers',
      receivedAt: 2,
      items: offers
    })
    const remapped = reduceAugmentOfferSnapshot(duplicate, {
      type: 'remap',
      mapName: (name) => (name === 'Scopier Weapons' ? 11 : null)
    })

    expect(duplicate).toBe(first)
    expect(remapped.offers[0].id).toBe(11)
    expect(remapped.availability).toBe('ready')
  })

  test('clears match data without pretending the provider is missing', () => {
    const waiting = reduceAugmentOfferSnapshot(createEmptyAugmentOfferSnapshot(), {
      type: 'provider-ready'
    })
    const ready = reduceAugmentOfferSnapshot(waiting, {
      type: 'offers',
      receivedAt: 1,
      items: [{ slot: 1, sourceName: 'Soul Eater', id: 2 }]
    })
    const cleared = reduceAugmentOfferSnapshot(ready, { type: 'clear-match' })

    expect(cleared.offers).toEqual([])
    expect(cleared.picked).toBeNull()
    expect(cleared.availability).toBe('waiting')
    expect(cleared.source).toBe('screen-vision')
  })

  test('clears a finished round without dropping the provider', () => {
    const ready = reduceAugmentOfferSnapshot(
      reduceAugmentOfferSnapshot(createEmptyAugmentOfferSnapshot(), { type: 'provider-ready' }),
      {
        type: 'offers',
        receivedAt: 1,
        items: [{ slot: 1, sourceName: 'Soul Eater', id: 2 }]
      }
    )
    const cleared = reduceAugmentOfferSnapshot(ready, { type: 'clear-offers' })

    expect(cleared.offers).toEqual([])
    expect(cleared.availability).toBe('waiting')
    expect(cleared.source).toBe('screen-vision')
  })
})
