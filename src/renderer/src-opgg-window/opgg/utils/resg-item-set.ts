import type { ResgChampionGuide, ResgGuideBuild } from '@shared/types/resg'

import type { GuideItemSet, GuideItemSetGroup } from './loadout'

const HOWLING_ABYSS_MAP_ID = 12
const FIVE_ITEM_BUILD_SIZE = 5
const MAX_FIVE_ITEM_BUILDS = 4

type Translate = (key: string, options?: Record<string, unknown>) => string

/** 把 RESG 方案的样本与胜率信息附加到客户端装备分组标题。 */
function getItemGroupTitle(t: Translate, title: string, build: ResgGuideBuild): string {
  const statsKey =
    build.pickRate === null ? 'opgg.resg.buildStatsWithoutPickRate' : 'opgg.resg.buildStats'
  const stats = t(statsKey, {
    count: build.play,
    play: build.play.toLocaleString(),
    winRate: (build.winRate * 100).toFixed(2),
    pickRate: build.pickRate === null ? undefined : (build.pickRate * 100).toFixed(2)
  })

  return `${title} · ${stats}`
}

/**
 * 将标准化 RESG 攻略转换为客户端装备页。
 *
 * 除起始装备、鞋子和各阶段首选核心装外，同一装备页会额外包含排名前四的五件装，方便在客户端内直接对比。
 *
 * @param guide 标准化后的 RESG 英雄攻略。
 * @param t 当前 renderer 的翻译函数。
 * @returns 可交给通用写入链路的 RESG 装备页。
 */
export function createResgItemSet(guide: ResgChampionGuide, t: Translate): GuideItemSet {
  const itemGroups: GuideItemSetGroup[] = []

  guide.starterItems.slice(0, 3).forEach((build) => {
    itemGroups.push({
      title: getItemGroupTitle(t, t('opgg.resg.starterGroup', { index: build.rank }), build),
      items: build.ids
    })
  })

  guide.boots.slice(0, 4).forEach((build) => {
    itemGroups.push({
      title: getItemGroupTitle(t, t('opgg.resg.bootsGroup', { index: build.rank }), build),
      items: build.ids
    })
  })

  guide.itemBuilds
    .filter((build) => build.ids.length !== FIVE_ITEM_BUILD_SIZE)
    .slice(0, 4)
    .forEach((build) => {
      itemGroups.push({
        title: getItemGroupTitle(t, t('opgg.resg.linkedItemGroup', { index: build.rank }), build),
        items: build.ids
      })
    })

  const fiveItemBuilds = guide.itemCombos
    .filter((build) => build.size === FIVE_ITEM_BUILD_SIZE)
    .slice(0, MAX_FIVE_ITEM_BUILDS)
  const importedFiveItemBuilds =
    fiveItemBuilds.length > 0
      ? fiveItemBuilds
      : guide.itemBuilds
          .filter((build) => build.ids.length === FIVE_ITEM_BUILD_SIZE)
          .slice(0, MAX_FIVE_ITEM_BUILDS)

  importedFiveItemBuilds.forEach((build) => {
    itemGroups.push({
      title: getItemGroupTitle(t, t('opgg.resg.fiveItemGroup', { index: build.rank }), build),
      items: build.ids
    })
  })

  return {
    sourceId: 'resg',
    sourceLabel: 'RESG',
    championId: guide.champion.id,
    version: guide.version,
    associatedChampions: [guide.champion.id],
    associatedMaps: [HOWLING_ABYSS_MAP_ID],
    itemGroups
  }
}
