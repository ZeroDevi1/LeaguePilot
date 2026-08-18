import {
  adaptResgChampionGuide,
  adaptResgChampionIndex,
  adaptResgVersions,
  isResgGuideUsable
} from '@shared/data-adapter/resg'
import type { ResgHttpApiAxiosHelper } from '@shared/http-api-axios-helper/resg'
import type {
  ResgChampionGuide,
  ResgChampionIndexResponse,
  ResgVersionItem
} from '@shared/types/resg'

/** RESG 列表和单英雄详情内存缓存的有效期。 */
const DATA_CACHE_TTL_MS = 30 * 60 * 1000
/** RESG 版本索引的有效期。 */
const VERSION_CACHE_TTL_MS = 15 * 60 * 1000
/** 连续 RESG HTTP 请求之间的最小间隔。 */
const REQUEST_INTERVAL_MS = 500

/** RESG 查询选项。 */
export interface ResgLoadOptions {
  /** 调用方取消信号；切换来源、版本或英雄时必须透传。 */
  signal?: AbortSignal
  /** 是否绕过对应的短期内存缓存。 */
  force?: boolean
}

/** 带写入时间的通用内存缓存项。 */
interface TimedValue<T> {
  /** 已解析的数据。 */
  value: T
  /** 写入缓存时的 Unix 毫秒时间。 */
  cachedAt: number
}

/**
 * 为攻略窗口加载 RESG 版本、英雄列表和单英雄详情。
 *
 * Loader 负责请求节流、短期内存缓存和详情标准化；只会按当前 provider 状态请求一个版本或一个英雄。
 */
export class ResgGuideLoader {
  /** RESG 版本索引缓存。 */
  private _versionsCache: TimedValue<ResgVersionItem[]> | null = null
  /** 按版本保存的英雄列表缓存。 */
  private readonly _championsCache = new Map<string, TimedValue<ResgChampionIndexResponse>>()
  /** 按 `版本:英雄 ID` 保存的标准化攻略缓存。 */
  private readonly _guideCache = new Map<string, TimedValue<ResgChampionGuide>>()
  /** 最近一次实际发出 RESG HTTP 请求的时间。 */
  private _lastRequestAt = 0

  /**
   * 创建 RESG loader。
   *
   * @param api RESG HTTP 客户端。
   */
  constructor(private readonly _api: ResgHttpApiAxiosHelper) {}

  /**
   * 加载 RESG 已发布版本。
   *
   * @param options 缓存和取消选项。
   * @returns 经运行时校验的版本索引。
   * @throws 网络失败、取消或响应中没有合法版本时抛出错误。
   */
  async loadVersions(options: ResgLoadOptions = {}): Promise<ResgVersionItem[]> {
    if (
      !options.force &&
      this._versionsCache &&
      Date.now() - this._versionsCache.cachedAt < VERSION_CACHE_TTL_MS
    ) {
      return this._versionsCache.value
    }

    await this._pace(options.signal)
    const { data } = await this._api.getVersions({ signal: options.signal })
    const versions = adaptResgVersions(data)
    if (versions.length === 0) {
      throw new Error('RESG returned no usable data version')
    }

    this._versionsCache = { value: versions, cachedAt: Date.now() }
    return versions
  }

  /**
   * 加载一个 RESG 版本的英雄列表。
   *
   * @param version RESG 已发布的主次版本号。
   * @param options 缓存和取消选项。
   * @returns 经运行时校验的对应版本英雄列表。
   * @throws 版本非法、网络失败、取消或列表结构无效时抛出错误。
   */
  async loadChampions(
    version: string,
    options: ResgLoadOptions = {}
  ): Promise<ResgChampionIndexResponse> {
    this._assertVersion(version)
    const cached = this._championsCache.get(version)
    if (!options.force && cached && Date.now() - cached.cachedAt < DATA_CACHE_TTL_MS) {
      return cached.value
    }

    await this._pace(options.signal)
    const { data } = await this._api.getChampions(version, { signal: options.signal })
    const championIndex = adaptResgChampionIndex(data)
    if (!championIndex) {
      throw new Error('RESG returned no usable champion index')
    }

    this._championsCache.set(version, { value: championIndex, cachedAt: Date.now() })
    return championIndex
  }

  /**
   * 加载并标准化一个英雄的 RESG 攻略。
   *
   * @param version RESG 已发布的主次版本号。
   * @param championId Riot 英雄数字 ID，必须为正整数。
   * @param options 缓存和取消选项。
   * @returns 可用的 RESG 英雄攻略。
   * @throws 版本或英雄 ID 非法、请求被取消、响应英雄不匹配或详情为空时抛出错误。
   */
  async loadChampion(
    version: string,
    championId: number,
    options: ResgLoadOptions = {}
  ): Promise<ResgChampionGuide> {
    this._assertVersion(version)
    if (!Number.isInteger(championId) || championId <= 0) {
      throw new Error(`Invalid RESG champion id: ${championId}`)
    }

    const cacheKey = `${version}:${championId}`
    const cached = this._guideCache.get(cacheKey)
    if (!options.force && cached && Date.now() - cached.cachedAt < DATA_CACHE_TTL_MS) {
      return cached.value
    }

    await this._pace(options.signal)
    const { data } = await this._api.getChampion(version, championId, {
      signal: options.signal
    })
    const guide = adaptResgChampionGuide(data, version)

    if (!guide || guide.champion.id !== championId) {
      throw new Error('RESG returned a mismatched champion detail')
    }
    if (!isResgGuideUsable(guide)) {
      throw new Error('RESG has no usable guide data for this champion')
    }

    this._guideCache.set(cacheKey, { value: guide, cachedAt: Date.now() })
    return guide
  }

  /**
   * 校验版本参数，防止无效路径进入缓存或代理层。
   *
   * @param version 待校验主次版本号。
   * @returns 校验成功后无返回值。
   * @throws 版本格式不合法时抛出错误。
   */
  private _assertVersion(version: string): void {
    if (!/^\d+(?:\.\d+)*$/.test(version)) {
      throw new Error(`Invalid RESG version: ${version}`)
    }
  }

  /**
   * 在请求前等待最小间隔，同时响应调用方取消。
   *
   * @param signal 可选取消信号；取消时 Promise 以 `AbortError` 拒绝。
   * @returns 等待完成后无返回值。
   */
  private async _pace(signal?: AbortSignal): Promise<void> {
    const waitMs = Math.max(0, REQUEST_INTERVAL_MS - (Date.now() - this._lastRequestAt))
    if (waitMs > 0) {
      await abortableDelay(waitMs, signal)
    }
    this._lastRequestAt = Date.now()
  }
}

/**
 * 创建可被 `AbortSignal` 中止的延迟。
 *
 * @param milliseconds 等待毫秒数，必须为非负数。
 * @param signal 可选取消信号。
 * @returns 延迟结束时完成；取消时以 `AbortError` 拒绝。
 */
function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('The operation was aborted', 'AbortError'))
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)

    const onAbort = () => {
      clearTimeout(timeout)
      reject(new DOMException('The operation was aborted', 'AbortError'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
