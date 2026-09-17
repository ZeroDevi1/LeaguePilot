import { useComponentName } from '@renderer-shared/composables/useComponentName'
import { useInstance } from '@renderer-shared/shards'
import { LeagueClientRenderer } from '@renderer-shared/shards/league-client'
import { useLeagueClientStore } from '@renderer-shared/shards/league-client/store'
import { LoggerRenderer } from '@renderer-shared/shards/logger'
import { SUMMONER_SPELL_FLASH_ID } from '@shared/constants/summoner-spells'
import { OpggChampionBuildResponse } from '@shared/types/opgg'
import { useTranslation } from 'i18next-vue'
import { useMessage } from 'naive-ui'

import { restoreRecipe } from './recipe-restore'

/** 一个可写入英雄联盟客户端的装备分组。 */
export interface GuideItemSetGroup {
  /** 客户端装备页中显示的分组标题。 */
  title: string
  /**
   * 按展示顺序排列的 Riot 装备 ID。
   * 技能加点等无法写成商店装备的信息可以留空，只保留标题供游戏内对照。
   */
  items: number[]
}

/** 已由数据源适配器准备好的装备页。 */
export interface GuideItemSet {
  /** 稳定数据源 ID，用于生成不会与其他来源碰撞的 UID。 */
  sourceId: string
  /** 面向用户的数据源标签，例如 `OP.GG` 或 `RESG`。 */
  sourceLabel: string
  /** Riot 英雄数字 ID。 */
  championId: number
  /** 数据版本；来源没有版本时可省略。 */
  version?: string
  /** 附加到客户端装备页标题末尾的短说明，例如首选技能加点。 */
  titleNote?: string
  /** 限制该装备页显示的 Riot 英雄 ID；省略时不限制英雄。 */
  associatedChampions?: number[]
  /** 限制该装备页显示的 Riot 地图 ID；省略时不限制地图。 */
  associatedMaps?: number[]
  /** 要写入客户端的装备分组；没有装备 ID 的分组仍会写入标题，供技能加点等信息展示。 */
  itemGroups: GuideItemSetGroup[]
}

export function useLoadout() {
  const lc = useInstance(LeagueClientRenderer)
  const log = useInstance(LoggerRenderer)

  const lcs = useLeagueClientStore()
  const message = useMessage()

  const componentName = useComponentName()

  const { t } = useTranslation()

  // 更新召唤师技能，会考虑到闪现位置的偏好
  const setSummonerSpells = async (ids: number[], flashPosition: 'auto' | 'd' | 'f') => {
    try {
      const selection = (await lc.api.champSelect.getMySelections()).data

      const [oldSpell1Id, oldSpell2Id] = [selection.spell1Id, selection.spell2Id]
      let [newSpell1Id, newSpell2Id] = ids

      // 有闪现的情况且不为 auto 时, 优先按照偏好闪现位置, 否则强制按照 auto
      if (
        flashPosition !== 'auto' &&
        (newSpell1Id === SUMMONER_SPELL_FLASH_ID || newSpell2Id === SUMMONER_SPELL_FLASH_ID)
      ) {
        if (newSpell2Id === SUMMONER_SPELL_FLASH_ID) {
          if (flashPosition === 'd') {
            ;[newSpell1Id, newSpell2Id] = [newSpell2Id, newSpell1Id]
          }
        } else if (newSpell1Id === SUMMONER_SPELL_FLASH_ID) {
          if (flashPosition === 'f') {
            ;[newSpell1Id, newSpell2Id] = [newSpell2Id, newSpell1Id]
          }
        }
      } else {
        if (newSpell1Id === oldSpell2Id || newSpell2Id === oldSpell1Id) {
          ;[newSpell1Id, newSpell2Id] = [newSpell2Id, newSpell1Id]
        }
      }

      await lc.api.champSelect.setSummonerSpells({
        spell1Id: newSpell1Id,
        spell2Id: newSpell2Id
      })

      message.success(() => t('opgg.view.success', { reason: t('opgg.view.summonerSpells') }))

      if (lcs.chat.conversations.championSelect) {
        lc.api.chat
          .chatSend(
            lcs.chat.conversations.championSelect.id,
            t('opgg.view.spellsSet', {
              spell1: lcs.gameData.summonerSpellName(newSpell1Id),
              spell2: lcs.gameData.summonerSpellName(newSpell2Id)
            }),
            'celebration'
          )
          .catch((error) => {
            log.warn(componentName, 'Failed to send summoner spells message', error)
          })
      }
    } catch (error) {
      log.warn(componentName, '	set summoner spells failed', error)
      message.warning(t('opgg.view.setSpellsFailedMessage', { reason: (error as any).message }))
    }
  }

  // 获取符文页名称，如果位置为 none，则只显示英雄名称
  const getRunePageName = (championId: number, position: string) => {
    if (position === 'none') {
      return `[OP.GG] ${lcs.gameData.championName(championId)}`
    }

    return `[OP.GG] ${lcs.gameData.championName(championId)} - ${t(
      `opgg.filters.positions.${position}`
    )}`
  }

  const setRunes = async (
    runes: {
      primary_page_id: number
      secondary_page_id: number
      primary_rune_ids: number[]
      secondary_rune_ids: number[]
      stat_mod_ids: number[]
    },
    meta: {
      championId: number
      position: string
    }
  ) => {
    const { championId, position } = meta

    try {
      const inventory = (await lc.api.perks.getPerkInventory()).data
      let newRunePageAdded = false

      if (inventory.canAddCustomPage) {
        const { data: added } = await lc.api.perks.postPerkPage({
          name: getRunePageName(championId, position),
          isEditable: true,
          primaryStyleId: runes.primary_page_id.toString()
        })
        await lc.api.perks.putPage({
          id: added.id,
          isRecommendationOverride: false,
          isTemporary: false,
          name: getRunePageName(championId, position),
          primaryStyleId: runes.primary_page_id,
          selectedPerkIds: [
            ...runes.primary_rune_ids,
            ...runes.secondary_rune_ids,
            ...runes.stat_mod_ids
          ],
          subStyleId: runes.secondary_page_id
        })
        await lc.api.perks.putCurrentPage(added.id)
        newRunePageAdded = true
      } else {
        const pages = (await lc.api.perks.getPerkPages()).data
        if (!pages.length) {
          return
        }

        const page1 = pages[0]

        await lc.api.perks.putPage({
          id: page1.id,
          isRecommendationOverride: false,
          isTemporary: false,
          name: getRunePageName(championId, position),
          primaryStyleId: runes.primary_page_id,
          selectedPerkIds: [
            ...runes.primary_rune_ids,
            ...runes.secondary_rune_ids,
            ...runes.stat_mod_ids
          ],
          subStyleId: runes.secondary_page_id
        })

        await lc.api.perks.putCurrentPage(page1.id)
      }

      message.success(() => t('opgg.view.success', { reason: t('opgg.view.runes') }))

      if (lcs.chat.conversations.championSelect) {
        lc.api.chat
          .chatSend(
            lcs.chat.conversations.championSelect.id,
            t('opgg.view.runesSet', {
              name: getRunePageName(championId, position),
              action: newRunePageAdded ? t('opgg.view.create') : t('opgg.view.replace')
            }),
            'celebration'
          )
          .catch((error) => {
            log.warn(componentName, 'Failed to send runes message', error)
          })
      }
    } catch (error) {
      log.warn(componentName, 'set runes failed', error)
      message.warning(t('opgg.view.setRunesFailedMessage', { reason: (error as any).message }))
    }
  }

  const toItemSetsUid = (traits: {
    sourceId?: string
    championId: number
    mode?: string
    region?: string
    tier?: string
    position?: string
    version?: string
  }) => {
    // 保留既有 OP.GG UID 契约；其它来源在前缀中加入 sourceId，避免互相覆盖。
    const prefix =
      !traits.sourceId || traits.sourceId === 'opgg' ? 'akari1' : `akari1-${traits.sourceId}`
    return `${prefix}-${traits.championId}-${traits.mode || '_'}-${traits.region || '_'}-${traits.tier || '_'}-${traits.position || '_'}-${traits.version || '_'}`
  }

  /**
   * 生成写入客户端的装备页标题。
   *
   * @param options.sourceLabel 数据源标签。
   * @param options.championId Riot 英雄 ID，用于读取本地英雄名。
   * @param options.mode 当前攻略模式。
   * @param options.position 当前攻略位置；`none` 时不写入标题。
   * @param options.titleNote 附加在标题末尾的短说明，例如技能加点。
   * @returns 客户端装备页显示的完整标题。
   */
  const getItemSetsTitle = (options: {
    sourceLabel: string
    championId: number
    mode: string
    position: string
    titleNote?: string
  }) => {
    const { sourceLabel, championId, mode, position, titleNote } = options

    const championName = lcs.gameData.championName(championId)
    let title = `[${sourceLabel}] ${championName}`

    if (mode) {
      const modeName = t(`opgg.filters.modes.${mode}`)
      title += ` - ${modeName || mode}`
    }

    const hasPosition = position && position !== 'none'
    if (hasPosition) {
      const positionName = t(`opgg.filters.positions.${position}`)
      title += ` - ${positionName || position}`
    }

    if (titleNote) {
      title += ` - ${titleNote}`
    }

    return title
  }

  const getItemSetsChatName = (options: {
    sourceLabel: string
    championId: number
    position: string
  }) => {
    const { sourceLabel, championId, position } = options

    const championName = lcs.gameData.championName(championId)
    let name = `[${sourceLabel}] ${championName}`

    const hasPosition = position && position !== 'none'
    if (hasPosition) {
      const positionName = t(`opgg.filters.positions.${position}`)
      name += ` - ${positionName || position}`
    }

    return name
  }

  /**
   * 把标准化装备页写入客户端，并沿用现有成功提示和选人聊天通知。
   *
   * @param itemSet 已准备好的数据源、英雄、版本与装备分组。
   * @param meta 当前攻略筛选元数据，用于生成稳定 UID 和可读标题。
   * @returns 写入流程完成后无返回值；失败会记录日志并显示警告，不向 UI 抛出。
   */
  const writeItemSet = async (
    itemSet: GuideItemSet,
    meta: {
      position: string
      mode: string
      region: string
      tier: string
    }
  ) => {
    try {
      const newUid = toItemSetsUid({
        sourceId: itemSet.sourceId,
        championId: itemSet.championId,
        mode: meta.mode,
        region: meta.region,
        tier: meta.tier,
        position: meta.position,
        version: itemSet.version
      })

      await lc.writeItemSetsToDisk([
        {
          uid: newUid,
          title: getItemSetsTitle({
            sourceLabel: itemSet.sourceLabel,
            championId: itemSet.championId,
            mode: meta.mode,
            position: meta.position,
            titleNote: itemSet.titleNote
          }),
          sortrank: 0,
          type: 'global',
          map: 'any',
          mode: 'any',
          blocks: itemSet.itemGroups.map((group) => ({
            type: group.title,
            items: group.items.map((itemId) => ({
              id: restoreRecipe(itemId).toString(),
              count: 1
            }))
          })),
          associatedChampions: itemSet.associatedChampions ?? [],
          associatedMaps: itemSet.associatedMaps ?? [],
          preferredItemSlots: []
        }
      ])

      message.success(t('opgg.champion.writtenToDisk'))

      if (lcs.chat.conversations.championSelect) {
        lc.api.chat
          .chatSend(
            lcs.chat.conversations.championSelect.id,
            t('opgg.champion.writeToDisk', {
              name: getItemSetsChatName({
                sourceLabel: itemSet.sourceLabel,
                championId: itemSet.championId,
                position: meta.position
              })
            }),
            'celebration'
          )
          .catch((error) => {
            log.warn(componentName, 'Failed to send item sets message', error)
          })
      }
    } catch (error) {
      log.warn(componentName, 'write item sets failed', error)

      message.warning(
        t('opgg.champion.writeFileFailedMessage', {
          reason: (error as Error).message
        })
      )
    }
  }

  /**
   * 把 OP.GG 英雄响应转换成标准装备页并写入客户端。
   *
   * @param champion OP.GG 英雄攻略响应。
   * @param meta 当前攻略筛选元数据。
   * @returns 写入流程完成后无返回值；失败策略与 `writeItemSet` 一致。
   */
  const writeItemSets = async (
    champion: OpggChampionBuildResponse,
    meta: {
      position: string
      mode: string
      region: string
      tier: string
    }
  ) => {
    try {
      const itemGroups: Array<{ title: string; items: number[] }> = []
      const championId = champion.data.summary.id

      if (champion.data.starter_items && champion.data.starter_items.length) {
        champion.data.starter_items.slice(0, 3).forEach((s: any, i: number) => {
          itemGroups.push({
            title: t('opgg.champion.starterItem', {
              index: i + 1,
              pickRate: (s.pick_rate * 100).toFixed(2)
            }),
            items: s.ids
          })
        })
      }

      if (champion.data.boots && champion.data.boots.length) {
        itemGroups.push({
          title: t('opgg.champion.bootsDesc'),
          items: champion.data.boots.reduce((acc: number[], cur: any) => {
            acc.push(...cur.ids)
            return acc
          }, [])
        })
      }

      // @ts-ignore
      if (champion.data?.prism_items && champion.data?.prism_items.length) {
        itemGroups.push({
          title: t('opgg.champion.prismItemsDesc'),
          items: champion.data?.prism_items.reduce((acc: number[], cur: any) => {
            acc.push(...cur.ids)
            return acc
          }, [])
        })
      }

      if (champion.data.core_items && champion.data.core_items.length) {
        champion.data.core_items.slice(0, 4).forEach((s: any, i: number) => {
          itemGroups.push({
            title: t('opgg.champion.coreItem', {
              index: i + 1,
              pickRate: (s.pick_rate * 100).toFixed(2)
            }),
            items: s.ids
          })
        })
      }

      if (champion.data.last_items && champion.data.last_items.length) {
        itemGroups.push({
          title: t('opgg.champion.itemsDesc'),
          items: champion.data.last_items.reduce((acc: number[], cur: any) => {
            acc.push(...cur.ids)
            return acc
          }, [])
        })
      }

      await writeItemSet(
        {
          sourceId: 'opgg',
          sourceLabel: 'OP.GG',
          championId,
          version: champion.meta.version,
          itemGroups
        },
        meta
      )
    } catch (error) {
      log.warn(componentName, 'prepare OP.GG item sets failed', error)
      message.warning(
        t('opgg.champion.writeFileFailedMessage', {
          reason: (error as Error).message
        })
      )
    }
  }

  return {
    setSummonerSpells,
    setRunes,
    writeItemSet,
    writeItemSets
  }
}

export function hasItemsSets(champion: OpggChampionBuildResponse) {
  return (
    (champion.data.starter_items && champion.data.starter_items.length) ||
    (champion.data.boots && champion.data.boots.length) ||
    (champion.data.prism_items && champion.data.prism_items.length) ||
    (champion.data.core_items && champion.data.core_items.length) ||
    (champion.data.last_items && champion.data.last_items.length)
  )
}
