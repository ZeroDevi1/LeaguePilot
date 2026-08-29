<template>
  <div class="relative flex flex-col px-2 pt-1 pb-2">
    <OpggTabAndFilters class="mb-1" />

    <KeepAlive>
      <ResgChampionTable
        v-if="provider === 'resg' && currentTab === 'champions'"
        class="min-h-0 flex-1"
      />
      <OpggChampionTable v-else-if="currentTab === 'champions'" class="min-h-0 flex-1" />
      <ResgChampion
        v-else-if="provider === 'resg' && currentTab === 'champion'"
        class="min-h-0 flex-1"
      />
      <OpggChampion v-else-if="currentTab === 'champion'" class="min-h-0 flex-1" />
    </KeepAlive>

    <SessionChampions />
  </div>
</template>

<script setup lang="ts">
import OpggChampion from './OpggChampion.vue'
import OpggChampionTable from './OpggChampionTable.vue'
import OpggTabAndFilters from './OpggTabAndFilters.vue'
import ResgChampion from './ResgChampion.vue'
import ResgChampionTable from './ResgChampionTable.vue'
import { useOpgg } from './context'
import SessionChampions from './widgets/SessionChampions.vue'

const { currentTab, provider } = useOpgg()
</script>
