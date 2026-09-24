import { describe, expect, it } from 'vitest'

import { rankNameMatch, rankNameMatchKeywords } from './string-match'

describe('rankNameMatch', () => {
  it('ranks an equal-length initial match ahead of a longer name with the same first initial', () => {
    const exact = rankNameMatch('ys', '夜狩')
    const longer = rankNameMatch('ys', '夜神之矛')

    expect(exact).not.toBeNull()
    expect(longer).not.toBeNull()
    expect(exact!).toBeLessThan(longer!)
  })

  it('uses the best alias when several names are provided', () => {
    expect(rankNameMatchKeywords('ys', ['Night Hunter', '夜狩'])).toBe(0)
  })
})
