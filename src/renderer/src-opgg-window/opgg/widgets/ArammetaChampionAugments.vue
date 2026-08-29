<template>
  <div
    v-if="groups.length"
    class="@container mb-1 rounded border border-black/10 p-2 last:mb-0 dark:border-[#37373c]"
  >
    <div class="mb-2 flex items-center gap-2">
      <NTag type="info" size="small" :bordered="false">arammeta</NTag>
      <span class="text-xs font-bold">{{ t('opgg.arammeta.title') }}</span>
      <span v-if="patchPrefix" class="text-xs text-black/60 dark:text-white/60">
        {{ t('opgg.arammeta.version', { version: patchPrefix }) }}
      </span>
      <span class="ml-auto text-xs text-black/50 dark:text-white/50">
        {{ t('opgg.arammeta.source') }}
      </span>
    </div>

    <NTabs v-model:value="augmentTab" size="small" :animated="false">
      <NTabPane v-for="group of groups" :key="group.rarity" :name="group.rarity">
        <template #tab>
          <span class="text-xs font-bold">{{ group.rarityName }}</span>
        </template>

        <div class="my-2 flex items-center gap-2">
          <NCheckbox size="small" v-model:checked="isExpanded">
            {{ t('opgg.champion.showAll') }}
          </NCheckbox>
        </div>

        <div class="grid grid-cols-1 gap-x-6 gap-y-1 @min-[600px]:grid-cols-2">
          <div
            class="flex min-h-8 min-w-0 flex-wrap items-center gap-1 rounded"
            :class="{
              'bg-akari-500/7 ring-akari-500/35 dark:bg-akari-400/10 dark:ring-akari-400/30 ring-1':
                isLiveOffer(pick.id)
            }"
            v-for="(pick, i) of group.picks.slice(0, isExpanded ? Infinity : 16)"
            :key="pick.id"
          >
            <div class="min-w-6 shrink-0 text-[10px] text-[#666666] dark:text-[#b2b2b2]">
              #{{ i + 1 }}
            </div>

            <div class="flex min-w-0 items-center gap-1">
              <AugmentDisplay :size="24" :augment-id="pick.id" class="mr-1" />
              <span class="truncate text-xs">{{ lcs.gameData.augmentName(pick.id) }}</span>
            </div>

            <div class="ml-auto flex shrink-0 items-center gap-1">
              <span
                class="flex h-4 items-center rounded bg-black/10 px-1 text-[11px] text-black dark:bg-white/10 dark:text-white"
              >
                {{ t('opgg.champion.winRate') }}
                <span class="ml-1 font-bold">{{ formatPercent(pick.winRate) }}</span>
              </span>
              <span
                class="flex h-4 items-center rounded bg-black/10 px-1 text-[11px] text-black dark:bg-white/10 dark:text-white"
              >
                {{ t('opgg.arammeta.liftValue', { value: formatSignedPercent(pick.lift) }) }}
              </span>
              <span
                class="flex h-4 items-center rounded bg-black/10 px-1 text-[11px] text-black dark:bg-white/10 dark:text-white"
              >
                {{ t('opgg.champion.pickRate') }}
                <span class="ml-1 font-bold">{{ formatPercent(pick.pickRate) }}</span>
              </span>
              <span class="text-[10px] text-black/50 dark:text-white/50">
                {{ t('opgg.champion.times', { times: pick.games.toLocaleString() }) }}
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="hasAnySlots(group.picks.slice(0, isExpanded ? Infinity : 16))"
          class="mt-2 grid grid-cols-1 gap-1 @min-[600px]:grid-cols-2"
        >
          <template
            v-for="pick of group.picks.slice(0, isExpanded ? Infinity : 16)"
            :key="`slots-${pick.id}`"
          >
            <div v-if="visibleSlots(pick).length" class="flex min-w-0 flex-wrap items-center gap-1">
              <AugmentDisplay :size="16" :augment-id="pick.id" />
              <span
                v-for="slot of visibleSlots(pick)"
                :key="`${pick.id}-${slot.level}`"
                class="rounded bg-black/10 px-1 text-[10px] text-black/70 dark:bg-white/10 dark:text-white/70"
              >
                {{ t('opgg.arammeta.slotLevel', { level: slot.level }) }}
                {{ formatPercent(slot.winRate) }}
              </span>
            </div>
          </template>
        </div>
      </NTabPane>
    </NTabs>
  </div>
</template>

<script setup lang="ts">
import AugmentDisplay from '@renderer-shared/components/widgets/AugmentDisplay.vue'
import { useExtraAssetsStore } from '@renderer-shared/shards/extra-assets/store'
import { useLeagueClientStore } from '@renderer-shared/shards/league-client/store'
import {
  ARAMMETA_HEX_RARITIES,
  ARAMMETA_HEX_SLOT_LEVELS,
  type ArammetaHexPick,
  type ArammetaHexRarity
} from '@shared/types/arammeta'
import { useTranslation } from 'i18next-vue'
import { NCheckbox, NTabPane, NTabs, NTag } from 'naive-ui'
import { computed, ref, watch, watchEffect } from 'vue'

import { useOpgg } from '../context'
import { pinLiveItems, useLiveAugmentOffer } from '../utils/live-augment-offer'

const enum AugmentTab {
  All = '<akari:all>',
  kSilver = 'kSilver',
  kGold = 'kGold',
  kPrismatic = 'kPrismatic'
}

const { championId, mode, provider } = useOpgg()
const { t } = useTranslation()
const extraAssetsStore = useExtraAssetsStore()
const lcs = useLeagueClientStore()
const { isLiveOffer } = useLiveAugmentOffer()

const augmentTab = ref<AugmentTab | undefined>(undefined)
const isExpanded = ref(false)

const isMayhemSurface = computed(() => mode.value === 'aram' || provider.value === 'resg')

const championPicks = computed(() => {
  if (!isMayhemSurface.value || championId.value === null) {
    return null
  }

  return extraAssetsStore.arammeta.hexCatalog?.champions[championId.value] ?? null
})

const patchPrefix = computed(() => extraAssetsStore.arammeta.hexCatalog?.patchPrefix ?? null)

const groups = computed(() => {
  const picks = championPicks.value
  if (!picks) {
    return []
  }

  const mapped = ARAMMETA_HEX_RARITIES.flatMap((rarity) =>
    picks.top[rarity].map((item) => ({ ...item, rarity }))
  )
  const sorted = pinLiveItems(mapped, (item) => isLiveOffer(item.id))

  const result: {
    rarity: AugmentTab
    rarityName: string
    picks: Array<ArammetaHexPick & { rarity: ArammetaHexRarity }>
  }[] = []

  if (sorted.length) {
    result.push({
      rarity: AugmentTab.All,
      rarityName: t('opgg.champion.augmentAll'),
      picks: sorted
    })
  }

  for (const rarity of ['kSilver', 'kGold', 'kPrismatic'] as const) {
    const rarityPicks = pinLiveItems(
      picks.top[rarity].map((item) => ({ ...item, rarity })),
      (item) => isLiveOffer(item.id)
    )
    if (!rarityPicks.length) {
      continue
    }

    result.push({
      rarity: rarity as AugmentTab,
      rarityName: rarityName(rarity),
      picks: rarityPicks
    })
  }

  return result
})

watch(
  () => groups.value.map((group) => group.rarity),
  (tabs) => {
    if (!tabs.length) {
      augmentTab.value = undefined
      return
    }

    const activeTab = augmentTab.value
    if (!activeTab || !tabs.includes(activeTab)) {
      augmentTab.value = tabs[0]
    }
  },
  { immediate: true }
)

watchEffect(() => {
  if (championId.value === null) {
    isExpanded.value = false
  }
})

function rarityName(rarity: ArammetaHexRarity) {
  switch (rarity) {
    case 'kSilver':
      return t('opgg.champion.augmentSilver')
    case 'kGold':
      return t('opgg.champion.augmentGold')
    case 'kPrismatic':
      return t('opgg.champion.augmentPrism')
  }
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatSignedPercent(value: number) {
  const percent = value * 100
  if (percent > 0) {
    return `+${percent.toFixed(1)}%`
  }
  if (percent < 0) {
    return `${percent.toFixed(1)}%`
  }
  return '0.0%'
}

function hasAnySlots(picks: ArammetaHexPick[]) {
  return picks.some((pick) => pick.slots.some((slot) => slot !== null))
}

function visibleSlots(pick: ArammetaHexPick) {
  return pick.slots.flatMap((slot, index) => {
    if (!slot) {
      return []
    }

    return [
      {
        level: ARAMMETA_HEX_SLOT_LEVELS[index] ?? index + 1,
        winRate: slot.winRate
      }
    ]
  })
}
</script>
