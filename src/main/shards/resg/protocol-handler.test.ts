import { describe, expect, it, vi } from 'vitest'

import { handleResgProtocolRequest } from './protocol-handler'

describe('RESG protocol allowlist', () => {
  it('proxies an allowed version module as JSON without forwarding arbitrary headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('export default [{"version":"16.16","collectedAt":"2026-08-20T00:00:00Z"}]', {
        headers: { 'Content-Type': 'application/javascript' }
      })
    )
    const signal = new AbortController().signal

    const response = await handleResgProtocolRequest(
      new Request('akari://resg/api/v1/versions.js', {
        headers: { Authorization: 'secret' }
      }),
      signal,
      fetcher
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual([
      { version: '16.16', collectedAt: '2026-08-20T00:00:00Z' }
    ])
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith(new URL('https://www.resg.top/api/v1/versions.js'), {
      method: 'GET',
      headers: { Accept: 'application/javascript' },
      redirect: 'manual',
      signal
    })
  })

  it.each([
    'akari://resg/api/v1/versions.json',
    'akari://resg/api/v1/versions.js?target=http://127.0.0.1',
    'akari://resg/api/v1/versions/16.16/champions/-1.js',
    'akari://resg/api/v1/versions/16.16/champions/1/extra.js',
    'akari://resg/api/v1/versions/16.16/champions/1.json',
    'akari://resg/api/v2/versions.js'
  ])('rejects a non-allowlisted URL: %s', async (requestUrl) => {
    const fetcher = vi.fn()

    const response = await handleResgProtocolRequest(new Request(requestUrl), undefined, fetcher)

    expect(response.status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects non-GET methods', async () => {
    const fetcher = vi.fn()

    const response = await handleResgProtocolRequest(
      new Request('akari://resg/api/v1/versions.js', { method: 'POST' }),
      undefined,
      fetcher
    )

    expect(response.status).toBe(405)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not expose an upstream redirect to the renderer', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: 'http://127.0.0.1/admin' }
      })
    )

    const response = await handleResgProtocolRequest(
      new Request('akari://resg/api/v1/versions.js'),
      undefined,
      fetcher
    )

    expect(response.status).toBe(502)
    expect(response.headers.get('Location')).toBeNull()
  })

  it('rejects SPA HTML fallbacks that replace missing JSON files', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('<!doctype html><title>RESG</title>', {
        headers: { 'Content-Type': 'text/html' }
      })
    )

    const response = await handleResgProtocolRequest(
      new Request('akari://resg/api/v1/versions.js'),
      undefined,
      fetcher
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe('Upstream HTML fallback rejected')
  })

  it('rejects executable or malformed upstream modules', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('export default window.payload', {
        headers: { 'Content-Type': 'application/javascript' }
      })
    )

    const response = await handleResgProtocolRequest(
      new Request('akari://resg/api/v1/versions.js'),
      undefined,
      fetcher
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe('Upstream module is not JSON')
  })
})
