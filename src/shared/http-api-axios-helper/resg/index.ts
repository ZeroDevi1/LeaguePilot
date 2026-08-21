import type {
  ResgChampionIndexResponse,
  ResgChampionResponse,
  ResgVersionItem
} from '@shared/types/resg'
import type { AxiosInstance } from 'axios'

import type { HttpApiRequestOptions } from '../request-options'

/**
 * RESG 公共英雄攻略 API 客户端。
 *
 * 该客户端只负责 HTTP 传输，不处理缓存、限频、版本选择或响应转换。
 */
export class ResgHttpApiAxiosHelper {
  /**
   * 创建 RESG API 客户端。
   *
   * @param httpClient 已绑定到受限 `akari://resg/api/v1` 代理的 Axios 实例。
   */
  constructor(private readonly _httpClient: AxiosInstance) {
    if (_httpClient.defaults.baseURL !== 'akari://resg/api/v1') {
      throw new Error('RESG HTTP client must use the restricted akari://resg/api/v1 proxy')
    }
  }

  /**
   * 获取 RESG 已发布的数据版本。
   *
   * @param options 请求选项；`signal` 用于在英雄或模式切换时取消请求。
   * @returns Axios 响应，数据为 RESG 版本数组；网络和非 2xx 错误由 Axios 抛出。
   */
  getVersions(options: HttpApiRequestOptions = {}) {
    return this._httpClient.get<ResgVersionItem[]>('/versions.js', {
      signal: options.signal
    })
  }

  /**
   * 获取指定版本的 RESG 英雄列表。
   *
   * @param version RESG 已发布的主次版本号，例如 `16.16`。
   * @param options 请求选项；`signal` 用于在来源或版本切换时取消请求。
   * @returns Axios 响应，数据为 RESG 英雄列表；网络和非 2xx 错误由 Axios 抛出。
   */
  getChampions(version: string, options: HttpApiRequestOptions = {}) {
    return this._httpClient.get<ResgChampionIndexResponse>(
      `/versions/${encodeURIComponent(version)}/champions.js`,
      { signal: options.signal }
    )
  }

  /**
   * 获取指定版本和英雄的 RESG 攻略详情。
   *
   * @param version RESG 已发布的主次版本号，例如 `16.16`。
   * @param championId Riot 英雄数字 ID，必须为正整数。
   * @param options 请求选项；`signal` 用于在英雄或模式切换时取消请求。
   * @returns Axios 响应，数据为 RESG 英雄详情；网络和非 2xx 错误由 Axios 抛出。
   */
  getChampion(version: string, championId: number, options: HttpApiRequestOptions = {}) {
    return this._httpClient.get<ResgChampionResponse>(
      `/versions/${encodeURIComponent(version)}/champions/${championId}.js`,
      { signal: options.signal }
    )
  }
}
