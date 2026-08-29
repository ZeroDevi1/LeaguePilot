import { useAugmentOfferStore } from '@renderer-shared/shards/augment-offer/store'
import { useLeagueClientStore } from '@renderer-shared/shards/league-client/store'
import type { AugmentOfferSnapshot } from '@shared/types/augment-offer'
import { computed } from 'vue'

export function useLiveAugmentOffer() {
  const augmentOfferStore = useAugmentOfferStore()
  const leagueClientStore = useLeagueClientStore()

  const snapshot = computed(() => augmentOfferStore.snapshot)
  const gameMode = computed(() => leagueClientStore.gameflow.session?.map.gameMode ?? null)
  const offerIds = computed(() => {
    const ids = new Set<number>()
    for (const offer of snapshot.value.offers) {
      if (offer.id !== null) {
        ids.add(offer.id)
      }
    }
    if (snapshot.value.picked?.id !== null && snapshot.value.picked?.id !== undefined) {
      ids.add(snapshot.value.picked.id)
    }
    return ids
  })

  const visible = computed(() => shouldShowLiveAugmentOffer(snapshot.value, gameMode.value))

  return {
    snapshot,
    gameMode,
    offerIds,
    visible,
    isLiveOffer: (id: number | null | undefined) => typeof id === 'number' && offerIds.value.has(id)
  }
}

export function shouldShowLiveAugmentOffer(
  snapshot: AugmentOfferSnapshot,
  gameMode: string | null
) {
  if (snapshot.offers.length > 0 || snapshot.picked !== null) {
    return true
  }

  return gameMode === 'KIWI'
}

export function pinLiveItems<T>(items: T[], isLive: (item: T) => boolean): T[] {
  const live: T[] = []
  const rest: T[] = []

  for (const item of items) {
    if (isLive(item)) {
      live.push(item)
    } else {
      rest.push(item)
    }
  }

  return [...live, ...rest]
}
