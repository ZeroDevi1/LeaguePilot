import { type GtimgKiwiAugments, Level } from '@shared/data-sources/gtimg'
import type { Augment } from '@shared/types/league-client/game-data'
import { describe, expect, test } from 'vitest'

import { AugmentNameMapper } from './augment-name-mapper'

function kiwi(augmentID: number, name_en: string, name_cn: string): GtimgKiwiAugments {
  return {
    augmentID,
    name_en,
    name_cn,
    level: Level.KGold,
    desc: '',
    tooltip: '',
    large_Icon: '',
    small_Icon: ''
  }
}

describe('augment name mapper', () => {
  test('maps GTIMG English names to augment IDs', () => {
    const mapper = new AugmentNameMapper(
      [kiwi(11, 'Scopier Weapons', '广域武器'), kiwi(22, 'Soul Eater', '噬魂者')],
      null
    )

    expect(mapper.mapName('Scopier Weapons')).toBe(11)
    expect(mapper.mapName('  soul   eater ')).toBe(22)
    expect(mapper.mapName('噬魂者')).toBe(22)
  })

  test('uses LCU localized names only as a fallback', () => {
    const mapper = new AugmentNameMapper([kiwi(11, 'Scopier Weapons', '广域武器')], {
      11: {
        id: 11,
        nameTRA: '广域武器',
        augmentSmallIconPath: '',
        rarity: 'kGold'
      } satisfies Augment
    })

    expect(mapper.mapName('广域武器')).toBe(11)
  })

  test('does not guess when a normalized name maps to multiple IDs', () => {
    const mapper = new AugmentNameMapper(
      [kiwi(11, 'Soul Eater', '噬魂者'), kiwi(99, 'soul eater', '噬魂者·冲突')],
      null
    )

    expect(mapper.mapName('Soul Eater')).toBeNull()
    expect(mapper.isConflict('Soul Eater')).toBe(true)
    expect(mapper.mapName('Unknown')).toBeNull()
    expect(mapper.isConflict('Unknown')).toBe(false)
  })
})
