<template>
  <div
    v-if="session"
    class="mb-1 rounded border border-black/10 p-2 last:mb-0 lg:col-span-2 dark:border-[#37373c]"
  >
    <!-- header -->
    <div class="mb-2 flex items-center gap-2">
      <span class="text-[13px] font-bold">{{ t('opgg.mayhemAssistant.title') }}</span>
      <NTag size="small" :bordered="false" type="info">
        {{ t('opgg.mayhemAssistant.level', { level: session.level }) }}
      </NTag>
      <span class="truncate text-xs text-black/60 dark:text-white/60">
        {{ t('opgg.mayhemAssistant.source', { source: sourceLabel }) }}
      </span>
      <NButton
        class="ml-auto"
        size="tiny"
        quaternary
        :disabled="!hasManualEntries"
        @click="clearManualEntries"
      >
        {{ t('opgg.mayhemAssistant.clear') }}
      </NButton>
    </div>

    <!-- champion / mode mismatch hints -->
    <NAlert
      v-if="isChampionMismatch && session.championId"
      type="warning"
      size="small"
      :show-icon="false"
      class="mb-2"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs">
          {{
            t('opgg.mayhemAssistant.championMismatch', {
              champion: resources.champions.name(session.championId)
            })
          }}
        </span>
        <NButton size="tiny" secondary @click="changeChampion(session.championId)">
          {{ t('opgg.mayhemAssistant.switchChampion') }}
        </NButton>
      </div>
    </NAlert>
    <NAlert
      v-else-if="provider === 'opgg' && mode !== 'aram_mayhem'"
      type="warning"
      size="small"
      :show-icon="false"
      class="mb-2"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs">{{ t('opgg.mayhemAssistant.modeMismatch') }}</span>
        <NButton size="tiny" secondary @click="changeMode('aram_mayhem')">
          {{ t('opgg.mayhemAssistant.switchMode') }}
        </NButton>
      </div>
    </NAlert>

    <!-- rounds -->
    <NTabs
      :value="activeRoundIndex ?? undefined"
      type="segment"
      size="small"
      @update:value="selectRound"
    >
      <NTab
        v-for="round in session.rounds"
        :key="round.index"
        :name="round.index"
        :disabled="!round.reached"
        :title="
          round.reached
            ? t('opgg.mayhemAssistant.roundReached', { level: round.level })
            : t('opgg.mayhemAssistant.roundLocked', { level: round.level })
        "
      >
        <div class="flex items-center justify-center gap-1">
          <span class="text-xs">Lv.{{ round.level }}</span>
          <AugmentDisplay
            v-if="round.pickedAugmentId"
            :size="16"
            :augment-id="round.pickedAugmentId"
          />
        </div>
      </NTab>
    </NTabs>

    <template v-if="activeRound">
      <!-- offered picker -->
      <div class="mt-2 flex items-center gap-2">
        <span class="shrink-0 text-xs text-black/70 dark:text-white/70">
          {{ t('opgg.mayhemAssistant.offered') }}
        </span>
        <NSelect
          class="min-w-0 flex-1"
          size="small"
          multiple
          filterable
          clearable
          :max-tag-count="3"
          :placeholder="t('opgg.mayhemAssistant.offeredPlaceholder')"
          :value="activeRound.offeredAugmentIds"
          :options="augmentOptions"
          :filter="filterAugmentOption"
          :render-label="renderAugmentOption"
          :render-tag="renderAugmentTag"
          @update:value="setOffered"
        />
      </div>

      <div class="mt-1 text-[11px] text-black/50 dark:text-white/50">
        {{
          activeRound.offeredAugmentIds.length
            ? t('opgg.mayhemAssistant.candidatesFromOffered')
            : t('opgg.mayhemAssistant.candidatesFromRanking')
        }}
      </div>

      <!-- candidates -->
      <div v-if="candidates.length" class="mt-2 flex flex-col gap-1">
        <div
          v-for="candidate in candidates"
          :key="candidate.augmentId"
          class="candidate-row"
          :class="{ picked: activeRound.pickedAugmentId === candidate.augmentId }"
        >
          <div class="flex min-w-0 items-center gap-2">
            <AugmentDisplay :size="28" :augment-id="candidate.augmentId" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1">
                <span
                  v-if="candidate.stats.tier !== null"
                  class="flex size-4 shrink-0 items-center justify-center rounded text-[11px]"
                  :class="TIER_COLOR[candidate.stats.tier] ?? TIER_COLOR[4]"
                >
                  {{ TIER_NAME[candidate.stats.tier] ?? '-' }}
                </span>
                <span class="truncate text-xs font-bold">
                  {{ resources.augments.name(candidate.augmentId) }}
                </span>
              </div>
              <div class="text-[11px] text-black/60 dark:text-white/60">
                {{ formatStats(candidate) }}
              </div>
            </div>
            <NButton
              size="tiny"
              :type="activeRound.pickedAugmentId === candidate.augmentId ? 'primary' : 'default'"
              secondary
              @click="togglePick(candidate.augmentId)"
            >
              {{
                activeRound.pickedAugmentId === candidate.augmentId
                  ? t('opgg.mayhemAssistant.picked')
                  : t('opgg.mayhemAssistant.pick')
              }}
            </NButton>
          </div>

          <!-- RESG 组合推荐：包含已选 + 该候选 -->
          <div v-if="candidate.combos.length" class="mt-1 flex flex-col gap-1">
            <div
              v-for="combo in candidate.combos.slice(0, COMBO_LIMIT)"
              :key="combo.augmentIds.join('-')"
              class="combo-row"
            >
              <div class="flex items-center gap-1">
                <AugmentDisplay
                  v-for="augmentId in combo.augmentIds"
                  :key="augmentId"
                  :size="20"
                  :augment-id="augmentId"
                />
              </div>
              <span class="text-[11px]">
                {{
                  t('opgg.mayhemAssistant.comboStats', {
                    winRate: (combo.winRate * 100).toFixed(2),
                    play: combo.play.toLocaleString()
                  })
                }}
              </span>
              <div v-if="combo.builds[0]" class="ml-auto flex items-center gap-1">
                <span class="text-[10px] text-black/50 dark:text-white/50">
                  {{ t('opgg.resg.linkedBuild') }}
                </span>
                <ItemDisplay
                  v-for="itemId in combo.builds[0].ids"
                  :key="itemId"
                  :size="18"
                  :item-id="itemId"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="mt-2 text-xs text-black/60 dark:text-white/60">
        {{ t('opgg.mayhemAssistant.noData') }}
      </div>
    </template>
    <div v-else class="mt-2 text-xs text-black/60 dark:text-white/60">
      {{ t('opgg.mayhemAssistant.waiting', { level: nextRoundLevel }) }}
    </div>
  </div>
</template>

<script setup lang="tsx">
import AugmentDisplay from '@renderer-shared/components/widgets/AugmentDisplay.vue'
import ItemDisplay from '@renderer-shared/components/widgets/ItemDisplay.vue'
import { useAkariResourceProvider } from '@renderer-shared/providers/akari-resource'
import { useInstance } from '@renderer-shared/shards'
import { useExtraAssetsStore } from '@renderer-shared/shards/extra-assets/store'
import { useLeagueClientStore } from '@renderer-shared/shards/league-client/store'
import { MayhemAugmentRenderer } from '@renderer-shared/shards/mayhem-augment'
import { useMayhemAugmentStore } from '@renderer-shared/shards/mayhem-augment/store'
import { useTranslation } from 'i18next-vue'
import { NAlert, NButton, NSelect, NTab, NTabs, NTag, type SelectOption } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { useOpgg } from '../../context'
import { type AugmentCandidate, buildAugmentCandidates } from './augment-recommendations'

/** 每个候选最多展示的组合数量。 */
const COMBO_LIMIT = 2

const TIER_NAME: Record<number, string> = { 0: 'S', 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F' }
const TIER_COLOR: Record<number, string> = {
  0: 'bg-violet-500 text-white',
  1: 'bg-blue-500 text-white',
  2: 'bg-emerald-500 text-white',
  3: 'bg-yellow-600 text-white',
  4: 'bg-gray-500 text-white',
  5: 'bg-gray-500 text-white',
  6: 'bg-gray-500 text-white'
}

const { t } = useTranslation()
const resources = useAkariResourceProvider()
const mayhemAugment = useInstance(MayhemAugmentRenderer)
const mayhemAugmentStore = useMayhemAugmentStore()
const extraAssetsStore = useExtraAssetsStore()
const leagueClientStore = useLeagueClientStore()

const {
  provider,
  activeSource,
  mode,
  championId,
  resgGuide,
  kiwiAugments,
  changeChampion,
  changeMode
} = useOpgg()

const session = computed(() => mayhemAugmentStore.session)

const sourceLabel = computed(() => t(`opgg.filters.sources.${activeSource.value}`))

const isChampionMismatch = computed(
  () =>
    session.value?.championId !== null &&
    session.value?.championId !== undefined &&
    championId.value !== session.value.championId
)

const hasManualEntries = computed(
  () =>
    session.value?.rounds.some(
      (round) => round.offeredAugmentIds.length > 0 || round.pickedAugmentId !== null
    ) ?? false
)

/** 用户当前查看的轮次；`null` 表示还没有任何轮次到达。 */
const activeRoundIndex = ref<number | null>(null)

const activeRound = computed(() =>
  activeRoundIndex.value === null ? null : (session.value?.rounds[activeRoundIndex.value] ?? null)
)

const nextRoundLevel = computed(
  () => session.value?.rounds.find((round) => !round.reached)?.level ?? null
)

/** 到达新一轮时自动切到该轮；默认落在最新到达且尚未选择的轮次。 */
watch(
  () => session.value?.rounds.filter((round) => round.reached).length ?? 0,
  (reachedCount) => {
    if (reachedCount === 0) {
      activeRoundIndex.value = null
      return
    }

    const rounds = session.value?.rounds ?? []
    const pending = rounds.find((round) => round.reached && round.pickedAugmentId === null)
    activeRoundIndex.value = pending?.index ?? reachedCount - 1
  },
  { immediate: true }
)

/** 之前轮次已确定的选择，用于组合筛选。 */
const pickedBeforeActiveRound = computed(() => {
  const rounds = session.value?.rounds ?? []
  return rounds
    .filter(
      (round) =>
        round.pickedAugmentId !== null &&
        (activeRoundIndex.value === null || round.index !== activeRoundIndex.value)
    )
    .map((round) => round.pickedAugmentId as number)
})

const candidates = computed<AugmentCandidate[]>(() => {
  if (!activeRound.value) {
    return []
  }

  return buildAugmentCandidates({
    offeredAugmentIds: activeRound.value.offeredAugmentIds,
    pickedAugmentIds: pickedBeforeActiveRound.value,
    // RESG 数据只在 RESG 通道下才与当前展示一致，避免沿用切换前残留的详情。
    resgGuide: provider.value === 'resg' ? resgGuide.value : null,
    kiwiAugments: provider.value === 'opgg' ? kiwiAugments.value : null
  })
})

/** 可录入的全部海克斯：合并 LCU 静态资源与 gtimg kiwi 目录。 */
const augmentOptions = computed<SelectOption[]>(() => {
  const ids = new Set<number>()
  for (const key of Object.keys(leagueClientStore.gameData.augments)) ids.add(Number(key))
  for (const key of Object.keys(extraAssetsStore.kiwiAugmentsMap)) ids.add(Number(key))

  const pickedElsewhere = new Set(pickedBeforeActiveRound.value)
  return [...ids]
    .filter((id) => Number.isFinite(id) && id > 0 && !pickedElsewhere.has(id))
    .map((id) => ({ value: id, label: resources.augments.name(id) }))
    .toSorted((left, right) => String(left.label).localeCompare(String(right.label)))
})

const filterAugmentOption = (pattern: string, option: SelectOption) => {
  const query = pattern.trim().toLowerCase()
  if (!query) return true

  const id = option.value as number
  const kiwi = extraAssetsStore.kiwiAugmentsMap[id]
  return [option.label as string, kiwi?.name_cn, kiwi?.name_en].some((name) =>
    name?.toLowerCase().includes(query)
  )
}

const renderAugmentOption = (option: SelectOption) => (
  <div class="flex items-center gap-2">
    <AugmentDisplay size={20} augmentId={option.value as number} />
    <span class="text-xs">{option.label as string}</span>
  </div>
)

const renderAugmentTag = ({
  option,
  handleClose
}: {
  option: SelectOption
  handleClose: () => void
}) => (
  <NTag size="small" closable onClose={handleClose}>
    <div class="flex items-center gap-1">
      <AugmentDisplay size={16} augmentId={option.value as number} />
      <span class="text-xs">{option.label as string}</span>
    </div>
  </NTag>
)

const selectRound = (index: string | number) => {
  activeRoundIndex.value = Number(index)
}

const setOffered = (ids: number[]) => {
  if (activeRoundIndex.value === null) return
  void mayhemAugment.setOfferedAugments(activeRoundIndex.value, ids.slice(0, 3))
}

const togglePick = async (augmentId: number) => {
  if (activeRoundIndex.value === null || !activeRound.value) return
  const roundIndex = activeRoundIndex.value
  const next = activeRound.value.pickedAugmentId === augmentId ? null : augmentId
  const updated = await mayhemAugment.setPickedAugment(roundIndex, next)

  // 确认选择后自动跳到下一轮已出现但尚未选择的轮次，减少对局中的操作。
  if (next !== null && updated && activeRoundIndex.value === roundIndex) {
    const pending = updated.rounds.find(
      (round) => round.index > roundIndex && round.reached && round.pickedAugmentId === null
    )
    if (pending) activeRoundIndex.value = pending.index
  }
}

const clearManualEntries = () => {
  void mayhemAugment.clearManualEntries()
}

/** 按数据源拼出候选的一行统计文案。 */
const formatStats = (candidate: AugmentCandidate) => {
  const { stats } = candidate
  const parts: string[] = []

  if (stats.winRate !== null) {
    parts.push(t('opgg.resg.winRateValue', { rate: (stats.winRate * 100).toFixed(2) }))
  }
  if (stats.pickRate !== null) {
    parts.push(t('opgg.resg.pickRateValue', { rate: (stats.pickRate * 100).toFixed(2) }))
  }
  if (stats.play !== null) {
    parts.push(t('opgg.champion.times', { times: stats.play.toLocaleString() }))
  }
  if (stats.performance !== null) {
    parts.push(`${t('opgg.champion.augmentPerformance')} ${stats.performance}`)
  }
  if (stats.popular !== null) {
    parts.push(`${t('opgg.champion.augmentPopular')} ${stats.popular}`)
  }

  return parts.length ? parts.join(' · ') : t('opgg.mayhemAssistant.noStats')
}
</script>

<style scoped>
@reference '@renderer-shared/assets/css/tailwind.css';

.candidate-row {
  @apply rounded border border-black/5 px-2 py-1.5 dark:border-white/5;
}

.candidate-row.picked {
  @apply border-akari-500/60 bg-akari-500/5;
}

.combo-row {
  @apply flex items-center gap-2 rounded bg-black/5 px-1.5 py-1 dark:bg-white/5;
}
</style>
