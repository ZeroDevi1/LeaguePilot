<template>
  <div>
    <!-- buttons + tabs -->
    <div class="mb-1 flex items-center gap-1">
      <NSelect
        size="small"
        class="w-21!"
        :placeholder="t('opgg.filters.provider')"
        :value="provider"
        :options="providerOptions"
        :render-label="renderLabel"
        :consistent-menu-width="false"
        :disabled="isLoading"
        @update:value="changeProvider"
      />

      <!-- refresh -->
      <NButton
        secondary
        class="size-8!"
        :title="t('opgg.filters.refresh')"
        :loading="isLoading"
        @click="() => refresh()"
      >
        <template #icon>
          <NIcon><RefreshSharp /></NIcon>
        </template>
      </NButton>

      <!-- settings -->
      <NButton
        secondary
        class="size-8!"
        :title="t('opgg.filters.settings.button')"
        @click="isSettingsShow = true"
      >
        <template #icon>
          <NIcon><Settings /></NIcon>
        </template>
      </NButton>

      <NTabs class="tabs" :value="currentTab" type="segment" size="small" @update:value="setTab">
        <NTab name="champions" :tab="t('opgg.filters.champions')" />
        <NTab :title="t('opgg.filters.champion')" name="champion" :disabled="!championId">
          <div v-if="championId" class="flex items-center gap-2">
            <ChampionIcon round class="size-5" :champion-id="championId" />
            <span>{{ lcs.gameData.championName(championId) }}</span>
          </div>
          <div v-else>{{ t('opgg.filters.empty') }}</div>
        </NTab>
      </NTabs>
    </div>

    <!-- filters -->
    <div class="flex gap-1">
      <NSelect
        size="small"
        :placeholder="t('opgg.filters.mode')"
        :options="provider === 'resg' ? resgModeOptions : modeOptions"
        :value="provider === 'resg' ? 'aram' : mode"
        @update:value="changeMode"
        :render-label="renderLabel"
        class="w-0! flex-1"
        :consistent-menu-width="false"
        :disabled="isLoading || provider === 'resg'"
      />
      <NSelect
        v-if="provider === 'opgg'"
        size="small"
        :placeholder="t('opgg.filters.region')"
        :options="regionOptions"
        :value="region"
        @update:value="changeRegion"
        :render-label="renderLabel"
        class="w-0! flex-1"
        :consistent-menu-width="false"
        :disabled="isLoading"
      />
      <NSelect
        v-if="provider === 'opgg'"
        size="small"
        :placeholder="t('opgg.filters.rankTier')"
        :options="tierOptions"
        :value="tier"
        @update:value="changeTier"
        :render-label="renderLabel"
        class="w-0! flex-1"
        :consistent-menu-width="false"
        :disabled="isLoading || mode === 'arena'"
      />
      <NSelect
        v-if="provider === 'opgg'"
        size="small"
        :placeholder="t('opgg.filters.position')"
        :options="positionOptions"
        :value="position"
        @update:value="changePosition"
        class="w-18!"
        :render-label="renderLabel"
        :consistent-menu-width="false"
        :disabled="isLoading || mode !== 'ranked'"
      />
      <NSelect
        size="small"
        :placeholder="t('opgg.filters.version')"
        :value="provider === 'resg' ? resgVersion : version"
        :options="versionOptions"
        @update:value="changeVersion"
        :render-label="renderLabel"
        class="w-18!"
        :consistent-menu-width="false"
        :disabled="isLoading"
      />
    </div>

    <!-- settings modal -->
    <NModal v-model:show="isSettingsShow" transform-origin="center">
      <div class="w-125 max-w-[90vw]">
        <SettingsPane @close="isSettingsShow = false" />
      </div>
    </NModal>
  </div>
</template>

<script setup lang="tsx">
import {
  useModeOptions,
  usePositionOptions,
  useRegionOptions,
  useTierOptions
} from '@opgg-window/opgg/utils/options'
import ChampionIcon from '@renderer-shared/components/widgets/ChampionIcon.vue'
import { useLeagueClientStore } from '@renderer-shared/shards/league-client/store'
import { RefreshSharp, Settings } from '@vicons/ionicons5'
import { useTranslation } from 'i18next-vue'
import { NButton, NIcon, NModal, NSelect, NTab, NTabs, SelectRenderLabel } from 'naive-ui'
import { computed, ref } from 'vue'

import { useOpgg } from './context'
import SettingsPane from './widgets/Settings.vue'

const { t } = useTranslation()
const lcs = useLeagueClientStore()

const {
  currentTab,
  provider,
  mode,
  versions,
  version,
  resgVersions,
  resgVersion,
  tier,
  position,
  region,
  isLoading,
  championId,
  changeProvider,
  changeMode,
  changePosition,
  changeRegion,
  changeTier,
  changeVersion,
  refresh,
  setTab
} = useOpgg()

const isSettingsShow = ref(false)

const { modeOptions } = useModeOptions()
const { regionOptions } = useRegionOptions()
const { tierOptions } = useTierOptions()
const { positionOptions } = usePositionOptions(mode)

const providerOptions = [
  { label: 'OP.GG', value: 'opgg' },
  { label: 'RESG', value: 'resg' }
]
const resgModeOptions = computed(() => [{ label: t('opgg.filters.modes.aram'), value: 'aram' }])

const versionOptions = computed(() =>
  (provider.value === 'resg' ? resgVersions.value.map((item) => item.version) : versions.value).map(
    (item) => ({ label: item, value: item })
  )
)

const renderLabel: SelectRenderLabel = (option) => {
  return <span class="text-xs">{option.label as string}</span>
}
</script>
