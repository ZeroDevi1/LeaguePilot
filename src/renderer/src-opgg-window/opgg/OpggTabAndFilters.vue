<template>
  <div>
    <!-- buttons + tabs -->
    <div class="mb-1 flex items-center gap-1">
      <NSelect
        size="small"
        :placeholder="t('opgg.filters.source')"
        :options="sourceOptions"
        :value="activeSource"
        :title="t('opgg.filters.source')"
        class="w-22!"
        :consistent-menu-width="false"
        :disabled="isLoading"
        @update:value="changeSource"
      />

      <a :href="sourceHomeUrl" :title="sourceHomeTitle" target="_blank">
        <NButton secondary class="size-8!">
          <template #icon>
            <NIcon><OpenOutline /></NIcon>
          </template>
        </NButton>
      </a>

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
            <span>{{ resources.champions.name(championId) }}</span>
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
        :options="isResg ? resgModeOptions : modeOptions"
        :value="isResg ? RESG_MODE : mode"
        @update:value="changeMode"
        :render-label="renderLabel"
        class="w-0! flex-1"
        :consistent-menu-width="false"
        :disabled="isLoading || isResg"
      />
      <NSelect
        v-if="supportsFilter('region')"
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
        v-if="supportsFilter('tier')"
        size="small"
        :placeholder="t('opgg.filters.rankTier')"
        :options="tierOptions"
        :value="tier"
        @update:value="changeTier"
        :render-label="renderLabel"
        class="w-0! flex-1"
        :consistent-menu-width="false"
        :disabled="isLoading"
      />
      <NSelect
        v-if="supportsFilter('position')"
        size="small"
        :placeholder="t('opgg.filters.position')"
        :options="positionOptions"
        :value="position"
        @update:value="changePosition"
        class="w-18!"
        :render-label="renderLabel"
        :consistent-menu-width="false"
        :disabled="isLoading"
      />
      <NSelect
        v-if="supportsFilter('patch')"
        size="small"
        :placeholder="t('opgg.filters.version')"
        :value="isResg ? resgVersion : version"
        :options="versionOptions"
        @update:value="changeVersion"
        :render-label="renderLabel"
        class="w-18!"
        :consistent-menu-width="false"
        :disabled="isLoading || versionOptions.length === 0"
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
import { useAkariResourceProvider } from '@renderer-shared/providers/akari-resource'
import { useChampionDataStore } from '@renderer-shared/shards/champion-data/store'
import {
  type ChampionDataFilter,
  type ChampionDataMode,
  getChampionDataCapability
} from '@shared/data-adapter/champion-data'
import { OpenOutline, RefreshSharp, Settings } from '@vicons/ionicons5'
import { useTranslation } from 'i18next-vue'
import { NButton, NIcon, NModal, NSelect, NTab, NTabs, SelectRenderLabel } from 'naive-ui'
import { computed, ref } from 'vue'

import { RESG_MODE, useOpgg } from './context'
import SettingsPane from './widgets/Settings.vue'

const { t } = useTranslation()
const resources = useAkariResourceProvider()
const championDataStore = useChampionDataStore()

const {
  currentTab,
  provider,
  activeSource,
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
  preferredSource,
  changeSource,
  changeMode,
  changePosition,
  changeRegion,
  changeTier,
  changeVersion,
  refresh,
  setTab
} = useOpgg()

const isSettingsShow = ref(false)

const { modeOptions } = useModeOptions(preferredSource)
const { regionOptions } = useRegionOptions()
const { tierOptions } = useTierOptions()
const { positionOptions } = usePositionOptions()

const isResg = computed(() => provider.value === 'resg')

// RESG 只提供海克斯大乱斗数据，模式选择固定且不可切换。
const resgModeOptions = computed(() => [
  { label: t(`opgg.filters.modes.${RESG_MODE}`), value: RESG_MODE }
])

const versionOptions = computed(() =>
  (isResg.value ? resgVersions.value.map((item) => item.version) : versions.value).map((item) => ({
    label: item,
    value: item
  }))
)

const sourceOptions = computed(() => [
  ...(['opgg', 'qq101'] as const).map((source) => ({
    label: t(`opgg.filters.sources.${source}`),
    value: source,
    disabled: !championDataStore.availability.sources[source].enabled
  })),
  { label: t('opgg.filters.sources.resg'), value: 'resg', disabled: false }
])

const capability = computed(() =>
  getChampionDataCapability(preferredSource.value, mode.value as ChampionDataMode)
)

// RESG 通道只保留版本筛选；其余筛选由 champion-data 的能力表决定。
const supportsFilter = (filter: ChampionDataFilter) =>
  isResg.value ? filter === 'patch' : (capability.value?.filters.includes(filter) ?? false)

const SOURCE_HOME_URLS: Record<typeof activeSource.value, string> = {
  opgg: 'https://op.gg',
  qq101: 'https://101.qq.com',
  resg: 'https://www.bilibili.com/toy/resg/index.html'
}

const sourceHomeUrl = computed(() => SOURCE_HOME_URLS[activeSource.value])

const sourceHomeTitle = computed(() =>
  t('opgg.filters.openSource', {
    source: t(`opgg.filters.sources.${activeSource.value}`)
  })
)

const renderLabel: SelectRenderLabel = (option) => {
  return <span class="text-xs">{option.label as string}</span>
}
</script>
