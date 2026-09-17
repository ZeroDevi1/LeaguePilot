import type { ResgChampionGuide, ResgGuideBuild, ResgGuideItemCombo } from '@shared/types/resg'
import { describe, expect, it } from 'vitest'

import { createResgItemSet } from './resg-item-set'

/** 测试用翻译函数，保留 key 和会被写入标题的关键字段。 */
const translate = (key: string, options?: Record<string, unknown>) => {
  const payload = options
    ? Object.entries(options)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(',')
    : ''
  return payload ? `${key}{${payload}}` : key
}

/**
 * 构造指定件数和名次的核心装备组合。
 *
 * @param rank 组合名次。
 * @param size 组合内的装备数量。
 * @returns 用稳定假 ID 填充的装备组合。
 */
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

/**
 * 构造一条技能加点方案。
 *
 * @param rank 方案名次。
 * @param names 技能键，例如 `['Q', 'W', 'E']`。
 * @returns 不含装备 ID 的 RESG 加点方案。
 */
function createSkillOrder(rank: number, names: string[]): ResgGuideBuild {
  return {
    rank,
    ids: [],
    names,
    play: 80 - rank,
    winRate: 0.5,
    pickRate: 0.4
  }
}

/**
 * 构造用于装备页转换测试的 RESG 攻略。
 *
 * @param itemCombos 核心装备组合；默认也会生成各件数的首选 `itemBuilds`。
 * @param extra 覆盖攻略中的其它字段，例如技能加点或旧版回退出装。
 * @returns 可交给 `createResgItemSet` 的攻略对象。
 */
function createGuide(
  itemCombos: ResgGuideItemCombo[],
  extra: Partial<ResgChampionGuide> = {}
): ResgChampionGuide {
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
    itemBuilds: itemCombos.filter((combo) => combo.rank === 1),
    ...extra
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

  it('keeps multiple core builds per item count and writes skill orders as title-only groups', () => {
    const guide = createGuide(
      [
        createItemCombo(1, 2),
        createItemCombo(2, 2),
        createItemCombo(3, 2),
        createItemCombo(4, 2),
        createItemCombo(1, 3),
        createItemCombo(2, 3),
        createItemCombo(1, 5),
        createItemCombo(2, 5)
      ],
      {
        skillOrders: [createSkillOrder(1, ['Q', 'W', 'E']), createSkillOrder(2, ['Q', 'E', 'W'])],
        starterItems: [
          {
            rank: 1,
            ids: [3802],
            names: ['遗失的章节'],
            play: 60,
            winRate: 0.52,
            pickRate: 0.6
          }
        ]
      }
    )

    const itemSet = createResgItemSet(guide, translate)
    /** 各分组写入商店的装备 ID；技能加点分组为空数组。 */
    const groupItems = itemSet.itemGroups.map((group) => group.items)
    /** 各分组标题，用于确认加点顺序已经写进装备页。 */
    const groupTitles = itemSet.itemGroups.map((group) => group.title)

    expect(itemSet.titleNote).toBe('Q › W › E')
    expect(groupTitles[0]).toContain('opgg.resg.skillOrderGroup')
    expect(groupTitles[0]).toContain('Q › W › E')
    expect(groupTitles[1]).toContain('Q › E › W')
    expect(groupItems).toEqual([
      [],
      [],
      [3802],
      guide.itemCombos[0].ids,
      guide.itemCombos[1].ids,
      guide.itemCombos[2].ids,
      guide.itemCombos[4].ids,
      guide.itemCombos[5].ids,
      guide.itemCombos[6].ids,
      guide.itemCombos[7].ids
    ])
    expect(groupItems).not.toContainEqual(guide.itemCombos[3].ids)
  })

  it('falls back to preferred item builds when combination stats are missing', () => {
    const itemBuilds: ResgGuideBuild[] = [
      {
        rank: 1,
        ids: [3118, 4645],
        names: ['残疫', '影焰'],
        play: 35,
        winRate: 0.55,
        pickRate: 0.2
      },
      {
        rank: 2,
        ids: [3118, 4645, 3089],
        names: ['残疫', '影焰', '灭世者的死亡之帽'],
        play: 20,
        winRate: 0.51,
        pickRate: null
      }
    ]
    const guide = createGuide([], {
      itemBuilds,
      skillOrders: [createSkillOrder(1, ['  Q  ', '', 'W'])]
    })

    const itemSet = createResgItemSet(guide, translate)

    expect(itemSet.titleNote).toBe('Q › W')
    expect(itemSet.itemGroups.map((group) => group.items)).toEqual([
      [],
      itemBuilds[0].ids,
      itemBuilds[1].ids
    ])
  })
})
