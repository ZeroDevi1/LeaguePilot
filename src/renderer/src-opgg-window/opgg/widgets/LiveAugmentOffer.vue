<template>
  <section v-if="visible" class="live-offer">
    <div class="live-offer-header">
      <NTag type="info" size="small" :bordered="false">{{ t('opgg.liveAugmentOffer.badge') }}</NTag>
      <span class="text-xs font-bold">{{ t('opgg.liveAugmentOffer.title') }}</span>
      <span class="ml-auto text-xs text-black/50 dark:text-white/50">{{ statusText }}</span>
      <NButton size="tiny" secondary :loading="scanning" @click="scanNow">
        {{ t('opgg.liveAugmentOffer.scan') }}
      </NButton>
    </div>

    <NAlert v-if="statusAlert" :type="statusAlert.type" :show-icon="false" class="mb-2">
      {{ statusAlert.text }}
    </NAlert>

    <div v-if="snapshot.offers.length" class="grid grid-cols-1 gap-1 sm:grid-cols-3">
      <div
        v-for="offer in snapshot.offers"
        :key="`${offer.slot}-${offer.sourceName}`"
        class="live-offer-slot"
        :class="{
          picked: isPicked(offer.sourceName),
          unmapped: offer.id === null
        }"
      >
        <span class="guide-rank">{{ offer.slot }}</span>
        <AugmentDisplay v-if="offer.id !== null" :size="28" :augment-id="offer.id" />
        <div v-else class="size-7 rounded bg-black/10 dark:bg-white/10" />
        <div class="min-w-0">
          <div class="truncate text-xs font-bold">
            {{ displayName(offer) }}
          </div>
          <div class="truncate text-[10px] text-black/50 dark:text-white/50">
            {{
              offer.id === null
                ? t('opgg.liveAugmentOffer.unmapped')
                : isPicked(offer.sourceName)
                  ? t('opgg.liveAugmentOffer.picked')
                  : t('opgg.liveAugmentOffer.slot', { index: offer.slot })
            }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import AugmentDisplay from '@renderer-shared/components/widgets/AugmentDisplay.vue'
import { useInstance } from '@renderer-shared/shards'
import { AugmentOfferRenderer } from '@renderer-shared/shards/augment-offer'
import { useLeagueClientStore } from '@renderer-shared/shards/league-client/store'
import type { AugmentOfferItem } from '@shared/types/augment-offer'
import { useTranslation } from 'i18next-vue'
import { NAlert, NButton, NTag, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

import { useLiveAugmentOffer } from '../utils/live-augment-offer'

const { t } = useTranslation()
const leagueClientStore = useLeagueClientStore()
const augmentOffer = useInstance(AugmentOfferRenderer)
const message = useMessage()
const { snapshot, visible } = useLiveAugmentOffer()
const scanning = ref(false)

const statusText = computed(() => {
  switch (snapshot.value.availability) {
    case 'ready':
      return t('opgg.liveAugmentOffer.status.ready')
    case 'waiting':
      return t('opgg.liveAugmentOffer.status.waiting')
    case 'degraded':
      return t('opgg.liveAugmentOffer.status.degraded')
    case 'unavailable':
      return t('opgg.liveAugmentOffer.status.unavailable')
    case 'error':
      return t('opgg.liveAugmentOffer.status.error')
    case 'unsupported':
      return t('opgg.liveAugmentOffer.status.unsupported')
  }
})

const statusAlert = computed(() => {
  switch (snapshot.value.availability) {
    case 'error':
      return { type: 'error' as const, text: t('opgg.liveAugmentOffer.errorHint') }
    case 'degraded':
      return { type: 'warning' as const, text: t('opgg.liveAugmentOffer.degradedHint') }
    case 'waiting':
      return snapshot.value.offers.length
        ? null
        : { type: 'info' as const, text: t('opgg.liveAugmentOffer.waitingHint') }
    default:
      return null
  }
})

async function scanNow() {
  scanning.value = true
  try {
    const result = await augmentOffer.scanNow()
    if (!result.ok) {
      message.warning(t('opgg.liveAugmentOffer.scanFailed'))
    }
  } finally {
    scanning.value = false
  }
}

function displayName(offer: AugmentOfferItem) {
  if (offer.id !== null) {
    return leagueClientStore.gameData.augmentName(offer.id)
  }

  return offer.sourceName
}

function isPicked(sourceName: string) {
  return snapshot.value.picked?.sourceName === sourceName
}
</script>

<style scoped>
@reference '@renderer-shared/assets/css/tailwind.css';

.live-offer {
  @apply rounded border border-black/10 p-2 dark:border-[#37373c];
}

.live-offer-header {
  @apply mb-2 flex items-center gap-2;
}

.live-offer-slot {
  @apply flex min-h-8 items-center gap-1 rounded border border-black/10 px-1.5 py-1 dark:border-white/10;
}

.live-offer-slot.picked {
  @apply border-akari-500/35 bg-akari-500/7 dark:border-akari-400/30 dark:bg-akari-400/10;
}

.live-offer-slot.unmapped {
  @apply border-dashed;
}

.guide-rank {
  @apply min-w-5 text-[10px] text-[#666666] dark:text-[#b2b2b2];
}
</style>
