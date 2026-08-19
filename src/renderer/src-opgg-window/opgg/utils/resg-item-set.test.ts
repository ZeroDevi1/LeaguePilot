import type { ResgChampionGuide, ResgGuideItemCombo } from '@shared/types/resg'
import { describe, expect, it } from 'vitest'

import { createResgItemSet } from './resg-item-set'

const translate = (key: string, options?: Record<string, unknown>) =>
  `${key}:${String(options?.index ?? options?.play ?? '')}`

function createItemCombo(rank: number, size: number): ResgGuideItemCombo {
  return {
    rank,
    size,
    ids: Array.from({ length: size }, (_, index) => rank * 100 + index),
    names: [],
    play: 100 - rank,
    winRate: 0.5,
    pickRate: 0.1
  }
}

function createGuide(itemCombos: ResgGuideItemCombo[]): ResgChampionGuide {
  return {
    version: '16.16',
    champion: {
      id: 1,
      name: '黑暗之女',
      title: '安妮',
      alias: 'Annie',
      roles: ['mage'],
      totalMatches: 100,
      tier: 'T2'
    },
    spells: [],
    skillOrders: [],
    starterItems: [],
    boots: [],
    augments: [],
    augmentCombos: [],
    itemCombos,
    items: [],
    itemBuilds: itemCombos.filter((combo) => combo.rank === 1)
  }
}

describe('RESG item set', () => {
  it('imports the first four five-item builds into separate groups without duplicating the old best build', () => {
    const guide = createGuide([
      createItemCombo(1, 3),
      createItemCombo(1, 5),
      createItemCombo(2, 5),
      createItemCombo(3, 5),
      createItemCombo(4, 5),
      createItemCombo(5, 5)
    ])

    const itemSet = createResgItemSet(guide, translate)

    expect(itemSet.itemGroups.map((group) => group.items)).toEqual([
      guide.itemCombos[0].ids,
      guide.itemCombos[1].ids,
      guide.itemCombos[2].ids,
      guide.itemCombos[3].ids,
      guide.itemCombos[4].ids
    ])
  })
})
