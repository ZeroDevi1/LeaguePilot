/**
 * 把 RESG 静态 ESM 数据模块解析为 JSON 值。
 *
 * 上游现在提供 `export default <json>` 的 `.js` 文件，而不是 `.json`。
 * 只接受 JSON 字面量，不执行模块代码。
 *
 * @param source 上游响应正文。
 * @returns 解析后的 JSON 值。
 * @throws 正文不是 `export default` JSON 字面量时抛出错误。
 */
export function parseResgEsmModule(source: string): unknown {
  const trimmed = source.replace(/^\uFEFF/, '').trim()
  const prefix = trimmed.match(/^export\s+default\s+/)
  if (!prefix) {
    throw new Error('RESG module is not an export default JSON payload')
  }

  let payload = trimmed.slice(prefix[0].length).trim()
  if (payload.endsWith(';')) {
    payload = payload.slice(0, -1).trim()
  }

  return JSON.parse(payload)
}

/**
 * 判断上游是否把 SPA HTML 当成数据接口返回。
 *
 * @param body 上游响应正文。
 * @param contentType `Content-Type` 头；缺失时只根据正文判断。
 * @returns 正文或类型表明这是 HTML 文档时返回 `true`。
 */
export function isResgHtmlDocument(body: string, contentType: string | null): boolean {
  if ((contentType ?? '').toLowerCase().includes('text/html')) {
    return true
  }

  const head = body.trimStart().slice(0, 15).toLowerCase()
  return head.startsWith('<!doctype') || head.startsWith('<html')
}
