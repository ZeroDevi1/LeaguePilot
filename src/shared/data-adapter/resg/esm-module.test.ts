import { describe, expect, it } from 'vitest'

import { isResgHtmlDocument, parseResgEsmModule } from './esm-module'

describe('RESG ESM module parser', () => {
  it('parses JSON array and object export default payloads', () => {
    expect(
      parseResgEsmModule(`
export default [
  {
    "version": "16.16",
    "collectedAt": "2026-08-20T04:41:44.106Z"
  }
]
`)
    ).toEqual([{ version: '16.16', collectedAt: '2026-08-20T04:41:44.106Z' }])

    expect(parseResgEsmModule('\uFEFFexport default {"id":1};')).toEqual({ id: 1 })
  })

  it('rejects executable or malformed modules', () => {
    expect(() => parseResgEsmModule('export const versions = []')).toThrow()
    expect(() => parseResgEsmModule('export default foo')).toThrow()
    expect(() => parseResgEsmModule('{"version":"16.16"}')).toThrow()
  })

  it('detects SPA HTML fallbacks even when the content type is missing', () => {
    expect(isResgHtmlDocument('<!doctype html><html lang="zh-CN">', null)).toBe(true)
    expect(isResgHtmlDocument('export default []', 'text/html; charset=utf-8')).toBe(true)
    expect(isResgHtmlDocument('export default []', 'application/javascript')).toBe(false)
  })
})
