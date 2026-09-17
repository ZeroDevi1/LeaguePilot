import type { ResgChampionGuide, ResgGuideBuild } from '@shared/types/resg'

import type { GuideItemSet, GuideItemSetGroup } from './loadout'

/** 极地大乱斗地图 ID，用于把装备页限制到嚎哭深渊。 */
const HOWLING_ABYSS_MAP_ID = 12
/** 导入时纳入的最小核心装备件数；单件统计不作为一套出装。 */
const MIN_ITEM_COMBO_SIZE = 2
/** 导入时纳入的最大核心装备件数，对应 RESG 五件装。 */
const MAX_ITEM_COMBO_SIZE = 5
/** 五件装的装备数量，用于给该阶段保留更多对照方案。 */
const FIVE_ITEM_BUILD_SIZE = 5
/** 写入客户端的技能加点方案上限。 */
const MAX_SKILL_ORDERS = 3
/** 写入客户端的起始装备方案上限。 */
const MAX_STARTER_BUILDS = 3
/** 写入客户端的鞋子方案上限。 */
const MAX_BOOT_BUILDS = 4
/** 2 到 4 件核心出装在每个件数下保留的方案数。 */
const MAX_BUILDS_PER_SIZE = 3
/** 五件装额外多保留一套，方便在商店里对比完整出装。 */
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
 * 把技能键整理成客户端标题可用的加点顺序。
 *
 * @param build RESG 技能加点方案；缺失或没有技能名时视为不可展示。
 * @returns 用 `›` 连接的技能顺序；没有可用技能名时返回空字符串。
 */
function formatSkillOrder(build: ResgGuideBuild | undefined): string {
  if (!build) {
    return ''
  }

  return build.names
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .join(' › ')
}

/**
 * 按装备件数收集要写入客户端的多套核心出装。
 *
 * 优先使用独立装备组合统计，这样同一件数下可以保留多套对照方案；旧响应没有组合统计时，回退到各阶段首选或海克斯关联出装。
 *
 * @param guide 标准化后的 RESG 英雄攻略。
 * @returns 按 2 到 5 件顺序排列、且已截取导入上限的出装方案。
 */
function collectImportedItemCombos(guide: ResgChampionGuide): ResgGuideBuild[] {
  /** 按装备件数分组的待导入出装，组内保持 RESG 原有排名顺序。 */
  const combosBySize = new Map<number, ResgGuideBuild[]>()
  /** 有组合统计时使用全部组合，否则回退到各阶段首选或海克斯关联出装。 */
  const sourceBuilds: Array<ResgGuideBuild & { size: number }> =
    guide.itemCombos.length > 0
      ? guide.itemCombos
      : guide.itemBuilds.map((build) => ({
          ...build,
          size: build.ids.length
        }))

  for (const build of sourceBuilds) {
    if (
      build.size < MIN_ITEM_COMBO_SIZE ||
      build.size > MAX_ITEM_COMBO_SIZE ||
      build.ids.length === 0
    ) {
      continue
    }

    const builds = combosBySize.get(build.size) ?? []
    builds.push(build)
    combosBySize.set(build.size, builds)
  }

  /** 按 2 到 5 件顺序展开后、已截取导入上限的出装列表。 */
  const imported: ResgGuideBuild[] = []
  for (let size = MIN_ITEM_COMBO_SIZE; size <= MAX_ITEM_COMBO_SIZE; size += 1) {
    const limit = size === FIVE_ITEM_BUILD_SIZE ? MAX_FIVE_ITEM_BUILDS : MAX_BUILDS_PER_SIZE
    imported.push(...(combosBySize.get(size) ?? []).slice(0, limit))
  }

  return imported
}

/**
 * 将一个 RESG 排名方案追加为客户端装备分组。
 *
 * @param itemGroups 正在组装的装备页分组。
 * @param build 要写入的方案。
 * @param t 当前 renderer 的翻译函数。
 * @param title 已翻译的分组标题，统计信息会再附加到后面。
 * @param items 该分组写入商店的装备 ID；技能加点等非装备信息传空数组，只保留标题。
 */
function pushBuildGroup(
  itemGroups: GuideItemSetGroup[],
  build: ResgGuideBuild,
  t: Translate,
  title: string,
  items: number[]
) {
  itemGroups.push({
    title: getItemGroupTitle(t, title, build),
    items
  })
}

/**
 * 将标准化 RESG 攻略转换为客户端装备页。
 *
 * 同一装备页会写入技能加点、多套起始装备、鞋子，以及 2 到 5 件的多套核心出装，方便在英雄联盟商店里直接对照。
 * 技能加点无法写成真实装备，因此只进入分组标题和装备页标题备注。
 *
 * @param guide 标准化后的 RESG 英雄攻略。
 * @param t 当前 renderer 的翻译函数。
 * @returns 可交给通用写入链路的 RESG 装备页。
 */
export function createResgItemSet(guide: ResgChampionGuide, t: Translate): GuideItemSet {
  /** 按游戏内购买顺序排列的装备页分组，技能加点只保留标题。 */
  const itemGroups: GuideItemSetGroup[] = []
  /** 可展示的技能加点，最多写入三套。 */
  const skillOrders = guide.skillOrders
    .map((build) => ({ build, order: formatSkillOrder(build) }))
    .filter((entry) => entry.order.length > 0)
    .slice(0, MAX_SKILL_ORDERS)

  for (const { build, order } of skillOrders) {
    pushBuildGroup(
      itemGroups,
      build,
      t,
      t('opgg.resg.skillOrderGroup', { index: build.rank, order }),
      []
    )
  }

  for (const build of guide.starterItems.slice(0, MAX_STARTER_BUILDS)) {
    pushBuildGroup(
      itemGroups,
      build,
      t,
      t('opgg.resg.starterGroup', { index: build.rank }),
      build.ids
    )
  }

  for (const build of guide.boots.slice(0, MAX_BOOT_BUILDS)) {
    pushBuildGroup(
      itemGroups,
      build,
      t,
      t('opgg.resg.bootsGroup', { index: build.rank }),
      build.ids
    )
  }

  for (const build of collectImportedItemCombos(guide)) {
    pushBuildGroup(
      itemGroups,
      build,
      t,
      t('opgg.resg.itemComboGroup', { index: build.rank, size: build.ids.length }),
      build.ids
    )
  }

  return {
    sourceId: 'resg',
    sourceLabel: 'RESG',
    championId: guide.champion.id,
    version: guide.version,
    titleNote: skillOrders[0]?.order,
    associatedChampions: [guide.champion.id],
    associatedMaps: [HOWLING_ABYSS_MAP_ID],
    itemGroups
  }
}
