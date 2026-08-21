import { isResgHtmlDocument, parseResgEsmModule } from '@shared/data-adapter/resg/esm-module'

/** RESG 代理允许访问的固定上游根地址。 */
const RESG_API_BASE_URL = 'https://www.resg.top'
/** RESG 版本索引路径。 */
const VERSION_INDEX_PATH = '/api/v1/versions.js'
/** RESG 英雄列表路径。 */
const CHAMPION_INDEX_PATH = /^\/api\/v1\/versions\/\d+(?:\.\d+)*\/champions\.js$/
/** RESG 单英雄详情路径；禁止代理任意上游 URL。 */
const CHAMPION_DETAIL_PATH = /^\/api\/v1\/versions\/\d+(?:\.\d+)*\/champions\/[1-9]\d*\.js$/

/** 可注入的 fetch 子集，仅用于协议边界测试。 */
type Fetcher = (input: URL, init: RequestInit) => Promise<Response>

/**
 * 处理一条受限的 RESG 代理请求。
 *
 * 仅允许三个固定 GET 路径形状，不转发 renderer 请求头或查询参数，也不跟随或暴露上游重定向。
 * 上游提供 ESM JSON 模块；成功响应会被转成 JSON，SPA HTML fallback 会被拒绝。
 *
 * @param request renderer 发起的 `akari://resg` 请求。
 * @param signal main proxy cancellation 提供的取消信号。
 * @param fetcher 上游请求函数；生产环境使用全局 `fetch`，测试可注入替身。
 * @returns JSON 化后的上游数据，或本地生成的 404、405、502 响应。
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
  const path = `${url.pathname}${url.search}`
  if (
    url.search ||
    (url.pathname !== VERSION_INDEX_PATH &&
      !CHAMPION_INDEX_PATH.test(url.pathname) &&
      !CHAMPION_DETAIL_PATH.test(url.pathname))
  ) {
    return new Response('Not Found', { status: 404 })
  }

  const response = await fetcher(new URL(path, RESG_API_BASE_URL), {
    method: 'GET',
    headers: { Accept: 'application/javascript' },
    redirect: 'manual',
    signal
  })

  if (response.status >= 300 && response.status < 400) {
    return new Response('Upstream Redirect Rejected', { status: 502 })
  }

  if (response.status < 200 || response.status >= 300) {
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
