import { describe, expect, test } from 'vitest'

import {
  extractAugmentPayloadsFromGepInfo,
  normalizeAugmentName,
  parseGepInfoUpdate,
  serializeOfferFingerprint,
  toMappedOfferItems
} from './gep-payload'

describe('GEP augment payload parsing', () => {
  test('normalizes names conservatively before matching', () => {
    expect(normalizeAugmentName('  Soul   Eater ')).toBe('soul eater')
    expect(normalizeAugmentName('Scopier Weapons')).toBe(normalizeAugmentName('scopier  weapons'))
  })

  test('parses the documented three-offer JSON string', () => {
    const parsed = parseGepInfoUpdate({
      feature: 'augments',
      key: 'augments',
      value:
        '{"augment_1":{"name":"Scopier Weapons"}, "augment_2":{"name":"Rabble Rousing"}, "augment_3":{"name":"Soul Eater"}}'
    })

    expect(parsed).toEqual({
      kind: 'offers',
      items: [
        { slot: 1, sourceName: 'Scopier Weapons' },
        { slot: 2, sourceName: 'Rabble Rousing' },
        { slot: 3, sourceName: 'Soul Eater' }
      ]
    })
  })

  test('parses picked_augment as a raw name', () => {
    expect(
      parseGepInfoUpdate({
        feature: 'augments',
        key: 'picked_augment',
        value: 'Rabble Rousing'
      })
    ).toEqual({
      kind: 'picked',
      sourceName: 'Rabble Rousing'
    })
  })

  test('rejects malformed offer JSON instead of guessing', () => {
    expect(
      parseGepInfoUpdate({
        feature: 'augments',
        key: 'augments',
        value: '{"augment_1":'
      })
    ).toEqual({ kind: 'invalid', reason: 'malformed-json' })
  })

  test('rejects offer entries that are missing a name', () => {
    expect(
      parseGepInfoUpdate({
        feature: 'augments',
        key: 'augments',
        value: '{"augment_1":{"name":""},"augment_2":{"name":"Soul Eater"}}'
      })
    ).toEqual({ kind: 'invalid', reason: 'empty-name' })
  })

  test('ignores unrelated features and empty offer objects', () => {
    expect(
      parseGepInfoUpdate({
        feature: 'gold',
        key: 'gold',
        value: '{}'
      })
    ).toEqual({ kind: 'ignored' })

    expect(
      parseGepInfoUpdate({
        feature: 'augments',
        key: 'augments',
        value: '{}'
      })
    ).toEqual({ kind: 'ignored' })
  })

  test('extracts offers and picked values from a nested getInfo snapshot', () => {
    const extracted = extractAugmentPayloadsFromGepInfo({
      info: {
        me: {
          augments:
            '{"augment_1":{"name":"Scopier Weapons"},"augment_2":{"name":"Rabble Rousing"}}',
          picked_augment: 'Rabble Rousing'
        }
      }
    })

    expect(extracted.offers).toEqual({
      kind: 'offers',
      items: [
        { slot: 1, sourceName: 'Scopier Weapons' },
        { slot: 2, sourceName: 'Rabble Rousing' }
      ]
    })
    expect(extracted.picked).toEqual({
      kind: 'picked',
      sourceName: 'Rabble Rousing'
    })
  })

  test('maps names through the provided mapper and fingerprints offers for dedupe', () => {
    const items = toMappedOfferItems(
      [
        { slot: 1, sourceName: 'Scopier Weapons' },
        { slot: 2, sourceName: 'Unknown Hex' }
      ],
      (name) => (name === 'Scopier Weapons' ? 101 : null)
    )

    expect(items).toEqual([
      { slot: 1, sourceName: 'Scopier Weapons', id: 101 },
      { slot: 2, sourceName: 'Unknown Hex', id: null }
    ])
    expect(serializeOfferFingerprint(items)).toBe(
      serializeOfferFingerprint([
        { slot: 1, sourceName: 'scopier  weapons', id: 101 },
        { slot: 2, sourceName: 'Unknown Hex', id: null }
      ])
    )
  })
})
