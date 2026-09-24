import type { MayhemAugmentSession } from '@shared/types/mayhem-augment'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useMayhemAugmentStore = defineStore('shard:mayhem-augment-renderer', () => {
  /** 当前或刚结束的海克斯大乱斗对局进度；不在该模式对局中时为 `null`。 */
  const session = shallowRef<MayhemAugmentSession | null>(null)

  return {
    session
  }
})
