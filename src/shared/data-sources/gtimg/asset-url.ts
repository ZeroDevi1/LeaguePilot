/**
 * gtimg 图标地址处理。
 *
 * 独立成纯模块是因为 renderer 也需要使用，而 `./index.ts` 依赖 `require('axios-retry')`，
 * 只能在 main 进程加载。
 */

/**
 * 把 gtimg 相对/协议相对图标路径收成可请求的绝对 URL。
 */
export function resolveGtimgAssetUrl(icon: string): string | null {
  const trimmed = icon.trim()
  if (!trimmed) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  return `https://game.gtimg.cn/${trimmed.replace(/^\//, '')}`
}
