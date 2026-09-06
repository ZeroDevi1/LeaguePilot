import { afterEach, describe, expect, it, vi } from 'vitest'

import { handleResgProtocolRequest } from './protocol-handler'

const ENTRY = 'https://www.bilibili.com/toy/resg/index.html'
const RELEASE = 'https://www.bilibilitoy.com/toy/resg/19226257645568-v12014/'

/** 模拟固定入口与发布目录，错误拼接路径不会得到数据。 */
function createUpstream() {
  const state = {
    release: RELEASE,
    entryStatus: 200,
    dataStatus: 200,
    body: 'export default {"id":1}'
  }
  const fetcher = vi.fn(async (url: URL, init: RequestInit) => {
    if (init.signal?.aborted) throw init.signal.reason
    if (url.href === ENTRY) {
      return new Response(`<iframe src="${state.release}index.html"></iframe>`, {
        status: state.entryStatus
      })
    }
    if (!url.href.startsWith(`${state.release}api/v1/`)) return new Response(null, { status: 404 })
    return new Response(state.body, { status: state.dataStatus })
  })
  return { state, fetcher }
}

afterEach(() => vi.restoreAllMocks())

describe('RESG protocol allowlist', () => {
  it('discovers the release prefix for all three data routes without forwarding credentials', async () => {
    const { fetcher } = createUpstream()
    for (const path of [
      'versions.js',
      'versions/16.17/champions.js',
      'versions/16.17/champions/1.js'
    ]) {
      const response = await handleResgProtocolRequest(
        new Request(`akari://resg/api/v1/${path}`, { headers: { Authorization: 'secret' } }),
        undefined,
        fetcher
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')
      await expect(response.json()).resolves.toEqual({ id: 1 })
    }
    expect(fetcher.mock.calls.filter(([url]) => url.href === ENTRY)).toHaveLength(1)
    for (const [, options] of fetcher.mock.calls) {
      expect(new Headers(options.headers).has('Authorization')).toBe(false)
      expect(options.redirect).toBe('manual')
    }
  })

  it.each([
    'akari://other/api/v1/versions.js',
    'akari://resg/api/v1/versions.json',
    'akari://resg/api/v1/versions.js?target=http://127.0.0.1',
    'akari://resg/api/v1/versions/16.16/champions/-1.js',
    'akari://resg/api/v1/versions/16.16/champions/1/extra.js',
    'akari://resg/api/v1/versions/16.16/champions/1.json',
    'akari://resg/api/v2/versions.js'
  ])('rejects a non-allowlisted URL: %s', async (url) => {
    const { fetcher } = createUpstream()
    expect((await handleResgProtocolRequest(new Request(url), undefined, fetcher)).status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects non-GET methods before resolving the release', async () => {
    const { fetcher } = createUpstream()
    const response = await handleResgProtocolRequest(
      new Request('akari://resg/api/v1/versions.js', { method: 'POST' }),
      undefined,
      fetcher
    )
    expect(response.status).toBe(405)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([
    'http://127.0.0.1/admin',
    'https://www.bilibilitoy.com.evil.test/toy/resg/1-v2/index.html',
    'https://user:secret@www.bilibilitoy.com/toy/resg/1-v2/index.html',
    'https://www.bilibilitoy.com/toy/other/1-v2/index.html',
    'https://www.bilibilitoy.com/toy/resg/1-v2/index.html?target=evil',
    'https://www.bilibilitoy.com:444/toy/resg/1-v2/index.html'
  ])('rejects an untrusted release without requesting it: %s', async (src) => {
    const fetcher = vi.fn(async () => new Response(`<iframe src="${src}"></iframe>`))
    const response = await handleResgProtocolRequest(
      new Request('akari://resg/api/v1/versions.js'),
      undefined,
      fetcher
    )
    expect(response.status).toBe(502)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it.each(['entry', 'data'] as const)('does not expose or follow a %s redirect', async (stage) => {
    const fetcher = vi.fn(async (url: URL) => {
      if (stage === 'data' && url.href === ENTRY)
        return new Response(`<iframe src="${RELEASE}index.html"></iframe>`)
      return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/admin' } })
    })
    const response = await handleResgProtocolRequest(
      new Request('akari://resg/api/v1/versions.js'),
      undefined,
      fetcher
    )
    expect(response.status).toBe(502)
    expect(response.headers.get('Location')).toBeNull()
    expect(fetcher.mock.calls.every(([url]) => url.hostname !== '127.0.0.1')).toBe(true)
  })

  it.each(['<!doctype html><title>RESG</title>', 'export default window.payload'])(
    'rejects non-data modules',
    async (body) => {
      const { fetcher, state } = createUpstream()
      state.body = body
      const response = await handleResgProtocolRequest(
        new Request('akari://resg/api/v1/versions.js'),
        undefined,
        fetcher
      )
      expect(response.status).toBe(502)
    }
  )

  it('resolves a new deployment after cache expiry', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0)
    const { fetcher, state } = createUpstream()
    const request = new Request('akari://resg/api/v1/versions.js')
    expect((await handleResgProtocolRequest(request, undefined, fetcher)).status).toBe(200)
    clock.mockReturnValue(15 * 60 * 1000)
    state.release = RELEASE.replace('v12014', 'v12015')
    state.body = 'export default {"id":2}'
    const response = await handleResgProtocolRequest(request, undefined, fetcher)
    await expect(response.json()).resolves.toEqual({ id: 2 })
  })

  it('does not cache entry failures and invalidates removed deployments', async () => {
    const { fetcher, state } = createUpstream()
    const request = new Request('akari://resg/api/v1/versions.js')
    state.entryStatus = 503
    expect((await handleResgProtocolRequest(request, undefined, fetcher)).status).toBe(502)
    state.entryStatus = 200
    expect((await handleResgProtocolRequest(request, undefined, fetcher)).status).toBe(200)
    state.dataStatus = 404
    expect((await handleResgProtocolRequest(request, undefined, fetcher)).status).toBe(404)
    state.release = RELEASE.replace('v12014', 'v12015')
    state.dataStatus = 200
    expect((await handleResgProtocolRequest(request, undefined, fetcher)).status).toBe(200)
  })

  it('propagates cancellation without poisoning subsequent requests', async () => {
    const { fetcher } = createUpstream()
    const controller = new AbortController()
    controller.abort()
    const request = new Request('akari://resg/api/v1/versions.js')
    await expect(
      handleResgProtocolRequest(request, controller.signal, fetcher)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher).not.toHaveBeenCalled()
    expect((await handleResgProtocolRequest(request, undefined, fetcher)).status).toBe(200)
  })
})
