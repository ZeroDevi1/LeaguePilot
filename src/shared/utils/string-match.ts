import { pinyin } from 'pinyin-pro'

function isSubsequence(s: string, t: string, caseSensitive = false): boolean {
  if (s.length === 0) return true
  if (t.length === 0) return false

  if (!caseSensitive) {
    s = s.toLowerCase()
    t = t.toLowerCase()
  }

  let index = 0
  for (let i = 0; i < t.length && index < s.length; i++) {
    if (s.length - index > t.length - i) return false
    if (s[index] === t[i]) {
      index++
    }
  }
  return index === s.length
}

export function isChampionNameMatch(pattern: string, title: string): boolean {
  if (!title) {
    return false
  }

  if (isSubsequence(pattern, title)) {
    return true
  }

  const titlePinyin = pinyin(title, { separator: '', toneType: 'none' })

  if (isSubsequence(pattern, titlePinyin)) {
    return true
  }

  const patternPinyin = pinyin(pattern, { separator: '', toneType: 'none' })

  if (isSubsequence(patternPinyin, titlePinyin)) {
    return true
  }

  return false
}

export function isChampionNameMatchKeywords(pattern: string, keywords: string[] | string): boolean {
  if (keywords.length === 0) {
    return false
  }

  if (typeof keywords === 'string') {
    return isChampionNameMatch(pattern, keywords)
  }

  if (keywords.some((keyword) => isChampionNameMatch(pattern, keyword))) {
    return true
  }

  return false
}

/**
 * 取名称的拼音首字母，用于和缩写输入比较长度。
 *
 * @param title 待匹配的名称。
 * @returns 无声调、无分隔符的小写首字母串；非中文按 pinyin-pro 的结果处理。
 */
function nameInitials(title: string): string {
  return pinyin(title, { pattern: 'first', toneType: 'none', separator: '' }).toLowerCase()
}

/**
 * 计算单个名称相对输入的排序权重。数值越小越优先；不匹配时返回 `null`。
 *
 * 拼音首字母与输入等长（如 `ys` → 夜狩）排在仅首字拼音相同、但字数更长的名称之前。
 *
 * @param pattern 用户输入，前后空白会被忽略。
 * @param title 候选名称。
 * @returns 匹配权重；名称无法匹配时返回 `null`。
 */
export function rankNameMatch(pattern: string, title: string): number | null {
  const query = pattern.trim().toLowerCase()
  if (!query || !title || !isChampionNameMatch(query, title)) {
    return null
  }

  const initials = nameInitials(title)
  if (initials === query) {
    return 0
  }

  if (initials.startsWith(query)) {
    return 100 + (initials.length - query.length)
  }

  return 1000 + Math.abs(Array.from(title).length - query.length)
}

/**
 * 在多个别名中取最优先的匹配权重。
 *
 * @param pattern 用户输入。
 * @param keywords 同一候选项的中文名、英文名等别名。
 * @returns 最佳匹配权重；全部不匹配时返回 `null`。
 */
export function rankNameMatchKeywords(pattern: string, keywords: string[] | string): number | null {
  const names = typeof keywords === 'string' ? [keywords] : keywords
  let best: number | null = null

  for (const name of names) {
    const rank = rankNameMatch(pattern, name)
    if (rank !== null && (best === null || rank < best)) {
      best = rank
    }
  }

  return best
}
