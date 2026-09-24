import type { AxiosInstance } from 'axios'
import { AxiosRetry } from 'axios-retry'

const axiosRetry = require('axios-retry').default as AxiosRetry

/**
 * arammeta 公开静态数据客户端。
 *
 * 只负责拉取 GitHub Pages 上的 tier-list JSON，不处理校验或裁剪。
 * HTTP 传输由调用方注入（main 进程通过 `NetworkMain.createAxiosClient` 创建），
 * 这样代理策略与其余应用请求保持一致。
 */
export class ArammetaApi {
  static BASE_URL = 'https://arammeta.com/'

  static USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'

  get http() {
    return this._http
  }

  /**
   * @param _http 已配置 `baseURL` 与 `User-Agent` 的 Axios 实例。
   */
  constructor(private readonly _http: AxiosInstance) {
    axiosRetry(this._http, {
      retries: 2
    })
  }

  /**
   * 获取 arammeta 当前发布的 Mayhem 聚合 payload。
   *
   * @returns 未经信任的 JSON 正文。
   */
  async getTierList(): Promise<unknown> {
    const { data } = await this._http.get<unknown>('/api/tier-list.json')
    return data
  }
}
