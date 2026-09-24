import { TimeoutTask } from '@main/utils/timer'
import { adaptArammetaHexCatalog } from '@shared/data-adapter/arammeta'

import {
  ARAMMETA_HEX_CATALOG_UPDATE_INTERVAL,
  type ExtraAssetsMainContext,
  GTIMG_HERO_LIST_UPDATE_INTERVAL,
  GTIMG_KIWI_AUGMENTS_UPDATE_INTERVAL,
  OPGG_ARAM_BALANCE_UPDATE_INTERVAL
} from './context'

export class ExtraAssetsRefreshController {
  private _gtimgTask = new TimeoutTask(this._updateGtimgHeroList.bind(this))
  private _gtimgKiwiAugmentsTask = new TimeoutTask(this._updateGtimgKiwiAugments.bind(this))
  private _opggAramBalanceTask = new TimeoutTask(this._updateOpggAramBalance.bind(this))
  private _arammetaHexCatalogTask = new TimeoutTask(this._updateArammetaHexCatalog.bind(this))

  constructor(private readonly context: ExtraAssetsMainContext) {}

  start() {
    void this._updateGtimgHeroList()
    void this._updateGtimgKiwiAugments()
    void this._updateOpggAramBalance()
    void this._updateArammetaHexCatalog()
  }

  private async _updateGtimgHeroList() {
    const { gtimg, gtimgApi, logger } = this.context

    try {
      logger.info('Gtimg: updating "hero_list"')
      const heroList = await gtimgApi.getHeroList()
      gtimg.setHeroList(heroList)
    } catch (error) {
      logger.warn(`Gtimg: failed to update hero list, will retry`, error)
    } finally {
      this._gtimgTask.start({ delay: GTIMG_HERO_LIST_UPDATE_INTERVAL })
    }
  }

  private async _updateGtimgKiwiAugments() {
    const { gtimg, gtimgApi, logger } = this.context

    try {
      logger.info('Gtimg: updating "kiwi_augments"')
      const kiwiAugments = await gtimgApi.getKiwiAugments()
      gtimg.setKiwiAugments(kiwiAugments)
    } catch (error) {
      logger.warn('Gtimg: failed to update kiwi augments', error)
    } finally {
      this._gtimgKiwiAugmentsTask.start({
        delay: GTIMG_KIWI_AUGMENTS_UPDATE_INTERVAL
      })
    }
  }

  private async _updateOpggAramBalance() {
    const { logger, opgg, opggApi } = this.context

    try {
      logger.info('OP.GG: updating ARAM balance data')
      const { data } = await opggApi.getAramBalance()
      opgg.setAramBalance(data.data)
      logger.info(`OP.GG: updated ARAM balance data (${data.data.length} items)`)
    } catch (error) {
      logger.warn('OP.GG: failed to update ARAM balance data', error)
    } finally {
      this._opggAramBalanceTask.start({ delay: OPGG_ARAM_BALANCE_UPDATE_INTERVAL })
    }
  }

  private async _updateArammetaHexCatalog() {
    const { arammeta, arammetaApi, logger } = this.context

    try {
      logger.info('arammeta: updating Mayhem hex catalog')
      const catalog = adaptArammetaHexCatalog(await arammetaApi.getTierList())
      if (!catalog) {
        throw new Error('arammeta returned no usable hex catalog')
      }

      arammeta.setHexCatalog(catalog)
      logger.info(
        `arammeta: updated Mayhem hex catalog (${Object.keys(catalog.champions).length} champions)`
      )
    } catch (error) {
      logger.warn('arammeta: failed to update Mayhem hex catalog', error)
    } finally {
      this._arammetaHexCatalogTask.start({ delay: ARAMMETA_HEX_CATALOG_UPDATE_INTERVAL })
    }
  }
}
