import { isResgHtmlDocument, parseResgEsmModule } from '@shared/data-adapter/resg/esm-module'

/** RESG 稳定入口；内容根由其中的 iframe 声明。 */
const RESG_ENTRY_URL = 'https://www.bilibili.com/toy/resg/index.html'
const RELEASE_CACHE_TTL_MS = 15 * 60 * 1000
/** 当前固定内容页；其目录就是 API 根。 */
const STABLE_RELEASE_PATH = '/toy/resg/index.html'
/** 旧版按发布号分目录的内容页，例如 `/toy/resg/19226257645568-v12014/index.html`。 */
const VERSIONED_RELEASE_PATH = /^\/toy\/resg\/\d+-v\d+\/index\.html$/
/** RESG 版本索引路径。 */
const VERSION_INDEX_PATH = '/api/v1/versions.js'
/** RESG 英雄列表路径。 */
const CHAMPION_INDEX_PATH = /^\/api\/v1\/versions\/\d+(?:\.\d+)*\/champions\.js$/
/** RESG 单英雄详情路径；禁止代理任意上游 URL。 */
const CHAMPION_DETAIL_PATH = /^\/api\/v1\/versions\/\d+(?:\.\d+)*\/champions\/[1-9]\d*\.js$/

/** 可注入的 fetch 子集，仅用于协议边界测试。 */
type Fetcher = (input: URL, init: RequestInit) => Promise<Response>

/** 按传输实例隔离缓存；不共享取消信号或正在执行的请求。 */
const releaseCache = new WeakMap<Fetcher, { baseUrl: URL; expiresAt: number }>()

/**
 * 判断 iframe 地址是否是允许代理的 RESG 内容页。
 *
 * 只接受 `bilibilitoy.com` 上的固定内容根，以及旧的版本化发布目录。
 * 用户名、查询参数、哈希和非默认端口都会使 `origin` 或路径不匹配，从而拒绝。
 *
 * @param url 从入口 HTML 中读到的绝对 iframe 地址。
 * @returns 地址落在允许的内容页上时返回 `true`。
 */
function isTrustedReleasePage(url: URL): boolean {
  return (
    url.origin === 'https://www.bilibilitoy.com' &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    (url.pathname === STABLE_RELEASE_PATH || VERSIONED_RELEASE_PATH.test(url.pathname))
  )
}

/**
 * 从固定入口解析受限内容根，不执行 HTML 或脚本。
 * 仅缓存成功结果；网络与取消错误透传，入口失效或结构不符返回 null。
 */
async function resolveReleaseUrl(fetcher: Fetcher, signal?: AbortSignal): Promise<URL | null> {
  const cached = releaseCache.get(fetcher)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.baseUrl
  }

  const response = await fetcher(new URL(RESG_ENTRY_URL), {
    method: 'GET',
    headers: { Accept: 'text/html' },
    redirect: 'manual',
    signal
  })
  if (!response.ok) {
    await response.body?.cancel()
    return null
  }

  const html = await response.text()
  // 只接受入口实际使用的带引号 iframe src；未知格式明确失败，不猜测资源地址。
  for (const match of html.matchAll(/<iframe\b[^>]*?\s+src\s*=\s*(["'])(.*?)\1/gi)) {
    let url: URL
    try {
      url = new URL(match[2])
    } catch {
      continue
    }
    if (!isTrustedReleasePage(url)) {
      continue
    }

    const baseUrl = new URL('./', url)
    signal?.throwIfAborted()
    releaseCache.set(fetcher, { baseUrl, expiresAt: Date.now() + RELEASE_CACHE_TTL_MS })
    return baseUrl
  }
  return null
}

/**
 * 处理一条受限的 RESG 代理请求。
 *
 * 仅允许三个固定 GET 路径形状，不转发 renderer 请求头或查询参数，也不跟随或暴露上游重定向。
 * 从 B 站入口发现并短期缓存内容根；上游 ESM JSON 模块转成 JSON，SPA HTML fallback 被拒绝。
 *
 * @param request renderer 发起的 `akari://resg` 请求。
 * @param signal main proxy cancellation 提供的取消信号。
 * @param fetcher 上游请求函数；生产环境使用全局 `fetch`，测试可注入替身。
 * @returns JSON 化后的上游数据，或本地生成的 404、405、502 响应；网络和取消错误透传。
 */
export async function handleResgProtocolRequest(
  request: Request,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch
): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const url = new URL(request.url)
  const path = url.pathname
  if (
    url.hostname !== 'resg' ||
    url.protocol !== 'akari:' ||
    url.search ||
    (url.pathname !== VERSION_INDEX_PATH &&
      !CHAMPION_INDEX_PATH.test(url.pathname) &&
      !CHAMPION_DETAIL_PATH.test(url.pathname))
  ) {
    return new Response('Not Found', { status: 404 })
  }

  signal?.throwIfAborted()
  const baseUrl = await resolveReleaseUrl(fetcher, signal)
  if (!baseUrl) {
    return new Response('Upstream release directory unavailable', { status: 502 })
  }

  // 去掉协议路径的前导斜杠，避免 URL 构造器丢弃发布目录。
  const response = await fetcher(new URL(path.slice(1), baseUrl), {
    method: 'GET',
    headers: { Accept: 'application/javascript' },
    redirect: 'manual',
    signal
  })

  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel()
    return new Response('Upstream Redirect Rejected', { status: 502 })
  }

  if (response.status < 200 || response.status >= 300) {
    if (
      (response.status === 404 || response.status === 410) &&
      releaseCache.get(fetcher)?.baseUrl === baseUrl
    ) {
      releaseCache.delete(fetcher)
    }
    return response
  }

  const body = await response.text()
  if (isResgHtmlDocument(body, response.headers.get('content-type'))) {
    return new Response('Upstream HTML fallback rejected', { status: 502 })
  }

  try {
    return Response.json(parseResgEsmModule(body))
  } catch {
    return new Response('Upstream module is not JSON', { status: 502 })
  }
}
