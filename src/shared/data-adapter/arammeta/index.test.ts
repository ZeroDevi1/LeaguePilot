import { describe, expect, it } from 'vitest'

import { adaptArammetaHexCatalog } from '.'

describe('arammeta hex catalog adapter', () => {
  it('keeps champion hex picks and four-round slots, and drops unrelated payload fields', () => {
    const catalog = adaptArammetaHexCatalog({
      patch_prefix: '16.17',
      draftModel: { unused: true },
      champs: {
        '99': {
          name: 'Lux',
          top: {
            kPrismatic: [
              {
                id: 1058,
                g: 1074,
                wr: 0.6529,
                lift: 0.0716,
                pick: 0.1254,
                slots: [
                  { g: 289, wr: 0.6632 },
                  { g: 271, wr: 0.7153 },
                  { g: 295, wr: 0.661 },
                  { g: 218, wr: 0.6607 }
                ]
              }
            ],
            kGold: [
              {
                id: 1141,
                g: 40,
                wr: 0.58,
                lift: -0.01,
                pick: 0.04
              }
            ],
            kSilver: []
          },
          bot: { kGold: [{ id: 1, g: 20, wr: 0.4, lift: -0.1, pick: 0.1 }] },
          items: { top: [] }
        }
      }
    })

    expect(catalog).toEqual({
      patchPrefix: '16.17',
      champions: {
        99: {
          top: {
            kPrismatic: [
              {
                id: 1058,
                games: 1074,
                winRate: 0.6529,
                lift: 0.0716,
                pickRate: 0.1254,
                slots: [
                  { games: 289, winRate: 0.6632 },
                  { games: 271, winRate: 0.7153 },
                  { games: 295, winRate: 0.661 },
                  { games: 218, winRate: 0.6607 }
                ]
              }
            ],
            kGold: [
              {
                id: 1141,
                games: 40,
                winRate: 0.58,
                lift: -0.01,
                pickRate: 0.04,
                slots: []
              }
            ],
            kSilver: []
          }
        }
      }
    })
  })

  it('returns null when no champion has a usable hex bucket', () => {
    expect(
      adaptArammetaHexCatalog({
        patch_prefix: '16.17',
        champs: {
          '0': { top: { kGold: [{ id: 1, g: 10, wr: 0.5, lift: 0, pick: 0.1 }] } },
          '99': { top: { kGold: [{ id: -1, g: 10, wr: 0.5, lift: 0, pick: 0.1 }] } }
        }
      })
    ).toBeNull()
  })

  it('drops malformed rows and slot entries without discarding the champion', () => {
    const catalog = adaptArammetaHexCatalog({
      champs: {
        '1': {
          top: {
            kSilver: [
              {
                id: 1205,
                g: 12,
                wr: 0.51,
                lift: 0.02,
                pick: 0.1,
                slots: [null, { g: 4, wr: 1.2 }]
              },
              { id: 1206, g: -1, wr: 0.5, lift: 0, pick: 0.1 }
            ]
          }
        }
      }
    })

    expect(catalog?.patchPrefix).toBeNull()
    expect(catalog?.champions[1].top.kSilver).toEqual([
      {
        id: 1205,
        games: 12,
        winRate: 0.51,
        lift: 0.02,
        pickRate: 0.1,
        slots: [null, null]
      }
    ])
  })
})
