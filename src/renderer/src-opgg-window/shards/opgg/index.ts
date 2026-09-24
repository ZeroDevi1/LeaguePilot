import { AkariProtocolRenderer } from '@renderer-shared/shards/akari-protocol'
import { LeagueClientRenderer } from '@renderer-shared/shards/league-client'
import { LoggerRenderer } from '@renderer-shared/shards/logger'
import { SettingUtilsRenderer } from '@renderer-shared/shards/setting-utils'
import { Dep, Shard } from '@shared/akari-shard'
import { ResgHttpApiAxiosHelper } from '@shared/http-api-axios-helper/resg'
import axios from 'axios'

import {
  OPGG_RENDERER_NAMESPACE,
  type OpggPreferenceUpdate,
  type OpggRendererContext
} from './context'
import { OpggWatcher } from './opgg-watcher'
import { OpggPreferencesService } from './preferences-service'
import { ResgGuideLoader, ResgLoadOptions } from './resg-guide-loader'
import { syncOpggSettings } from './settings-sync'

@Shard(OpggRenderer.id)
export class OpggRenderer {
  static id = OPGG_RENDERER_NAMESPACE

  /**
   * 通过 main 进程受限代理访问 RESG 的 Axios 实例。
   *
   * OP.GG / 101 数据已迁移到 main 进程的 champion-data 服务；RESG 仍走 renderer 侧的
   * `akari://resg` 代理，因为其静态 ESM 模块需要由 main 进程按固定路径白名单转发。
   */
  private readonly _resgHttpClient = axios.create({
    baseURL: 'akari://resg/api/v1',
    adapter: 'fetch'
  })

  /** RESG 公共 API 客户端。 */
  private readonly _resgApi = new ResgHttpApiAxiosHelper(this._resgHttpClient)

  /** renderer shard 共享依赖。 */
  private readonly _context: OpggRendererContext
  /** OP.GG 偏好持久化服务。 */
  private readonly _preferencesService: OpggPreferencesService
  /** OP.GG 窗口生命周期监听器。 */
  private readonly _watcher: OpggWatcher
  /** RESG 单英雄查询、限频和缓存入口。 */
  private readonly _resgGuideLoader = new ResgGuideLoader(this._resgApi)

  constructor(
    @Dep(SettingUtilsRenderer) private readonly _settingUtils: SettingUtilsRenderer,
    @Dep(LeagueClientRenderer) private readonly _leagueClient: LeagueClientRenderer,
    @Dep(AkariProtocolRenderer) private readonly _akariProtocol: AkariProtocolRenderer,
    @Dep(LoggerRenderer) private readonly _logger: LoggerRenderer
  ) {
    this._akariProtocol.installProxyRequestCancellation(this._resgHttpClient)
    this._context = {
      settingUtils: this._settingUtils,
      leagueClient: this._leagueClient,
      logger: this._logger
    }
    this._preferencesService = new OpggPreferencesService(this._context)
    this._watcher = new OpggWatcher(this._context)
  }

  async onInit() {
    await syncOpggSettings(this._context)
    await this._preferencesService.migrate()
    await this._preferencesService.restore()
    this._watcher.start()
  }

  async updatePreferences(options: OpggPreferenceUpdate) {
    return this._preferencesService.update(options)
  }

  /**
   * 加载 RESG 数据版本。
   *
   * @param options 请求取消和强制刷新选项。
   * @returns RESG 已发布版本索引。
   */
  async loadResgVersions(options: ResgLoadOptions = {}) {
    return this._resgGuideLoader.loadVersions(options)
  }

  /**
   * 加载指定 RESG 版本的英雄列表。
   *
   * @param version RESG 主次版本号。
   * @param options 请求取消和强制刷新选项。
   * @returns 对应版本的英雄列表响应。
   */
  async loadResgChampions(version: string, options: ResgLoadOptions = {}) {
    return this._resgGuideLoader.loadChampions(version, options)
  }

  /**
   * 按版本和英雄实时加载 RESG 攻略。
   *
   * @param version RESG 主次版本号。
   * @param championId Riot 英雄数字 ID，必须为正整数。
   * @param options 请求取消和强制刷新选项。
   * @returns 标准化后的 RESG 英雄攻略；失败和取消由 Promise 向调用方传递。
   */
  async loadResgChampion(version: string, championId: number, options: ResgLoadOptions = {}) {
    return this._resgGuideLoader.loadChampion(version, championId, options)
  }
}
