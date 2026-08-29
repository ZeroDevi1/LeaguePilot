import { describe, expect, test } from 'vitest'

import {
  differenceHashFromGray,
  hammingDistance,
  iconRectsForOfferBand,
  isNearlyBlackBgra,
  matchIconHash,
  resolveKiwiIconUrl,
  shouldScanForAugmentOffer,
  uniqueMatchedIds,
  unlockedAugmentRounds
} from './vision-match'

function grayRamp(width: number, height: number, leftToRight: boolean) {
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels[y * width + x] = leftToRight ? x * 20 : (width - 1 - x) * 20
    }
  }
  return pixels
}

describe('mayhem screen-vision match helpers', () => {
  test('unlocks one round at each of 3 / 7 / 11 / 15', () => {
    expect(unlockedAugmentRounds(2)).toBe(0)
    expect(unlockedAugmentRounds(3)).toBe(1)
    expect(unlockedAugmentRounds(6)).toBe(1)
    expect(unlockedAugmentRounds(7)).toBe(2)
    expect(unlockedAugmentRounds(15)).toBe(4)
  })

  test('scans only in KIWI after a round unlocks, and keeps scanning while offers are visible', () => {
    expect(
      shouldScanForAugmentOffer({
        gameMode: 'KIWI',
        phase: 'InProgress',
        level: 3,
        completedRounds: 0,
        hasCurrentOffers: false
      })
    ).toBe(true)

    expect(
      shouldScanForAugmentOffer({
        gameMode: 'KIWI',
        phase: 'InProgress',
        level: 6,
        completedRounds: 1,
        hasCurrentOffers: false
      })
    ).toBe(false)

    expect(
      shouldScanForAugmentOffer({
        gameMode: 'KIWI',
        phase: 'InProgress',
        level: 6,
        completedRounds: 1,
        hasCurrentOffers: true
      })
    ).toBe(true)

    expect(
      shouldScanForAugmentOffer({
        gameMode: 'ARAM',
        phase: 'InProgress',
        level: 3,
        completedRounds: 0,
        hasCurrentOffers: false
      })
    ).toBe(false)
  })

  test('splits the offer band into three on-screen icon rects', () => {
    const rects = iconRectsForOfferBand(1920, 1080)
    expect(rects).toHaveLength(3)
    expect(rects[0].x).toBeLessThan(rects[1].x)
    expect(rects[1].x).toBeLessThan(rects[2].x)
    expect(rects.every((rect) => rect.width >= 8 && rect.height >= 8)).toBe(true)
    expect(rects[2].x + rects[2].width).toBeLessThanOrEqual(1920)
  })

  test('dHash is identical for the same pixels and far for a reversed gradient', () => {
    const left = differenceHashFromGray(grayRamp(9, 8, true), 9, 8)
    const same = differenceHashFromGray(grayRamp(9, 8, true), 9, 8)
    const reversed = differenceHashFromGray(grayRamp(9, 8, false), 9, 8)

    expect(hammingDistance(left, same)).toBe(0)
    expect(hammingDistance(left, reversed)).toBeGreaterThan(20)
  })

  test('matches the nearest catalog hash and rejects duplicates or ties', () => {
    const catalog = [
      { id: 1, nameEn: 'a', nameCn: '甲', hash: 0b11110000n },
      { id: 2, nameEn: 'b', nameCn: '乙', hash: 0b11110001n },
      { id: 3, nameEn: 'c', nameCn: '丙', hash: 0b00001111n }
    ]

    expect(matchIconHash(0b11110000n, catalog, { maxDistance: 4, minMargin: 1 })?.id).toBe(1)
    expect(matchIconHash(0b11110000n, catalog, { maxDistance: 4, minMargin: 2 })).toBeNull()
    expect(uniqueMatchedIds([{ id: 1 }, { id: 2 }, { id: 3 }])).toEqual([1, 2, 3])
    expect(uniqueMatchedIds([{ id: 1 }, { id: 1 }, { id: 3 }])).toBeNull()
    expect(uniqueMatchedIds([{ id: 1 }, null, { id: 3 }])).toBeNull()
  })

  test('detects an almost black BGRA frame', () => {
    const dark = new Uint8Array(4 * 4)
    const bright = new Uint8Array([
      255, 255, 255, 255, 200, 200, 200, 255, 180, 180, 180, 255, 255, 255, 255, 255
    ])
    expect(isNearlyBlackBgra(dark, 2, 2)).toBe(true)
    expect(isNearlyBlackBgra(bright, 2, 2)).toBe(false)
  })

  test('accepts absolute, protocol-relative, and gtimg-relative icon paths', () => {
    expect(resolveKiwiIconUrl('https://game.gtimg.cn/a.png')).toBe('https://game.gtimg.cn/a.png')
    expect(resolveKiwiIconUrl('//game.gtimg.cn/a.png')).toBe('https://game.gtimg.cn/a.png')
    expect(resolveKiwiIconUrl('/images/lol/a.png')).toBe('https://game.gtimg.cn/images/lol/a.png')
    expect(resolveKiwiIconUrl('   ')).toBeNull()
  })
})
