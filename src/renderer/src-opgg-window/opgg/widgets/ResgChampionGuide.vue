<template>
  <section v-if="resgGuide || resgError" class="lg:col-span-2">
    <div
      class="mb-2 flex items-center gap-2 rounded border border-black/10 px-2 py-1.5 dark:border-white/10"
    >
      <NTag type="success" size="small" :bordered="false">RESG</NTag>
      <span class="text-xs font-bold">{{ t('opgg.resg.title') }}</span>
      <span v-if="resgGuide" class="text-xs text-black/60 dark:text-white/60">
        {{ t('opgg.resg.version', { version: resgGuide.version }) }}
      </span>
      <span class="ml-auto text-xs text-black/50 dark:text-white/50">
        {{ t('opgg.resg.aramOnly') }}
      </span>
      <NButton
        v-if="resgGuide && hasItemSet"
        size="tiny"
        type="primary"
        secondary
        :disabled="!leagueClientStore.isConnected"
        @click="applyItemSet"
      >
        {{ t('opgg.resg.importItems') }}
      </NButton>
    </div>

    <NAlert v-if="resgError" type="warning" :show-icon="false" class="mb-2">
      {{ t('opgg.resg.loadFailed', { reason: resgError }) }}
    </NAlert>

    <div v-if="resgGuide" class="grid grid-cols-1 gap-2 lg:grid-cols-2">
      <div v-if="resgGuide.spells.length" class="guide-card">
        <div class="guide-title">{{ t('opgg.champion.spells') }}</div>
        <div v-for="build in resgGuide.spells.slice(0, 4)" :key="build.rank" class="guide-row">
          <div class="guide-rank">#{{ build.rank }}</div>
          <div class="flex gap-1">
            <SummonerSpellDisplay
              v-for="spellId in build.ids"
              :key="spellId"
              :size="28"
              :spell-id="spellId"
            />
          </div>
          <RateStats :play="build.play" :win-rate="build.winRate" :pick-rate="build.pickRate" />
          <NButton
            size="tiny"
            type="primary"
            secondary
            :disabled="leagueClientStore.gameflow.phase !== 'ChampSelect' || build.ids.length !== 2"
            @click="applySummonerSpells(build.ids)"
          >
            {{ t('opgg.champion.apply') }}
          </NButton>
        </div>
      </div>

      <div v-if="resgGuide.skillOrders.length" class="guide-card">
        <div class="guide-title">{{ t('opgg.champion.abilityBuild') }}</div>
        <div v-for="build in resgGuide.skillOrders.slice(0, 4)" :key="build.rank" class="guide-row">
          <div class="guide-rank">#{{ build.rank }}</div>
          <div class="flex items-center gap-1">
            <template v-for="(skill, index) in build.names" :key="`${skill}-${index}`">
              <span class="skill-key">{{ skill }}</span>
              <span
                v-if="index < build.names.length - 1"
                class="text-xs text-black/40 dark:text-white/40"
                >›</span
              >
            </template>
          </div>
          <RateStats :play="build.play" :win-rate="build.winRate" :pick-rate="build.pickRate" />
        </div>
      </div>

      <div v-if="resgGuide.starterItems.length" class="guide-card">
        <div class="guide-title">{{ t('opgg.champion.starterItemText') }}</div>
        <div
          v-for="build in resgGuide.starterItems.slice(0, 4)"
          :key="build.rank"
          class="guide-row"
        >
          <div class="guide-rank">#{{ build.rank }}</div>
          <div class="flex gap-1">
            <ItemDisplay v-for="itemId in build.ids" :key="itemId" :size="28" :item-id="itemId" />
          </div>
          <RateStats :play="build.play" :win-rate="build.winRate" :pick-rate="build.pickRate" />
        </div>
      </div>

      <div v-if="resgGuide.boots.length" class="guide-card">
        <div class="guide-title">{{ t('opgg.champion.boots') }}</div>
        <div v-for="build in resgGuide.boots.slice(0, 4)" :key="build.rank" class="guide-row">
          <div class="guide-rank">#{{ build.rank }}</div>
          <div class="flex gap-1">
            <ItemDisplay v-for="itemId in build.ids" :key="itemId" :size="28" :item-id="itemId" />
          </div>
          <RateStats :play="build.play" :win-rate="build.winRate" :pick-rate="build.pickRate" />
        </div>
      </div>

      <div v-if="resgGuide.augments.length" class="guide-card">
        <div class="guide-title">{{ t('opgg.resg.recommendedAugments') }}</div>
        <div v-for="augment in visibleAugments" :key="augment.id" class="guide-row">
          <div class="guide-rank">#{{ augment.rank }}</div>
          <AugmentDisplay :size="28" :augment-id="augment.id" />
          <span class="truncate text-xs">{{ augment.name }}</span>
          <RateStats
            :play="augment.play"
            :win-rate="augment.winRate"
            :pick-rate="augment.pickRate"
          />
        </div>
        <NButton
          v-if="resgGuide.augments.length > DEFAULT_STAT_LIMIT"
          class="mt-1 w-full"
          size="tiny"
          quaternary
          @click="showAllAugments = !showAllAugments"
        >
          {{ t(showAllAugments ? 'opgg.resg.showLess' : 'opgg.resg.showAll') }}
        </NButton>
      </div>

      <div v-if="resgGuide.items.length" class="guide-card">
        <div class="guide-title">{{ t('opgg.resg.singleItems') }}</div>
        <div v-for="item in visibleItems" :key="item.id" class="guide-row">
          <div class="guide-rank">#{{ item.rank }}</div>
          <ItemDisplay :size="28" :item-id="item.id" />
          <span class="truncate text-xs">{{ item.name }}</span>
          <RateStats
            :play="item.play"
            :win="item.win"
            :win-rate="item.winRate"
            :pick-rate="item.pickRate"
          />
        </div>
        <NButton
          v-if="resgGuide.items.length > DEFAULT_STAT_LIMIT"
          class="mt-1 w-full"
          size="tiny"
          quaternary
          @click="showAllItems = !showAllItems"
        >
          {{ t(showAllItems ? 'opgg.resg.showLess' : 'opgg.resg.showAll') }}
        </NButton>
      </div>

      <div v-if="augmentComboSizes.length" class="guide-card lg:col-span-2">
        <div class="guide-heading">
          <div class="guide-title mb-0">{{ t('opgg.resg.augmentCombos') }}</div>
          <NSelect
            v-model:value="augmentComboSize"
            size="tiny"
            class="w-32"
            :aria-label="t('opgg.resg.augmentComboSizeLabel')"
            :options="augmentComboOptions"
          />
        </div>
        <div v-for="combo in visibleAugmentCombos" :key="comboKey(combo)" class="combo-row">
          <NButton
            v-if="combo.builds.length"
            size="tiny"
            quaternary
            circle
            :title="
              t(
                expandedAugmentComboKeys.has(comboKey(combo))
                  ? 'opgg.resg.hideLinkedBuilds'
                  : 'opgg.resg.showLinkedBuilds'
              )
            "
            :aria-label="
              t(
                expandedAugmentComboKeys.has(comboKey(combo))
                  ? 'opgg.resg.hideLinkedBuilds'
                  : 'opgg.resg.showLinkedBuilds'
              )
            "
            :aria-expanded="expandedAugmentComboKeys.has(comboKey(combo))"
            @click="toggleAugmentCombo(combo)"
          >
            {{ expandedAugmentComboKeys.has(comboKey(combo)) ? '−' : '+' }}
          </NButton>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1">
              <AugmentDisplay
                v-for="augmentId in combo.augmentIds"
                :key="augmentId"
                :size="30"
                :augment-id="augmentId"
              />
              <span class="ml-1 truncate text-xs">{{
                combo.augmentNames.filter(Boolean).join(' · ')
              }}</span>
              <RateStats :play="combo.play" :win-rate="combo.winRate" />
            </div>
            <div
              v-for="(build, index) in expandedAugmentComboKeys.has(comboKey(combo))
                ? combo.builds
                : []"
              :key="`${combo.rank}-${index}-${build.ids.join('-')}`"
              class="linked-build"
            >
              <span class="linked-label">{{ t('opgg.resg.linkedBuild') }}</span>
              <div class="flex gap-1">
                <ItemDisplay
                  v-for="itemId in build.ids"
                  :key="itemId"
                  :size="24"
                  :item-id="itemId"
                />
              </div>
              <RateStats :play="build.play" :win-rate="build.winRate" compact />
            </div>
          </div>
        </div>
        <NButton
          v-if="selectedAugmentCombos.length > DEFAULT_COMBO_LIMIT"
          class="mt-1 w-full"
          size="tiny"
          quaternary
          @click="showAllAugmentCombos = !showAllAugmentCombos"
        >
          {{ t(showAllAugmentCombos ? 'opgg.resg.showLess' : 'opgg.resg.showAll') }}
        </NButton>
      </div>

      <div v-if="itemComboSizes.length" class="guide-card lg:col-span-2">
        <div class="guide-heading">
          <div class="guide-title mb-0">{{ t('opgg.resg.coreItemCombos') }}</div>
          <NSelect
            v-model:value="itemComboSize"
            size="tiny"
            class="w-32"
            :aria-label="t('opgg.resg.itemComboSizeLabel')"
            :options="itemComboOptions"
          />
        </div>
        <div
          v-for="combo in visibleItemCombos"
          :key="`${combo.size}-${combo.rank}-${combo.ids.join('-')}`"
          class="combo-row items-center"
        >
          <div class="guide-rank">#{{ combo.rank }}</div>
          <div class="flex gap-1">
            <ItemDisplay v-for="itemId in combo.ids" :key="itemId" :size="30" :item-id="itemId" />
          </div>
          <span class="min-w-0 flex-1 truncate text-xs">{{
            combo.names.filter(Boolean).join(' · ')
          }}</span>
          <RateStats :play="combo.play" :win-rate="combo.winRate" :pick-rate="combo.pickRate" />
        </div>
        <NButton
          v-if="selectedItemCombos.length > DEFAULT_COMBO_LIMIT"
          class="mt-1 w-full"
          size="tiny"
          quaternary
          @click="showAllItemCombos = !showAllItemCombos"
        >
          {{ t(showAllItemCombos ? 'opgg.resg.showLess' : 'opgg.resg.showAll') }}
        </NButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import AugmentDisplay from '@renderer-shared/components/widgets/AugmentDisplay.vue'
import ItemDisplay from '@renderer-shared/components/widgets/ItemDisplay.vue'
import SummonerSpellDisplay from '@renderer-shared/components/widgets/SummonerSpellDisplay.vue'
import { useLeagueClientStore } from '@renderer-shared/shards/league-client/store'
import type { ResgGuideAugmentCombo } from '@shared/types/resg'
import { useTranslation } from 'i18next-vue'
import { NAlert, NButton, NSelect, NTag } from 'naive-ui'
import { computed, defineComponent, h, type PropType, ref, watch } from 'vue'

import { useOpgg } from '../context'
import { useLoadout } from '../utils/loadout'
import { createResgItemSet } from '../utils/resg-item-set'

const DEFAULT_COMBO_LIMIT = 6
const DEFAULT_STAT_LIMIT = 10

const RateStats = defineComponent({
  name: 'ResgRateStats',
  props: {
    play: { type: Number, required: true },
    win: { type: Number as PropType<number | null>, default: null },
    winRate: { type: Number, required: true },
    pickRate: { type: Number as PropType<number | null>, default: null },
    compact: { type: Boolean, default: false }
  },
  setup(props) {
    const { t } = useTranslation()

    return () =>
      h('div', { class: props.compact ? 'rate-stats min-w-28' : 'rate-stats min-w-36' }, [
        h(
          'span',
          { class: 'rate-primary' },
          [
            t('opgg.resg.winRateValue', { rate: (props.winRate * 100).toFixed(2) }),
            props.pickRate === null
              ? null
              : t('opgg.resg.pickRateValue', { rate: (props.pickRate * 100).toFixed(2) })
          ]
            .filter(Boolean)
            .join(' · ')
        ),
        h(
          'span',
          { class: 'rate-play' },
          [
            t('opgg.champion.times', { times: props.play.toLocaleString() }),
            props.win === null
              ? null
              : t('opgg.resg.wins', { count: props.win, wins: props.win.toLocaleString() })
          ]
            .filter(Boolean)
            .join(' · ')
        )
      ])
  }
})

const { resgGuide, resgError, flashPosition, position, region, tier } = useOpgg()
const { setSummonerSpells, writeItemSet } = useLoadout()
const { t } = useTranslation()
const leagueClientStore = useLeagueClientStore()

const augmentComboSizes = computed(() =>
  [...new Set(resgGuide.value?.augmentCombos.map((combo) => combo.size) ?? [])].toSorted()
)
const itemComboSizes = computed(() =>
  [...new Set(resgGuide.value?.itemCombos.map((combo) => combo.size) ?? [])].toSorted()
)
const augmentComboSize = ref(2)
const itemComboSize = ref(3)
const showAllAugments = ref(false)
const showAllItems = ref(false)
const showAllAugmentCombos = ref(false)
const showAllItemCombos = ref(false)
const expandedAugmentComboKeys = ref(new Set<string>())

const augmentComboOptions = computed(() =>
  augmentComboSizes.value.map((count) => ({
    label: t('opgg.resg.augmentCount', { count }),
    value: count
  }))
)
const itemComboOptions = computed(() =>
  itemComboSizes.value.map((count) => ({
    label: t('opgg.resg.itemCount', { count }),
    value: count
  }))
)
const visibleAugments = computed(() =>
  showAllAugments.value
    ? (resgGuide.value?.augments ?? [])
    : (resgGuide.value?.augments ?? []).slice(0, DEFAULT_STAT_LIMIT)
)
const visibleItems = computed(() =>
  showAllItems.value
    ? (resgGuide.value?.items ?? [])
    : (resgGuide.value?.items ?? []).slice(0, DEFAULT_STAT_LIMIT)
)
const selectedAugmentCombos = computed(() =>
  (resgGuide.value?.augmentCombos ?? []).filter((combo) => combo.size === augmentComboSize.value)
)
const selectedItemCombos = computed(() =>
  (resgGuide.value?.itemCombos ?? []).filter((combo) => combo.size === itemComboSize.value)
)
const visibleAugmentCombos = computed(() =>
  showAllAugmentCombos.value
    ? selectedAugmentCombos.value
    : selectedAugmentCombos.value.slice(0, DEFAULT_COMBO_LIMIT)
)
const visibleItemCombos = computed(() =>
  showAllItemCombos.value
    ? selectedItemCombos.value
    : selectedItemCombos.value.slice(0, DEFAULT_COMBO_LIMIT)
)

watch(resgGuide, () => {
  showAllAugments.value = false
  showAllItems.value = false
  showAllAugmentCombos.value = false
  showAllItemCombos.value = false
  expandedAugmentComboKeys.value = new Set()
})
watch(augmentComboSizes, (sizes) => {
  if (!sizes.includes(augmentComboSize.value)) {
    augmentComboSize.value = sizes[0] ?? 1
  }
})
watch(itemComboSizes, (sizes) => {
  if (!sizes.includes(itemComboSize.value)) {
    itemComboSize.value = sizes[0] ?? 1
  }
})
watch(augmentComboSize, () => {
  showAllAugmentCombos.value = false
  expandedAugmentComboKeys.value = new Set()
})
watch(itemComboSize, () => {
  showAllItemCombos.value = false
})

const itemSet = computed(() => (resgGuide.value ? createResgItemSet(resgGuide.value, t) : null))
const hasItemSet = computed(() => itemSet.value?.itemGroups.some((group) => group.items.length > 0))

/** 返回海克斯组合在当前英雄详情中的稳定展开键。 */
function comboKey(combo: ResgGuideAugmentCombo): string {
  return `${combo.size}:${combo.augmentIds.join('-')}`
}

/** 展开或收起一个海克斯组合的全部关联出装。 */
function toggleAugmentCombo(combo: ResgGuideAugmentCombo) {
  const key = comboKey(combo)
  const nextKeys = new Set(expandedAugmentComboKeys.value)
  if (nextKeys.has(key)) {
    nextKeys.delete(key)
  } else {
    nextKeys.add(key)
  }
  expandedAugmentComboKeys.value = nextKeys
}

/** 仅将完整的两个召唤师技能 ID 交给现有应用链路。 */
function applySummonerSpells(spellIds: number[]) {
  if (spellIds.length !== 2) {
    return
  }

  setSummonerSpells(spellIds, flashPosition.value)
}

/** 将当前 RESG 装备数据交给攻略窗的通用装备页写入链路。 */
function applyItemSet() {
  if (!itemSet.value || !hasItemSet.value) {
    return
  }

  writeItemSet(itemSet.value, {
    position: position.value,
    mode: 'aram',
    region: region.value,
    tier: tier.value
  })
}
</script>

<style scoped>
@reference '@renderer-shared/assets/css/tailwind.css';

.guide-card {
  @apply rounded border border-black/10 p-2 dark:border-[#37373c];
}

.guide-heading {
  @apply mb-2 flex items-center justify-between gap-2;
}

.guide-title {
  @apply mb-2 text-[13px] font-bold;
}

.guide-row {
  @apply mb-1 flex min-h-8 items-center gap-1 last:mb-0;
}

.combo-row {
  @apply flex gap-1 border-t border-black/5 py-2 first:border-t-0 first:pt-0 last:pb-0 dark:border-white/5;
}

.linked-build {
  @apply mt-1 flex min-h-7 items-center gap-1 rounded bg-black/5 px-1.5 py-1 dark:bg-white/5;
}

.linked-label {
  @apply mr-1 text-[10px] text-black/50 dark:text-white/50;
}

.guide-rank {
  @apply min-w-5 text-[10px] text-[#666666] dark:text-[#b2b2b2];
}

.skill-key {
  @apply inline-flex size-7 items-center justify-center rounded bg-black/5 text-xs font-bold dark:bg-white/10;
}

:deep(.rate-stats) {
  @apply ml-auto flex flex-col items-end;
}

:deep(.rate-primary) {
  @apply text-right text-[10px] font-bold text-[#1a1a1a] dark:text-[#ebebeb];
}

:deep(.rate-play) {
  @apply text-[10px] text-[#666666] dark:text-[#bebebe];
}
</style>
