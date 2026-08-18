<template>
  <div class="relative h-full">
    <NSpin v-if="isLoading" class="absolute inset-0 z-10 dark:bg-black/50">
      <template #description>
        <NButton size="tiny" secondary @click="cancel">
          {{ t('opgg.champion.cancel') }}
        </NButton>
      </template>
    </NSpin>

    <NScrollbar v-if="resgGuide || resgError">
      <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <ResgChampionGuide />
      </div>
    </NScrollbar>
  </div>
</template>

<script setup lang="ts">
import { useTranslation } from 'i18next-vue'
import { NButton, NScrollbar, NSpin } from 'naive-ui'

import { useOpgg } from './context'
import ResgChampionGuide from './widgets/ResgChampionGuide.vue'

const { resgGuide, resgError, isLoading, cancel } = useOpgg()
const { t } = useTranslation()
</script>
