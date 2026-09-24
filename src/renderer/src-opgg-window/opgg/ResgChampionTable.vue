<template>
  <div class="flex h-full flex-col">
    <NInput
      :value="filterInput"
      :placeholder="t('opgg.championTable.searchPlaceholder')"
      size="small"
      class="mb-1 text-xs"
      clearable
      @update:value="handleFilterUpdate"
      @compositionstart="handleFilterCompositionStart"
      @compositionend="handleFilterCompositionEnd"
    />
    <NDataTable
      class="flex-1"
      flex-height
      :data="data"
      :columns="columns"
      :row-key="(item: ResgChampionIndexItem) => item.id"
      :row-props="rowProps"
      :loading="isLoading"
      virtual-scroll
      size="small"
    >
      <template #loading>
        <div class="flex flex-col items-center gap-2">
          <NSpin size="small" />
          <NButton size="tiny" secondary @click="cancel">
            {{ t('opgg.championTable.cancel') }}
          </NButton>
        </div>
      </template>
    </NDataTable>
  </div>
</template>

<script lang="tsx" setup>
import LcuImage from '@renderer-shared/components/LcuImage.vue'
import { useCompositionAwareInput } from '@renderer-shared/composables/useCompositionAwareInput'
import { useLeagueClientStore } from '@renderer-shared/shards/league-client/store'
import { championIconUri } from '@renderer-shared/shards/league-client/game-data-assets'
import { parseResgTierLevel } from '@shared/data-adapter/resg'
import type { ResgChampionIndexItem } from '@shared/types/resg'
import { useTranslation } from 'i18next-vue'
import {
  type DataTableColumns,
  type DataTableCreateRowProps,
  NButton,
  NDataTable,
  NInput,
  NSpin
} from 'naive-ui'
import { computed } from 'vue'

import { useChampionNameMatch } from '@main-window/composables/useChampionNameMatch'

import { useOpgg } from './context'
import { getTierTextColorClass } from './utils/theme'

const { t } = useTranslation()
const lcs = useLeagueClientStore()
const { resgChampions, isLoading, cancel, setTab } = useOpgg()
const { match } = useChampionNameMatch()

const {
  inputValue: filterInput,
  committedValue: filterText,
  handleUpdateValue: handleFilterUpdate,
  handleCompositionStart: handleFilterCompositionStart,
  handleCompositionEnd: handleFilterCompositionEnd
} = useCompositionAwareInput()

const columns: DataTableColumns<ResgChampionIndexItem> = [
  {
    title: '#',
    key: 'rank',
    align: 'center',
    width: 46,
    className: 'text-[13px] dark:text-white/80 text-black/80',
    render: (_row, index) => index + 1
  },
  {
    title: () => t('opgg.championTable.columns.champion'),
    key: 'champion',
    align: 'center',
    className: 'text-[13px] dark:text-white/80 text-black/80',
    sorter: (left, right) => {
      const leftName = lcs.gameData.champions[left.id]?.name
      const rightName = lcs.gameData.champions[right.id]?.name
      return leftName && rightName ? leftName.localeCompare(rightName) : left.id - right.id
    },
    render: (row) => (
      <div class="flex items-center justify-center overflow-hidden">
        <LcuImage class="size-8 shrink-0" src={championIconUri(row.id)} />
        <div class="ml-2 w-25 truncate text-left text-[13px] text-black/80 dark:text-white/80">
          {lcs.gameData.champions[row.id]?.name || row.title || row.id}
        </div>
      </div>
    )
  },
  {
    title: () => t('opgg.championTable.columns.tier'),
    key: 'tier',
    align: 'center',
    width: 76,
    className: 'text-[13px] dark:text-white/80 text-black/80',
    sorter: (left, right) => parseResgTierLevel(left.tier) - parseResgTierLevel(right.tier),
    render: (row) => (
      <span class={getTierTextColorClass(parseResgTierLevel(row.tier))}>
        {row.tier === 'T0' ? 'OP' : row.tier}
      </span>
    )
  },
  {
    title: () => t('opgg.championTable.columns.winRate'),
    key: 'winRate',
    align: 'center',
    width: 86,
    className: 'text-[13px] dark:text-white/80 text-black/80',
    sorter: (left, right) => left.winRate - right.winRate,
    render: (row) => `${(row.winRate * 100).toFixed(2)}%`
  },
  {
    title: () => t('opgg.championTable.columns.matches'),
    key: 'totalMatches',
    align: 'center',
    width: 92,
    className: 'text-[13px] dark:text-white/80 text-black/80',
    sorter: (left, right) => left.totalMatches - right.totalMatches,
    render: (row) => row.totalMatches.toLocaleString()
  }
]

const data = computed(() => {
  const items = resgChampions.value?.items ?? []
  return items.filter((item) => {
    if (!filterText.value) {
      return true
    }
    return match(filterText.value, lcs.gameData.champions[item.id]?.name ?? item.title, item.id)
  })
})

const rowProps: DataTableCreateRowProps<ResgChampionIndexItem> = (row) => ({
  class: 'cursor-pointer',
  onClick: () => setTab('champion', row.id)
})
</script>
