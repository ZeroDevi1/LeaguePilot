import { ModeType, PositionType, RegionType, TierType } from '@shared/types/opgg'
import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

export const useOpggStore = defineStore('shard:opgg-renderer', () => {
  const frontendSettings = shallowReactive({
    autoApplyRunes: false,
    autoApplyItems: false,
    autoApplySpells: false,
    kiwiGuideProvider: 'opgg' as 'opgg' | 'resg',
    /** 窗口打开时是否优先进入 RESG。为 false 时沿用 champion-data 的 OP.GG / 101 首选源。 */
    preferResg: false
  })

  const savedPreferences = shallowReactive<{
    flashPosition: 'auto' | 'd' | 'f'
    mode: ModeType
    position: PositionType
    region: RegionType
    tier: TierType
  }>({
    flashPosition: 'auto',
    mode: 'ranked',
    position: 'top',
    region: 'global',
    tier: 'all'
  })

  return {
    frontendSettings,
    savedPreferences
  }
})
