import { describe, expect, it, vi } from 'vitest'

import { handleResgProtocolRequest } from './protocol-handler'

describe('RESG protocol allowlist', () => {
  it('proxies an allowed version index without forwarding arbitrary headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([{ version: '16.16' }]))
    const signal = new AbortController().signal

    const response = await handleResgProtocolRequest(
      new Request('akari://resg/api/v1/versions.json', {
        headers: { Authorization: 'secret' }
      }),
      signal,
      fetcher
    )

    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledWith(new URL('https://www.resg.top/api/v1/versions.json'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal
    })
  })

  it.each([
    'akari://resg/api/v1/versions.json?target=http://127.0.0.1',
    'akari://resg/api/v1/versions/16.16/champions/-1.json',
    'akari://resg/api/v1/versions/16.16/champions/1/extra.json',
    'akari://resg/api/v2/versions.json'
  ])('rejects a non-allowlisted URL: %s', async (requestUrl) => {
    const fetcher = vi.fn()

    const response = await handleResgProtocolRequest(new Request(requestUrl), undefined, fetcher)

    expect(response.status).toBe(404)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects non-GET methods', async () => {
    const fetcher = vi.fn()

    const response = await handleResgProtocolRequest(
      new Request('akari://resg/api/v1/versions.json', { method: 'POST' }),
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
      new Request('akari://resg/api/v1/versions.json'),
      undefined,
      fetcher
    )

    expect(response.status).toBe(502)
    expect(response.headers.get('Location')).toBeNull()
  })
})
