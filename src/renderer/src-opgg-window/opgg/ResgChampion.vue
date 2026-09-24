<template>
  <div class="relative h-full">
    <NSpin v-if="isLoading" class="absolute inset-0 z-10 dark:bg-black/50">
      <template #description>
        <NButton size="tiny" secondary @click="cancel">
          {{ t('opgg.champion.cancel') }}
        </NButton>
      </template>
    </NSpin>

    <NScrollbar v-if="summary || resgGuide || resgError">
      <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <!-- summary: 梯队 / 排名 / 胜率，来自 RESG 英雄列表，与详情加载是否成功无关 -->
        <div v-if="summary" class="flex h-20 items-center gap-3 px-2 pt-1 pb-3 lg:col-span-2">
          <ChampionIcon
            round
            class="size-14 ring-2"
            :champion-id="summary.item.id"
            :class="getTierRingColorClass(summary.tierLevel)"
          />

          <div class="mr-auto min-w-0">
            <div class="truncate text-lg font-bold">
              {{ resources.champions.name(summary.item.id) }}
            </div>
            <div class="flex items-center gap-2">
              <div class="text-sm font-bold" :class="getTierTextColorClass(summary.tierLevel)">
                {{ summary.tierText }}
              </div>
              <div class="text-[13px] text-black/80 dark:text-white/80">
                {{ t('opgg.resg.rankOf', { rank: summary.rank, total: summary.total }) }}
              </div>
              <div class="text-[13px] text-black/80 dark:text-white/80">
                {{ t(`opgg.filters.modes.${RESG_MODE}`) }}
              </div>
            </div>
          </div>

          <div class="flex w-43 flex-wrap justify-end gap-2 self-end">
            <div class="w-12.5">
              <div class="text-[11px] text-black/70 dark:text-white/70">
                {{ t('opgg.champion.winRate') }}
              </div>
              <div class="text-[13px] font-bold">
                {{ (summary.item.winRate * 100).toFixed(2) }}%
              </div>
            </div>
            <div class="w-12.5">
              <div class="text-[11px] text-black/70 dark:text-white/70">
                {{ t('opgg.resg.winRateRank') }}
              </div>
              <div class="text-[13px] font-bold">#{{ summary.winRateRank }}</div>
            </div>
            <div class="w-12.5">
              <div class="text-[11px] text-black/70 dark:text-white/70">
                {{ t('opgg.champion.plays') }}
              </div>
              <div class="text-[13px] font-bold">
                {{ summary.item.totalMatches.toLocaleString() }}
              </div>
            </div>
          </div>
        </div>

        <!-- 海克斯大乱斗对局中的强化选择助手 -->
        <MayhemAugmentAssistant />

        <ResgChampionGuide />
      </div>
    </NScrollbar>
  </div>
</template>

<script setup lang="ts">
import ChampionIcon from '@renderer-shared/components/widgets/ChampionIcon.vue'
import { useAkariResourceProvider } from '@renderer-shared/providers/akari-resource'
import { parseResgTierLevel } from '@shared/data-adapter/resg'
import { useTranslation } from 'i18next-vue'
import { NButton, NScrollbar, NSpin } from 'naive-ui'
import { computed } from 'vue'

import { RESG_MODE, useOpgg } from './context'
import { getTierRingColorClass, getTierTextColorClass } from './utils/theme'
import ResgChampionGuide from './widgets/ResgChampionGuide.vue'
import MayhemAugmentAssistant from './widgets/mayhem-augment-assistant/MayhemAugmentAssistant.vue'

const { championId, resgChampions, resgGuide, resgError, isLoading, cancel } = useOpgg()
const { t } = useTranslation()
const resources = useAkariResourceProvider()

/**
 * 当前英雄在 RESG 榜单中的位置。
 *
 * - `rank`：RESG 默认榜单顺序（与梯队表的 `#` 列一致）。
 * - `winRateRank`：按胜率降序的名次，便于和梯队标签互相印证。
 */
const summary = computed(() => {
  const items = resgChampions.value?.items
  const id = championId.value
  if (!items || !id) {
    return null
  }

  const index = items.findIndex((item) => item.id === id)
  if (index < 0) {
    return null
  }

  const item = items[index]
  const winRateRank = items.filter((other) => other.winRate > item.winRate).length + 1

  return {
    item,
    rank: index + 1,
    total: items.length,
    winRateRank,
    tierLevel: parseResgTierLevel(item.tier),
    tierText: item.tier === 'T0' ? 'OP' : item.tier
  }
})
</script>
