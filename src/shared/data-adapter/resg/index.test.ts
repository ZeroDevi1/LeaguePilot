import { describe, expect, it } from 'vitest'

import {
  adaptResgChampionGuide,
  adaptResgChampionIndex,
  adaptResgVersions,
  isResgGuideUsable,
  selectLatestResgVersion
} from '.'

describe('RESG data adapter', () => {
  it('selects the numerically latest version without trusting response order', () => {
    expect(
      selectLatestResgVersion([
        { version: '16.9', collectedAt: '' },
        { version: '16.16', collectedAt: '' },
        { version: 'invalid', collectedAt: '' },
        { version: '16.10', collectedAt: '' }
      ])
    ).toBe('16.16')
  })

  it('normalizes current RESG champion data and deduplicates linked item builds', () => {
    const guide = adaptResgChampionGuide(
      {
        champion: {
          id: 1,
          name: '黑暗之女',
          title: '安妮',
          alias: 'Annie',
          roles: ['mage'],
          totalMatches: 100,
          tier: 'T2'
        },
        builds: {
          SPELLS: [
            {
              rank: 1,
              value: [
                { id: 4, name: '闪现' },
                { id: 32, name: '标记' }
              ],
              totalMatches: 80,
              winRate: 0.5,
              pickRate: 0.8
            }
          ],
          SKILL_ORDER: [
            {
              rank: 1,
              value: [
                { id: 0, name: 'Q' },
                { id: 0, name: 'W' }
              ],
              totalMatches: 70,
              winRate: 0.51,
              pickRate: 0.7
            }
          ]
        },
        startingItems: [
          {
            rank: 1,
            value: [{ id: 3802, name: '遗失的章节' }],
            totalMatches: 60,
            winRate: 0.52,
            pickRate: 0.6
          }
        ],
        itemAnalysis: {
          items: [
            {
              rank: 1,
              item: { id: 3118, name: '残疫' },
              totalMatches: 50,
              winMatches: 28,
              winRate: 0.56,
              pickRate: 0.5
            }
          ],
          combos: {
            '2': [
              {
                id: 1,
                rank: 1,
                size: 2,
                items: [
                  { id: 3118, name: '残疫' },
                  { id: 4645, name: '影焰' }
                ],
                totalMatches: 35,
                winRate: 0.55,
                pickRate: 0.2
              }
            ]
          }
        },
        recommendedAugments: [
          {
            id: 1030,
            name: '尤里卡',
            quality: 3,
            totalMatches: 40,
            winRate: 0.56,
            pickRate: 0.3
          }
        ],
        augmentCombos: {
          '1': [
            {
              id: 1,
              rank: 1,
              size: 1,
              augments: [{ id: 2083, name: '牙仙子', quality: 1 }],
              totalMatches: 50,
              winRate: 0.53,
              builds: [
                {
                  items: [
                    { id: 3118, name: '残疫' },
                    { id: 4645, name: '影焰' }
                  ],
                  total_matches: 30,
                  win_rate: 0.54
                }
              ]
            },
            {
              id: 2,
              rank: 2,
              size: 1,
              augments: [{ id: 1390, name: '超凡邪恶', quality: 1 }],
              totalMatches: 40,
              winRate: 0.52,
              builds: [
                {
                  items: [
                    { id: 3118, name: '残疫' },
                    { id: 4645, name: '影焰' }
                  ],
                  total_matches: 20,
                  win_rate: 0.51
                }
              ]
            }
          ]
        }
      },
      '16.16'
    )

    expect(guide).not.toBeNull()
    expect(guide?.spells[0].ids).toEqual([4, 32])
    expect(guide?.skillOrders[0].names).toEqual(['Q', 'W'])
    expect(guide?.skillOrders[0].ids).toEqual([])
    expect(guide?.augments[0].id).toBe(1030)
    expect(guide?.augmentCombos[0].augmentIds).toEqual([2083])
    expect(guide?.augmentCombos[0].size).toBe(1)
    expect(guide?.augmentCombos[0].builds[0]).toMatchObject({
      ids: [3118, 4645],
      play: 30,
      winRate: 0.54
    })
    expect(guide?.itemCombos[0]).toMatchObject({
      size: 2,
      ids: [3118, 4645],
      play: 35,
      winRate: 0.55,
      pickRate: 0.2
    })
    expect(guide?.items[0]).toMatchObject({
      id: 3118,
      play: 50,
      win: 28,
      winRate: 0.56,
      pickRate: 0.5
    })
    expect(guide?.itemBuilds).toHaveLength(1)
    expect(guide?.itemBuilds[0].ids).toEqual([3118, 4645])
    expect(guide && isResgGuideUsable(guide)).toBe(true)
  })

  it('accepts numeric item and augment ids from current RESG modules', () => {
    const guide = adaptResgChampionGuide(
      {
        champion: {
          id: 1,
          name: '黑暗之女',
          title: '安妮',
          alias: 'Annie',
          roles: ['mage'],
          totalMatches: 100,
          tier: 'T2'
        },
        itemAnalysis: {
          items: [
            {
              rank: 1,
              item: { id: 3118 },
              totalMatches: 50,
              winMatches: 28,
              winRate: 0.56,
              pickRate: 0.5
            }
          ],
          combos: {
            '2': [
              {
                id: 1,
                rank: 1,
                size: 2,
                items: [3118, 4645],
                totalMatches: 35,
                winRate: 0.55,
                pickRate: 0.2
              }
            ]
          }
        },
        recommendedAugments: [
          {
            id: 1030,
            name: '尤里卡',
            quality: 3,
            totalMatches: 40,
            winRate: 0.56,
            pickRate: 0.3
          }
        ],
        augmentCombos: {
          '2': [
            {
              id: 31,
              rank: 1,
              size: 2,
              augments: [1030, 1390],
              totalMatches: 246,
              winRate: 0.439,
              builds: [
                {
                  items: [3118, 4645, 3089],
                  total_matches: 87,
                  win_rate: 0.3563
                }
              ]
            }
          ]
        }
      },
      '16.16'
    )

    expect(guide?.items[0]).toMatchObject({ id: 3118, name: '', play: 50 })
    expect(guide?.itemCombos[0].ids).toEqual([3118, 4645])
    expect(guide?.itemBuilds[0].ids).toEqual([3118, 4645])
    expect(guide?.augmentCombos[0]).toMatchObject({
      size: 2,
      augmentIds: [1030, 1390],
      augmentNames: ['尤里卡', '']
    })
    expect(guide?.augmentCombos[0].builds[0].ids).toEqual([3118, 4645, 3089])
  })

  it('preserves provider ranks and filters malformed nested combination data independently', () => {
    const guide = adaptResgChampionGuide(
      {
        champion: {
          id: 1,
          name: '黑暗之女',
          title: '安妮',
          alias: 'Annie',
          roles: ['mage'],
          totalMatches: 100,
          tier: 'T2'
        },
        augmentCombos: {
          '1': [
            {
              id: 2,
              rank: 2,
              size: 1,
              augments: [{ id: 1390, name: '超凡邪恶', quality: 1 }],
              totalMatches: 100,
              winRate: 0.52,
              builds: []
            },
            {
              id: 1,
              rank: 1,
              size: 1,
              augments: [{ id: 2083, name: '牙仙子', quality: 1 }],
              totalMatches: 10,
              winRate: 0.53,
              builds: [
                {
                  items: [{ id: 3118, name: '残疫' }],
                  total_matches: 8,
                  win_rate: 0.5
                },
                {
                  items: [{ id: 0, name: '损坏装备' }],
                  total_matches: 2,
                  win_rate: 0.5
                }
              ]
            }
          ],
          '5': [
            {
              id: 3,
              rank: 1,
              size: 5,
              augments: Array.from({ length: 5 }, (_, index) => ({
                id: index + 1,
                name: `强化 ${index + 1}`,
                quality: 1
              })),
              totalMatches: 10,
              winRate: 0.5,
              builds: []
            }
          ]
        },
        itemAnalysis: {
          combos: {
            '2': [
              {
                id: 1,
                rank: 1,
                size: 2,
                items: [
                  { id: 3118, name: '残疫' },
                  { id: 0, name: '损坏装备' }
                ],
                totalMatches: 20,
                winRate: 0.5,
                pickRate: 0.2
              }
            ],
            '6': [
              {
                id: 2,
                rank: 1,
                size: 6,
                items: Array.from({ length: 6 }, (_, index) => ({
                  id: index + 1,
                  name: `装备 ${index + 1}`
                })),
                totalMatches: 10,
                winRate: 0.5,
                pickRate: 0.1
              }
            ]
          }
        }
      },
      '16.16'
    )

    expect(guide?.augmentCombos.map((combo) => combo.rank)).toEqual([1, 2])
    expect(guide?.augmentCombos[0].builds).toHaveLength(1)
    expect(guide?.itemCombos).toEqual([])
  })

  it('filters malformed version and champion index entries at the trust boundary', () => {
    expect(
      adaptResgVersions([
        { version: '16.16', collectedAt: '2026-08-16T00:00:00Z' },
        { version: '../private', collectedAt: '2026-08-16T00:00:00Z' },
        null
      ])
    ).toEqual([{ version: '16.16', collectedAt: '2026-08-16T00:00:00Z' }])

    expect(
      adaptResgChampionIndex({
        items: [
          {
            id: 1,
            name: '黑暗之女',
            title: '安妮',
            alias: 'Annie',
            roles: ['mage'],
            totalMatches: 100,
            winMatches: 52,
            winRate: 0.52,
            tier: 'T2'
          },
          { id: -1 }
        ]
      })
    ).toEqual({
      items: [
        {
          id: 1,
          name: '黑暗之女',
          title: '安妮',
          alias: 'Annie',
          roles: ['mage'],
          totalMatches: 100,
          winMatches: 52,
          winRate: 0.52,
          tier: 'T2'
        }
      ]
    })
  })

  it('rejects malformed champion details and recognizes empty placeholders', () => {
    expect(
      adaptResgChampionGuide(
        {
          champion: {
            id: 0,
            name: '',
            title: '',
            alias: '',
            roles: [],
            totalMatches: 0,
            tier: ''
          }
        },
        '16.16'
      )
    ).toBeNull()

    const emptyGuide = adaptResgChampionGuide(
      {
        champion: {
          id: 1,
          name: '黑暗之女',
          title: '安妮',
          alias: 'Annie',
          roles: [],
          totalMatches: 0,
          tier: 'T2'
        }
      },
      '16.16'
    )

    expect(emptyGuide && isResgGuideUsable(emptyGuide)).toBe(false)
  })
})
