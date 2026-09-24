import type { ResgChampionGuide, ResgGuideAugmentCombo } from '@shared/types/resg'
import { describe, expect, it } from 'vitest'

import { buildAugmentCandidates, findCombosContaining } from './augment-recommendations'

function combo(augmentIds: number[], winRate: number, play = 100): ResgGuideAugmentCombo {
  return {
    rank: 1,
    size: augmentIds.length,
    augmentIds,
    augmentNames: augmentIds.map(String),
    play,
    winRate,
    builds: []
  }
}

function resgGuide(overrides: Partial<ResgChampionGuide> = {}): ResgChampionGuide {
  return {
    version: '16.1',
    champion: { id: 1, name: '', title: '', alias: '', roles: [], totalMatches: 0, tier: 'T1' },
    spells: [],
    skillOrders: [],
    starterItems: [],
    boots: [],
    augments: [
      { rank: 1, id: 101, name: 'A', play: 500, winRate: 0.58, pickRate: 0.3 },
      { rank: 2, id: 102, name: 'B', play: 400, winRate: 0.55, pickRate: 0.2 },
      { rank: 3, id: 103, name: 'C', play: 300, winRate: 0.5, pickRate: 0.1 }
    ],
    augmentCombos: [
      combo([101, 102], 0.62),
      combo([101, 103], 0.57),
      combo([102, 103], 0.66),
      combo([101, 102, 103], 0.7)
    ],
    itemCombos: [],
    items: [],
    itemBuilds: [],
    ...overrides
  }
}

describe('findCombosContaining', () => {
  it('returns only combos containing every required augment, best win rate first', () => {
    const result = findCombosContaining(resgGuide().augmentCombos, [101, 102])
    expect(result.map((item) => item.augmentIds)).toEqual([
      [101, 102, 103],
      [101, 102]
    ])
  })

  it('returns nothing when no augment is required', () => {
    expect(findCombosContaining(resgGuide().augmentCombos, [])).toEqual([])
  })
})

describe('buildAugmentCandidates', () => {
  it('evaluates only offered augments and ranks by best combo with picked augments', () => {
    const guide = resgGuide({
      augmentCombos: [combo([101, 102], 0.62), combo([101, 103], 0.57), combo([102, 103], 0.66)]
    })
    const result = buildAugmentCandidates({
      offeredAugmentIds: [101, 103],
      pickedAugmentIds: [102],
      resgGuide: guide,
      kiwiAugments: null
    })

    // 103 与已选 102 的组合胜率 0.66 高于 101 的 0.62，即使 101 单体胜率更高。
    expect(result.map((item) => item.augmentId)).toEqual([103, 101])
    expect(result[0].combos.map((item) => item.augmentIds)).toEqual([[102, 103]])
    expect(result[0].offered).toBe(true)
    expect(result[0].stats.winRate).toBe(0.5)
  })

  it('suggests from the source ranking and excludes already picked augments when nothing is offered', () => {
    const result = buildAugmentCandidates({
      offeredAugmentIds: [],
      pickedAugmentIds: [101],
      resgGuide: resgGuide(),
      kiwiAugments: null,
      suggestionLimit: 5
    })

    expect(result.every((item) => item.augmentId !== 101)).toBe(true)
    expect(result.every((item) => !item.offered)).toBe(true)
    expect(result.length).toBe(2)
  })

  it('falls back to OP.GG tier ordering when RESG data is absent', () => {
    const result = buildAugmentCandidates({
      offeredAugmentIds: [201, 202],
      pickedAugmentIds: [],
      resgGuide: null,
      kiwiAugments: {
        data: [
          { id: 201, tier: 2, performance: 51, popular: 10 },
          { id: 202, tier: 0, performance: 60, popular: 20 }
        ]
      }
    })

    expect(result.map((item) => item.augmentId)).toEqual([202, 201])
    expect(result[0].combos).toEqual([])
    expect(result[0].stats.tier).toBe(0)
  })
})
