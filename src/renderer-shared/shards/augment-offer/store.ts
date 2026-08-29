import type { AugmentOfferSnapshot } from '@shared/types/augment-offer'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

const EMPTY_SNAPSHOT: AugmentOfferSnapshot = {
  availability: 'waiting',
  source: 'screen-vision',
  gameId: null,
  offers: [],
  picked: null,
  updatedAt: null,
  reason: null
}

export const useAugmentOfferStore = defineStore('shard:augment-offer-renderer', () => {
  const snapshot = shallowRef<AugmentOfferSnapshot>(EMPTY_SNAPSHOT)

  return {
    snapshot
  }
})
