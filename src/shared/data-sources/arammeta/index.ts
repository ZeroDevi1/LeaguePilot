import axios from 'axios'
import { AxiosRetry } from 'axios-retry'

const axiosRetry = require('axios-retry').default as AxiosRetry

/**
 * arammeta 公开静态数据客户端。
 *
 * 只负责拉取 GitHub Pages 上的 tier-list JSON，不处理校验或裁剪。
 */
export class ArammetaApi {
  static BASE_URL = 'https://arammeta.com/'

  static USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'

  private _http = axios.create({
    headers: {
      'User-Agent': ArammetaApi.USER_AGENT
    },
    baseURL: ArammetaApi.BASE_URL,
    timeout: 30_000
  })

  get http() {
    return this._http
  }

  constructor() {
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
